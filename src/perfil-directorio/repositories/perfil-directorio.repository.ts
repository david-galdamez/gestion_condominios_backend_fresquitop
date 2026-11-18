import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import type { PerfilDirectorio } from '@PrismaClient';

export type OpcionesPerfil = Pick<
  PerfilDirectorio,
  'visible' | 'mostrarNombre' | 'mostrarUnidad' | 'mostrarTelefono' | 'mostrarCorreo'
>;

/** Datos propios del residente que puede mostrar el directorio. */
export interface DatosResidente {
  nombre: string;
  correo: string;
  unidades: string[];
  /** Todavía no existe en el modelo (lo agrega el registro de la fase base). */
  telefono: string | null;
}

/** Perfil por defecto: oculto y sin datos marcados (H15, criterio 1). */
export const PERFIL_OCULTO: OpcionesPerfil = {
  visible: false,
  mostrarNombre: false,
  mostrarUnidad: false,
  mostrarTelefono: false,
  mostrarCorreo: false,
};

/** Único punto que habla con `perfil_directorio`. */
@Injectable()
export class PerfilDirectorioRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByResidente(residenteId: string): Promise<PerfilDirectorio | null> {
    return this.prisma.perfilDirectorio.findUnique({ where: { residenteId } });
  }

  /** Upsert: los usuarios creados antes de H15 (o por el seed) no tienen fila. */
  guardar(residenteId: string, opciones: OpcionesPerfil): Promise<PerfilDirectorio> {
    return this.prisma.perfilDirectorio.upsert({
      where: { residenteId },
      update: opciones,
      create: { residenteId, ...opciones },
    });
  }

  async datosResidente(residenteId: string): Promise<DatosResidente | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: residenteId },
      select: {
        nombre: true,
        email: true,
        unidades: { select: { unidad: { select: { codigo: true } } }, orderBy: { unidad: { codigo: 'asc' } } },
      },
    });
    if (!user) return null;
    return {
      nombre: user.nombre,
      correo: user.email,
      unidades: user.unidades.map((u) => u.unidad.codigo),
      telefono: null,
    };
  }
}
