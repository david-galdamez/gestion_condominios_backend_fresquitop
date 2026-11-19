import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Rol } from '@PrismaClient';
import { DatoInvalidoError, DestinoNoExisteError } from '@Notificaciones/errors';
import type { NotificacionRepository } from '@Notificaciones/repositories';
import type { EnviarAvisoInput } from '@Notificaciones/types';
import { NotificacionService } from './notificacion.service.js';

const UUID_USUARIO = '11111111-1111-4111-8111-111111111111';
const UUID_UNIDAD = '22222222-2222-4222-8222-222222222222';
const UUID_TORRE = '33333333-3333-4333-8333-333333333333';
const UUID_NOTIF = '44444444-4444-4444-8444-444444444444';

const RESIDENTE_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const RESIDENTE_2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const RESIDENTE_3 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';

interface RepoMock {
  findUsuarioById: ReturnType<typeof vi.fn>;
  existsUnidad: ReturnType<typeof vi.fn>;
  findResidentesActivosPorUnidad: ReturnType<typeof vi.fn>;
  existsTorre: ReturnType<typeof vi.fn>;
  findResidentesActivosPorTorre: ReturnType<typeof vi.fn>;
  findTodosResidentesActivos: ReturnType<typeof vi.fn>;
  crearConDestinatarios: ReturnType<typeof vi.fn>;
}

