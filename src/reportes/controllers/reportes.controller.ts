import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFiles,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import {
  CreateReporteDto,
  ReporteDto,
  ReportesPaginaDto,
  ReportesQueryDto,
  UbicacionesDto,
} from '@Reportes/dto';
import { FotoDemasiadoGrandeFilter } from '@Reportes/filters';
import { ReportesService } from '@Reportes/services';
import { Rol, type User } from '@PrismaClient';
import {
  DESCRIPCION_MAX,
  DESCRIPCION_MIN,
  MAX_FOTO_BYTES,
  MAX_FOTOS,
  MAX_FOTOS_MULTER,
  TITULO_MAX,
  TITULO_MIN,
} from '../reportes.constants.js';
import type { FotoSubida } from '../reportes.types.js';

@ApiTags('reportes')
@ApiBearerAuth()
@Controller('reportes')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  @Post()
  @Roles(Rol.RESIDENTE)
  @UseFilters(FotoDemasiadoGrandeFilter)
  // Sin `storage` multer usa memoria: el servicio valida y recién ahí escribe a disco.
  @UseInterceptors(
    FilesInterceptor('fotos', MAX_FOTOS_MULTER, {
      limits: { fileSize: MAX_FOTO_BYTES, files: MAX_FOTOS_MULTER },
    }),
  )
  @ApiOperation({ summary: 'Registrar un reporte con 0 a 5 fotos' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['titulo', 'categoria', 'ubicacion', 'descripcion'],
      properties: {
        titulo: { type: 'string', minLength: TITULO_MIN, maxLength: TITULO_MAX },
        categoria: { type: 'string', enum: ['FUGA', 'LUMINARIA', 'ASCENSOR', 'LIMPIEZA', 'OTRO'] },
        ubicacion: { type: 'string', example: 'Torre A' },
        descripcion: { type: 'string', minLength: DESCRIPCION_MIN, maxLength: DESCRIPCION_MAX },
        fotos: {
          type: 'array',
          maxItems: MAX_FOTOS,
          items: { type: 'string', format: 'binary' },
          description: 'JPG o PNG, máx. 5 MB cada una.',
        },
      },
    },
  })
  @ApiCreatedResponse({ type: ReporteDto })
  @ApiBadRequestResponse({ description: 'Campo fuera de rango, archivo inválido o más de 5 fotos.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión.' })
  @ApiForbiddenResponse({ description: 'Rol no permitido.' })
  crear(
    @CurrentUser() user: User,
    @Body() dto: CreateReporteDto,
    @UploadedFiles() fotos: FotoSubida[] = [],
  ): Promise<ReporteDto> {
    return this.service.crear(user.id, dto, fotos);
  }

  @Get()
  @Roles(Rol.RESIDENTE)
  @ApiOperation({ summary: 'Mis reportes, del más reciente al más antiguo (20 por página)' })
  @ApiOkResponse({ type: ReportesPaginaDto })
  @ApiBadRequestResponse({ description: 'Parámetros inválidos.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión.' })
  @ApiForbiddenResponse({ description: 'Rol no permitido.' })
  listar(@CurrentUser() user: User, @Query() query: ReportesQueryDto): Promise<ReportesPaginaDto> {
    return this.service.listar(user.id, query.pagina ?? 1);
  }

  // Debe declararse antes de `:numero` para que "ubicaciones" no se tome como número.
  @Get('ubicaciones')
  @Roles(Rol.RESIDENTE)
  @ApiOperation({ summary: 'Torres y áreas comunes válidas como ubicación' })
  @ApiOkResponse({ type: UbicacionesDto })
  @ApiUnauthorizedResponse({ description: 'Sin sesión.' })
  @ApiForbiddenResponse({ description: 'Rol no permitido.' })
  ubicaciones(): Promise<UbicacionesDto> {
    return this.service.ubicaciones();
  }

  @Get(':numero')
  @Roles(Rol.RESIDENTE)
  @ApiOperation({ summary: 'Detalle de un reporte propio (ej. REP-000123)' })
  @ApiOkResponse({ type: ReporteDto })
  @ApiNotFoundResponse({ description: 'Reporte no encontrado (inexistente o de otro residente).' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión.' })
  @ApiForbiddenResponse({ description: 'Rol no permitido.' })
  obtener(@CurrentUser() user: User, @Param('numero') numero: string): Promise<ReporteDto> {
    return this.service.obtener(user.id, numero);
  }

  @Get(':numero/fotos/:fotoId')
  @Roles(Rol.RESIDENTE)
  @ApiOperation({ summary: 'Descarga una foto de un reporte propio' })
  @ApiOkResponse({ description: 'Imagen JPG o PNG.' })
  @ApiNotFoundResponse({ description: 'Reporte no encontrado.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión.' })
  @ApiForbiddenResponse({ description: 'Rol no permitido.' })
  async foto(
    @CurrentUser() user: User,
    @Param('numero') numero: string,
    @Param('fotoId') fotoId: string,
  ): Promise<StreamableFile> {
    const { stream, mimeType } = await this.service.abrirFoto(user.id, numero, fotoId);
    return new StreamableFile(stream, { type: mimeType, disposition: 'inline' });
  }
}
