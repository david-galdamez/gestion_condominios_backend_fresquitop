import { Module } from '@nestjs/common';
import { NotificacionRepository } from '@Notificaciones/repositories';
import { NotificacionService } from '@Notificaciones/services';

/**
 * Módulo interno de notificaciones (H18).
 * Exporta NotificacionService para ser inyectado por otros módulos del backend.
 */
@Module({
  providers: [NotificacionRepository, NotificacionService],
  exports: [NotificacionService],
})
export class NotificacionesModule {}