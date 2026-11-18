import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { CurrentUser, Roles } from '@Auth/decorators';
import { ComprobanteDto, CuotasPorPagarDto, PagarCuotasDto, PagoAprobadoDto, PendientesQueryDto } from '@Pagos/dto';
import { PagosService } from '@Pagos/services';
import { Rol, type User } from '@PrismaClient';

export const MSG_CLAVE = 'Falta el encabezado Idempotency-Key (uuid)';

@ApiTags('pagos')
@Roles(Rol.RESIDENTE)
@ApiUnauthorizedResponse({ description: 'Sin sesión.' })
@ApiForbiddenResponse({ description: 'Rol no permitido o unidad ajena.' })
@Controller('pagos')
export class PagosController {
  constructor(private readonly service: PagosService) {}

  // Declarada antes de `:numeroTransaccion` para que "pendientes" no se tome como número.
  @Get('pendientes')
  @ApiOperation({ summary: 'Cuotas Pendientes y Vencidas de una unidad del residente (pantalla de pago)' })
  @ApiOkResponse({ type: CuotasPorPagarDto })
  pendientes(@CurrentUser() user: User, @Query() query: PendientesQueryDto): Promise<CuotasPorPagarDto> {
    return this.service.porPagar(user.id, query.unidadId);
  }

  @Post()
  @ApiOperation({ summary: 'Pagar cuotas con la tarjeta de prueba (espera simulada de 2 s)' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'uuid generado al abrir el formulario' })
  @ApiCreatedResponse({ type: PagoAprobadoDto })
  @ApiBadRequestResponse({ description: 'Tarjeta con formato inválido, lista vacía o sin Idempotency-Key.' })
  @ApiNotFoundResponse({ description: 'Una cuota no existe o no es de tu unidad.' })
  @ApiConflictResponse({ description: 'Esta cuota ya fue pagada.' })
  @ApiUnprocessableEntityResponse({ description: '{ estado: "RECHAZADO", motivo }' })
  pagar(
    @CurrentUser() user: User,
    @Headers('idempotency-key') clave: string | undefined,
    @Body() dto: PagarCuotasDto,
  ): Promise<PagoAprobadoDto> {
    if (!clave || !isUUID(clave)) throw new BadRequestException(MSG_CLAVE);
    return this.service.pagar(user.id, clave.toLowerCase(), dto);
  }

  @Get(':numeroTransaccion')
  @ApiOperation({ summary: 'Comprobante de un pago aprobado de mi unidad' })
  @ApiOkResponse({ type: ComprobanteDto })
  @ApiNotFoundResponse({ description: 'No existe o es de otra unidad.' })
  comprobante(@CurrentUser() user: User, @Param('numeroTransaccion') numero: string): Promise<ComprobanteDto> {
    return this.service.comprobante(user.id, numero);
  }
}
