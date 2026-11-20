/** La restricción PostgreSQL reserva_no_cruce rechazó el INSERT. */
export class ReservaHorarioOcupadoError extends Error {
  constructor() {
    super('Ese horario ya está reservado');
    this.name = 'ReservaHorarioOcupadoError';
  }
}
