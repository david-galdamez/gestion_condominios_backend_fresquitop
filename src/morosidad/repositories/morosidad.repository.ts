import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { TorreNotFoundError } from '@Morosidad/errors';

export interface FilaUnidadMorosa {
  id: string;
  unidad: string;
  cuotasVencidas: number;
  montoAdeudado: number;
  vencidaMasAntigua: string;
}

export interface ResumenMorosidad {
  totalMora: number;
  unidadesMorosas: number;
}

export interface ResultadoConsultaMorosidad {
  totalMora: number;
  unidadesMorosas: number;
  filas: FilaUnidadMorosa[];
}

/**
 * Único punto del módulo que accede a la base de datos mediante PrismaService.
 * Ejecuta las consultas nativas ($queryRaw) y lanza errores de dominio (nunca excepciones HTTP).
 */
@Injectable()
export class MorosidadRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica que la torre exista cuando se filtra por `torreId`.
   * @throws {TorreNotFoundError} si la torre no existe en la BD.
   */
  async verificarTorreExiste(torreId: string): Promise<void> {
    const torre = await this.prisma.torre.findUnique({
      where: { id: torreId },
      select: { id: true },
    });

    if (!torre) {
      throw new TorreNotFoundError(torreId);
    }
  }

  /**
   * Obtiene la página de unidades morosas y los agregados globales del filtro actual.
   *
   * Nota sobre el esquema: `unidad.codigo` ya almacena el código legible (ej. "A-101", "B-204"),
   * por lo que se proyecta `u.codigo AS unidad` conservando el JOIN con `torre`.
   */
  async consultarMorosidad(
    torreId: string | null,
    limit: number,
    offset: number,
  ): Promise<ResultadoConsultaMorosidad> {
    if (torreId !== null) {
      await this.verificarTorreExiste(torreId);
    }

    const [filas, resumenRows] = await Promise.all([
      this.prisma.$queryRaw<FilaUnidadMorosa[]>`
        SELECT
          u.id,
          u.codigo AS unidad,
          COUNT(c.id)::int AS "cuotasVencidas",
          ROUND(SUM(c.monto), 2)::float AS "montoAdeudado",
          TO_CHAR(MIN(c.fecha_vencimiento), 'YYYY-MM-DD') AS "vencidaMasAntigua"
        FROM cuota c
        JOIN unidad u ON u.id = c.unidad_id
        JOIN torre t ON t.id = u.torre_id
        WHERE c.estado = 'VENCIDA'
          AND u.activa = true
          AND (${torreId}::uuid IS NULL OR u.torre_id = ${torreId}::uuid)
        GROUP BY u.id, u.codigo
        ORDER BY MIN(c.fecha_vencimiento) ASC, unidad ASC
        LIMIT ${limit} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<ResumenMorosidad[]>`
        SELECT
          COALESCE(ROUND(SUM(c.monto), 2)::float, 0) AS "totalMora",
          COUNT(DISTINCT u.id)::int AS "unidadesMorosas"
        FROM cuota c
        JOIN unidad u ON u.id = c.unidad_id
        JOIN torre t ON t.id = u.torre_id
        WHERE c.estado = 'VENCIDA'
          AND u.activa = true
          AND (${torreId}::uuid IS NULL OR u.torre_id = ${torreId}::uuid)
      `,
    ]);

    const resumen = resumenRows[0] ?? { totalMora: 0, unidadesMorosas: 0 };

    return {
      totalMora: Number(resumen.totalMora),
      unidadesMorosas: Number(resumen.unidadesMorosas),
      filas,
    };
  }
}
