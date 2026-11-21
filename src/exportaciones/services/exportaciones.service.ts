import { Injectable } from '@nestjs/common';
import { hoyEnZonaNegocio } from '@Common/fechas';
import { MorosidadService } from '@Morosidad/services';
import { PanelService } from '@Panel/services';
import { FormatoExportacion, VersionExportacion } from '@PrismaClient';
import type { ExportarReporteQueryDto } from '../dto/index.js';
import { ExportacionRepository } from '../repositories/index.js';
import { construirDocumento } from '../reporte/reporte-documento.js';
import { generarExcel } from '../reporte/reporte-excel.js';
import { generarPdf } from '../reporte/reporte-pdf.js';

export const TIPO_ARCHIVO: Record<FormatoExportacion, { tipo: string; extension: string }> = {
  PDF: { tipo: 'application/pdf', extension: 'pdf' },
  EXCEL: { tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' },
};

export interface ArchivoExportado {
  contenido: Buffer;
  nombre: string;
  tipo: string;
}

/**
 * BE-20.1 / BE-20.2. Los datos salen del mismo servicio del panel (BE-19.1),
 * por eso el archivo y la pantalla muestran los mismos valores. DETALLADA
 * agrega la morosidad por unidad de H22. Cada archivo generado queda en la
 * tabla `exportacion`.
 */
@Injectable()
export class ExportacionesService {
  constructor(
    private readonly panel: PanelService,
    private readonly morosidad: MorosidadService,
    private readonly exportaciones: ExportacionRepository,
  ) {}

  async exportar(
    administrador: { id: string; nombre: string },
    { formato, version, desde, hasta }: ExportarReporteQueryDto,
    ahora: Date = new Date(),
  ): Promise<ArchivoExportado> {
    const detallada = version === VersionExportacion.DETALLADA;
    const [panel, morosidad] = await Promise.all([
      this.panel.consultar({ desde, hasta }),
      detallada ? this.morosidad.detallePorUnidad() : Promise.resolve([]),
    ]);

    const documento = construirDocumento({
      panel,
      morosidad,
      version,
      desde,
      hasta,
      administrador: administrador.nombre,
      generadoEn: ahora,
    });
    const contenido = formato === FormatoExportacion.PDF ? await generarPdf(documento) : await generarExcel(documento);

    await this.exportaciones.registrar({
      administradorId: administrador.id,
      formato,
      version,
      desde,
      hasta,
      generadaEn: ahora,
    });

    const { tipo, extension } = TIPO_ARCHIVO[formato];
    return { contenido, tipo, nombre: `reporte-condominio-${hoyEnZonaNegocio(ahora)}.${extension}` };
  }
}
