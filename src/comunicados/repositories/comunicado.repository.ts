import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { EstadoComunicado, type CategoriaComunicado, type Prisma } from '@PrismaClient';

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

/** Único punto que habla con `comunicado` y `comunicado_destino`. */
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
}
