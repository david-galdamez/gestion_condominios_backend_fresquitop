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
import { CurrentUser, Roles } from '@Auth/decorators';
import { Rol, type User } from '@PrismaClient';
import { BuscarVecinosQueryDto, DirectorioResponseDto } from '../dto/index.js';
import { DirectorioService } from '../services/index.js';

@ApiTags('directorio')
@ApiBearerAuth()
@Roles(Rol.RESIDENTE)
@ApiUnauthorizedResponse({ description: 'Sin sesión.' })
@ApiForbiddenResponse({ description: 'No tienes permiso para esta acción' })
@Controller('directorio')
export class DirectorioController {
  constructor(private readonly service: DirectorioService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar vecinos por nombre o unidad, con los datos que cada uno autorizó (H16)' })
  @ApiOkResponse({ type: DirectorioResponseDto })
  @ApiBadRequestResponse({ description: 'q con menos de 2 o más de 60 caracteres, o página inválida.' })
  buscar(@CurrentUser() user: User, @Query() query: BuscarVecinosQueryDto): Promise<DirectorioResponseDto> {
    return this.service.buscar(user.id, query);
  }
}
