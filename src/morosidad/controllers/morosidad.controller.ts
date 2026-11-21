import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '@Auth/decorators';
import { MorosidadService } from '@Morosidad/services';
import { MorosidadQueryDto, MorosidadResponseDto } from '@Morosidad/dto';

@ApiTags('morosidad')
@ApiBearerAuth()
@Controller('admin/morosidad')
export class MorosidadController {
  constructor(private readonly morosidadService: MorosidadService) {}

  @Get()
  @Roles('ADMINISTRADOR')
  @ApiOperation({
    summary:
      'Lista las unidades activas morosas y desde cuándo tienen cuotas vencidas',
  })
  @ApiOkResponse({ type: MorosidadResponseDto })
  @ApiBadRequestResponse({ description: 'Parámetros de consulta inválidos.' })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido o expirado.',
  })
  @ApiForbiddenResponse({ description: 'No tienes permiso para esta acción' })
  @ApiNotFoundResponse({ description: 'Torre no encontrada' })
  consultar(@Query() query: MorosidadQueryDto): Promise<MorosidadResponseDto> {
    return this.morosidadService.consultar(query);
  }
}
