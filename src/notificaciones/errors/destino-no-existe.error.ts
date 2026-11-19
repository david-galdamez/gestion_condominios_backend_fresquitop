import type { TipoDestino } from '@Notificaciones/types';

export class DestinoNoExisteError extends Error {
  constructor(
    public readonly tipo: TipoDestino,
    public readonly id?: string,
  ) {
    super(`No existe el destinatario ${tipo} ${id ?? ''}`.trim());
    this.name = 'DestinoNoExisteError';
  }
}