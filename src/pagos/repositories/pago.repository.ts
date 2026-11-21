import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { ClaveIdempotenciaRepetidaError } from '@Pagos/errors';
import { EstadoCuota, EstadoPago, Prisma, type Pago } from '@PrismaClient';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/** Cuota leída con bloqueo de fila (SELECT … FOR UPDATE). */
export interface CuotaBloqueada {
  id: string;
  unidadId: string;
  periodo: string;
  monto: Prisma.Decimal;
  estado: EstadoCuota;
}

export interface DatosPago {
  unidadId: string;
  residenteId: string;
  monto: Prisma.Decimal;
  ultimos4: string;
  titular: string;
  idempotencyKey: string;
}

/** Operaciones que solo se usan dentro de la transacción del pago. */
export interface TransaccionPago {
  bloquearCuotas(ids: string[]): Promise<CuotaBloqueada[]>;
  findByClave(clave: string): Promise<Pago | null>;
  siguienteNumero(fechaYYYYMMDD: string): Promise<string>;
  crearAprobado(datos: DatosPago, numeroTransaccion: string, cuotas: CuotaBloqueada[]): Promise<Pago>;
  crearRechazado(datos: DatosPago, motivo: string): Promise<Pago>;
  marcarPagadas(ids: string[], pagadaEn: Date): Promise<number>;
}

const INCLUIR_COMPROBANTE = {
  unidad: { select: { codigo: true } },
  cuotas: { select: { monto: true, cuota: { select: { periodo: true } } }, orderBy: { cuota: { periodo: 'asc' } } },
} satisfies Prisma.PagoInclude;

export type PagoConDetalle = Prisma.PagoGetPayload<{ include: typeof INCLUIR_COMPROBANTE }>;

const traducir = (error: unknown, clave: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION
    ? new ClaveIdempotenciaRepetidaError(clave)
    : error;

/** Único punto que habla con `pago` y `pago_cuota`. Sin borrado: es historial contable. */
@Injectable()
export class PagoRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el pago en una transacción. El tiempo de espera cubre los 2 s de
   * la pasarela simulada, que se llama con las cuotas bloqueadas.
   */
  enTransaccion<T>(trabajo: (tx: TransaccionPago) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => trabajo(this.operaciones(tx)), { maxWait: 10_000, timeout: 20_000 });
  }

  findClave(clave: string): Promise<Pago | null> {
    return this.prisma.pago.findUnique({ where: { idempotencyKey: clave } });
  }

  findByNumero(numeroTransaccion: string): Promise<PagoConDetalle | null> {
    return this.prisma.pago.findUnique({ where: { numeroTransaccion }, include: INCLUIR_COMPROBANTE });
  }

  /** Pendientes y vencidas de la unidad, de la más antigua a la más nueva. */
  findPorPagar(unidadId: string) {
    return this.prisma.cuota.findMany({
      where: { unidadId, estado: { in: [EstadoCuota.PENDIENTE, EstadoCuota.VENCIDA] } },
      orderBy: { periodo: 'asc' },
      select: { id: true, periodo: true, monto: true, fechaVencimiento: true, estado: true },
    });
  }

  private operaciones(tx: Prisma.TransactionClient): TransaccionPago {
    return {
      // Orden por id: dos pagos con cuotas en común las bloquean en el mismo orden (sin interbloqueo).
      bloquearCuotas: async (ids) => {
        const filas = await tx.$queryRaw<(Omit<CuotaBloqueada, 'monto'> & { monto: string })[]>`
          SELECT id::text AS id, unidad_id::text AS "unidadId", periodo, monto::text AS monto, estado::text AS estado
          FROM cuota
          WHERE id = ANY(${ids}::uuid[])
          ORDER BY id
          FOR UPDATE`;
        // El monto viaja como texto para no perder precisión: se convierte a Decimal aquí.
        return filas.map((f) => ({ ...f, monto: new Prisma.Decimal(f.monto) }));
      },

      findByClave: (clave) => tx.pago.findUnique({ where: { idempotencyKey: clave } }),

      siguienteNumero: async (fecha) => {
        const [{ n }] = await tx.$queryRaw<{ n: number }[]>`SELECT nextval('pago_transaccion_seq')::int AS n`;
        return `TX-${fecha}-${String(n).padStart(6, '0')}`;
      },

      crearAprobado: async (datos, numeroTransaccion, cuotas) => {
        try {
          return await tx.pago.create({
            data: {
              ...datos,
              numeroTransaccion,
              estado: EstadoPago.APROBADO,
              cuotas: { create: cuotas.map((c) => ({ cuotaId: c.id, monto: c.monto })) },
            },
          });
        } catch (error) {
          throw traducir(error, datos.idempotencyKey);
        }
      },

      crearRechazado: async (datos, motivo) => {
        try {
          return await tx.pago.create({ data: { ...datos, estado: EstadoPago.RECHAZADO, motivo } });
        } catch (error) {
          throw traducir(error, datos.idempotencyKey);
        }
      },

      marcarPagadas: async (ids, pagadaEn) => {
        const { count } = await tx.cuota.updateMany({
          where: { id: { in: ids }, estado: { not: EstadoCuota.PAGADA } },
          data: { estado: EstadoCuota.PAGADA, pagadaEn },
        });
        return count;
      },
    };
  }
}
