import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@PrismaClient';
import type {
  ConfiguracionCuotaRepository,
  GeneracionCuotaRepository,
} from '../repositories/index.js';
import { CuotasService, MSG_SIN_CONFIGURACION } from './cuotas.service.js';
import { GeneracionAutomaticaService } from './generacion-automatica.service.js';

describe('CuotasService', () => {
  const configuraciones = { findVigente: vi.fn(), create: vi.fn() };
  const generaciones = { generar: vi.fn() };
  const service = new CuotasService(
    configuraciones as unknown as ConfiguracionCuotaRepository,
    generaciones as unknown as GeneracionCuotaRepository,
  );

  const config = (extra: object = {}) => ({
    id: 'c-1',
    montoMensual: new Prisma.Decimal('45.00'),
    diaVencimiento: 10,
    creadaPorId: 'admin-1',
    // 2 de noviembre 03:00 UTC = 1 de noviembre en El Salvador.
    createdAt: new Date('2026-11-02T03:00:00Z'),
    ...extra,
  });

  beforeEach(() => vi.resetAllMocks());

  it('obtenerConfiguracion devuelve la vigente con vigenteDesde en hora local', async () => {
    configuraciones.findVigente.mockResolvedValue(config());
    await expect(service.obtenerConfiguracion()).resolves.toEqual({
      montoMensual: 45,
      diaVencimiento: 10,
      vigenteDesde: '2026-11-01',
    });
  });

  it('obtenerConfiguracion responde 404 si no existe', async () => {
    configuraciones.findVigente.mockResolvedValue(null);
    await expect(service.obtenerConfiguracion()).rejects.toThrow(
      NotFoundException,
    );
  });

  it('guardarConfiguracion registra al administrador de la sesión', async () => {
    configuraciones.create.mockResolvedValue(
      config({ montoMensual: new Prisma.Decimal('50.25') }),
    );
    const r = await service.guardarConfiguracion('admin-1', {
      montoMensual: 50.25,
      diaVencimiento: 10,
    });
    expect(configuraciones.create).toHaveBeenCalledWith({
      montoMensual: 50.25,
      diaVencimiento: 10,
      creadaPorId: 'admin-1',
    });
    expect(r.montoMensual).toBe(50.25);
  });

  it('generar usa el monto vigente y el día configurado del periodo', async () => {
    configuraciones.findVigente.mockResolvedValue(
      config({ diaVencimiento: 5 }),
    );
    generaciones.generar.mockResolvedValue({ creadas: 28, omitidas: 2 });

    await expect(service.generarManual('admin-1', '2026-12')).resolves.toEqual({
      periodo: '2026-12',
      creadas: 28,
      omitidas: 2,
    });
    expect(generaciones.generar).toHaveBeenCalledWith({
      periodo: '2026-12',
      monto: new Prisma.Decimal('45.00'),
      fechaVencimiento: new Date('2026-12-05T00:00:00.000Z'),
      origen: 'MANUAL',
      ejecutadaPorId: 'admin-1',
    });
  });

  it('generar sin configuración responde 409 y no toca las cuotas', async () => {
    configuraciones.findVigente.mockResolvedValue(null);
    await expect(service.generarManual('admin-1', '2026-12')).rejects.toThrow(
      new ConflictException(MSG_SIN_CONFIGURACION),
    );
    expect(generaciones.generar).not.toHaveBeenCalled();
  });
});

describe('GeneracionAutomaticaService', () => {
  const cuotas = { generar: vi.fn() };
  const service = new GeneracionAutomaticaService(
    cuotas as unknown as CuotasService,
  );

  beforeEach(() => vi.resetAllMocks());

  it('genera el mes actual de El Salvador como AUTOMATICA sin usuario', async () => {
    cuotas.generar.mockResolvedValue({
      periodo: '2026-12',
      creadas: 3,
      omitidas: 0,
    });
    // 1 de diciembre 06:00 UTC = 00:00 en El Salvador.
    await service.generarMesActual(new Date('2026-12-01T06:00:00Z'));
    expect(cuotas.generar).toHaveBeenCalledWith('2026-12', 'AUTOMATICA', null);
  });

  it('sin configuración no lanza: deja aviso y devuelve null', async () => {
    cuotas.generar.mockRejectedValue(
      new ConflictException(MSG_SIN_CONFIGURACION),
    );
    await expect(
      service.generarMesActual(new Date('2026-12-01T06:00:00Z')),
    ).resolves.toBeNull();
  });

  it('otros errores se propagan', async () => {
    cuotas.generar.mockRejectedValue(new Error('db caída'));
    await expect(service.generarMesActual()).rejects.toThrow('db caída');
  });

  it('tareaMensual invoca la generación', async () => {
    cuotas.generar.mockResolvedValue({
      periodo: '2026-12',
      creadas: 0,
      omitidas: 0,
    });
    await service.tareaMensual();
    expect(cuotas.generar).toHaveBeenCalledTimes(1);
  });
});
