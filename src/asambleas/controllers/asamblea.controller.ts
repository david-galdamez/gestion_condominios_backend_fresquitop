import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Roles } from '@Auth/decorators';
import { Rol, type User } from '@PrismaClient';
import {
  CrearAsambleaDto,
  EmitirVotosDto,
  type DetalleAsambleaResidenteDto,
  type EmitirVotosResponseDto,
} from '../dto/index.js';
import { AsambleaService } from '../services/index.js';

@Controller('asambleas')
export class AsambleaController {
  constructor(private readonly service: AsambleaService) {}

  @Post()
  @Roles(Rol.ADMINISTRADOR)
  crear(@CurrentUser() user: User, @Body() dto: CrearAsambleaDto) {
    return this.service.crear(user.id, dto);
  }

  @Get()
  @Roles(Rol.ADMINISTRADOR, Rol.RESIDENTE)
  listar(@CurrentUser() user: User) {
    if (user.rol === Rol.RESIDENTE) {
      return this.service.listarParaResidente(user.id);
    }
    return this.service.listar();
  }

  // ⚠️ IMPORTANTE: 'comprobantes/verificar' debe ir ANTES que ':id' y ':id/resultados'
  @Get('comprobantes/verificar')
  @Roles(Rol.ADMINISTRADOR)
  verificarComprobante(@Query('codigo') codigo: string) {
    return this.service.verificarComprobante(codigo);
  }

  @Get(':id')
  @Roles(Rol.RESIDENTE, Rol.ADMINISTRADOR)
  obtenerDetalle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<DetalleAsambleaResidenteDto> {
    return this.service.obtenerDetalle(id, user);
  }

  @Post(':id/publicar')
  @Roles(Rol.ADMINISTRADOR)
  publicar(@Param('id') id: string) {
    return this.service.publicar(id);
  }

  @Post(':id/votos')
  @Roles(Rol.RESIDENTE)
  @HttpCode(HttpStatus.CREATED)
  emitirVotos(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: EmitirVotosDto,
  ): Promise<EmitirVotosResponseDto> {
    return this.service.emitirVotos(id, user.id, dto);
  }

  @Get(':id/resultados')
  @Roles(Rol.ADMINISTRADOR)
  obtenerResultados(@Param('id') id: string) {
    return this.service.obtenerResultados(id);
  }
}