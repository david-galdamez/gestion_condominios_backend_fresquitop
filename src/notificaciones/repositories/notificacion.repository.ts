import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { Rol } from '@PrismaClient';
import type { CrearNotificacionData, ResultadoEnvio } from '@Notificaciones/types';

export interface UsuarioDestinoRegistro {
  id: string;
  rol: Rol;
  isActive: boolean;
}

/**
 * Único punto de acceso a Prisma para notificaciones y resolución de destinatarios.
 * No lanza excepciones HTTP.
 */
@Injectable()
export class NotificacionRepository {
  constructor(private readonly prisma: PrismaService) { }

  findUsuarioById(usuarioId: string): Promise<UsuarioDestinoRegistro | null> {
    return this.prisma.user.findUnique({
      where: { id: usuarioId },
      select: { id: true, rol: true, isActive: true },
    });
  }

  async existsUnidad(unidadId: string): Promise<boolean> {
    const unidad = await this.prisma.unidad.findUnique({
      where: { id: unidadId },
      select: { id: true },
    });
    return unidad !== null;
  }

  async findResidentesActivosPorUnidad(unidadId: string): Promise<string[]> {
    const usuarios = await this.prisma.user.findMany({
      where: {
        rol: Rol.RESIDENTE,
        isActive: true,
        unidades: {
          some: { unidadId },
        },
      },
      select: { id: true },
    });
    return usuarios.map((u) => u.id);
  }

  async existsTorre(torreId: string): Promise<boolean> {
    const torre = await this.prisma.torre.findUnique({
      where: { id: torreId },
      select: { id: true },
    });
    return torre !== null;
  }

  async findResidentesActivosPorTorre(torreId: string): Promise<string[]> {
    const usuarios = await this.prisma.user.findMany({
      where: {
        rol: Rol.RESIDENTE,
        isActive: true,
        unidades: {
          some: {
            unidad: { torreId },
          },
        },
      },
      select: { id: true },
    });
    return usuarios.map((u) => u.id);
  }

  async findTodosResidentesActivos(): Promise<string[]> {
    const usuarios = await this.prisma.user.findMany({
      where: {
        rol: Rol.RESIDENTE,
        isActive: true,
      },
      select: { id: true },
    });
    return usuarios.map((u) => u.id);
  }

  async crearConDestinatarios(
    datos: CrearNotificacionData,
    residenteIds: string[],
  ): Promise<ResultadoEnvio> {
    const idsUnicos = [...new Set(residenteIds)];

    return this.prisma.$transaction(async (tx) => {
      const notificacion = await tx.notificacion.create({
        data: {
          moduloOrigen: datos.moduloOrigen,
          titulo: datos.titulo,
          mensaje: datos.mensaje,
          referencia: datos.referencia ?? null,
          destinoTipo: datos.destinoTipo,
          destinoId: datos.destinoId ?? null,
        },
        select: { id: true },
      });

      if (idsUnicos.length > 0) {
        await tx.notificacionDestinatario.createMany({
          data: idsUnicos.map((residenteId) => ({
            notificacionId: notificacion.id,
            residenteId,
          })),
          skipDuplicates: true,
        });
      }

      return {
        id: notificacion.id,
        destinatarios: idsUnicos.length,
      };
    });
  }

  async listarPorResidente(residenteId: string, pagina: number, porPagina: number = 20) {
    const skip = (pagina - 1) * porPagina;
    const [registros, total] = await this.prisma.$transaction([
      this.prisma.notificacionDestinatario.findMany({
        where: { residenteId },
        skip,
        take: porPagina,
        orderBy: { notificacion: { createdAt: 'desc' } },
        include: { notificacion: true },
      }),
      this.prisma.notificacionDestinatario.count({ where: { residenteId } }),
    ]);

    return { registros, total };
  }

  async contarNoLeidas(residenteId: string) {
    return this.prisma.notificacionDestinatario.count({
      where: { residenteId, leida: false },
    });
  }

  async marcarComoLeida(residenteId: string, notificacionId: string) {
    return this.prisma.notificacionDestinatario.updateMany({
      where: { residenteId, notificacionId, leida: false },
      data: { leida: true, leidaEn: new Date() },
    });
  }

  async marcarTodasComoLeidas(residenteId: string) {
    return this.prisma.notificacionDestinatario.updateMany({
      where: { residenteId, leida: false },
      data: { leida: true, leidaEn: new Date() },
    });
  }

  async existeNotificacionParaResidente(residenteId: string, notificacionId: string) {
    return this.prisma.notificacionDestinatario.findUnique({
      where: { notificacionId_residenteId: { notificacionId, residenteId } },
    });
  }
}