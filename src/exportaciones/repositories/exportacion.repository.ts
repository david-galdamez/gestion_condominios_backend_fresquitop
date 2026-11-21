import { Injectable } from '@nestjs/common';
import { aFechaUtc } from '@Common/fechas';
import { PrismaService } from '@Prisma/services';
import type { FormatoExportacion, VersionExportacion } from '@PrismaClient';

export interface NuevaExportacion {
  administradorId: string;
  formato: FormatoExportacion;
  version: VersionExportacion;
  desde: string;
  hasta: string;
  generadaEn: Date;
}

/** Único punto que habla con `exportacion` (auditoría, sin borrado). */
@Injectable()
export class ExportacionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async registrar({ desde, hasta, ...datos }: NuevaExportacion): Promise<void> {
    await this.prisma.exportacion.create({
      data: { ...datos, periodoDesde: aFechaUtc(desde), periodoHasta: aFechaUtc(hasta) },
    });
  }
}
