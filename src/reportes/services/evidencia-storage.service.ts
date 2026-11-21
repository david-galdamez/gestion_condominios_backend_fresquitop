import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { Readable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { detectarTipoImagen } from '../reportes.utils.js';
import type { FotoGuardada, FotoSubida } from '../reportes.types.js';

const MIME = { jpg: 'image/jpeg', png: 'image/png' } as const;
const CARPETA = 'reportes';

/**
 * Guarda las fotos en la tabla `archivo` (clave "reportes/<archivo>").
 * Es el único lugar que conoce dónde viven los archivos: para pasar a S3 solo
 * hay que reemplazar esta clase.
 */
@Injectable()
export class EvidenciaStorageService {
  constructor(private readonly prisma: PrismaService) {}

  async guardar(foto: FotoSubida): Promise<FotoGuardada> {
    // La extensión y el mime salen del contenido real, nunca del nombre que mandó el cliente.
    const tipo = detectarTipoImagen(foto.buffer);
    if (!tipo) throw new Error('Tipo de imagen no soportado');

    const archivo = `${randomUUID()}.${tipo}`;
    await this.prisma.archivo.create({
      data: {
        clave: this.clave(archivo),
        mimeType: MIME[tipo],
        tamanoBytes: foto.size,
        datos: new Uint8Array(foto.buffer),
      },
    });
    return { archivo, mimeType: MIME[tipo], tamanoBytes: foto.size };
  }

  /** Borra archivos huérfanos (por ejemplo si falló el insert en la base). */
  async eliminar(archivos: string[]): Promise<void> {
    await this.prisma.archivo.deleteMany({ where: { clave: { in: archivos.map((a) => this.clave(a)) } } });
  }

  /** Lanza si el archivo no existe. */
  async abrir(archivo: string): Promise<Readable> {
    const fila = await this.prisma.archivo.findUniqueOrThrow({ where: { clave: this.clave(archivo) } });
    return Readable.from([Buffer.from(fila.datos)]);
  }

  private clave(archivo: string): string {
    return `${CARPETA}/${basename(archivo)}`;
  }
}
