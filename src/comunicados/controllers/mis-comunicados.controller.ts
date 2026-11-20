import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
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
import { CurrentUser, Roles } from '@Auth/decorators';
import {
  ConteoNoLeidosDto,
  MiComunicadoDetalleDto,
  MisComunicadosQueryDto,
  MisComunicadosResponseDto,
} from '@Comunicados/dto';
import { MSG_COMUNICADO_NO_ENCONTRADO, MisComunicadosService } from '@Comunicados/services';
import { Rol, type User } from '@PrismaClient';

/** H14 · Vista del residente. La del administrador está en ComunicadosController. */
@ApiTags('comunicados')
@ApiBearerAuth()
@Roles(Rol.RESIDENTE)
@ApiUnauthorizedResponse({ description: 'Sin sesión.' })
@ApiForbiddenResponse({ description: 'No tienes permiso para esta acción' })
@Controller('comunicados')
export class MisComunicadosController {
  constructor(private readonly service: MisComunicadosService) {}

  @Get('mios')
  @ApiOperation({
    summary: 'Mis comunicados: pestaña principal o "Archivo", 20 por página (H14)',
  })
  @ApiOkResponse({ type: MisComunicadosResponseDto })
  @ApiBadRequestResponse({ description: 'archivo o pagina inválidos.' })
  listar(@CurrentUser() user: User, @Query() query: MisComunicadosQueryDto): Promise<MisComunicadosResponseDto> {
    return this.service.listar(user.id, query);
  }

  @Get('no-leidos/conteo')
  @ApiOperation({ summary: 'Cuántos comunicados vigentes no he leído (H14)' })
  @ApiOkResponse({ type: ConteoNoLeidosDto })
  contarNoLeidos(@CurrentUser() user: User): Promise<ConteoNoLeidosDto> {
    return this.service.contarNoLeidos(user.id);
  }

  @Get('mios/:id')
  @ApiOperation({
    summary: 'Abrir un comunicado; queda marcado como leído (H14)',
  })
  @ApiOkResponse({ type: MiComunicadoDetalleDto })
  @ApiNotFoundResponse({
    description: 'Comunicado no encontrado (no existe, no está publicado o es de otra torre).',
  })
  abrir(
    @CurrentUser() user: User,
    // Un enlace mal formado se trata igual que uno de otra torre.
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () => new NotFoundException(MSG_COMUNICADO_NO_ENCONTRADO),
      }),
    )
    id: string,
  ): Promise<MiComunicadoDetalleDto> {
    return this.service.abrir(user.id, id);
  }
}
