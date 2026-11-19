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

export const TIPOS_DESTINO = ['USUARIO', 'UNIDAD', 'TORRE', 'TODOS'] as const;

export type TipoDestino = (typeof TIPOS_DESTINO)[number];

export interface DestinatarioAviso {
  tipo: TipoDestino;
  id?: string;
}

export interface EnviarAvisoInput {
  destinatario: DestinatarioAviso;
  titulo: string;
  mensaje: string;
  moduloOrigen: ModuloOrigen;
  referencia?: string;
}

export type Aviso = EnviarAvisoInput;

export interface ResultadoEnvio {
  id: string;
  destinatarios: number;
}

export interface CrearNotificacionData {
  moduloOrigen: ModuloOrigen;
  titulo: string;
  mensaje: string;
  referencia?: string;
  destinoTipo: TipoDestino;
  destinoId?: string;
}