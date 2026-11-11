import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '@Auth/decorators';
import { AccesosService } from '@Accesos/services';
import { AutorizacionesPorteriaResponseDto, BuscarDto } from '@Accesos/dto';
import { Rol } from '@PrismaClient';

/**
 * Búsqueda de pre-autorizaciones desde portería (H08). Vive en este módulo
 * para no mezclar el rol SEGURIDAD en el controlador de residentes (H07).
 */
@ApiTags('autorizaciones')
@Roles(Rol.SEGURIDAD)
@ApiUnauthorizedResponse({ description: 'Sin sesión.' })
@ApiForbiddenResponse({ description: 'Rol no permitido.' })
@Controller('autorizaciones')
export class PorteriaAutorizacionesController {
  constructor(private readonly service: AccesosService) {}

  @Get('buscar')
  @ApiOperation({ summary: 'Autorizaciones de hoy por código de 6 dígitos o número de documento' })
  @ApiOkResponse({ type: AutorizacionesPorteriaResponseDto })
  @ApiBadRequestResponse({ description: 'Búsqueda vacía o demasiado larga.' })
  buscar(@Query() { q }: BuscarDto): Promise<AutorizacionesPorteriaResponseDto> {
    return this.service.buscarAutorizacionesDeHoy(q);
  }
}
