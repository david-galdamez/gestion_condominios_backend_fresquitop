import type { ReadStream } from 'node:fs';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { API_PREFIX } from '../../app.setup.js';
import type {
  CreateReporteDto,
  ReporteDto,
  ReportesPaginaDto,
  UbicacionesDto,
} from '@Reportes/dto';
import { ReporteRepository, type ReporteConEvidencias } from '@Reportes/repositories';
import {
  AREAS_COMUNES,
  MAX_FOTO_BYTES,
  MAX_FOTOS,
  MENSAJE_FOTOS,
  MENSAJE_REPORTE_NO_ENCONTRADO,
  MENSAJE_UBICACION_INVALIDA,
  REPORTES_PAGE_SIZE,
} from '../reportes.constants.js';
import type { FotoGuardada, FotoSubida } from '../reportes.types.js';
import { detectarTipoImagen, formatearNumero, parsearNumero } from '../reportes.utils.js';
import { EvidenciaStorageService } from './evidencia-storage.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function aReporteDto(r: ReporteConEvidencias): ReporteDto {
  const numero = formatearNumero(r.numero);
  return {
    id: r.id,
    numero,
    titulo: r.titulo,
    categoria: r.categoria,
    ubicacion: r.ubicacion,
    descripcion: r.descripcion,
    estado: r.estado,
    fotos: r.evidencias.map((e) => `/${API_PREFIX}/reportes/${numero}/fotos/${e.id}`),
    creadoEn: r.createdAt.toISOString(),
  };
}

@Injectable()
export class ReportesService {
  constructor(
    private readonly reportes: ReporteRepository,
    private readonly storage: EvidenciaStorageService,
  ) {}

  /** Opciones válidas para el campo `ubicacion`. */
  async ubicaciones(): Promise<UbicacionesDto> {
    return { torres: await this.reportes.findNombresTorres(), areasComunes: [...AREAS_COMUNES] };
  }

  async crear(residenteId: string, dto: CreateReporteDto, fotos: FotoSubida[]): Promise<ReporteDto> {
    this.validarFotos(fotos);

    const { torres, areasComunes } = await this.ubicaciones();
    if (![...torres, ...areasComunes].includes(dto.ubicacion)) {
      throw new BadRequestException(MENSAJE_UBICACION_INVALIDA);
    }

    const guardadas: FotoGuardada[] = [];
    try {
      for (const foto of fotos) guardadas.push(await this.storage.guardar(foto));
      const reporte = await this.reportes.crear({
        residenteId,
        titulo: dto.titulo,
        categoria: dto.categoria,
        ubicacion: dto.ubicacion,
        descripcion: dto.descripcion,
        evidencias: guardadas,
      });
      return aReporteDto(reporte);
    } catch (error) {
      // Si algo falló después de escribir archivos, no dejar fotos huérfanas.
      await this.storage.eliminar(guardadas.map((g) => g.archivo));
      throw error;
    }
  }

  async listar(residenteId: string, pagina: number): Promise<ReportesPaginaDto> {
    const { reportes, total } = await this.reportes.findPagina(
      residenteId,
      (pagina - 1) * REPORTES_PAGE_SIZE,
      REPORTES_PAGE_SIZE,
    );
    return {
      datos: reportes.map((r) => ({
        id: r.id,
        numero: formatearNumero(r.numero),
        titulo: r.titulo,
        categoria: r.categoria,
        estado: r.estado,
        creadoEn: r.createdAt.toISOString(),
      })),
      total,
      pagina,
      porPagina: REPORTES_PAGE_SIZE,
    };
  }

  /** 404 tanto si no existe como si es de otro residente (no revela cuáles existen). */
  async obtener(residenteId: string, numeroTexto: string): Promise<ReporteDto> {
    const numero = parsearNumero(numeroTexto);
    const reporte = numero === null ? null : await this.reportes.findDeResidente(residenteId, numero);
    if (!reporte) throw new NotFoundException(MENSAJE_REPORTE_NO_ENCONTRADO);
    return aReporteDto(reporte);
  }

  async abrirFoto(
    residenteId: string,
    numeroTexto: string,
    fotoId: string,
  ): Promise<{ stream: ReadStream; mimeType: string }> {
    const numero = parsearNumero(numeroTexto);
    if (numero === null || !UUID.test(fotoId)) throw new NotFoundException(MENSAJE_REPORTE_NO_ENCONTRADO);

    const evidencia = await this.reportes.findEvidenciaDeResidente(residenteId, numero, fotoId);
    if (!evidencia) throw new NotFoundException(MENSAJE_REPORTE_NO_ENCONTRADO);

    try {
      return { stream: await this.storage.abrir(evidencia.archivo), mimeType: evidencia.mimeType };
    } catch {
      throw new NotFoundException(MENSAJE_REPORTE_NO_ENCONTRADO);
    }
  }

  private validarFotos(fotos: FotoSubida[]): void {
    const invalida =
      fotos.length > MAX_FOTOS ||
      fotos.some((f) => f.size > MAX_FOTO_BYTES || detectarTipoImagen(f.buffer) === null);
    if (invalida) throw new BadRequestException(MENSAJE_FOTOS);
  }
}
