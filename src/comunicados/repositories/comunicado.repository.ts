import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { EstadoComunicado, type CategoriaComunicado, type Comunicado, type Prisma } from '@PrismaClient';

const INCLUIR = {
  destinos: { select: { torre: { select: { id: true, nombre: true } } }, orderBy: { torre: { nombre: 'asc' } } },
  autor: { select: { id: true, nombre: true } },
} satisfies Prisma.ComunicadoInclude;

export type ComunicadoCompleto = Prisma.ComunicadoGetPayload<{ include: typeof INCLUIR }>;

export interface NuevoComunicado {
  titulo: string;
  contenido: string;
  categoria: CategoriaComunicado;
  paraTodos: boolean;
  torreIds: string[];
  fechaPublicacion: Date;
  fechaExpiracion: Date | null;
  estado: EstadoComunicado;
  autorId: string;
}

/** Único punto que habla con `comunicado`, `comunicado_destino` y `lectura_comunicado`. */
@Injectable()
export class ComunicadoRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Cuántas de estas torres existen (para responder 404 si falta alguna). */
  contarTorres(ids: string[]): Promise<number> {
    return this.prisma.torre.count({ where: { id: { in: ids } } });
  }

  /** Comunicado y destinos en una sola transacción (create anidado). */
  create({ torreIds, ...data }: NuevoComunicado): Promise<ComunicadoCompleto> {
    return this.prisma.comunicado.create({
      data: { ...data, destinos: { create: torreIds.map((torreId) => ({ torreId })) } },
      include: INCLUIR,
    });
  }

  /** Lista del administrador: lo más reciente (o próximo a salir) primero. */
  findTodos(): Promise<ComunicadoCompleto[]> {
    return this.prisma.comunicado.findMany({
      include: INCLUIR,
      orderBy: [{ fechaPublicacion: 'desc' }, { createdAt: 'desc' }],
    });
  }

  findProgramadosVencidos(ahora: Date): Promise<ComunicadoCompleto[]> {
    return this.prisma.comunicado.findMany({
      where: { estado: EstadoComunicado.PROGRAMADO, fechaPublicacion: { lte: ahora } },
      include: INCLUIR,
      orderBy: { fechaPublicacion: 'asc' },
    });
  }

  /** Solo cambia si sigue PROGRAMADO: dos corridas a la vez no duplican el aviso. */
  async publicarSiProgramado(id: string): Promise<boolean> {
    const { count } = await this.prisma.comunicado.updateMany({
      where: { id, estado: EstadoComunicado.PROGRAMADO },
      data: { estado: EstadoComunicado.PUBLICADO },
    });
    return count === 1;
  }

  async expirar(ahora: Date): Promise<number> {
    const { count } = await this.prisma.comunicado.updateMany({
      where: { estado: EstadoComunicado.PUBLICADO, fechaExpiracion: { lte: ahora } },
      data: { estado: EstadoComunicado.EXPIRADO },
    });
    return count;
  }

  // ---------------------------------------------------------------------------
  // H14 · Comunicados del residente
  // ---------------------------------------------------------------------------

  /** Torres de las unidades del residente (sale de la sesión, nunca del cliente). */
  async torresDeResidente(residenteId: string): Promise<string[]> {
    const torres = await this.prisma.torre.findMany({
      where: {
        unidades: { some: { usuarios: { some: { usuarioId: residenteId } } } },
      },
      select: { id: true },
    });
    return torres.map((t) => t.id);
  }

  /** Página de la pestaña principal o "Archivo", del más reciente al más antiguo. */
  async findDeResidente(f: FiltroResidente & { skip: number; take: number }): Promise<[LecturaResumen[], number]> {
    const where = dondeResidente(f);
    return this.prisma.$transaction([
      this.prisma.comunicado.findMany({
        where,
        select: {
          id: true,
          titulo: true,
          categoria: true,
          fechaPublicacion: true,
          lecturas: {
            where: { residenteId: f.residenteId },
            select: { leidoEn: true },
          },
        },
        orderBy: [{ fechaPublicacion: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        skip: f.skip,
        take: f.take,
      }),
      this.prisma.comunicado.count({ where }),
    ]);
  }

  /** Vigentes que el residente aún no abre (el contador de la pantalla). */
  contarNoLeidos(f: Omit<FiltroResidente, 'archivo'>): Promise<number> {
    return this.prisma.comunicado.count({
      where: {
        AND: [dondeResidente({ ...f, archivo: false }), { lecturas: { none: { residenteId: f.residenteId } } }],
      },
    });
  }

  /** Un comunicado publicado o expirado dirigido al residente; null si no existe o no le aplica. */
  findDeResidenteById(id: string, torreIds: string[]): Promise<Comunicado | null> {
    return this.prisma.comunicado.findFirst({
      where: {
        id,
        estado: { in: [EstadoComunicado.PUBLICADO, EstadoComunicado.EXPIRADO] },
        ...paraResidente(torreIds),
      },
    });
  }

  /** Idempotente: la PK (comunicado, residente) evita una segunda lectura. */
  async registrarLectura(comunicadoId: string, residenteId: string): Promise<void> {
    await this.prisma.lecturaComunicado.createMany({
      data: [{ comunicadoId, residenteId }],
      skipDuplicates: true,
    });
  }
}

export interface FiltroResidente {
  residenteId: string;
  torreIds: string[];
  archivo: boolean;
  ahora: Date;
}

export type LecturaResumen = Pick<Comunicado, 'id' | 'titulo' | 'categoria' | 'fechaPublicacion'> & {
  lecturas: { leidoEn: Date }[];
};

/** Para todo el condominio o para alguna de las torres del residente. */
const paraResidente = (torreIds: string[]) =>
  ({
    OR: [{ paraTodos: true }, { destinos: { some: { torreId: { in: torreIds } } } }],
  }) satisfies Prisma.ComunicadoWhereInput;

/**
 * Principal: PUBLICADO y sin expirar. Archivo: EXPIRADO, o PUBLICADO cuya
 * fecha_expiracion ya pasó pero la tarea de 5 minutos aún no lo marca.
 */
const dondeResidente = ({ torreIds, archivo, ahora }: FiltroResidente): Prisma.ComunicadoWhereInput => ({
  AND: [
    paraResidente(torreIds),
    archivo
      ? {
          OR: [
            { estado: EstadoComunicado.EXPIRADO },
            {
              estado: EstadoComunicado.PUBLICADO,
              fechaExpiracion: { lte: ahora },
            },
          ],
        }
      : {
          estado: EstadoComunicado.PUBLICADO,
          OR: [{ fechaExpiracion: null }, { fechaExpiracion: { gt: ahora } }],
        },
  ],
});
