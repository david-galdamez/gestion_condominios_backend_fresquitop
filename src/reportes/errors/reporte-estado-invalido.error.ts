import type { EstadoReporte } from '@PrismaClient';

export class ReporteEstadoInvalidoError extends Error {
  constructor(
    public readonly reporteId: string,
    public readonly estadoActual: EstadoReporte,
  ) {
    super(`El reporte ${reporteId} está en estado ${estadoActual} y no puede resolverse`);
    this.name = 'ReporteEstadoInvalidoError';
  }
}