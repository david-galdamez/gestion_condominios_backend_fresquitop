import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ComunicadoRepository } from '@Comunicados/repositories';
import { NotificacionService } from '@Notificaciones/services';
import { avisarComunicado } from './comunicados.service.js';

/** BE-13.2: publica los programados y expira los vencidos cada 5 minutos. */
@Injectable()
export class ComunicadosPublicacionService {
  private readonly logger = new Logger(ComunicadosPublicacionService.name);

  constructor(
    private readonly comunicados: ComunicadoRepository,
    private readonly notificaciones: NotificacionService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async tarea(): Promise<void> {
    await this.ejecutar();
  }

  /** Idempotente: solo cambia filas en el estado de origen, así que no repite avisos. */
  async ejecutar(ahora: Date = new Date()): Promise<{ publicados: number; expirados: number }> {
    let publicados = 0;
    for (const c of await this.comunicados.findProgramadosVencidos(ahora)) {
      if (!(await this.comunicados.publicarSiProgramado(c.id))) continue;
      publicados++;
      await avisarComunicado(this.notificaciones, this.logger, c);
    }
    // Después de publicar: un programado cuya expiración también pasó termina EXPIRADO.
    const expirados = await this.comunicados.expirar(ahora);
    if (publicados || expirados) {
      this.logger.log(`Comunicados publicados: ${publicados}, expirados: ${expirados}`);
    }
    return { publicados, expirados };
  }
}
