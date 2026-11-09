import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '@Config';
import { ArchivosService, MAX_IMAGEN_BYTES, type ArchivoSubido } from './archivos.service.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PDF = Buffer.from('%PDF-1.7 ...');
const archivo = (buffer: Buffer, size = buffer.length): ArchivoSubido => ({ buffer, size });

describe('ArchivosService', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'archivos-'));
  const config = { get: () => raiz } as unknown as ConfigService<EnvConfig, true>;
  const service = new ArchivosService(config);

  it('reconoce PNG y JPG por sus primeros bytes', () => {
    expect(service.extensionImagen(archivo(PNG))).toBe('png');
    expect(service.extensionImagen(archivo(JPG))).toBe('jpg');
  });

  it('rechaza PDF, vacío, ausente y más de 5 MB aunque el nombre diga .jpg', () => {
    expect(service.extensionImagen({ ...archivo(PDF), originalname: 'foto.jpg', mimetype: 'image/jpeg' })).toBeNull();
    expect(service.extensionImagen(archivo(Buffer.alloc(0)))).toBeNull();
    expect(service.extensionImagen(undefined)).toBeNull();
    expect(service.extensionImagen(archivo(PNG, MAX_IMAGEN_BYTES + 1))).toBeNull();
    expect(service.extensionImagen(archivo(PNG, MAX_IMAGEN_BYTES))).toBe('png');
  });

  it('guarda con nombre aleatorio dentro de la carpeta y lo puede borrar', async () => {
    const ruta = await service.guardar('paquetes', archivo(PNG), 'png');
    expect(ruta).toMatch(/^paquetes\/[0-9a-f-]{36}\.png$/);
    expect(readFileSync(service.rutaAbsoluta(ruta))).toEqual(PNG);
    await service.borrar(ruta);
    expect(existsSync(service.rutaAbsoluta(ruta))).toBe(false);
    await expect(service.borrar(ruta)).resolves.toBeUndefined();
  });
});
