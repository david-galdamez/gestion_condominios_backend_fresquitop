import { randomUUID } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { detectarTipoImagen } from '../reportes.utils.js';
import type { FotoGuardada, FotoSubida } from '../reportes.types.js';

const MIME = { jpg: 'image/jpeg', png: 'image/png' } as const;

/**
 * Guarda las fotos en disco (UPLOADS_DIR, por defecto ./uploads/reportes).
 * Es el único lugar que conoce dónde viven los archivos: para pasar a S3 solo
 * hay que reemplazar esta clase.
 */
@Injectable()
export class EvidenciaStorageService {
  private readonly dir = resolve(process.cwd(), process.env.UPLOADS_DIR ?? 'uploads', 'reportes');

  async guardar(foto: FotoSubida): Promise<FotoGuardada> {
    // La extensión y el mime salen del contenido real, nunca del nombre que mandó el cliente.
    const tipo = detectarTipoImagen(foto.buffer);
    if (!tipo) throw new Error('Tipo de imagen no soportado');

    await mkdir(this.dir, { recursive: true });
    const archivo = `${randomUUID()}.${tipo}`;
    await writeFile(join(this.dir, archivo), foto.buffer);
    return { archivo, mimeType: MIME[tipo], tamanoBytes: foto.size };
  }

  /** Borra archivos huérfanos (por ejemplo si falló el insert en la base). */
  async eliminar(archivos: string[]): Promise<void> {
    await Promise.all(archivos.map((a) => rm(join(this.dir, basename(a)), { force: true })));
  }

  /** Lanza si el archivo no existe en disco. */
  async abrir(archivo: string): Promise<ReadStream> {
    const ruta = join(this.dir, basename(archivo));
    await stat(ruta);
    return createReadStream(ruta);
  }
}
