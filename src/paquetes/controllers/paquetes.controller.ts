import { Body, Controller, Get, Post, UploadedFile, UseFilters, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { MAX_IMAGEN_BYTES, type ArchivoSubido } from '@Archivos/services';
import { CurrentUser, Roles } from '@Auth/decorators';
import { ListaPaquetesResponseDto, PaqueteDto, RegistrarPaqueteDto } from '@Paquetes/dto';
import { FotoDemasiadoGrandeFilter } from '@Paquetes/filters';
import { PaquetesService } from '@Paquetes/services';
import { Mensajeria, Rol, type User } from '@PrismaClient';

@ApiTags('paquetes')
@Roles(Rol.SEGURIDAD)
@ApiUnauthorizedResponse({ description: 'Sin sesión.' })
@ApiForbiddenResponse({ description: 'Rol no permitido.' })
@Controller('paquetes')
export class PaquetesController {
  constructor(private readonly service: PaquetesService) {}

  @Post()
  // Los guards (401/403) corren antes que el interceptor: sin permiso no se lee la foto.
  @UseInterceptors(FileInterceptor('foto', { limits: { fileSize: MAX_IMAGEN_BYTES, files: 1 } }))
  @UseFilters(FotoDemasiadoGrandeFilter)
  @ApiOperation({ summary: 'Registrar la llegada de un paquete (avisa a la unidad)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['unidadId', 'destinatario', 'mensajeria', 'foto'],
      properties: {
        unidadId: { type: 'string', format: 'uuid' },
        destinatario: { type: 'string', minLength: 3, maxLength: 60 },
        mensajeria: { type: 'string', enum: Object.values(Mensajeria) },
        guia: { type: 'string', maxLength: 40 },
        foto: { type: 'string', format: 'binary', description: 'JPG o PNG, máx. 5 MB' },
      },
    },
  })
  @ApiCreatedResponse({ type: PaqueteDto, description: 'Sin código de retiro.' })
  @ApiBadRequestResponse({ description: 'Campo inválido o foto que no es JPG/PNG de hasta 5 MB.' })
  @ApiNotFoundResponse({ description: 'La unidad no existe.' })
  @ApiConflictResponse({ description: 'La unidad no tiene residentes registrados.' })
  registrar(
    @CurrentUser() user: User,
    @Body() dto: RegistrarPaqueteDto,
    @UploadedFile() foto?: ArchivoSubido,
  ): Promise<PaqueteDto> {
    return this.service.registrar(user.id, dto, foto);
  }

  @Get()
  @ApiOperation({ summary: 'Paquetes en portería (En portería y Retenidos), más recientes primero' })
  @ApiOkResponse({ type: ListaPaquetesResponseDto })
  porRetirar(): Promise<ListaPaquetesResponseDto> {
    return this.service.listarPorRetirar();
  }
}
