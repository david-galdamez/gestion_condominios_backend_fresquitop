import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';

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

const MIME: Record<ExtensionImagen, string> = { jpg: 'image/jpeg', png: 'image/png' };

/**
 * Almacenamiento de archivos del backend en la tabla `archivo` (Postgres).
 * Las claves que se guardan en otras tablas son relativas ("paquetes/<uuid>.jpg"),
 * así se puede cambiar a otro almacenamiento (S3, etc.) sin migrar datos.
 */
@Injectable()
export class ArchivosService {
  constructor(private readonly prisma: PrismaService) {}

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

  /** Guarda el archivo con nombre aleatorio y devuelve su clave relativa. */
  async guardar(carpeta: string, archivo: ArchivoSubido, extension: ExtensionImagen): Promise<string> {
    const clave = `${carpeta}/${randomUUID()}.${extension}`;
    await this.prisma.archivo.create({
      data: { clave, mimeType: MIME[extension], tamanoBytes: archivo.size, datos: new Uint8Array(archivo.buffer) },
    });
    return clave;
  }

  /** Borra un archivo guardado; si ya no existe, no falla. */
  async borrar(clave: string): Promise<void> {
    await this.prisma.archivo.deleteMany({ where: { clave } });
  }

  /** Devuelve el contenido y el tipo del archivo, o null si no existe. */
  async leer(clave: string): Promise<{ datos: Buffer; mimeType: string } | null> {
    const fila = await this.prisma.archivo.findUnique({ where: { clave } });
    return fila ? { datos: Buffer.from(fila.datos), mimeType: fila.mimeType } : null;
  }
}
