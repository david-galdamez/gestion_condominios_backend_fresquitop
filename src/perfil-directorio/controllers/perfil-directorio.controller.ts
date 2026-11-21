import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { GuardarPerfilDirectorioDto, PerfilDirectorioDto } from '@PerfilDirectorio/dto';
import { PerfilDirectorioService } from '@PerfilDirectorio/services';
import { Rol, type User } from '@PrismaClient';

// Ruta propia (directorio/mi-perfil) para no chocar con GET /directorio de H16.
@ApiTags('directorio')
@Roles(Rol.RESIDENTE)
@ApiUnauthorizedResponse({ description: 'Sin sesión.' })
@ApiForbiddenResponse({ description: 'Rol no permitido.' })
@Controller('directorio/mi-perfil')
export class PerfilDirectorioController {
  constructor(private readonly service: PerfilDirectorioService) {}

  @Get()
  @ApiOperation({ summary: 'Mi configuración de privacidad en el directorio (oculto por defecto)' })
  @ApiOkResponse({ type: PerfilDirectorioDto })
  obtener(@CurrentUser() user: User): Promise<PerfilDirectorioDto> {
    return this.service.obtener(user.id);
  }

  @Put()
  @ApiOperation({ summary: 'Guardar si aparezco en el directorio y qué datos muestro' })
  @ApiOkResponse({ type: PerfilDirectorioDto })
  @ApiBadRequestResponse({ description: 'Visible sin ningún dato marcado, o campo no booleano.' })
  guardar(@CurrentUser() user: User, @Body() dto: GuardarPerfilDirectorioDto): Promise<PerfilDirectorioDto> {
    return this.service.guardar(user.id, dto);
  }
}
