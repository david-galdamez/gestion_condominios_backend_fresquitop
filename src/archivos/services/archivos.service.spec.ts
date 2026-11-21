import type { PrismaService } from '@Prisma/services';
import { ArchivosService, MAX_IMAGEN_BYTES, type ArchivoSubido } from './archivos.service.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PDF = Buffer.from('%PDF-1.7 ...');
const archivo = (buffer: Buffer, size = buffer.length): ArchivoSubido => ({ buffer, size });

describe('ArchivosService', () => {
  const prisma = {
    archivo: { create: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn() },
  };
  const service = new ArchivosService(prisma as unknown as PrismaService);

  beforeEach(() => vi.clearAllMocks());

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

  it('guarda en la tabla archivo con clave aleatoria dentro de la carpeta', async () => {
    const clave = await service.guardar('paquetes', archivo(PNG), 'png');
    expect(clave).toMatch(/^paquetes\/[0-9a-f-]{36}\.png$/);
    expect(prisma.archivo.create).toHaveBeenCalledWith({
      data: { clave, mimeType: 'image/png', tamanoBytes: PNG.length, datos: new Uint8Array(PNG) },
    });
  });

  it('borra por clave sin fallar si no existe', async () => {
    prisma.archivo.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.borrar('paquetes/x.png')).resolves.toBeUndefined();
    expect(prisma.archivo.deleteMany).toHaveBeenCalledWith({ where: { clave: 'paquetes/x.png' } });
  });

  it('lee el contenido y el tipo; devuelve null si no existe', async () => {
    prisma.archivo.findUnique.mockResolvedValueOnce({ datos: new Uint8Array(PNG), mimeType: 'image/png' });
    expect(await service.leer('paquetes/x.png')).toEqual({ datos: PNG, mimeType: 'image/png' });
    prisma.archivo.findUnique.mockResolvedValueOnce(null);
    expect(await service.leer('paquetes/y.png')).toBeNull();
  });
});
