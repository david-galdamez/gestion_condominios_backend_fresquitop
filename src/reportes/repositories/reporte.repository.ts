import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import {
  EstadoReporte,
  type CategoriaReporte,
  type EvidenciaReporte,
  type Prisma,
  type Reporte,
} from '@PrismaClient';
import type { FotoGuardada } from '../reportes.types.js';

export type ReporteConEvidencias = Prisma.ReporteGetPayload<{ include: { evidencias: true } }>;

export interface NuevoReporte {
  residenteId: string;
  titulo: string;
  categoria: CategoriaReporte;
  ubicacion: string;
  descripcion: string;
  evidencias: FotoGuardada[];
}

/**
 * Único punto del módulo que habla con las tablas `reporte`,
 * `evidencia_reporte` e `historial_reporte` (y con `torre` para el selector).
 */
@Injectable()
export class ReporteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea reporte + evidencias + primera entrada del historial (ABIERTO) en una
   * sola operación: los `create` anidados de Prisma corren en una transacción,
   * así que o queda todo o no queda nada.
   */
  crear(data: NuevoReporte): Promise<ReporteConEvidencias> {
    return this.prisma.reporte.create({
      data: {
        residenteId: data.residenteId,
        titulo: data.titulo,
        categoria: data.categoria,
        ubicacion: data.ubicacion,
        descripcion: data.descripcion,
        evidencias: { create: data.evidencias.map((e, orden) => ({ ...e, orden })) },
        historial: { create: { estado: EstadoReporte.ABIERTO, cambiadoPorId: data.residenteId } },
      },
      include: { evidencias: { orderBy: { orden: 'asc' } } },
    });
  }

  /** Reportes del residente, del más reciente al más antiguo. */
  async findPagina(
    residenteId: string,
    skip: number,
    take: number,
  ): Promise<{ reportes: Reporte[]; total: number }> {
    const where = { residenteId };
    const [reportes, total] = await Promise.all([
      this.prisma.reporte.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { numero: 'desc' }],
        skip,
        take,
      }),
      this.prisma.reporte.count({ where }),
    ]);
    return { reportes, total };
  }

  /** Filtra por dueño: el reporte de otro residente es indistinguible de uno inexistente. */
  findDeResidente(residenteId: string, numero: number): Promise<ReporteConEvidencias | null> {
    return this.prisma.reporte.findFirst({
      where: { numero, residenteId },
      include: { evidencias: { orderBy: { orden: 'asc' } } },
    });
  }

  findEvidenciaDeResidente(
    residenteId: string,
    numero: number,
    evidenciaId: string,
  ): Promise<EvidenciaReporte | null> {
    return this.prisma.evidenciaReporte.findFirst({
      where: { id: evidenciaId, reporte: { numero, residenteId } },
    });
  }

  async findNombresTorres(): Promise<string[]> {
    const torres = await this.prisma.torre.findMany({ select: { nombre: true }, orderBy: { nombre: 'asc' } });
    return torres.map((t) => t.nombre);
  }
}
