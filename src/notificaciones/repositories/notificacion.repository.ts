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
  constructor(private readonly prisma: PrismaService) {}

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
}