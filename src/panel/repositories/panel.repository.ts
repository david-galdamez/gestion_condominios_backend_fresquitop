import { Injectable } from '@nestjs/common';
import { aFechaUtc, sumarDias } from '@Common/fechas';
import { PrismaService } from '@Prisma/services';
import { EstadoAsamblea, EstadoReporte } from '@PrismaClient';
import type { Periodo } from '../panel.calculos.js';

export interface OcupacionAreaFila {
  area: string;
  horasDiarias: number;
  horasReservadas: number;
}

export interface ParticipacionAsambleaFila {
  asamblea: string;
  unidadesQueVotaron: number;
}

/** Medianoche local del negocio (UTC-6), igual que en reservas, para filtrar columnas con hora. */
const inicioDelDia = (iso: string) => new Date(`${iso}T00:00:00-06:00`);

/**
 * Consultas agregadas del panel de salud (H19). Todas son de solo lectura y
 * usan los índices por fecha: reserva(fecha, estado) y reporte(created_at, estado).
 */
@Injectable()
export class PanelRepository {
  constructor(private readonly prisma: PrismaService) {}

  contarUnidadesActivas(): Promise<number> {
    return this.prisma.unidad.count({ where: { activa: true } });
  }

  /** Horas reservadas (CONFIRMADA o FINALIZADA, por fecha de la reserva) y horas diarias de apertura por área activa. */
  async ocupacionPorArea({ desde, hasta }: Periodo): Promise<OcupacionAreaFila[]> {
    const filas = await this.prisma.$queryRaw<OcupacionAreaFila[]>`
      SELECT
        a.nombre AS area,
        EXTRACT(EPOCH FROM (a.hora_cierre - a.hora_apertura))::float / 3600 AS "horasDiarias",
        COALESCE(SUM(EXTRACT(EPOCH FROM (r.hora_fin - r.hora_inicio))), 0)::float / 3600 AS "horasReservadas"
      FROM area_comun a
      LEFT JOIN reserva r
        ON r.area_id = a.id
       AND r.estado IN ('CONFIRMADA', 'FINALIZADA')
       AND r.fecha BETWEEN ${aFechaUtc(desde)} AND ${aFechaUtc(hasta)}
      WHERE a.activa = true
      GROUP BY a.id, a.nombre, a.hora_apertura, a.hora_cierre
      ORDER BY a.nombre ASC
    `;
    return filas.map((f) => ({
      area: f.area,
      horasDiarias: Number(f.horasDiarias),
      horasReservadas: Number(f.horasReservadas),
    }));
  }

  /** Reportes ABIERTO o EN_PROCESO creados en el periodo, por prioridad (`null` = sin asignar). */
  async incidenciasPorPrioridad({ desde, hasta }: Periodo) {
    const grupos = await this.prisma.reporte.groupBy({
      by: ['prioridad'],
      where: {
        estado: { in: [EstadoReporte.ABIERTO, EstadoReporte.EN_PROCESO] },
        createdAt: { gte: inicioDelDia(desde), lt: inicioDelDia(sumarDias(hasta, 1)) },
      },
      _count: { _all: true },
    });
    return grupos.map((g) => ({ prioridad: g.prioridad, total: g._count._all }));
  }

  /** Últimas asambleas CERRADA con cierre en el periodo y cuántas unidades distintas votaron en cada una. */
  async ultimasAsambleasCerradas({ desde, hasta }: Periodo, limite: number): Promise<ParticipacionAsambleaFila[]> {
    const asambleas = await this.prisma.asamblea.findMany({
      where: {
        estado: EstadoAsamblea.CERRADA,
        fechaCierre: { gte: inicioDelDia(desde), lt: inicioDelDia(sumarDias(hasta, 1)) },
      },
      orderBy: { fechaCierre: 'desc' },
      take: limite,
      select: { id: true, titulo: true },
    });
    if (asambleas.length === 0) return [];

    const votantes = await this.prisma.voto.groupBy({
      by: ['asambleaId', 'unidadId'],
      where: { asambleaId: { in: asambleas.map((a) => a.id) } },
    });
    const porAsamblea = new Map<string, number>();
    for (const v of votantes) porAsamblea.set(v.asambleaId, (porAsamblea.get(v.asambleaId) ?? 0) + 1);

    return asambleas.map((a) => ({ asamblea: a.titulo, unidadesQueVotaron: porAsamblea.get(a.id) ?? 0 }));
  }
}
