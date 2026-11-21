/**
 * Error de dominio: ya existe un pago con esa Idempotency-Key. Pasa cuando dos
 * solicitudes con la misma clave (y cuotas distintas) llegan a la vez y la
 * otra ganó el insert. El servicio responde con el pago original.
 */
export class ClaveIdempotenciaRepetidaError extends Error {
  constructor(public readonly clave: string) {
    super(`Ya existe un pago con la clave ${clave}.`);
    this.name = 'ClaveIdempotenciaRepetidaError';
  }
}
