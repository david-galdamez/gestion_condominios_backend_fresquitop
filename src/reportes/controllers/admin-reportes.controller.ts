import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { Rol, type User } from '@PrismaClient';
import {
  AdminReporteDetalleDto,
  AdminReportesPaginaDto,
  AdminReportesQueryDto,
  AsignacionReporteResponseDto,
  AsignarReporteDto,
} from '@Reportes/dto';
import { AdminReportesService } from '@Reportes/services';

@ApiTags('admin/reportes')
@ApiBearerAuth()
@Roles(Rol.ADMINISTRADOR)
@Controller('admin/reportes')
export class AdminReportesController {
  constructor(private readonly service: AdminReportesService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar reportes para administración ordenados por prioridad (ALTA -> MEDIA -> BAJA -> sin asignar) y antigüedad',
  })
  @ApiOkResponse({ type: AdminReportesPaginaDto })
  @ApiBadRequestResponse({ description: 'Parámetros de consulta inválidos.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión.' })
  @ApiForbiddenResponse({ description: 'No tienes permiso para esta acción' })
  listar(@Query() query: AdminReportesQueryDto): Promise<AdminReportesPaginaDto> {
    return this.service.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle completo de un reporte con evidencias e historial cronológico' })
  @ApiOkResponse({ type: AdminReporteDetalleDto })
  @ApiNotFoundResponse({ description: 'Reporte no encontrado.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión.' })
  @ApiForbiddenResponse({ description: 'No tienes permiso para esta acción' })
  obtenerDetalle(@Param('id') id: string): Promise<AdminReporteDetalleDto> {
    return this.service.obtenerDetalle(id);
  }

  @Patch(':id/asignacion')
  @ApiOperation({ summary: 'Asignar o reasignar prioridad y responsable de un reporte' })
  @ApiOkResponse({ type: AsignacionReporteResponseDto })
  @ApiBadRequestResponse({ description: 'Asigna prioridad y responsable juntos o datos inválidos.' })
  @ApiNotFoundResponse({ description: 'Reporte no encontrado.' })
  @ApiConflictResponse({ description: 'No se puede modificar un reporte resuelto.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión.' })
  @ApiForbiddenResponse({ description: 'No tienes permiso para esta acción' })
  asignar(
    @Param('id') id: string,
    @CurrentUser() admin: User,
    @Body() dto: AsignarReporteDto,
  ): Promise<AsignacionReporteResponseDto> {
    return this.service.asignar(id, admin.id, dto);
  }
}