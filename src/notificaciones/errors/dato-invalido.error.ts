export class DatoInvalidoError extends Error {
  constructor(motivo: string) {
    super(`Aviso inválido: ${motivo}`);
    this.name = 'DatoInvalidoError';
  }
}