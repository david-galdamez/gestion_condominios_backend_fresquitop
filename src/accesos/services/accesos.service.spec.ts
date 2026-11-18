import { ConflictException, NotFoundException } from '@nestjs/common';
import type { UnidadRepository } from '@Unidades/repositories';
import type { AccesoRepository } from '../repositories/acceso.repository.js';
import {
  AccesosService,
  mensajeCodigoNoValido,
  MSG_ACCESO_NO_EXISTE,
  MSG_CODIGO_NO_EXISTE,
  MSG_CODIGO_OTRA_FECHA,
  MSG_UNIDAD_NO_EXISTE,
  MSG_YA_SALIO,
} from './accesos.service.js';

const fila = (extra: object = {}) => ({
  id: 'r-1',
  autorizacionId: null,
  unidadId: 'u-1',
  unidad: { id: 'u-1', codigo: 'A-101' },
  nombre: 'Ana López',
  tipoDocumento: 'DUI',
  numeroDocumento: '01234567-8',
  motivo: 'Entrega',
  preautorizado: false,
  estado: 'DENTRO',
  horaEntrada: new Date('2026-11-11T16:00:00.000Z'),
  horaSalida: null,
  ...extra,
});

describe('AccesosService', () => {
  const repo = {
    entrarConCodigo: vi.fn(),
    entrarSinCodigo: vi.fn(),
    marcarSalida: vi.fn(),
    findById: vi.fn(),
    findDentro: vi.fn(),
    findAutorizacionesDeHoy: vi.fn(),
  };
  const unidades = { findById: vi.fn() };
  const service = new AccesosService(repo as unknown as AccesoRepository, unidades as unknown as UnidadRepository);

  beforeEach(() => vi.resetAllMocks());

  describe('entrada con código', () => {
    // 11 de noviembre 03:00 UTC = 10 de noviembre en El Salvador.
    const ahora = new Date('2026-11-11T03:00:00Z');

    it('usa la fecha de El Salvador y devuelve el registro DENTRO preautorizado', async () => {
      repo.entrarConCodigo.mockResolvedValue({
        tipo: 'ok',
        acceso: fila({ preautorizado: true, motivo: null, autorizacionId: 'a-1' }),
      });
      const r = await service.registrarEntrada('g-1', { codigo: '048213' }, ahora);
      expect(repo.entrarConCodigo).toHaveBeenCalledWith('048213', '2026-11-10', 'g-1');
      expect(r).toMatchObject({ unidad: 'A-101', preautorizado: true, estado: 'DENTRO', motivo: null });
      expect(r.horaEntrada).toBe('2026-11-11T16:00:00.000Z');
    });

    it.each([
      ['USADA', 'Código no válido: está usado'],
      ['CANCELADA', 'Código no válido: está cancelado'],
      ['VENCIDA', 'Código no válido: está vencido'],
    ] as const)('%s responde 409 "%s"', async (estado, mensaje) => {
      repo.entrarConCodigo.mockResolvedValue({ tipo: 'no_vigente', estado });
      expect(mensajeCodigoNoValido(estado)).toBe(mensaje);
      await expect(service.registrarEntrada('g-1', { codigo: '048213' })).rejects.toThrow(new ConflictException(mensaje));
    });

    it('código de otra fecha responde 409', async () => {
      repo.entrarConCodigo.mockResolvedValue({ tipo: 'otra_fecha' });
      await expect(service.registrarEntrada('g-1', { codigo: '048213' })).rejects.toThrow(
        new ConflictException(MSG_CODIGO_OTRA_FECHA),
      );
    });

    it('código inexistente responde 404', async () => {
      repo.entrarConCodigo.mockResolvedValue({ tipo: 'no_existe' });
      await expect(service.registrarEntrada('g-1', { codigo: '048213' })).rejects.toThrow(
        new NotFoundException(MSG_CODIGO_NO_EXISTE),
      );
    });
  });

  describe('entrada sin pre-autorización', () => {
    const dto = {
      nombre: 'Ana López',
      tipoDocumento: 'DUI' as const,
      numeroDocumento: '01234567-8',
      unidadId: 'u-1',
      motivo: 'Entrega',
    };

    it('crea el registro con el guardia de la sesión', async () => {
      unidades.findById.mockResolvedValue({ id: 'u-1', codigo: 'A-101', activa: true });
      repo.entrarSinCodigo.mockResolvedValue(fila());
      const r = await service.registrarEntrada('g-1', dto);
      expect(repo.entrarSinCodigo).toHaveBeenCalledWith({ ...dto, entradaPorId: 'g-1' });
      expect(r).toMatchObject({ preautorizado: false, motivo: 'Entrega' });
    });

    it.each([null, { id: 'u-1', codigo: 'A-101', activa: false }])('unidad %o responde 404', async (unidad) => {
      unidades.findById.mockResolvedValue(unidad);
      await expect(service.registrarEntrada('g-1', dto)).rejects.toThrow(new NotFoundException(MSG_UNIDAD_NO_EXISTE));
      expect(repo.entrarSinCodigo).not.toHaveBeenCalled();
    });
  });

  describe('salida', () => {
    it('marca la salida y devuelve el registro SALIO', async () => {
      const ahora = new Date('2026-11-11T20:00:00.000Z');
      repo.marcarSalida.mockResolvedValue(1);
      repo.findById.mockResolvedValue(fila({ estado: 'SALIO', horaSalida: ahora }));
      const r = await service.registrarSalida('r-1', 'g-2', ahora);
      expect(repo.marcarSalida).toHaveBeenCalledWith('r-1', 'g-2', ahora);
      expect(r).toMatchObject({ estado: 'SALIO', horaSalida: '2026-11-11T20:00:00.000Z' });
    });

    it('una segunda salida responde 409', async () => {
      repo.marcarSalida.mockResolvedValue(0);
      repo.findById.mockResolvedValue(fila({ estado: 'SALIO' }));
      await expect(service.registrarSalida('r-1', 'g-2')).rejects.toThrow(new ConflictException(MSG_YA_SALIO));
    });

    it('registro inexistente responde 404', async () => {
      repo.marcarSalida.mockResolvedValue(0);
      repo.findById.mockResolvedValue(null);
      await expect(service.registrarSalida('r-1', 'g-2')).rejects.toThrow(
        new NotFoundException(MSG_ACCESO_NO_EXISTE),
      );
    });
  });

  it('buscarAutorizacionesDeHoy consulta la fecha de El Salvador', async () => {
    repo.findAutorizacionesDeHoy.mockResolvedValue([]);
    await service.buscarAutorizacionesDeHoy('048213', new Date('2026-11-11T03:00:00Z'));
    expect(repo.findAutorizacionesDeHoy).toHaveBeenCalledWith('048213', new Date('2026-11-10T00:00:00.000Z'));
  });
});
