import { ConflictException, NotFoundException } from '@nestjs/common';
import { Rol } from '@PrismaClient';
import type { GuardarAreaDto } from '../dto/guardar-area.dto.js';
import { AreaNombreDuplicadoError } from '../errors/area-nombre-duplicado.error.js';
import type { AreaRepository } from '../repositories/area.repository.js';
import { AreasService, MSG_AREA_NO_EXISTE, MSG_NOMBRE_DUPLICADO } from './areas.service.js';

describe('AreasService', () => {
  const repo = {
    create: vi.fn(),
    update: vi.fn(),
    setActiva: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    existeNombre: vi.fn(),
  };
  const service = new AreasService(repo as unknown as AreaRepository);

  const dto = (extra: Partial<GuardarAreaDto> = {}) =>
    ({
      nombre: 'Alberca',
      capacidad: 30,
      horaApertura: '07:00',
      horaCierre: '19:00',
      duracionMaxHoras: 2,
      ...extra,
    }) as GuardarAreaDto;

  const fila = (extra: object = {}) => ({
    id: 'area-1',
    nombre: 'Alberca',
    capacidad: 30,
    horaApertura: new Date('1970-01-01T07:00:00.000Z'),
    horaCierre: new Date('1970-01-01T19:00:00.000Z'),
    duracionMaxHoras: 2,
    activa: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  });

  beforeEach(() => {
    vi.resetAllMocks();
    repo.existeNombre.mockResolvedValue(false);
    repo.findById.mockResolvedValue(fila());
    repo.create.mockImplementation(async (data: object) => fila(data));
    repo.update.mockImplementation(async (_id: string, data: object) => fila(data));
  });

  describe('listar', () => {
    it('administrador ve todas; residente solo activas', async () => {
      repo.findAll.mockResolvedValue([fila()]);
      await service.listar(Rol.ADMINISTRADOR);
      expect(repo.findAll).toHaveBeenLastCalledWith(false);
      const r = await service.listar(Rol.RESIDENTE);
      expect(repo.findAll).toHaveBeenLastCalledWith(true);
      expect(r.datos[0]).toMatchObject({ horaApertura: '07:00', horaCierre: '19:00' });
    });
  });

  describe('crear', () => {
    it('convierte las horas a @db.Time en UTC y devuelve Activa', async () => {
      const r = await service.crear(dto());
      const data = repo.create.mock.calls[0][0];
      expect(data.horaApertura).toEqual(new Date('1970-01-01T07:00:00.000Z'));
      expect(data.horaCierre).toEqual(new Date('1970-01-01T19:00:00.000Z'));
      expect(r).toEqual({
        id: 'area-1',
        nombre: 'Alberca',
        capacidad: 30,
        horaApertura: '07:00',
        horaCierre: '19:00',
        duracionMaxHoras: 2,
        activa: true,
      });
    });

    it('nombre repetido (sin distinguir mayúsculas) -> 409 sin intentar guardar', async () => {
      repo.existeNombre.mockResolvedValue(true);
      await expect(service.crear(dto({ nombre: 'ALBERCA' }))).rejects.toThrow(
        new ConflictException(MSG_NOMBRE_DUPLICADO),
      );
      expect(repo.existeNombre).toHaveBeenCalledWith('ALBERCA', undefined);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('si gana otra alta simultánea (índice único) -> 409', async () => {
      repo.create.mockRejectedValue(new AreaNombreDuplicadoError('Alberca'));
      await expect(service.crear(dto())).rejects.toThrow(new ConflictException(MSG_NOMBRE_DUPLICADO));
    });

    it('otros errores se propagan', async () => {
      repo.create.mockRejectedValue(new Error('boom'));
      await expect(service.crear(dto())).rejects.toThrow('boom');
    });
  });

  describe('actualizar', () => {
    it('404 si no existe', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.actualizar('x', dto())).rejects.toThrow(new NotFoundException(MSG_AREA_NO_EXISTE));
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('excluye su propio id al validar el nombre (puede conservarlo)', async () => {
      await service.actualizar('area-1', dto({ horaCierre: '20:00' }));
      expect(repo.existeNombre).toHaveBeenCalledWith('Alberca', 'area-1');
      expect(repo.update.mock.calls[0][1].horaCierre).toEqual(new Date('1970-01-01T20:00:00.000Z'));
    });

    it('nombre de otra área -> 409', async () => {
      repo.existeNombre.mockResolvedValue(true);
      await expect(service.actualizar('area-1', dto({ nombre: 'Gimnasio' }))).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('cambiarEstado', () => {
    it('404 si no existe', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.cambiarEstado('x', false)).rejects.toThrow(new NotFoundException(MSG_AREA_NO_EXISTE));
    });

    it('desactiva un área activa', async () => {
      repo.setActiva.mockResolvedValue(fila({ activa: false }));
      const r = await service.cambiarEstado('area-1', false);
      expect(repo.setActiva).toHaveBeenCalledWith('area-1', false);
      expect(r.activa).toBe(false);
    });

    it('si ya está en ese estado no escribe y devuelve igual (idempotente)', async () => {
      const r = await service.cambiarEstado('area-1', true);
      expect(repo.setActiva).not.toHaveBeenCalled();
      expect(r.activa).toBe(true);
    });
  });
});
