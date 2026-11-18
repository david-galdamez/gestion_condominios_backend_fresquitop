import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { UnidadRepository } from '@Unidades/repositories';
import { Prisma } from '@PrismaClient';
import type { CrearAutorizacionDto } from '../dto/crear-autorizacion.dto.js';
import type { EditarAutorizacionDto } from '../dto/editar-autorizacion.dto.js';
import type { AutorizacionRepository } from '../repositories/autorizacion.repository.js';
import { AutorizacionesService, MAX_INTENTOS_CODIGO } from './autorizaciones.service.js';

const colision = () =>
  new Prisma.PrismaClientKnownRequestError('dup', {
    code: 'P2002',
    clientVersion: 'test',
  });

describe('AutorizacionesService', () => {
  const u1 = { id: 'u-1', codigo: 'A-101' };
  const u2 = { id: 'u-2', codigo: 'B-205' };
  const repo = {
    create: vi.fn(),
    findByResidente: vi.fn(),
    findOneDeResidente: vi.fn(),
    cancelarSiVigente: vi.fn(),
    editarSiVigente: vi.fn(),
  };
  const unidades = { findDeUsuario: vi.fn() };
  const service = new AutorizacionesService(
    repo as unknown as AutorizacionRepository,
    unidades as unknown as UnidadRepository,
  );

  const dto = (extra: Partial<CrearAutorizacionDto> = {}) =>
    ({
      nombre: 'María',
      tipoDocumento: 'DUI',
      numeroDocumento: '01234567-8',
      fechaVisita: '2026-11-10',
      horaEstimada: '14:30',
      ...extra,
    }) as CrearAutorizacionDto;

  const fila = (extra: object = {}) => ({
    id: 'a-1',
    unidadId: 'u-1',
    residenteId: 'r-1',
    nombre: 'María',
    tipoDocumento: 'DUI',
    numeroDocumento: '01234567-8',
    placa: null,
    fechaVisita: new Date('2026-11-10T00:00:00.000Z'),
    horaEstimada: new Date('1970-01-01T14:30:00.000Z'),
    codigo: '123456',
    estado: 'VIGENTE',
    unidad: u1,
    editadoPor: null,
    updatedAt: new Date('2026-11-05T12:00:00.000Z'),
    ...extra,
  });

  beforeEach(() => {
    vi.resetAllMocks();
    unidades.findDeUsuario.mockResolvedValue([u1]);
    repo.create.mockImplementation(async (data: object) => fila(data));
  });

  describe('crear', () => {
    it('usa la única unidad, residenteId de la sesión y serializa fecha/hora en UTC', async () => {
      const r = await service.crear('r-1', dto());
      const data = repo.create.mock.calls[0][0];
      expect(data.unidadId).toBe('u-1');
      expect(data.residenteId).toBe('r-1');
      expect(data.codigo).toMatch(/^\d{6}$/);
      expect(data.fechaVisita).toEqual(new Date('2026-11-10T00:00:00.000Z'));
      expect(data.horaEstimada).toEqual(new Date('1970-01-01T14:30:00.000Z'));
      expect(r).toMatchObject({
        fechaVisita: '2026-11-10',
        horaEstimada: '14:30',
        estado: 'VIGENTE',
        unidad: u1,
      });
    });

    it('con varias unidades y sin unidadId -> 400 Selecciona una unidad', async () => {
      unidades.findDeUsuario.mockResolvedValue([u1, u2]);
      await expect(service.crear('r-1', dto())).rejects.toThrow(new BadRequestException('Selecciona una unidad'));
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('con varias unidades y unidadId propio lo usa', async () => {
      unidades.findDeUsuario.mockResolvedValue([u1, u2]);
      await service.crear('r-1', dto({ unidadId: 'u-2' }));
      expect(repo.create.mock.calls[0][0].unidadId).toBe('u-2');
    });

    it('sin unidades -> 400 No tienes unidades asignadas', async () => {
      unidades.findDeUsuario.mockResolvedValue([]);
      await expect(service.crear('r-1', dto())).rejects.toThrow(
        new BadRequestException('No tienes unidades asignadas'),
      );
    });

    it('unidad ajena -> 403', async () => {
      await expect(service.crear('r-1', dto({ unidadId: 'otra' }))).rejects.toThrow(
        new ForbiddenException('No tienes permiso para esta acción'),
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('reintenta con otro código ante P2002', async () => {
      repo.create.mockRejectedValueOnce(colision()).mockRejectedValueOnce(colision());
      repo.create.mockImplementation(async (data: object) => fila(data));
      await service.crear('r-1', dto());
      expect(repo.create).toHaveBeenCalledTimes(3);
    });

    it('agota los intentos -> 503', async () => {
      repo.create.mockRejectedValue(colision());
      await expect(service.crear('r-1', dto())).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(repo.create).toHaveBeenCalledTimes(MAX_INTENTOS_CODIGO);
    });

    it('un error distinto de P2002 no se reintenta', async () => {
      repo.create.mockRejectedValue(new Error('boom'));
      await expect(service.crear('r-1', dto())).rejects.toThrow('boom');
      expect(repo.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelar', () => {
    it('404 si no existe o es de otro residente', async () => {
      repo.findOneDeResidente.mockResolvedValue(null);
      await expect(service.cancelar('a-1', 'r-2')).rejects.toThrow(new NotFoundException('La autorización no existe'));
      expect(repo.cancelarSiVigente).not.toHaveBeenCalled();
    });

    it.each(['USADA', 'VENCIDA', 'CANCELADA'])('409 si está %s', async (estado) => {
      repo.findOneDeResidente.mockResolvedValue(fila({ estado }));
      await expect(service.cancelar('a-1', 'r-1')).rejects.toThrow(
        new ConflictException('Esta autorización ya no se puede cancelar'),
      );
      expect(repo.cancelarSiVigente).not.toHaveBeenCalled();
    });

    it('409 si pierde la carrera (count 0)', async () => {
      repo.findOneDeResidente.mockResolvedValue(fila());
      repo.cancelarSiVigente.mockResolvedValue(0);
      await expect(service.cancelar('a-1', 'r-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('cancela una vigente y devuelve CANCELADA', async () => {
      repo.findOneDeResidente.mockResolvedValue(fila());
      repo.cancelarSiVigente.mockResolvedValue(1);
      const r = await service.cancelar('a-1', 'r-1');
      expect(r.estado).toBe('CANCELADA');
      expect(repo.cancelarSiVigente).toHaveBeenCalledWith('a-1', 'r-1');
    });
  });

  describe('obtener', () => {
    it('404 si no es del residente', async () => {
      repo.findOneDeResidente.mockResolvedValue(null);
      await expect(service.obtener('a-1', 'r-2')).rejects.toThrow(new NotFoundException('La autorización no existe'));
    });

    it('incluye quién la editó y cuándo', async () => {
      repo.findOneDeResidente.mockResolvedValue(fila({ editadoPor: { id: 'r-1', nombre: 'Ana' } }));
      expect(await service.obtener('a-1', 'r-1')).toMatchObject({
        editadoPor: { id: 'r-1', nombre: 'Ana' },
        actualizadoEn: '2026-11-05T12:00:00.000Z',
      });
    });
  });

  describe('editar', () => {
    const editar = (cambios: Partial<EditarAutorizacionDto>) =>
      service.editar('a-1', 'r-1', cambios as EditarAutorizacionDto);

    beforeEach(() => {
      repo.findOneDeResidente.mockResolvedValue(fila());
      repo.editarSiVigente.mockResolvedValue(1);
    });

    it('404 si no existe o es ajena', async () => {
      repo.findOneDeResidente.mockResolvedValue(null);
      await expect(editar({ nombre: 'Otro' })).rejects.toThrow(new NotFoundException('La autorización no existe'));
      expect(repo.editarSiVigente).not.toHaveBeenCalled();
    });

    it.each(['USADA', 'VENCIDA', 'CANCELADA'])('409 si está %s', async (estado) => {
      repo.findOneDeResidente.mockResolvedValue(fila({ estado }));
      await expect(editar({ nombre: 'Otro' })).rejects.toThrow(
        new ConflictException('Esta autorización ya no se puede editar'),
      );
      expect(repo.editarSiVigente).not.toHaveBeenCalled();
    });

    it('sin cambio de fecha conserva el código', async () => {
      await editar({ nombre: 'Pedro', placa: 'P123', horaEstimada: '09:15', fechaVisita: '2026-11-10' });
      expect(repo.editarSiVigente).toHaveBeenCalledWith('a-1', 'r-1', {
        nombre: 'Pedro',
        placa: 'P123',
        horaEstimada: new Date('1970-01-01T09:15:00.000Z'),
      });
    });

    it('con fecha nueva genera otro código de 6 dígitos', async () => {
      await editar({ fechaVisita: '2026-11-12' });
      const cambios = repo.editarSiVigente.mock.calls[0][2];
      expect(cambios.fechaVisita).toEqual(new Date('2026-11-12T00:00:00.000Z'));
      expect(cambios.codigo).toMatch(/^\d{6}$/);
    });

    it('reintenta el código ante P2002 y agota con 503', async () => {
      repo.editarSiVigente.mockRejectedValueOnce(colision()).mockResolvedValueOnce(1);
      await editar({ fechaVisita: '2026-11-12' });
      expect(repo.editarSiVigente).toHaveBeenCalledTimes(2);

      repo.editarSiVigente.mockReset().mockRejectedValue(colision());
      await expect(editar({ fechaVisita: '2026-11-12' })).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(repo.editarSiVigente).toHaveBeenCalledTimes(MAX_INTENTOS_CODIGO);
    });

    it('409 si pierde la carrera (count 0)', async () => {
      repo.editarSiVigente.mockResolvedValue(0);
      await expect(editar({ nombre: 'Pedro' })).rejects.toThrow(
        new ConflictException('Esta autorización ya no se puede editar'),
      );
    });

    it('devuelve la autorización releída con el editor', async () => {
      repo.findOneDeResidente
        .mockResolvedValueOnce(fila())
        .mockResolvedValueOnce(fila({ nombre: 'Pedro', editadoPor: { id: 'r-1', nombre: 'Ana' } }));
      const r = await editar({ nombre: 'Pedro' });
      expect(r).toMatchObject({ nombre: 'Pedro', codigo: '123456', editadoPor: { id: 'r-1', nombre: 'Ana' } });
    });
  });
});
