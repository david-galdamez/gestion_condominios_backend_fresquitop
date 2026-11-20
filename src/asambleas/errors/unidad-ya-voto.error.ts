export class UnidadYaVotoError extends Error {
  constructor() {
    super('Tu unidad ya votó este tema');
    this.name = 'UnidadYaVotoError';
  }
}