import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '@Auth/decorators';
import { Rol, type User } from '@PrismaClient';
import { PaquetesService } from '../services/index.js';
import { MisPaquetesQueryDto } from '../dto/mis-paquetes-query.dto.js';

@Controller('paquetes')
@Roles(Rol.RESIDENTE)
export class MisPaquetesController {
  constructor(private readonly service: PaquetesService) {}

  @Get('mios')
  listar(@CurrentUser() user: User, @Query() query: MisPaquetesQueryDto) {
    return this.service.listarMisPaquetes(user.id, query.filtro, query.pagina);
  }

  @Get('mios/:id')
  detalle(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.obtenerDetallePaquete(user.id, id);
  }
}