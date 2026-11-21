import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '@Auth/decorators';
import { Rol } from '@PrismaClient';
import { PanelQueryDto, PanelResponseDto } from '../dto/index.js';
import { PanelService } from '../services/index.js';

@ApiTags('admin/panel')
@ApiBearerAuth()
@Roles(Rol.ADMINISTRADOR)
@Controller('admin/panel')
export class PanelController {
  constructor(private readonly service: PanelService) {}

  @Get()
  @ApiOperation({
    summary: 'Panel de salud del condominio: morosidad, ocupación de áreas, incidencias y participación',
  })
  @ApiOkResponse({ type: PanelResponseDto })
  @ApiBadRequestResponse({ description: 'Fechas ausentes, invertidas o rango mayor a 366 días.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión.' })
  @ApiForbiddenResponse({ description: 'No tienes permiso para esta acción' })
  consultar(@Query() query: PanelQueryDto): Promise<PanelResponseDto> {
    return this.service.consultar(query);
  }
}
