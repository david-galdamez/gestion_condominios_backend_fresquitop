import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { ComunicadoDto, ComunicadosResponseDto, CrearComunicadoDto } from '@Comunicados/dto';
import { ComunicadosService } from '@Comunicados/services';
import { Rol, type User } from '@PrismaClient';

@ApiTags('comunicados')
@ApiBearerAuth()
@Roles(Rol.ADMINISTRADOR)
@ApiUnauthorizedResponse({ description: 'Sin sesión.' })
@ApiForbiddenResponse({ description: 'No tienes permiso para esta acción' })
@Controller('comunicados')
export class ComunicadosController {
  constructor(private readonly service: ComunicadosService) {}

  @Post()
  @ApiOperation({ summary: 'Publicar o programar un comunicado (H13)' })
  @ApiCreatedResponse({ type: ComunicadoDto })
  @ApiBadRequestResponse({ description: 'Campos fuera de rango, sin destinatarios o expiración no posterior.' })
  @ApiNotFoundResponse({ description: 'Una torre no existe.' })
  crear(@CurrentUser() user: User, @Body() dto: CrearComunicadoDto): Promise<ComunicadoDto> {
    return this.service.crear(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Comunicados publicados, programados y expirados (vista del administrador)' })
  @ApiOkResponse({ type: ComunicadosResponseDto })
  listar(): Promise<ComunicadosResponseDto> {
    return this.service.listar();
  }
}
