export class CodigoVerificacionColisionError extends Error {
  constructor() {
    super('Colisión al generar el código de verificación');
    this.name = 'CodigoVerificacionColisionError';
  }
}