import { NotFoundException } from '@nestjs/common';
import type { ComunicadoRepository } from '../repositories/comunicado.repository.js';
import { MisComunicadosService } from './mis-comunicados.service.js';

const AHORA = new Date('2026-11-20T18:00:00.000Z');

describe('MisComunicadosService (H14)', () => {
  const repo = {
    torresDeResidente: vi.fn(),
    findDeResidente: vi.fn(),
    contarNoLeidos: vi.fn(),
    findDeResidenteById: vi.fn(),
    registrarLectura: vi.fn(),
  };
  const service = new MisComunicadosService(repo as unknown as ComunicadoRepository);

  const comunicado = (extra: Record<string, unknown> = {}) => ({
    id: 'c-1',
    titulo: 'Corte de agua',
    contenido: 'El sábado no habrá agua de 8 a 12.',
    categoria: 'AGUA',
    paraTodos: true,
    estado: 'PUBLICADO',
    fechaPublicacion: new Date('2026-11-19T15:00:00.000Z'),
    fechaExpiracion: null,
    ...extra,
  });

  beforeEach(() => {
    vi.resetAllMocks();
    repo.torresDeResidente.mockResolvedValue(['torre-a']);
  });

  describe('listar', () => {
    it('usa las torres de la sesión, pagina de 20 en 20 y marca leído si hay lectura', async () => {
      repo.findDeResidente.mockResolvedValue([
        [
          {
            id: 'c-2',
            titulo: 'Dos',
            categoria: 'AGUA',
            fechaPublicacion: AHORA,
            lecturas: [],
          },
          {
            id: 'c-1',
            titulo: 'Uno',
            categoria: 'SEGURIDAD',
            fechaPublicacion: AHORA,
            lecturas: [{ leidoEn: AHORA }],
          },
        ],
        42,
      ]);

      const r = await service.listar('res-1', { archivo: false, pagina: 3 }, AHORA);

      expect(repo.torresDeResidente).toHaveBeenCalledWith('res-1');
      expect(repo.findDeResidente).toHaveBeenCalledWith({
        residenteId: 'res-1',
        torreIds: ['torre-a'],
        archivo: false,
        ahora: AHORA,
        skip: 40,
        take: 20,
      });
      expect(r).toEqual({
        datos: [
          {
            id: 'c-2',
            titulo: 'Dos',
            categoria: 'AGUA',
            fechaPublicacion: AHORA.toISOString(),
            leido: false,
          },
          {
            id: 'c-1',
            titulo: 'Uno',
            categoria: 'SEGURIDAD',
            fechaPublicacion: AHORA.toISOString(),
            leido: true,
          },
        ],
        total: 42,
        pagina: 3,
      });
    });

    it('pasa archivo=true al repositorio', async () => {
      repo.findDeResidente.mockResolvedValue([[], 0]);
      expect(await service.listar('res-1', { archivo: true, pagina: 1 }, AHORA)).toEqual({
        datos: [],
        total: 0,
        pagina: 1,
      });
      expect(repo.findDeResidente.mock.calls[0][0]).toMatchObject({
        archivo: true,
        skip: 0,
      });
    });
  });

  it('contarNoLeidos devuelve el conteo con las torres de la sesión', async () => {
    repo.contarNoLeidos.mockResolvedValue(3);
    expect(await service.contarNoLeidos('res-1', AHORA)).toEqual({
      noLeidos: 3,
    });
    expect(repo.contarNoLeidos).toHaveBeenCalledWith({
      residenteId: 'res-1',
      torreIds: ['torre-a'],
      ahora: AHORA,
    });
  });

  describe('abrir', () => {
    it('registra la lectura y devuelve el detalle', async () => {
      repo.findDeResidenteById.mockResolvedValue(comunicado());
      const r = await service.abrir('res-1', 'c-1', AHORA);
      expect(repo.findDeResidenteById).toHaveBeenCalledWith('c-1', ['torre-a']);
      expect(repo.registrarLectura).toHaveBeenCalledWith('c-1', 'res-1');
      expect(r).toEqual({
        id: 'c-1',
        titulo: 'Corte de agua',
        contenido: 'El sábado no habrá agua de 8 a 12.',
        categoria: 'AGUA',
        fechaPublicacion: '2026-11-19T15:00:00.000Z',
        fechaExpiracion: null,
        archivado: false,
        leido: true,
      });
    });

    it.each([
      [
        'EXPIRADO',
        {
          estado: 'EXPIRADO',
          fechaExpiracion: new Date('2026-11-18T00:00:00.000Z'),
        },
      ],
      ['PUBLICADO con expiración pasada', { fechaExpiracion: new Date('2026-11-20T17:00:00.000Z') }],
    ])('%s -> archivado', async (_t, extra) => {
      repo.findDeResidenteById.mockResolvedValue(comunicado(extra));
      expect((await service.abrir('res-1', 'c-1', AHORA)).archivado).toBe(true);
    });

    it('expiración futura -> no archivado', async () => {
      repo.findDeResidenteById.mockResolvedValue(comunicado({ fechaExpiracion: new Date('2026-11-25T00:00:00.000Z') }));
      expect((await service.abrir('res-1', 'c-1', AHORA)).archivado).toBe(false);
    });

    it('de otra torre o inexistente -> 404 "Comunicado no encontrado" y no registra lectura', async () => {
      repo.findDeResidenteById.mockResolvedValue(null);
      await expect(service.abrir('res-1', 'c-9', AHORA)).rejects.toThrow(
        new NotFoundException('Comunicado no encontrado'),
      );
      expect(repo.registrarLectura).not.toHaveBeenCalled();
    });
  });
});
