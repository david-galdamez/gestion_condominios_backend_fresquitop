import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
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
import { AccesosService } from '@Accesos/services';
import { AccesoDto, AccesosResponseDto, BuscarDto, RegistrarEntradaDto } from '@Accesos/dto';
import { Rol, type User } from '@PrismaClient';

@ApiTags('accesos')
@Roles(Rol.SEGURIDAD)
@ApiUnauthorizedResponse({ description: 'Sin sesión.' })
@ApiForbiddenResponse({ description: 'Rol no permitido.' })
@Controller('accesos')
export class AccesosController {
  constructor(private readonly service: AccesosService) {}

  @Post('entrada')
  @ApiOperation({
    summary: 'Registrar la entrada de un visitante',
    description: 'Con { codigo } usa la pre-autorización de hoy; sin código requiere nombre, documento, unidad y motivo.',
  })
  @ApiCreatedResponse({ type: AccesoDto })
  @ApiBadRequestResponse({ description: 'Faltan datos o formato inválido.' })
  @ApiNotFoundResponse({ description: 'Código o unidad inexistente.' })
  @ApiConflictResponse({ description: '"Código no válido: está {estado}" o el código es de otra fecha.' })
  registrarEntrada(@CurrentUser() user: User, @Body() dto: RegistrarEntradaDto): Promise<AccesoDto> {
    return this.service.registrarEntrada(user.id, dto);
  }

  @Patch(':id/salida')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registrar la salida de un visitante (mismo registro de la entrada)' })
  @ApiOkResponse({ type: AccesoDto })
  @ApiBadRequestResponse({ description: 'El id no es un UUID.' })
  @ApiNotFoundResponse({ description: 'El registro no existe.' })
  @ApiConflictResponse({ description: 'Este visitante ya registró su salida.' })
  registrarSalida(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<AccesoDto> {
    return this.service.registrarSalida(id, user.id);
  }

  @Get('buscar')
  @ApiOperation({ summary: 'Visitantes dentro por número de documento o código de entrada (apoyo para la salida)' })
  @ApiOkResponse({ type: AccesosResponseDto })
  @ApiBadRequestResponse({ description: 'Búsqueda vacía o demasiado larga.' })
  buscarDentro(@Query() { q }: BuscarDto): Promise<AccesosResponseDto> {
    return this.service.buscarDentro(q);
  }
}
