import { Injectable, NotFoundException } from '@nestjs/common';
import { MorosidadRepository } from '@Morosidad/repositories';
import { TorreNotFoundError } from '@Morosidad/errors';
import {
  MOROSIDAD_PAGE_SIZE,
  type MorosidadQueryDto,
  type MorosidadResponseDto,
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
}
