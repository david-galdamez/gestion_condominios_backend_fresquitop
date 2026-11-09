/**
 * Error de dominio: la torre solicitada en el filtro no existe en la base de datos.
 *
 * Lo lanza el repositorio y la capa de servicio lo traduce a NotFoundException (404).
 */
export class TorreNotFoundError extends Error {
  constructor(public readonly torreId: string) {
    super('Torre no encontrada');
    this.name = 'TorreNotFoundError';
  }
}
