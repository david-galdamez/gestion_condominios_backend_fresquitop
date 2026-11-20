import { Body, Controller, Param, Post } from '@nestjs/common';
import { CurrentUser, Roles } from '@Auth/decorators';
import { Rol, type User } from '@PrismaClient';
import { AsambleaService } from '../services/index.js';
import { CrearAsambleaDto } from '../dto/crear-asamblea.dto.js';

@Controller('asambleas')
@Roles(Rol.ADMINISTRADOR)
export class AsambleaController {
  constructor(private readonly service: AsambleaService) {}

  @Post()
  crear(@CurrentUser() user: User, @Body() dto: CrearAsambleaDto) {
    return this.service.crear(user.id, dto);
  }

  @Post(':id/publicar')
  publicar(@Param('id') id: string) {
    return this.service.publicar(id);
  }
}
