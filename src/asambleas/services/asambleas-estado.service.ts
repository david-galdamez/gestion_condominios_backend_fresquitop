import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AsambleaRepository } from '../repositories/asamblea.repository.js';

@Injectable()
export class AsambleasEstadoService {
  private readonly logger = new Logger(AsambleasEstadoService.name);

  constructor(private readonly asambleas: AsambleaRepository) {}

  /** Cada minuto: abre y cierra asambleas según su ventana. Idempotente. */
  @Cron(CronExpression.EVERY_MINUTE)
  async tareaPeriodica(): Promise<void> {
    await this.actualizarEstados();
  }

  /**
   * PUBLICADA → ABIERTA al llegar fechaApertura; PUBLICADA/ABIERTA → CERRADA al llegar fechaCierre.
   * Primero se cierra, así una PUBLICADA con la ventana ya vencida termina CERRADA y no ABIERTA.
   */
  async actualizarEstados(ahora: Date = new Date()): Promise<{ cerradas: number; abiertas: number }> {
    const cerradas = await this.asambleas.cerrarVencidas(ahora);
    const abiertas = await this.asambleas.abrirPublicadasVigentes(ahora);
    if (cerradas > 0 || abiertas > 0) {
      this.logger.log(`Asambleas cerradas: ${cerradas}, abiertas: ${abiertas}`);
    }
    return { cerradas, abiertas };
  }
}
