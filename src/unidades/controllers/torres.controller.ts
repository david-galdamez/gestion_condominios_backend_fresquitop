import { Controller, Get } from '@nestjs/common';
import { ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Roles } from '@Auth/decorators';
import { TorreDto } from '@Unidades/dto';
import { UnidadRepository } from '@Unidades/repositories';
import { Rol } from '@PrismaClient';

@ApiTags('torres')
@Controller('torres')
export class TorresController {
  constructor(private readonly unidades: UnidadRepository) {}

  @Get()
  @Roles(Rol.ADMINISTRADOR)
  @ApiOperation({ summary: 'Torres del condominio (destinatarios de comunicados)' })
  @ApiOkResponse({ type: TorreDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Sin sesión.' })
  @ApiForbiddenResponse({ description: 'Rol no permitido.' })
  listar(): Promise<TorreDto[]> {
    return this.unidades.findTorres();
  }
}
