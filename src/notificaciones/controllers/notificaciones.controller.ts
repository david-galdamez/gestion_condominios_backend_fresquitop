import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '@Auth/decorators';
import { Rol, type User } from '@PrismaClient';
import { NotificacionService } from '../services/index.js';

@Controller('notificaciones')
@Roles(Rol.RESIDENTE)
export class NotificacionesController {
  constructor(private readonly service: NotificacionService) {}

  @Get()
  listar(@CurrentUser() user: User, @Query('pagina') pagina?: string) {
    const p = parseInt(pagina ?? '1', 10) || 1;
    return this.service.listarMisNotificaciones(user.id, p);
  }

  @Get('no-leidas/conteo')
  conteo(@CurrentUser() user: User) {
    return this.service.contarNoLeidas(user.id);
  }

  @Patch(':id/leer')
  marcarLeida(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.marcarComoLeida(user.id, id);
  }

  @Patch('marcar-todas')
  marcarTodas(@CurrentUser() user: User) {
    return this.service.marcarTodasComoLeidas(user.id);
  }
}