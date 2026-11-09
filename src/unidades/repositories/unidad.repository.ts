import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { Rol } from '@PrismaClient';

export interface UnidadResumen {
  id: string;
  codigo: string;
}

/** Consultas compartidas sobre `unidad` / `usuario_unidad` (estado de cuenta, autorizaciones, selector). */
@Injectable()
export class UnidadRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Unidades del usuario, ordenadas por código (alimenta los selectores). */
  findDeUsuario(usuarioId: string): Promise<UnidadResumen[]> {
    return this.prisma.unidad.findMany({
      where: { usuarios: { some: { usuarioId } } },
      select: { id: true, codigo: true },
      orderBy: { codigo: 'asc' },
    });
  }

  /** Todas las unidades activas, ordenadas por código (selector de portería, H09). */
  findActivas(): Promise<UnidadResumen[]> {
    return this.prisma.unidad.findMany({
      where: { activa: true },
      select: { id: true, codigo: true },
      orderBy: { codigo: 'asc' },
    });
  }

  findById(id: string): Promise<(UnidadResumen & { activa: boolean }) | null> {
    return this.prisma.unidad.findUnique({
      where: { id },
      select: { id: true, codigo: true, activa: true },
    });
  }

  /** Residentes con cuenta activa de la unidad (los que reciben sus avisos). */
  contarResidentesActivos(unidadId: string): Promise<number> {
    return this.prisma.usuarioUnidad.count({
      where: { unidadId, usuario: { isActive: true, rol: Rol.RESIDENTE } },
    });
  }
}
