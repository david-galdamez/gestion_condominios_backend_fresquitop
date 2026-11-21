import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { Rol, type PerfilDirectorio, type Prisma } from '@PrismaClient';

export type OpcionesPerfil = Pick<
  PerfilDirectorio,
  'visible' | 'mostrarNombre' | 'mostrarUnidad' | 'mostrarTelefono' | 'mostrarCorreo'
>;

/** Datos propios del residente que puede mostrar el directorio. */
export interface DatosResidente {
  nombre: string;
  correo: string;
  unidades: string[];
  /** Lo registra el propio residente en "Mi directorio" (hotfix 1.0.1). */
  telefono: string | null;
}

/** Un perfil visible con los datos de su residente (para buscar vecinos, H16). */
export interface PerfilConDatos {
  opciones: OpcionesPerfil;
  datos: DatosResidente;
}

const DATOS_RESIDENTE = {
  nombre: true,
  email: true,
  telefono: true,
  unidades: { select: { unidad: { select: { codigo: true } } }, orderBy: { unidad: { codigo: 'asc' } } },
} satisfies Prisma.UserSelect;

const aDatos = (u: Prisma.UserGetPayload<{ select: typeof DATOS_RESIDENTE }>): DatosResidente => ({
  nombre: u.nombre,
  correo: u.email,
  unidades: u.unidades.map((x) => x.unidad.codigo),
  telefono: u.telefono,
});

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

  /**
   * Upsert: los usuarios creados antes de H15 (o por el seed) no tienen fila.
   * `telefono` undefined no lo toca; null lo borra. Todo en una transacción.
   */
  async guardar(residenteId: string, opciones: OpcionesPerfil, telefono?: string | null): Promise<PerfilDirectorio> {
    const [perfil] = await this.prisma.$transaction([
      this.prisma.perfilDirectorio.upsert({
        where: { residenteId },
        update: opciones,
        create: { residenteId, ...opciones },
      }),
      ...(telefono === undefined
        ? []
        : [this.prisma.user.update({ where: { id: residenteId }, data: { telefono }, select: { id: true } })]),
    ]);
    return perfil;
  }

  /** Perfiles visibles de residentes activos, sin el propio (H16). */
  async findVisibles(excluirResidenteId: string): Promise<PerfilConDatos[]> {
    const filas = await this.prisma.perfilDirectorio.findMany({
      where: {
        visible: true,
        residenteId: { not: excluirResidenteId },
        residente: { isActive: true, rol: Rol.RESIDENTE },
      },
      select: {
        visible: true,
        mostrarNombre: true,
        mostrarUnidad: true,
        mostrarTelefono: true,
        mostrarCorreo: true,
        residente: { select: DATOS_RESIDENTE },
      },
    });
    return filas.map(({ residente, ...opciones }) => ({ opciones, datos: aDatos(residente) }));
  }

  async datosResidente(residenteId: string): Promise<DatosResidente | null> {
    const user = await this.prisma.user.findUnique({ where: { id: residenteId }, select: DATOS_RESIDENTE });
    return user ? aDatos(user) : null;
  }
}
