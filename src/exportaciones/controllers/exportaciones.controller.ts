import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { Rol, type User } from '@PrismaClient';
import { ExportarReporteQueryDto } from '../dto/index.js';
import { ExportacionesService, TIPO_ARCHIVO } from '../services/index.js';

@ApiTags('admin/reportescondominio')
@ApiBearerAuth()
@Roles(Rol.ADMINISTRADOR)
@Controller('admin/reportescondominio')
export class ExportacionesController {
  constructor(private readonly service: ExportacionesService) {}

  @Get('exportar')
  @ApiOperation({ summary: 'Exportar el reporte del panel en PDF o Excel para la mesa directiva (H20)' })
  @ApiProduces(TIPO_ARCHIVO.PDF.tipo, TIPO_ARCHIVO.EXCEL.tipo)
  @ApiResponse({
    status: 200,
    description: 'Archivo reporte-condominio-AAAA-MM-DD.pdf o .xlsx (adjunto).',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiBadRequestResponse({ description: '"Selecciona un periodo", periodo inválido, formato o versión inválidos.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión.' })
  @ApiForbiddenResponse({ description: 'No tienes permiso para esta acción' })
  async exportar(@CurrentUser() user: User, @Query() query: ExportarReporteQueryDto): Promise<StreamableFile> {
    const archivo = await this.service.exportar({ id: user.id, nombre: user.nombre }, query);
    return new StreamableFile(archivo.contenido, {
      type: archivo.tipo,
      disposition: `attachment; filename="${archivo.nombre}"`,
      length: archivo.contenido.length,
    });
  }
}
