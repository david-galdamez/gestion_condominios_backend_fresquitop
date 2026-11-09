import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { NotificacionService, validarAviso, type Aviso, type ResultadoEnvio } from './notificacion.service.js';

/**
 * TEMPORAL hasta BE-18.1 (H18): valida el aviso y lo escribe en el log, sin
 * guardarlo. Devuelve 0 destinatarios porque no resuelve residentes.
 */
@Injectable()
export class NotificacionServiceTemporal extends NotificacionService {
  private readonly logger = new Logger('NotificacionService');

  enviar(aviso: Aviso): Promise<ResultadoEnvio> {
    validarAviso(aviso);
    const destino = aviso.destinatario.id
      ? `${aviso.destinatario.tipo} ${aviso.destinatario.id}`
      : aviso.destinatario.tipo;
    this.logger.log(`[${aviso.moduloOrigen}] ${destino}: "${aviso.titulo}" - ${aviso.mensaje}`);
    return Promise.resolve({ id: randomUUID(), destinatarios: 0 });
  }
}
