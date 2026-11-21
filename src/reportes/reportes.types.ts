/** Forma mínima del archivo que entrega multer (almacenamiento en memoria). */
export interface FotoSubida {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export type TipoImagen = 'jpg' | 'png';

export interface FotoGuardada {
  /** Llave de almacenamiento (nombre del archivo). */
  archivo: string;
  mimeType: string;
  tamanoBytes: number;
}
