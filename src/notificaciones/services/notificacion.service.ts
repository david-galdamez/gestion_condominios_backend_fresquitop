/** Módulos de origen permitidos (sección 2.6). */
export const MODULOS_ORIGEN = [
  'PAGOS',
  'RESERVAS',
  'INCIDENCIAS',
  'VISITAS',
  'PAQUETERIA',
  'VOTACIONES',
  'COMUNICADOS',
] as const;
export type ModuloOrigen = (typeof MODULOS_ORIGEN)[number];

export type TipoDestino = 'USUARIO' | 'UNIDAD' | 'TORRE' | 'TODOS';

export interface Aviso {
  /** `id` no aplica con TODOS. */
  destinatario: { tipo: TipoDestino; id?: string };
  /** 1 a 80 caracteres. */
  titulo: string;
  /** 1 a 300 caracteres. */
  mensaje: string;
  moduloOrigen: ModuloOrigen;
  /** Ruta del frontend, máx. 200 (p. ej. "/paquetes/123"). */
  referencia?: string;
}

export interface ResultadoEnvio {
  id: string;
  destinatarios: number;
}

/** El aviso no cumple el contrato (falta título, mensaje, destinatario o el módulo no es válido). */
export class DatoInvalidoError extends Error {
  constructor(motivo: string) {
    super(`Aviso inválido: ${motivo}`);
    this.name = 'DatoInvalidoError';
  }
}

/** El id del destinatario no existe. */
export class DestinoNoExisteError extends Error {
  constructor(tipo: TipoDestino, id?: string) {
    super(`No existe el destinatario ${tipo} ${id ?? ''}`.trim());
    this.name = 'DestinoNoExisteError';
  }
}

/**
 * Contrato de BE-18.1: NotificacionService.enviar(aviso). Sin ruta HTTP; lo
 * llaman los servicios del backend. Es una clase abstracta para usarla como
 * token de inyección de Nest.
 */
export abstract class NotificacionService {
  abstract enviar(aviso: Aviso): Promise<ResultadoEnvio>;
}

/** Validación del contrato, reutilizable por cualquier implementación. */
export function validarAviso(aviso: Aviso): void {
  const { destinatario, titulo, mensaje, moduloOrigen, referencia } = aviso;
  if (!destinatario?.tipo) throw new DatoInvalidoError('falta el destinatario');
  if (destinatario.tipo !== 'TODOS' && !destinatario.id) throw new DatoInvalidoError('falta el id del destinatario');
  if (!titulo || titulo.length > 80) throw new DatoInvalidoError('el título debe tener entre 1 y 80 caracteres');
  if (!mensaje || mensaje.length > 300) throw new DatoInvalidoError('el mensaje debe tener entre 1 y 300 caracteres');
  if (!MODULOS_ORIGEN.includes(moduloOrigen)) throw new DatoInvalidoError('módulo de origen no válido');
  if (referencia && referencia.length > 200) throw new DatoInvalidoError('la referencia supera 200 caracteres');
}
