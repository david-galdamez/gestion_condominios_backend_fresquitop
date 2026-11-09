export const TITULO_MIN = 5;
export const TITULO_MAX = 80;
export const DESCRIPCION_MIN = 10;
export const DESCRIPCION_MAX = 500;

export const MAX_FOTOS = 5;
export const MAX_FOTO_BYTES = 5 * 1024 * 1024;
/**
 * Tope que se le pasa a multer. Es mayor que MAX_FOTOS a propósito: así la
 * sexta foto llega al servicio y se rechaza con el mensaje de negocio en vez
 * del genérico "Unexpected field" de multer.
 */
export const MAX_FOTOS_MULTER = 10;

export const REPORTES_PAGE_SIZE = 20;

export const MENSAJE_TITULO = `El título debe tener entre ${TITULO_MIN} y ${TITULO_MAX} caracteres`;
export const MENSAJE_DESCRIPCION = `La descripción debe tener entre ${DESCRIPCION_MIN} y ${DESCRIPCION_MAX} caracteres`;
export const MENSAJE_FOTOS = 'Solo JPG o PNG de hasta 5 MB, máximo 5 fotos';
export const MENSAJE_REPORTE_NO_ENCONTRADO = 'Reporte no encontrado';
export const MENSAJE_UBICACION_INVALIDA = 'La ubicación no es válida';

/** Áreas comunes válidas como ubicación (las torres salen de la tabla `torre`). */
export const AREAS_COMUNES = [
  'Lobby',
  'Pasillos',
  'Parqueo',
  'Piscina',
  'Jardines',
  'Salón social',
  'Gimnasio',
  'Azotea',
] as const;
