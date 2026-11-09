import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { AreaNombreDuplicadoError } from '@Areas/errors';
import { Prisma, type AreaComun } from '@PrismaClient';

/** Código de Prisma para violación de restricción única. */
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

export type DatosArea = Pick<
  Prisma.AreaComunUncheckedCreateInput,
  'nombre' | 'capacidad' | 'horaApertura' | 'horaCierre' | 'duracionMaxHoras'
>;

/**
 * Único punto que habla con `area_comun`. Sin borrado físico: se desactiva.
 * No toca la tabla de reservas: cambiar horario o desactivar no anula nada.
 */
@Injectable()
export class AreaRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** @throws {AreaNombreDuplicadoError} si el nombre ya existe. */
  async create(data: DatosArea): Promise<AreaComun> {
    try {
      return await this.prisma.areaComun.create({ data });
    } catch (error) {
      throw this.traducir(error, data.nombre);
    }
  }

  /** @throws {AreaNombreDuplicadoError} si el nombre ya existe en otra área. */
  async update(id: string, data: DatosArea): Promise<AreaComun> {
    try {
      return await this.prisma.areaComun.update({ where: { id }, data });
    } catch (error) {
      throw this.traducir(error, data.nombre);
    }
  }

  setActiva(id: string, activa: boolean): Promise<AreaComun> {
    return this.prisma.areaComun.update({ where: { id }, data: { activa } });
  }

  findById(id: string): Promise<AreaComun | null> {
    return this.prisma.areaComun.findUnique({ where: { id } });
  }

  /** Ordenadas por nombre. `soloActivas` para residentes y la disponibilidad. */
  findAll(soloActivas: boolean): Promise<AreaComun[]> {
    return this.prisma.areaComun.findMany({
      where: soloActivas ? { activa: true } : undefined,
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * ¿Hay otra área con el mismo nombre sin distinguir mayúsculas? El índice
   * único sí distingue, así que "Alberca" y "alberca" pasarían sin esto.
   */
  async existeNombre(nombre: string, excluirId?: string): Promise<boolean> {
    const count = await this.prisma.areaComun.count({
      where: {
        nombre: { equals: nombre, mode: 'insensitive' },
        ...(excluirId ? { id: { not: excluirId } } : {}),
      },
    });
    return count > 0;
  }

  private traducir(error: unknown, nombre: string): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION) {
      return new AreaNombreDuplicadoError(nombre);
    }
    return error;
  }
}
