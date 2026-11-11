import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ZONA_NEGOCIO } from '@Common/fechas';
import { OrigenGeneracion } from '@PrismaClient';
import { periodoActual } from '../periodos.js';
import type { GeneracionCuotasDto } from '../dto/index.js';
import { CuotasService } from './cuotas.service.js';

@Injectable()
export class GeneracionAutomaticaService {
  private readonly logger = new Logger(GeneracionAutomaticaService.name);

  constructor(private readonly cuotas: CuotasService) {}

  /** Día 1 de cada mes a las 00:00 de El Salvador. */
  @Cron('0 0 1 * *', { timeZone: ZONA_NEGOCIO })
  async tareaMensual(): Promise<void> {
    await this.generarMesActual();
  }

  /** Genera el periodo del mes actual. Sin configuración solo deja un aviso en el log. */
  async generarMesActual(
    ahora: Date = new Date(),
  ): Promise<GeneracionCuotasDto | null> {
    const periodo = periodoActual(ahora);
    try {
      const r = await this.cuotas.generar(
        periodo,
        OrigenGeneracion.AUTOMATICA,
        null,
      );
      this.logger.log(
        `Cuotas ${periodo}: creadas=${r.creadas} omitidas=${r.omitidas}`,
      );
      return r;
    } catch (e) {
      if (e instanceof ConflictException) {
        this.logger.warn(
          `No se generaron las cuotas de ${periodo}: no existe configuración de cuota`,
        );
        return null;
      }
      throw e;
    }
  }
}
