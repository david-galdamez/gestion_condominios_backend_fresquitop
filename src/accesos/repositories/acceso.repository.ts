import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import type { AutorizacionConUnidad } from '@Autorizaciones/repositories';
import { EstadoAcceso, EstadoAutorizacion, type Prisma, type TipoDocumento } from '@PrismaClient';

const INCLUIR_UNIDAD = { unidad: { select: { id: true, codigo: true } } } as const;

export type AccesoConUnidad = Prisma.RegistroAccesoGetPayload<{
  include: { unidad: { select: { id: true; codigo: true } } };
}>;

export interface DatosSinCodigo {
  unidadId: string;
  nombre: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  motivo: string;
  entradaPorId: string;
}

/** Resultado de intentar entrar con un código. */
export type EntradaConCodigo =
  | { tipo: 'ok'; acceso: AccesoConUnidad }
  | { tipo: 'no_existe' }
  | { tipo: 'no_vigente'; estado: EstadoAutorizacion }
  | { tipo: 'otra_fecha' };

/** Único punto que habla con `registro_acceso`. Sin borrado: es la bitácora de portería. */
@Injectable()
export class AccesoRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * En una transacción: bloquea la autorización de hoy con ese código
   * (FOR UPDATE), verifica que siga VIGENTE, crea el registro con sus datos y
   * la pasa a USADA. Dos guardias con el mismo código: el segundo ve USADA.
   * `hoy` es "YYYY-MM-DD" en la zona del negocio.
   */
  entrarConCodigo(codigo: string, hoy: string, entradaPorId: string): Promise<EntradaConCodigo> {
    return this.prisma.$transaction(async (tx) => {
      const [fila] = await tx.$queryRaw<{ id: string; estado: EstadoAutorizacion }[]>`
        SELECT id, estado FROM autorizacion_visita
        WHERE codigo = ${codigo} AND fecha_visita = ${hoy}::date
        FOR UPDATE`;

      if (!fila) {
        // Los códigos se reutilizan entre días: se mira la más reciente.
        const otra = await tx.autorizacionVisita.findFirst({
          where: { codigo },
          orderBy: { fechaVisita: 'desc' },
          select: { estado: true },
        });
        if (!otra) return { tipo: 'no_existe' };
        return otra.estado === EstadoAutorizacion.VIGENTE
          ? { tipo: 'otra_fecha' }
          : { tipo: 'no_vigente', estado: otra.estado };
      }
      if (fila.estado !== EstadoAutorizacion.VIGENTE) return { tipo: 'no_vigente', estado: fila.estado };

      const a = await tx.autorizacionVisita.findUniqueOrThrow({ where: { id: fila.id } });
      const acceso = await tx.registroAcceso.create({
        data: {
          autorizacionId: a.id,
          unidadId: a.unidadId,
          nombre: a.nombre,
          tipoDocumento: a.tipoDocumento,
          numeroDocumento: a.numeroDocumento,
          preautorizado: true,
          entradaPorId,
        },
        include: INCLUIR_UNIDAD,
      });
      await tx.autorizacionVisita.update({ where: { id: a.id }, data: { estado: EstadoAutorizacion.USADA } });
      return { tipo: 'ok', acceso };
    });
  }

  entrarSinCodigo(datos: DatosSinCodigo): Promise<AccesoConUnidad> {
    return this.prisma.registroAcceso.create({
      data: { ...datos, preautorizado: false },
      include: INCLUIR_UNIDAD,
    });
  }

  /** Marca la salida solo si sigue DENTRO, en una sentencia. Devuelve filas cambiadas. */
  async marcarSalida(id: string, salidaPorId: string, ahora: Date): Promise<number> {
    const { count } = await this.prisma.registroAcceso.updateMany({
      where: { id, estado: EstadoAcceso.DENTRO },
      data: { estado: EstadoAcceso.SALIO, horaSalida: ahora, salidaPorId },
    });
    return count;
  }

  findById(id: string): Promise<AccesoConUnidad | null> {
    return this.prisma.registroAcceso.findUnique({ where: { id }, include: INCLUIR_UNIDAD });
  }

  /** Visitantes DENTRO por número de documento o por el código con que entraron. */
  findDentro(q: string): Promise<AccesoConUnidad[]> {
    return this.prisma.registroAcceso.findMany({
      where: {
        estado: EstadoAcceso.DENTRO,
        OR: [{ numeroDocumento: q }, { autorizacion: { codigo: q } }],
      },
      include: INCLUIR_UNIDAD,
      orderBy: { horaEntrada: 'desc' },
    });
  }

  /** Autorizaciones de hoy por código o por número de documento (apoyo de portería). */
  findAutorizacionesDeHoy(q: string, hoy: Date): Promise<AutorizacionConUnidad[]> {
    return this.prisma.autorizacionVisita.findMany({
      where: { fechaVisita: hoy, OR: [{ codigo: q }, { numeroDocumento: q }] },
      include: INCLUIR_UNIDAD,
      orderBy: { horaEstimada: 'asc' },
    });
  }
}
