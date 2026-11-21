export class VotacionNoAbiertaError extends Error {
  constructor() {
    super('La votación no está abierta');
    this.name = 'VotacionNoAbiertaError';
  }
}