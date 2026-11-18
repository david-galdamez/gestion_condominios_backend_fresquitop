import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import {
  EstadoCuota,
  TipoAvisoCuota,
  type OrigenGeneracion,
  type Prisma,
} from '@PrismaClient';

export interface DatosGeneracion {
  periodo: string;
  monto: Prisma.Decimal;
  /** Medianoche UTC del día de vencimiento (así maneja Prisma @db.Date). */
  fechaVencimiento: Date;
  origen: OrigenGeneracion;
  ejecutadaPorId: string | null;
}

export interface CuotaPorVencer {
  id: string;
  unidadId: string;
  periodo: string;
  monto: Prisma.Decimal;
  fechaVencimiento: Date;
}

/** Escrituras de H02 sobre `cuota`, `ejecucion_generacion` y `aviso_cuota`. */
@Injectable()
export class GeneracionCuotaRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea la cuota del periodo para cada unidad activa y registra la ejecución,
   * todo en una transacción. `skipDuplicates` es un ON CONFLICT (unidad_id,
   * periodo) DO NOTHING: una unidad que ya tenía cuota se omite sin error.
   */
  generar(
    datos: DatosGeneracion,
  ): Promise<{ creadas: number; omitidas: number }> {
    return this.prisma.$transaction(async (tx) => {
      const unidades = await tx.unidad.findMany({
        where: { activa: true },
        select: { id: true },
      });
      const { count: creadas } = await tx.cuota.createMany({
        data: unidades.map(({ id }) => ({
          unidadId: id,
          periodo: datos.periodo,
          monto: datos.monto,
          fechaVencimiento: datos.fechaVencimiento,
        })),
        skipDuplicates: true,
      });
      const omitidas = unidades.length - creadas;
      await tx.ejecucionGeneracion.create({
        data: {
          periodo: datos.periodo,
          origen: datos.origen,
          creadas,
          omitidas,
          ejecutadaPorId: datos.ejecutadaPorId,
        },
      });
      return { creadas, omitidas };
    });
  }

  /** Cuotas PENDIENTE que vencen exactamente en `fecha`. */
  findPendientesQueVencen(fecha: Date): Promise<CuotaPorVencer[]> {
    return this.prisma.cuota.findMany({
      where: { estado: EstadoCuota.PENDIENTE, fechaVencimiento: fecha },
      select: {
        id: true,
        unidadId: true,
        periodo: true,
        monto: true,
        fechaVencimiento: true,
      },
      orderBy: { unidadId: 'asc' },
    });
  }

  /**
   * Registra el aviso POR_VENCER y llama a `enviar` dentro de la misma
   * transacción. Bloquea la cuota (FOR UPDATE) y vuelve a verificar que siga
   * PENDIENTE: una cuota pagada entre la consulta y el envío no se avisa.
   * Devuelve false si ya no aplica o si el aviso ya existía. Si `enviar`
   * falla, el registro se revierte.
   */
  registrarAvisoPorVencer(
    cuotaId: string,
    enviar: () => Promise<unknown>,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRaw<{ estado: EstadoCuota }[]>`
        SELECT estado FROM cuota WHERE id = ${cuotaId}::uuid FOR UPDATE`;
      if (filas[0]?.estado !== EstadoCuota.PENDIENTE) return false;

      const { count } = await tx.avisoCuota.createMany({
        data: [{ cuotaId, tipo: TipoAvisoCuota.POR_VENCER }],
        skipDuplicates: true,
      });
      if (count === 0) return false;

      await enviar();
      return true;
    });
  }
}
