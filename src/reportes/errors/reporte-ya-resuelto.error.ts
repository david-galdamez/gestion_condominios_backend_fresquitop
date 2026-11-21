export class ReporteYaResueltoError extends Error {
  constructor(public readonly reporteId: string) {
    super(`El reporte ${reporteId} ya está resuelto y no puede modificarse`);
    this.name = 'ReporteYaResueltoError';
  }
}