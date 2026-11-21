import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificacionService } from '@Notificaciones/services';
import { API_PREFIX } from '../../app.setup.js';
import type {
  AdminReporteDetalleDto,
  AdminReporteItemDto,
  AdminReportesPaginaDto,
  AdminReportesQueryDto,
  AsignacionReporteResponseDto,
  AsignarReporteDto,
  ResolverReporteDto,
  ResolverReporteResponseDto,
} from '@Reportes/dto';
import {
  ReporteEstadoInvalidoError,
  ReporteNotFoundError,
  ReporteYaResueltoError,
} from '@Reportes/errors';
import {
  ReporteRepository,
  type ReporteAdminDetalle,
  type ReporteAdminItem,
} from '@Reportes/repositories';
import {
  COMENTARIO_CIERRE_MAX,
  COMENTARIO_CIERRE_MIN,
  MENSAJE_ASIGNACION_INCOMPLETA,
  MENSAJE_COMENTARIO_CIERRE,
  MENSAJE_REPORTE_NO_ENCONTRADO,
  MENSAJE_REPORTE_YA_RESUELTO,
  MENSAJE_RESPONSABLE_LONGITUD,
  MENSAJE_SOLO_EN_PROCESO,
  REPORTES_PAGE_SIZE,
  RESPONSABLE_MAX,
  RESPONSABLE_MIN,
} from '../reportes.constants.js';
import { compararPrioridadReporte, formatearNumero } from '../reportes.utils.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function aAdminItemDto(r: ReporteAdminItem): AdminReporteItemDto {
  return {
    id: r.id,
    numero: formatearNumero(r.numero),
    titulo: r.titulo,
    categoria: r.categoria,
    ubicacion: r.ubicacion,
    estado: r.estado,
    prioridad: r.prioridad,
    responsable: r.responsable,
    creadoEn: r.createdAt.toISOString(),
    residente: {
      id: r.residente.id,
      nombre: r.residente.nombre,
      email: r.residente.email,
    },
    unidades: r.residente.unidades.map((u) => u.unidad.codigo),
  };
}

function aAdminDetalleDto(r: ReporteAdminDetalle): AdminReporteDetalleDto {
  const numero = formatearNumero(r.numero);
  return {
    ...aAdminItemDto(r),
    descripcion: r.descripcion,
    resueltoEn: r.resueltoEn ? r.resueltoEn.toISOString() : null,
    comentarioCierre: r.comentarioCierre,
    evidencias: r.evidencias.map((e) => ({
      id: e.id,
      mimeType: e.mimeType,
      tamanoBytes: e.tamanoBytes,
      orden: e.orden,
      url: `/${API_PREFIX}/reportes/${numero}/fotos/${e.id}`,
    })),
    historial: r.historial.map((h) => ({
      id: h.id,
      estado: h.estado,
      comentario: h.comentario,
      fecha: h.createdAt.toISOString(),
      autor: {
        id: h.cambiadoPor.id,
        nombre: h.cambiadoPor.nombre,
        rol: h.cambiadoPor.rol,
      },
    })),
  };
}

@Injectable()
export class AdminReportesService {
  constructor(
    private readonly reportes: ReporteRepository,
    private readonly notificaciones: NotificacionService,
  ) {}

  async listar(query: AdminReportesQueryDto): Promise<AdminReportesPaginaDto> {
    const pagina = query.pagina ?? 1;
    const { reportes, total } = await this.reportes.findPaginaAdmin({
      estado: query.estado,
      categoria: query.categoria,
      skip: (pagina - 1) * REPORTES_PAGE_SIZE,
      take: REPORTES_PAGE_SIZE,
    });

    const ordenados = [...reportes].sort(compararPrioridadReporte);

    return {
      datos: ordenados.map(aAdminItemDto),
      total,
      pagina,
      porPagina: REPORTES_PAGE_SIZE,
    };
  }

  async obtenerDetalle(id: string): Promise<AdminReporteDetalleDto> {
    if (!UUID_REGEX.test(id)) {
      throw new NotFoundException(MENSAJE_REPORTE_NO_ENCONTRADO);
    }

    const reporte = await this.reportes.findDetalleAdminById(id);
    if (!reporte) {
      throw new NotFoundException(MENSAJE_REPORTE_NO_ENCONTRADO);
    }

    return aAdminDetalleDto(reporte);
  }

  async asignar(
    id: string,
    adminId: string,
    dto: AsignarReporteDto,
  ): Promise<AsignacionReporteResponseDto> {
    const prioridad = dto.prioridad;
    const responsable = typeof dto.responsable === 'string' ? dto.responsable.trim() : '';

    if (!prioridad || responsable.length === 0) {
      throw new BadRequestException(MENSAJE_ASIGNACION_INCOMPLETA);
    }

    if (responsable.length < RESPONSABLE_MIN || responsable.length > RESPONSABLE_MAX) {
      throw new BadRequestException(MENSAJE_RESPONSABLE_LONGITUD);
    }

    if (!UUID_REGEX.test(id)) {
      throw new NotFoundException(MENSAJE_REPORTE_NO_ENCONTRADO);
    }

    const comentario = `Prioridad: ${prioridad} · Responsable: ${responsable}`;

    try {
      const actualizado = await this.reportes.asignar({
        reporteId: id,
        adminId,
        prioridad,
        responsable,
        comentario,
      });

      return {
        id: actualizado.id,
        numero: formatearNumero(actualizado.numero),
        estado: actualizado.estado,
        prioridad: actualizado.prioridad!,
        responsable: actualizado.responsable!,
      };
    } catch (error) {
      if (error instanceof ReporteNotFoundError) {
        throw new NotFoundException(MENSAJE_REPORTE_NO_ENCONTRADO);
      }
      if (error instanceof ReporteYaResueltoError) {
        throw new ConflictException(MENSAJE_REPORTE_YA_RESUELTO);
      }
      throw error;
    }
  }

  async resolver(
    id: string,
    adminId: string,
    dto: ResolverReporteDto,
  ): Promise<ResolverReporteResponseDto> {
    const comentario = typeof dto?.comentario === 'string' ? dto.comentario.trim() : '';

    if (comentario.length < COMENTARIO_CIERRE_MIN || comentario.length > COMENTARIO_CIERRE_MAX) {
      throw new BadRequestException(MENSAJE_COMENTARIO_CIERRE);
    }

    if (!UUID_REGEX.test(id)) {
      throw new NotFoundException(MENSAJE_REPORTE_NO_ENCONTRADO);
    }

    let actualizado;
    try {
      actualizado = await this.reportes.resolver({
        reporteId: id,
        adminId,
        comentario,
      });
    } catch (error) {
      if (error instanceof ReporteNotFoundError) {
        throw new NotFoundException(MENSAJE_REPORTE_NO_ENCONTRADO);
      }
      if (error instanceof ReporteEstadoInvalidoError) {
        throw new ConflictException(MENSAJE_SOLO_EN_PROCESO);
      }
      throw error;
    }

    const numero = formatearNumero(actualizado.numero);

    await this.notificaciones.enviar({
      destinatario: { tipo: 'USUARIO', id: actualizado.residenteId },
      titulo: `Tu reporte ${numero} fue resuelto`,
      mensaje: comentario,
      moduloOrigen: 'INCIDENCIAS',
      referencia: `/reportes/${numero}`,
    });

    return {
      id: actualizado.id,
      numero,
      estado: actualizado.estado,
      resueltoEn: actualizado.resueltoEn!.toISOString(),
    };
  }
}