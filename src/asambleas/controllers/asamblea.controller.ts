import { Body, Controller, Param, Post, Get, Query } from '@nestjs/common';
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

  @Get()
  @Roles(Rol.ADMINISTRADOR)
  listar() {
    return this.service.listar();
  }

  @Post(':id/publicar')
  publicar(@Param('id') id: string) {
    return this.service.publicar(id);
  }

  // ⚠️ IMPORTANTE: 'comprobantes/verificar' debe ir ANTES que ':id/resultados'
  @Get('comprobantes/verificar')
  @Roles(Rol.ADMINISTRADOR)
  verificarComprobante(@Query('codigo') codigo: string) {
    return this.service.verificarComprobante(codigo);
  }

  @Get(':id/resultados')
  @Roles(Rol.ADMINISTRADOR)
  obtenerResultados(@Param('id') id: string) {
    return this.service.obtenerResultados(id);
  }
}