export class ReporteNotFoundError extends Error {
  constructor(public readonly reporteId: string) {
    super(`Reporte no encontrado: ${reporteId}`);
    this.name = 'ReporteNotFoundError';
  }
}