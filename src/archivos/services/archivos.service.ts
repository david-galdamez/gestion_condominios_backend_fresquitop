import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '@Config';

/** Límite de las fotos (H05, H09): 5 MB. */
export const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;

/** Lo mínimo que se usa del archivo que entrega multer (memoria). */
export interface ArchivoSubido {
  buffer: Buffer;
  size: number;
  originalname?: string;
  mimetype?: string;
}

export type ExtensionImagen = 'jpg' | 'png';

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const FIRMA_JPG = Buffer.from([0xff, 0xd8, 0xff]);

/**
 * Almacenamiento de archivos del backend en disco (carpeta UPLOAD_DIR).
 * Las rutas que se guardan en la base son relativas ("paquetes/<uuid>.jpg"),
 * así se puede mover la carpeta o cambiar a otro almacenamiento sin migrar datos.
 */
@Injectable()
export class ArchivosService {
  private readonly raiz: string;

  constructor(config: ConfigService<EnvConfig, true>) {
    this.raiz = resolve(config.get('UPLOAD_DIR', { infer: true }));
  }

  /**
   * Devuelve la extensión si es una imagen JPG o PNG de hasta 5 MB, o null.
   * Mira los primeros bytes del archivo y no el nombre ni el mimetype, que
   * los decide el cliente.
   */
  extensionImagen(archivo: ArchivoSubido | undefined): ExtensionImagen | null {
    if (!archivo || archivo.size === 0 || archivo.size > MAX_IMAGEN_BYTES) return null;
    const b = archivo.buffer;
    if (b.subarray(0, FIRMA_PNG.length).equals(FIRMA_PNG)) return 'png';
    if (b.subarray(0, FIRMA_JPG.length).equals(FIRMA_JPG)) return 'jpg';
    return null;
  }

  /** Guarda el archivo con nombre aleatorio y devuelve su ruta relativa. */
  async guardar(carpeta: string, archivo: ArchivoSubido, extension: ExtensionImagen): Promise<string> {
    const relativa = `${carpeta}/${randomUUID()}.${extension}`;
    await mkdir(join(this.raiz, carpeta), { recursive: true });
    await writeFile(join(this.raiz, relativa), archivo.buffer);
    return relativa;
  }

  /** Borra un archivo guardado; si ya no existe, no falla. */
  async borrar(relativa: string): Promise<void> {
    await rm(join(this.raiz, relativa), { force: true });
  }

  rutaAbsoluta(relativa: string): string {
    return join(this.raiz, relativa);
  }
}
