import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { AutorizacionesService } from '@Autorizaciones/services';
import {
  AutorizacionDto,
  CrearAutorizacionDto,
  EditarAutorizacionDto,
  MisAutorizacionesResponseDto,
} from '@Autorizaciones/dto';
import { Rol, type User } from '@PrismaClient';

@ApiTags('autorizaciones')
@Roles(Rol.RESIDENTE)
@ApiUnauthorizedResponse({ description: 'Sin sesión.' })
@ApiForbiddenResponse({ description: 'Rol no permitido o unidad ajena.' })
@Controller('autorizaciones')
export class AutorizacionesController {
  constructor(private readonly service: AutorizacionesService) {}

  @Post()
  @ApiOperation({ summary: 'Pre-autorizar a un visitante' })
  @ApiCreatedResponse({ type: AutorizacionDto })
  @ApiBadRequestResponse({
    description: 'Datos inválidos, fecha fuera de rango o unidad no indicada.',
  })
  @ApiServiceUnavailableResponse({
    description: 'No se pudo generar un código único.',
  })
  crear(@CurrentUser() user: User, @Body() dto: CrearAutorizacionDto): Promise<AutorizacionDto> {
    return this.service.crear(user.id, dto);
  }

  // Declarada antes de GET :id para que "mias" no se tome como id.
  @Get('mias')
  @ApiOperation({
    summary: 'Autorizaciones creadas por el residente (todas sus unidades)',
  })
  @ApiOkResponse({ type: MisAutorizacionesResponseDto })
  mias(@CurrentUser() user: User): Promise<MisAutorizacionesResponseDto> {
    return this.service.listarMias(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una autorización propia (formulario de edición)' })
  @ApiOkResponse({ type: AutorizacionDto })
  @ApiBadRequestResponse({ description: 'El id no es un UUID.' })
  @ApiNotFoundResponse({ description: 'No existe o no es del residente.' })
  obtener(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<AutorizacionDto> {
    return this.service.obtener(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar una autorización vigente (H07b)' })
  @ApiOkResponse({ type: AutorizacionDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos, fecha fuera de rango o intento de cambiar la unidad.' })
  @ApiNotFoundResponse({ description: 'No existe o no es del residente.' })
  @ApiConflictResponse({ description: 'Ya no está vigente.' })
  @ApiServiceUnavailableResponse({ description: 'No se pudo generar un código único.' })
  editar(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditarAutorizacionDto,
  ): Promise<AutorizacionDto> {
    return this.service.editar(id, user.id, dto);
  }

  @Patch(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una autorización vigente' })
  @ApiOkResponse({ type: AutorizacionDto })
  @ApiBadRequestResponse({ description: 'El id no es un UUID.' })
  @ApiNotFoundResponse({ description: 'No existe o no es del residente.' })
  @ApiConflictResponse({ description: 'Ya no está vigente.' })
  cancelar(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<AutorizacionDto> {
    return this.service.cancelar(id, user.id);
  }
}
