export class AsambleaNoEncontradaError extends Error {
  constructor(public readonly asambleaId: string) {
    super('La asamblea no existe');
    this.name = 'AsambleaNoEncontradaError';
  }
}