describe('NotificacionService (H18)', () => {
  let repo: RepoMock;
  let service: NotificacionService;

  const avisoBase = (extra: Partial<EnviarAvisoInput> = {}): EnviarAvisoInput => ({
    destinatario: { tipo: 'UNIDAD', id: UUID_UNIDAD },
    titulo: 'Tienes un paquete en portería',
    mensaje: 'DHL · PAQ-000001 disponible para retiro.',
    moduloOrigen: 'PAQUETERIA',
    referencia: '/paquetes/p-1',
    ...extra,
  });

  beforeEach(() => {
    repo = {
      findUsuarioById: vi.fn(),
      existsUnidad: vi.fn(),
      findResidentesActivosPorUnidad: vi.fn(),
      existsTorre: vi.fn(),
      findResidentesActivosPorTorre: vi.fn(),
      findTodosResidentesActivos: vi.fn(),
      crearConDestinatarios: vi.fn().mockImplementation(async (_datos, ids: string[]) => ({
        id: UUID_NOTIF,
        destinatarios: ids.length,
      })),
    };
    service = new NotificacionService(repo as unknown as NotificacionRepository);
  });

  describe('envío exitoso por tipo de destino', () => {
    it('envía a USUARIO cuando el usuario existe, es RESIDENTE y está activo', async () => {
      repo.findUsuarioById.mockResolvedValue({
        id: UUID_USUARIO,
        rol: Rol.RESIDENTE,
        isActive: true,
      });

      const res = await service.enviar(
        avisoBase({
          destinatario: { tipo: 'USUARIO', id: UUID_USUARIO },
          moduloOrigen: 'INCIDENCIAS',
        }),
      );

      expect(res).toEqual({ id: UUID_NOTIF, destinatarios: 1 });
      expect(repo.crearConDestinatarios).toHaveBeenCalledWith(
        expect.objectContaining({
          destinoTipo: 'USUARIO',
          destinoId: UUID_USUARIO,
          moduloOrigen: 'INCIDENCIAS',
        }),
        [UUID_USUARIO],
      );
    });

    it('envía a UNIDAD con 3 residentes activos y retorna 3 destinatarios', async () => {
      repo.existsUnidad.mockResolvedValue(true);
      repo.findResidentesActivosPorUnidad.mockResolvedValue([
        RESIDENTE_1,
        RESIDENTE_2,
        RESIDENTE_3,
      ]);

      const res = await service.enviar(avisoBase());

      expect(res).toEqual({ id: UUID_NOTIF, destinatarios: 3 });
      expect(repo.existsUnidad).toHaveBeenCalledWith(UUID_UNIDAD);
      expect(repo.findResidentesActivosPorUnidad).toHaveBeenCalledWith(UUID_UNIDAD);
      expect(repo.crearConDestinatarios).toHaveBeenCalledWith(
        expect.objectContaining({
          destinoTipo: 'UNIDAD',
          destinoId: UUID_UNIDAD,
        }),
        [RESIDENTE_1, RESIDENTE_2, RESIDENTE_3],
      );
    });

    it('envía a TORRE y resuelve los residentes activos de todas sus unidades', async () => {
      repo.existsTorre.mockResolvedValue(true);
      repo.findResidentesActivosPorTorre.mockResolvedValue([RESIDENTE_1, RESIDENTE_2]);

      const res = await service.enviar(
        avisoBase({
          destinatario: { tipo: 'TORRE', id: UUID_TORRE },
          moduloOrigen: 'COMUNICADOS',
        }),
      );

      expect(res).toEqual({ id: UUID_NOTIF, destinatarios: 2 });
      expect(repo.existsTorre).toHaveBeenCalledWith(UUID_TORRE);
      expect(repo.findResidentesActivosPorTorre).toHaveBeenCalledWith(UUID_TORRE);
      expect(repo.crearConDestinatarios).toHaveBeenCalledWith(
        expect.objectContaining({
          destinoTipo: 'TORRE',
          destinoId: UUID_TORRE,
          moduloOrigen: 'COMUNICADOS',
        }),
        [RESIDENTE_1, RESIDENTE_2],
      );
    });

    it('envía a TODOS sin requerir id y persiste para todos los residentes activos', async () => {
      repo.findTodosResidentesActivos.mockResolvedValue([
        RESIDENTE_1,
        RESIDENTE_2,
        RESIDENTE_3,
      ]);

      const res = await service.enviar(
        avisoBase({
          destinatario: { tipo: 'TODOS' },
          moduloOrigen: 'VOTACIONES',
          referencia: undefined,
        }),
      );

      expect(res).toEqual({ id: UUID_NOTIF, destinatarios: 3 });
      expect(repo.findTodosResidentesActivos).toHaveBeenCalledTimes(1);
      expect(repo.crearConDestinatarios).toHaveBeenCalledWith(
        expect.objectContaining({
          destinoTipo: 'TODOS',
          destinoId: undefined,
          moduloOrigen: 'VOTACIONES',
        }),
        [RESIDENTE_1, RESIDENTE_2, RESIDENTE_3],
      );
    });
  });

  describe('caso límite: destino válido con 0 residentes activos', () => {
    it('guarda la notificación con 0 destinatarios cuando la UNIDAD no tiene residentes activos', async () => {
      repo.existsUnidad.mockResolvedValue(true);
      repo.findResidentesActivosPorUnidad.mockResolvedValue([]);

      const res = await service.enviar(avisoBase());

      expect(res).toEqual({ id: UUID_NOTIF, destinatarios: 0 });
      expect(repo.crearConDestinatarios).toHaveBeenCalledWith(
        expect.objectContaining({ destinoTipo: 'UNIDAD', destinoId: UUID_UNIDAD }),
        [],
      );
    });

    it('guarda con 0 destinatarios cuando USUARIO existe pero está inactivo o no es RESIDENTE', async () => {
      repo.findUsuarioById.mockResolvedValue({
        id: UUID_USUARIO,
        rol: Rol.ADMINISTRADOR,
        isActive: true,
      });

      const resAdmin = await service.enviar(
        avisoBase({ destinatario: { tipo: 'USUARIO', id: UUID_USUARIO } }),
      );
      expect(resAdmin).toEqual({ id: UUID_NOTIF, destinatarios: 0 });

      repo.findUsuarioById.mockResolvedValue({
        id: UUID_USUARIO,
        rol: Rol.RESIDENTE,
        isActive: false,
      });

      const resInactivo = await service.enviar(
        avisoBase({ destinatario: { tipo: 'USUARIO', id: UUID_USUARIO } }),
      );
      expect(resInactivo).toEqual({ id: UUID_NOTIF, destinatarios: 0 });
    });
  });

  describe('validaciones de entrada (DatoInvalidoError)', () => {
    it.each<[string, Partial<EnviarAvisoInput>]>([
      ['falta destinatario', { destinatario: undefined as unknown as EnviarAvisoInput['destinatario'] }],
      ['tipo de destino inválido', { destinatario: { tipo: 'CONDOMINIO' as never, id: UUID_UNIDAD } }],
      ['título vacío', { titulo: '' }],
      ['título solo espacios', { titulo: '   ' }],
      ['título mayor a 80 caracteres', { titulo: 'a'.repeat(81) }],
      ['mensaje vacío', { mensaje: '' }],
      ['mensaje mayor a 300 caracteres', { mensaje: 'a'.repeat(301) }],
      ['referencia mayor a 200 caracteres', { referencia: `/${'a'.repeat(200)}` }],
      ['módulo de origen inválido', { moduloOrigen: 'OTRO' as never }],
      ['falta id en UNIDAD', { destinatario: { tipo: 'UNIDAD' } }],
      ['falta id en USUARIO', { destinatario: { tipo: 'USUARIO' } }],
      ['falta id en TORRE', { destinatario: { tipo: 'TORRE' } }],
      ['id no es UUID válido en UNIDAD', { destinatario: { tipo: 'UNIDAD', id: 'no-es-uuid' } }],
    ])('lanza DatoInvalidoError cuando %s', async (_caso, extra) => {
      await expect(service.enviar(avisoBase(extra))).rejects.toThrow(DatoInvalidoError);
      expect(repo.crearConDestinatarios).not.toHaveBeenCalled();
    });
  });

  describe('destinos inexistentes (DestinoNoExisteError)', () => {
    it('lanza DestinoNoExisteError si el USUARIO no existe', async () => {
      repo.findUsuarioById.mockResolvedValue(null);

      await expect(
        service.enviar(avisoBase({ destinatario: { tipo: 'USUARIO', id: UUID_USUARIO } })),
      ).rejects.toThrow(DestinoNoExisteError);

      expect(repo.crearConDestinatarios).not.toHaveBeenCalled();
    });

    it('lanza DestinoNoExisteError si la UNIDAD no existe', async () => {
      repo.existsUnidad.mockResolvedValue(false);

      await expect(
        service.enviar(avisoBase({ destinatario: { tipo: 'UNIDAD', id: UUID_UNIDAD } })),
      ).rejects.toThrow(DestinoNoExisteError);

      expect(repo.findResidentesActivosPorUnidad).not.toHaveBeenCalled();
      expect(repo.crearConDestinatarios).not.toHaveBeenCalled();
    });

    it('lanza DestinoNoExisteError si la TORRE no existe', async () => {
      repo.existsTorre.mockResolvedValue(false);

      await expect(
        service.enviar(avisoBase({ destinatario: { tipo: 'TORRE', id: UUID_TORRE } })),
      ).rejects.toThrow(DestinoNoExisteError);

      expect(repo.findResidentesActivosPorTorre).not.toHaveBeenCalled();
      expect(repo.crearConDestinatarios).not.toHaveBeenCalled();
    });
  });
});