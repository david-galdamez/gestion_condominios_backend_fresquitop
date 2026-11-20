export class VotoInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VotoInvalidoError';
  }
}