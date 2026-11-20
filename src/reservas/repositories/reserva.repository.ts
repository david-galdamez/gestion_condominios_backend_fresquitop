import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { ReservaHorarioOcupadoError } from '@Reservas/errors';
import { EstadoReserva, Prisma } from '@PrismaClient';

const INCLUIR_DETALLE = {
  area: { select: { nombre: true } },
  unidad: { select: { id: true, codigo: true } },
} satisfies Prisma.ReservaInclude;

export type ReservaConDetalle = Prisma.ReservaGetPayload<{ include: typeof INCLUIR_DETALLE }>;

export type DatosNuevaReserva = Pick<
  Prisma.ReservaUncheckedCreateInput,
  'codigo' | 'areaId' | 'unidadId' | 'residenteId' | 'fecha' | 'horaInicio' | 'horaFin' | 'asistentes'
>;

function esViolacionNoCruce(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error);
  const meta = error instanceof Prisma.PrismaClientKnownRequestError ? JSON.stringify(error.meta ?? {}) : '';
  return /23P01|reserva_no_cruce|exclusion constraint/i.test(`${mensaje} ${meta}`);
}

/** Único punto que accede a `reserva`. La exclusión de PostgreSQL resuelve las carreras concurrentes. */
@Injectable()
export class ReservaRepository {
  constructor(private readonly prisma: PrismaService) {}

  enTransaccion<T>(trabajo: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(trabajo, { maxWait: 10_000, timeout: 20_000 });
  }

  hayCruce(
    tx: Prisma.TransactionClient,
    datos: { areaId: string; fecha: Date; horaInicio: Date; horaFin: Date },
  ): Promise<boolean> {
    return tx.reserva
      .findFirst({
        where: {
          areaId: datos.areaId,
          fecha: datos.fecha,
          estado: EstadoReserva.CONFIRMADA,
          horaInicio: { lt: datos.horaFin },
          horaFin: { gt: datos.horaInicio },
        },
        select: { id: true },
      })
      .then(Boolean);
  }

  async siguienteCodigo(tx: Prisma.TransactionClient): Promise<string> {
    const filas = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('reserva_codigo_seq') AS n`;
    return `RES-${String(filas[0].n).padStart(6, '0')}`;
  }

  async crear(tx: Prisma.TransactionClient, datos: DatosNuevaReserva): Promise<ReservaConDetalle> {
    try {
      return await tx.reserva.create({ data: datos, include: INCLUIR_DETALLE });
    } catch (error) {
      // La consulta previa mejora el mensaje; esta captura traduce la carrera protegida por la DB.
      if (esViolacionNoCruce(error)) throw new ReservaHorarioOcupadoError();
      throw error;
    }
  }

  findByResidente(residenteId: string): Promise<ReservaConDetalle[]> {
    return this.prisma.reserva.findMany({
      where: { residenteId },
      include: INCLUIR_DETALLE,
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });
  }

  findOneDeResidente(id: string, residenteId: string): Promise<ReservaConDetalle | null> {
    return this.prisma.reserva.findFirst({ where: { id, residenteId }, include: INCLUIR_DETALLE });
  }

  async cancelarSiConfirmada(id: string, residenteId: string, canceladaEn: Date): Promise<number> {
    const { count } = await this.prisma.reserva.updateMany({
      where: { id, residenteId, estado: EstadoReserva.CONFIRMADA },
      data: { estado: EstadoReserva.CANCELADA, canceladaEn },
    });
    return count;
  }
}
