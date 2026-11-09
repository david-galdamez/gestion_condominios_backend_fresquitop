/**
 * Error de dominio: ya existe un área con ese nombre.
 *
 * Lo lanza el repositorio al detectar la violación de unicidad (P2002) y el
 * servicio lo traduce a 409, igual que EmailAlreadyTakenError en usuarios.
 */
export class AreaNombreDuplicadoError extends Error {
  constructor(public readonly nombre: string) {
    super(`Ya existe un área con el nombre "${nombre}".`);
    this.name = 'AreaNombreDuplicadoError';
  }
}
