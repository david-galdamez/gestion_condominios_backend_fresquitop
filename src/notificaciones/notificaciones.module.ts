import { Module } from '@nestjs/common';
import { NotificacionService, NotificacionServiceTemporal } from '@Notificaciones/services';

/**
 * Servicio común de avisos (H18, sección 2.6 de la especificación).
 *
 * TEMPORAL: mientras no exista BE-18.1 se usa NotificacionServiceTemporal, que
 * valida el aviso y lo escribe en el log. BE-18.1 solo tiene que implementar
 * NotificacionService y cambiar `useClass`: los módulos que avisan (H09, H02,
 * H11, H13, H24) no cambian.
 */
@Module({
  providers: [{ provide: NotificacionService, useClass: NotificacionServiceTemporal }],
  exports: [NotificacionService],
})
export class NotificacionesModule {}
