import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoriaReporte, EstadoReporte } from '@PrismaClient';
import type { ReporteConEvidencias, ReporteRepository } from '@Reportes/repositories';
import { MAX_FOTO_BYTES, MENSAJE_FOTOS, MENSAJE_REPORTE_NO_ENCONTRADO } from '../reportes.constants.js';
import type { FotoSubida } from '../reportes.types.js';
import type { EvidenciaStorageService } from './evidencia-storage.service.js';
import { ReportesService } from './reportes.service.js';

const RESIDENTE = '11111111-1111-4111-8111-111111111111';

const dto = {
  titulo: 'Fuga de agua',
  categoria: CategoriaReporte.FUGA,
  ubicacion: 'Torre A',
  descripcion: 'Hay una fuga en el pasillo del tercer piso.',
};

const png = (size = 16): FotoSubida => ({
  originalname: 'foto.png',
  mimetype: 'image/png',
  size,
  buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]),
});

const reporteFalso = (over: Partial<ReporteConEvidencias> = {}) =>
  ({
    id: '22222222-2222-4222-8222-222222222222',
    numero: 123,
    residenteId: RESIDENTE,
    ...dto,
    prioridad: 'MEDIA',
    estado: EstadoReporte.ABIERTO,
    createdAt: new Date('2026-11-08T22:53:00.000Z'),
    updatedAt: new Date('2026-11-08T22:53:00.000Z'),
    evidencias: [],
    ...over,
  }) as unknown as ReporteConEvidencias;

describe('ReportesService', () => {
  let repo: {
    crear: ReturnType<typeof vi.fn>;
    findPagina: ReturnType<typeof vi.fn>;
    findDeResidente: ReturnType<typeof vi.fn>;
    findEvidenciaDeResidente: ReturnType<typeof vi.fn>;
    findNombresTorres: ReturnType<typeof vi.fn>;
  };
  let storage: {
    guardar: ReturnType<typeof vi.fn>;
    eliminar: ReturnType<typeof vi.fn>;
    abrir: ReturnType<typeof vi.fn>;
  };
  let service: ReportesService;

  beforeEach(() => {
    repo = {
      crear: vi.fn().mockResolvedValue(reporteFalso()),
      findPagina: vi.fn(),
      findDeResidente: vi.fn(),
      findEvidenciaDeResidente: vi.fn(),
      findNombresTorres: vi.fn().mockResolvedValue(['Torre A', 'Torre B']),
    };
    storage = {
      guardar: vi.fn().mockImplementation(async (f: FotoSubida) => ({
        archivo: `${Math.random()}.png`,
        mimeType: 'image/png',
        tamanoBytes: f.size,
      })),
      eliminar: vi.fn().mockResolvedValue(undefined),
      abrir: vi.fn(),
    };
    service = new ReportesService(
      repo as unknown as ReporteRepository,
      storage as unknown as EvidenciaStorageService,
    );
  });

  describe('crear', () => {
    it('devuelve número REP-000123 en estado ABIERTO', async () => {
      const r = await service.crear(RESIDENTE, dto, []);
      expect(r.numero).toBe('REP-000123');
      expect(r.estado).toBe('ABIERTO');
      expect(repo.crear).toHaveBeenCalledOnce();
    });

    it('guarda cada foto y las pasa como evidencias', async () => {
      await service.crear(RESIDENTE, dto, [png(), png()]);
      expect(storage.guardar).toHaveBeenCalledTimes(2);
      expect(repo.crear.mock.calls[0]?.[0].evidencias).toHaveLength(2);
    });

    it('acepta una torre y un área común como ubicación', async () => {
      await expect(service.crear(RESIDENTE, { ...dto, ubicacion: 'Piscina' }, [])).resolves.toBeDefined();
    });

    it('rechaza una sexta foto', async () => {
      const fotos = Array.from({ length: 6 }, () => png());
      await expect(service.crear(RESIDENTE, dto, fotos)).rejects.toThrow(MENSAJE_FOTOS);
      expect(repo.crear).not.toHaveBeenCalled();
      expect(storage.guardar).not.toHaveBeenCalled();
    });

    it('rechaza un archivo que no es JPG ni PNG aunque diga serlo', async () => {
      const falsa: FotoSubida = {
        originalname: 'virus.png',
        mimetype: 'image/png',
        size: 10,
        buffer: Buffer.from('MZ-no-soy-una-imagen'),
      };
      await expect(service.crear(RESIDENTE, dto, [falsa])).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.crear).not.toHaveBeenCalled();
    });

    it('rechaza una foto de más de 5 MB', async () => {
      await expect(service.crear(RESIDENTE, dto, [png(MAX_FOTO_BYTES + 1)])).rejects.toThrow(MENSAJE_FOTOS);
    });

    it('rechaza una ubicación que no está en la lista', async () => {
      await expect(service.crear(RESIDENTE, { ...dto, ubicacion: 'Marte' }, [])).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.crear).not.toHaveBeenCalled();
    });

    it('borra las fotos ya escritas si falla el insert', async () => {
      repo.crear.mockRejectedValue(new Error('db caída'));
      await expect(service.crear(RESIDENTE, dto, [png(), png()])).rejects.toThrow('db caída');
      expect(storage.eliminar).toHaveBeenCalledOnce();
      expect(storage.eliminar.mock.calls[0]?.[0]).toHaveLength(2);
    });
  });

  describe('listar', () => {
    it('pagina de a 20 y formatea el número', async () => {
      repo.findPagina.mockResolvedValue({ reportes: [reporteFalso()], total: 41 });
      const r = await service.listar(RESIDENTE, 3);
      expect(repo.findPagina).toHaveBeenCalledWith(RESIDENTE, 40, 20);
      expect(r).toMatchObject({ total: 41, pagina: 3, porPagina: 20 });
      expect(r.datos[0]).toMatchObject({ numero: 'REP-000123', estado: 'ABIERTO' });
    });
  });

  describe('obtener', () => {
    it('devuelve el reporte propio', async () => {
      repo.findDeResidente.mockResolvedValue(reporteFalso());
      const r = await service.obtener(RESIDENTE, 'REP-000123');
      expect(repo.findDeResidente).toHaveBeenCalledWith(RESIDENTE, 123);
      expect(r.numero).toBe('REP-000123');
    });

    it('responde "Reporte no encontrado" si es de otro residente', async () => {
      repo.findDeResidente.mockResolvedValue(null);
      await expect(service.obtener(RESIDENTE, 'REP-000999')).rejects.toThrow(MENSAJE_REPORTE_NO_ENCONTRADO);
    });

    it('responde 404 si el número no tiene formato válido', async () => {
      await expect(service.obtener(RESIDENTE, 'abc')).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.findDeResidente).not.toHaveBeenCalled();
    });
  });
});
