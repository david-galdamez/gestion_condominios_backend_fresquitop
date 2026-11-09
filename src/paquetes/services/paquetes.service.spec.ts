import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { ArchivosService } from '@Archivos/services';
import type { NotificacionService } from '@Notificaciones/services';
import type { UnidadRepository } from '@Unidades/repositories';
import type { RegistrarPaqueteDto } from '../dto/registrar-paquete.dto.js';
import type { PaqueteRepository } from '../repositories/paquete.repository.js';
import {
  generarCodigoRetiro,
  MSG_UNIDAD_NO_EXISTE,
  MSG_UNIDAD_SIN_RESIDENTES,
  PaquetesService,
  TITULO_AVISO,
} from './paquetes.service.js';

describe('PaquetesService', () => {
  const repo = { siguienteCodigo: vi.fn(), create: vi.fn(), findPorRetirar: vi.fn() };
  const unidades = { findById: vi.fn(), contarResidentesActivos: vi.fn() };
  const archivos = { extensionImagen: vi.fn(), guardar: vi.fn(), borrar: vi.fn() };
  const notificaciones = { enviar: vi.fn() };
  const service = new PaquetesService(
    repo as unknown as PaqueteRepository,
    unidades as unknown as UnidadRepository,
    archivos as unknown as ArchivosService,
    notificaciones as unknown as NotificacionService,
  );

  const foto = { buffer: Buffer.from('x'), size: 1 };
  const dto = (extra: Partial<RegistrarPaqueteDto> = {}) =>
    ({ unidadId: 'u-1', destinatario: 'Carlos', mensajeria: 'DHL', ...extra }) as RegistrarPaqueteDto;
  const fila = (extra: object = {}) => ({
    id: 'p-1',
    codigoPaquete: 'PAQ-000007',
    destinatario: 'Carlos',
    mensajeria: 'DHL',
    guia: null,
    estado: 'EN_PORTERIA',
    recibidoEn: new Date('2026-11-09T18:40:00.000Z'),
    unidad: { codigo: 'A-101' },
    ...extra,
  });

  beforeEach(() => {
    vi.resetAllMocks();
    archivos.extensionImagen.mockReturnValue('png');
    archivos.guardar.mockResolvedValue('paquetes/abc.png');
    unidades.findById.mockResolvedValue({ id: 'u-1', codigo: 'A-101', activa: true });
    unidades.contarResidentesActivos.mockResolvedValue(2);
    repo.siguienteCodigo.mockResolvedValue('PAQ-000007');
    repo.create.mockResolvedValue(fila());
    notificaciones.enviar.mockResolvedValue({ id: 'n-1', destinatarios: 2 });
  });

  describe('registrar', () => {
    it('guarda con guardia de la sesión, dos códigos y la foto; responde sin código de retiro', async () => {
      const r = await service.registrar('g-1', dto(), foto);
      const data = repo.create.mock.calls[0][0];
      expect(data).toMatchObject({
        codigoPaquete: 'PAQ-000007',
        unidadId: 'u-1',
        recibidoPorId: 'g-1',
        fotoUrl: 'paquetes/abc.png',
        guia: null,
      });
      expect(data.codigoRetiro).toMatch(/^\d{6}$/);
      expect(archivos.guardar).toHaveBeenCalledWith('paquetes', foto, 'png');
      expect(r).toEqual({
        id: 'p-1',
        codigoPaquete: 'PAQ-000007',
        unidad: 'A-101',
        destinatario: 'Carlos',
        mensajeria: 'DHL',
        guia: null,
        estado: 'EN_PORTERIA',
        recibidoEn: '2026-11-09T18:40:00.000Z',
      });
      expect(r).not.toHaveProperty('codigoRetiro');
    });

    it('avisa a la unidad (BE-9.2) con mensajería y código', async () => {
      await service.registrar('g-1', dto(), foto);
      expect(notificaciones.enviar).toHaveBeenCalledWith({
        destinatario: { tipo: 'UNIDAD', id: 'u-1' },
        titulo: TITULO_AVISO,
        mensaje: 'DHL · PAQ-000007',
        moduloOrigen: 'PAQUETERIA',
        referencia: '/paquetes/p-1',
      });
    });

    it('si el aviso falla, el paquete queda registrado igual', async () => {
      notificaciones.enviar.mockRejectedValue(new Error('caído'));
      await expect(service.registrar('g-1', dto(), foto)).resolves.toMatchObject({ codigoPaquete: 'PAQ-000007' });
    });

    it('sin foto o foto inválida -> 400 sin tocar nada', async () => {
      archivos.extensionImagen.mockReturnValue(null);
      await expect(service.registrar('g-1', dto(), foto)).rejects.toThrow(
        new BadRequestException('Solo JPG o PNG de hasta 5 MB'),
      );
      await expect(service.registrar('g-1', dto(), undefined)).rejects.toBeInstanceOf(BadRequestException);
      expect(archivos.guardar).not.toHaveBeenCalled();
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('unidad inexistente o inactiva -> 404', async () => {
      unidades.findById.mockResolvedValueOnce(null);
      await expect(service.registrar('g-1', dto(), foto)).rejects.toThrow(new NotFoundException(MSG_UNIDAD_NO_EXISTE));
      unidades.findById.mockResolvedValueOnce({ id: 'u-1', codigo: 'A-101', activa: false });
      await expect(service.registrar('g-1', dto(), foto)).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('unidad sin residentes activos -> 409 y no guarda la foto', async () => {
      unidades.contarResidentesActivos.mockResolvedValue(0);
      await expect(service.registrar('g-1', dto(), foto)).rejects.toThrow(
        new ConflictException(MSG_UNIDAD_SIN_RESIDENTES),
      );
      expect(archivos.guardar).not.toHaveBeenCalled();
      expect(notificaciones.enviar).not.toHaveBeenCalled();
    });

    it('si falla el insert borra la foto y propaga el error', async () => {
      repo.create.mockRejectedValue(new Error('boom'));
      await expect(service.registrar('g-1', dto(), foto)).rejects.toThrow('boom');
      expect(archivos.borrar).toHaveBeenCalledWith('paquetes/abc.png');
      expect(notificaciones.enviar).not.toHaveBeenCalled();
    });

    it('guía vacía se guarda como null y la guía con valor se conserva', async () => {
      await service.registrar('g-1', dto({ guia: 'G-1' }), foto);
      expect(repo.create.mock.calls[0][0].guia).toBe('G-1');
    });
  });

  it('listarPorRetirar mapea las filas', async () => {
    repo.findPorRetirar.mockResolvedValue([fila(), fila({ id: 'p-2', estado: 'RETENIDO' })]);
    const r = await service.listarPorRetirar();
    expect(r.datos.map((p) => p.estado)).toEqual(['EN_PORTERIA', 'RETENIDO']);
  });

  it('generarCodigoRetiro siempre da 6 dígitos', () => {
    for (let i = 0; i < 200; i++) expect(generarCodigoRetiro()).toMatch(/^\d{6}$/);
  });
});
