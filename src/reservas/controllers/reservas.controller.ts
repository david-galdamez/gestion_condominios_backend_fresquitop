import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
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
import { Rol, type User } from '@PrismaClient';
import { CrearReservaDto, MisReservasResponseDto, ReservaDto } from '@Reservas/dto';
import { ReservasService } from '@Reservas/services';

@ApiTags('reservas')
@Roles(Rol.RESIDENTE)
@ApiUnauthorizedResponse({ description: 'Sin sesión.' })
@ApiForbiddenResponse({ description: 'Rol no permitido.' })
@Controller('reservas')
export class ReservasController {
  constructor(private readonly service: ReservasService) {}

  @Post()
  @ApiOperation({ summary: 'Reservar un área común sin cruces de horario' })
  @ApiCreatedResponse({ type: ReservaDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos, fecha pasada, horario, duración o capacidad no permitidos.' })
  @ApiNotFoundResponse({ description: 'El área no existe o está inactiva.' })
  @ApiConflictResponse({ description: 'Ese horario ya está reservado.' })
  crear(@CurrentUser() user: User, @Body() dto: CrearReservaDto): Promise<ReservaDto> {
    return this.service.crear(user.id, dto);
  }

  @Get('mias')
  @ApiOperation({ summary: 'Listar las reservas del residente autenticado' })
  @ApiOkResponse({ type: MisReservasResponseDto })
  mias(@CurrentUser() user: User): Promise<MisReservasResponseDto> {
    return this.service.listarMias(user.id);
  }

  @Patch(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una reserva propia con al menos 24 horas de anticipación' })
  @ApiOkResponse({ type: ReservaDto })
  @ApiBadRequestResponse({ description: 'El id no es UUID.' })
  @ApiNotFoundResponse({ description: 'La reserva no existe o no pertenece al residente.' })
  @ApiConflictResponse({ description: 'Ya no puedes cancelar esta reserva.' })
  cancelar(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<ReservaDto> {
    return this.service.cancelar(id, user.id);
  }
}
