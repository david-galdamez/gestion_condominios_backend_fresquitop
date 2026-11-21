import { Injectable, NotFoundException } from '@nestjs/common';
import { MorosidadRepository } from '@Morosidad/repositories';
import { TorreNotFoundError } from '@Morosidad/errors';
import {
  MOROSIDAD_PAGE_SIZE,
  type MorosidadQueryDto,
  type MorosidadResponseDto,
  type UnidadMorosaDto,
} from '@Morosidad/dto';

@Injectable()
export class MorosidadService {
  constructor(private readonly morosidadRepository: MorosidadRepository) {}

  async consultar(query: MorosidadQueryDto): Promise<MorosidadResponseDto> {
    const pagina = query.pagina ?? 1;
    const torreId = query.torreId ?? null;
    const offset = (pagina - 1) * MOROSIDAD_PAGE_SIZE;

    try {
      const { totalMora, unidadesMorosas, filas } =
        await this.morosidadRepository.consultarMorosidad(
          torreId,
          MOROSIDAD_PAGE_SIZE,
          offset,
        );

      return {
        totalMora: Number(totalMora.toFixed(2)),
        unidadesMorosas,
        datos: filas.map((fila) => ({
          unidad: fila.unidad,
          cuotasVencidas: Number(fila.cuotasVencidas),
          montoAdeudado: Number(Number(fila.montoAdeudado).toFixed(2)),
          vencidaMasAntigua: fila.vencidaMasAntigua,
        })),
        total: unidadesMorosas,
        pagina,
      };
    } catch (error) {
      if (error instanceof TorreNotFoundError) {
        throw new NotFoundException('Torre no encontrada');
      }
      throw error;
    }
  }

  /** Cifras globales de mora, compartidas con el panel de salud (H19). */
  async resumen(): Promise<{ totalMora: number; unidadesMorosas: number }> {
    const { totalMora, unidadesMorosas } = await this.morosidadRepository.resumenMorosidad();
    return { totalMora: Number(totalMora.toFixed(2)), unidadesMorosas };
  }

  /**
   * Todas las unidades morosas, sin paginar y con el mismo orden y cálculo que
   * la consulta paginada. La usa la versión detallada del reporte (H20).
   */
  async detallePorUnidad(): Promise<UnidadMorosaDto[]> {
    const { unidadesMorosas } = await this.morosidadRepository.resumenMorosidad();
    if (unidadesMorosas === 0) return [];
    const { filas } = await this.morosidadRepository.consultarMorosidad(null, unidadesMorosas, 0);
    return filas.map((fila) => ({
      unidad: fila.unidad,
      cuotasVencidas: Number(fila.cuotasVencidas),
      montoAdeudado: Number(Number(fila.montoAdeudado).toFixed(2)),
      vencidaMasAntigua: fila.vencidaMasAntigua,
    }));
  }
}
