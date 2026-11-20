// src/reportes/repositories/reporte.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import {
  EstadoReporte,
  type CategoriaReporte,
  type EvidenciaReporte,
  type PrioridadReporte,
  type Prisma,
  type Reporte,
} from '@PrismaClient';
import { ReporteNotFoundError, ReporteYaResueltoError } from '@Reportes/errors';
import type { FotoGuardada } from '../reportes.types.js';

export type ReporteConEvidencias = Prisma.ReporteGetPayload<{ include: { evidencias: true } }>;

const INCLUDE_ADMIN_ITEM = {
  residente: {
    select: {
      id: true,
      nombre: true,
      email: true,
      unidades: {
        select: {
          unidad: { select: { codigo: true } },
        },
      },
    },
  },
} satisfies Prisma.ReporteInclude;

const INCLUDE_ADMIN_DETALLE = {
  ...INCLUDE_ADMIN_ITEM,
  evidencias: { orderBy: { orden: 'asc' } },
  historial: {
    orderBy: { createdAt: 'asc' },
    include: {
      cambiadoPor: {
        select: { id: true, nombre: true, rol: true },
      },
    },
  },
} satisfies Prisma.ReporteInclude;

export type ReporteAdminItem = Prisma.ReporteGetPayload<{ include: typeof INCLUDE_ADMIN_ITEM }>;
export type ReporteAdminDetalle = Prisma.ReporteGetPayload<{ include: typeof INCLUDE_ADMIN_DETALLE }>;

export interface NuevoReporte {
  residenteId: string;
  titulo: string;
  categoria: CategoriaReporte;
  ubicacion: string;
  descripcion: string;
  evidencias: FotoGuardada[];
}

export interface FiltrosAdminReportes {
  estado?: EstadoReporte;
  categoria?: CategoriaReporte;
  skip: number;
  take: number;
}

export interface AsignarReporteParams {
  reporteId: string;
  adminId: string;
  prioridad: PrioridadReporte;
  responsable: string;
  comentario: string;
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

  /**
   * H06: Listado administrativo paginado.
   * El enum PostgreSQL `prioridad_reporte` está definido como ('BAJA', 'MEDIA', 'ALTA'),
   * por lo que `prioridad DESC NULLS LAST` ordena: ALTA (1), MEDIA (2), BAJA (3), NULL (4).
   */
  async findPaginaAdmin(
    filtros: FiltrosAdminReportes,
  ): Promise<{ reportes: ReporteAdminItem[]; total: number }> {
    const where: Prisma.ReporteWhereInput = {
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.categoria ? { categoria: filtros.categoria } : {}),
    };

    const [reportes, total] = await Promise.all([
      this.prisma.reporte.findMany({
        where,
        include: INCLUDE_ADMIN_ITEM,
        orderBy: [
          { prioridad: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'asc' },
          { numero: 'asc' },
        ],
        skip: filtros.skip,
        take: filtros.take,
      }),
      this.prisma.reporte.count({ where }),
    ]);

    return { reportes, total };
  }

  /** H06: Detalle administrativo completo por UUID con evidencias e historial cronológico. */
  findDetalleAdminById(id: string): Promise<ReporteAdminDetalle | null> {
    return this.prisma.reporte.findUnique({
      where: { id },
      include: INCLUDE_ADMIN_DETALLE,
    });
  }

  /**
   * H06: Asigna o reasigna prioridad y responsable en una transacción atómica,
   * pasando ABIERTO -> EN_PROCESO (o manteniendo EN_PROCESO) y registrando historial.
   */
  asignar(params: AsignarReporteParams): Promise<Reporte> {
    return this.prisma.$transaction(async (tx) => {
      const actual = await tx.reporte.findUnique({
        where: { id: params.reporteId },
        select: { id: true, estado: true },
      });

      if (!actual) {
        throw new ReporteNotFoundError(params.reporteId);
      }

      if (actual.estado === EstadoReporte.RESUELTO) {
        throw new ReporteYaResueltoError(params.reporteId);
      }

      const actualizado = await tx.reporte.update({
        where: { id: params.reporteId },
        data: {
          estado: EstadoReporte.EN_PROCESO,
          prioridad: params.prioridad,
          responsable: params.responsable,
        },
      });

      await tx.historialReporte.create({
        data: {
          reporteId: params.reporteId,
          estado: EstadoReporte.EN_PROCESO,
          cambiadoPorId: params.adminId,
          comentario: params.comentario,
        },
      });

      return actualizado;
    });
  }
}