import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
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
import { AreasService } from '@Areas/services';
import { AreaDto, CambiarEstadoAreaDto, GuardarAreaDto, ListaAreasResponseDto } from '@Areas/dto';
import { Rol, type User } from '@PrismaClient';

@ApiTags('areas')
@Roles(Rol.ADMINISTRADOR)
@ApiUnauthorizedResponse({ description: 'Sin sesión.' })
@ApiForbiddenResponse({ description: 'Rol no permitido.' })
@Controller('areas')
export class AreasController {
  constructor(private readonly service: AreasService) {}

  @Get()
  // Override del @Roles de la clase: el residente también lista (solo activas).
  @Roles(Rol.ADMINISTRADOR, Rol.RESIDENTE)
  @ApiOperation({ summary: 'Listar áreas (administrador: todas; residente: solo activas)' })
  @ApiOkResponse({ type: ListaAreasResponseDto })
  listar(@CurrentUser() user: User): Promise<ListaAreasResponseDto> {
    return this.service.listar(user.rol);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un área común' })
  @ApiCreatedResponse({ type: AreaDto })
  @ApiBadRequestResponse({ description: 'Campo fuera de rango, hora no en punto o cierre ≤ apertura.' })
  @ApiConflictResponse({ description: 'Ya existe un área con ese nombre.' })
  crear(@Body() dto: GuardarAreaDto): Promise<AreaDto> {
    return this.service.crear(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Editar un área (no anula reservas confirmadas)' })
  @ApiOkResponse({ type: AreaDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos o id no es UUID.' })
  @ApiNotFoundResponse({ description: 'El área no existe.' })
  @ApiConflictResponse({ description: 'Ya existe un área con ese nombre.' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: GuardarAreaDto): Promise<AreaDto> {
    return this.service.actualizar(id, dto);
  }

  @Patch(':id/estado')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activar o desactivar un área' })
  @ApiOkResponse({ type: AreaDto })
  @ApiBadRequestResponse({ description: 'activa no es booleano o id no es UUID.' })
  @ApiNotFoundResponse({ description: 'El área no existe.' })
  cambiarEstado(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CambiarEstadoAreaDto): Promise<AreaDto> {
    return this.service.cambiarEstado(id, dto.activa);
  }
}
