import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { CuotasService } from '@Cuotas/services';
import {
  ConfiguracionCuotaDto,
  GeneracionCuotasDto,
  GenerarCuotasDto,
  GuardarConfiguracionDto,
} from '@Cuotas/dto';
import { Rol, type User } from '@PrismaClient';

@ApiTags('cuotas')
@Roles(Rol.ADMINISTRADOR)
@ApiUnauthorizedResponse({ description: 'Sin sesión.' })
@ApiForbiddenResponse({ description: 'Rol no permitido.' })
@Controller('cuotas')
export class CuotasController {
  constructor(private readonly service: CuotasService) {}

  @Get('configuracion')
  @ApiOperation({ summary: 'Configuración de cuota vigente' })
  @ApiOkResponse({ type: ConfiguracionCuotaDto })
  @ApiNotFoundResponse({
    description: 'Todavía no existe configuración de cuota.',
  })
  obtenerConfiguracion(): Promise<ConfiguracionCuotaDto> {
    return this.service.obtenerConfiguracion();
  }

  @Put('configuracion')
  @ApiOperation({
    summary: 'Guardar monto mensual y día de vencimiento',
    description:
      'Aplica desde la siguiente generación; las cuotas ya generadas conservan su monto.',
  })
  @ApiOkResponse({ type: ConfiguracionCuotaDto })
  @ApiBadRequestResponse({ description: 'Monto o día fuera de rango.' })
  guardarConfiguracion(
    @CurrentUser() user: User,
    @Body() dto: GuardarConfiguracionDto,
  ): Promise<ConfiguracionCuotaDto> {
    return this.service.guardarConfiguracion(user.id, dto);
  }

  @Post('generar')
  @ApiOperation({
    summary: 'Generar las cuotas de un periodo para todas las unidades activas',
    description:
      'Idempotente: las unidades que ya tienen cuota del periodo se omiten.',
  })
  @ApiCreatedResponse({ type: GeneracionCuotasDto })
  @ApiBadRequestResponse({
    description: 'Periodo con otro formato o posterior al mes siguiente.',
  })
  @ApiConflictResponse({ description: 'No existe configuración de cuota.' })
  generar(
    @CurrentUser() user: User,
    @Body() dto: GenerarCuotasDto,
  ): Promise<GeneracionCuotasDto> {
    return this.service.generarManual(user.id, dto.periodo);
  }
}
