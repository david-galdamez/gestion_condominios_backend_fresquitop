import { Prisma } from '@PrismaClient';
import {
  validarAviso,
  type NotificacionService,
} from '@Notificaciones/services';
import type {
  CuotaPorVencer,
  GeneracionCuotaRepository,
} from '../repositories/index.js';
import { AvisoCuotasService, avisoPorVencer } from './aviso-cuotas.service.js';

const cuota = (extra: Partial<CuotaPorVencer> = {}): CuotaPorVencer => ({
  id: 'q-1',
  unidadId: 'u-1',
  periodo: '2026-12',
  monto: new Prisma.Decimal('45'),
  fechaVencimiento: new Date('2026-12-10T00:00:00.000Z'),
  ...extra,
});

describe('avisoPorVencer', () => {
  it('arma el aviso del contrato de notificaciones para la unidad', () => {
    const aviso = avisoPorVencer(cuota());
    expect(aviso).toEqual({
      destinatario: { tipo: 'UNIDAD', id: 'u-1' },
      titulo: 'Tu cuota vence pronto',
      mensaje: 'La cuota de 2026-12 por $45.00 vence el 10/12/2026.',
      moduloOrigen: 'PAGOS',
      referencia: '/estado-cuenta',
    });
    expect(() => validarAviso(aviso)).not.toThrow();
  });
});

describe('AvisoCuotasService', () => {
  const repo = {
    findPendientesQueVencen: vi.fn(),
    registrarAvisoPorVencer: vi.fn(),
  };
  const notificaciones = { enviar: vi.fn() };
  const service = new AvisoCuotasService(
    repo as unknown as GeneracionCuotaRepository,
    notificaciones as unknown as NotificacionService,
  );

  // El repositorio real ejecuta `enviar` dentro de su transacción; acá se simula igual.
  const registrarQueEnvia = async (
    _id: string,
    enviar: () => Promise<unknown>,
  ) => {
    await enviar();
    return true;
  };

  beforeEach(() => vi.resetAllMocks());

  it('busca las cuotas que vencen dentro de 3 días (hora de El Salvador)', async () => {
    repo.findPendientesQueVencen.mockResolvedValue([]);
    // 8 de diciembre 01:00 UTC = 7 de diciembre en El Salvador -> vencen el 10.
    await service.avisarPorVencer(new Date('2026-12-08T01:00:00Z'));
    expect(repo.findPendientesQueVencen).toHaveBeenCalledWith(
      new Date('2026-12-10T00:00:00.000Z'),
    );
  });

  it('envía un aviso por cuota y cuenta solo los enviados', async () => {
    repo.findPendientesQueVencen.mockResolvedValue([
      cuota(),
      cuota({ id: 'q-2', unidadId: 'u-2' }),
    ]);
    repo.registrarAvisoPorVencer
      .mockImplementationOnce(registrarQueEnvia)
      .mockResolvedValueOnce(false);
    notificaciones.enviar.mockResolvedValue({ id: 'n-1', destinatarios: 2 });

    await expect(service.avisarPorVencer()).resolves.toBe(1);
    expect(notificaciones.enviar).toHaveBeenCalledTimes(1);
    expect(notificaciones.enviar).toHaveBeenCalledWith(
      expect.objectContaining({ destinatario: { tipo: 'UNIDAD', id: 'u-1' } }),
    );
  });

  it('un fallo en una cuota no detiene las demás', async () => {
    repo.findPendientesQueVencen.mockResolvedValue([
      cuota(),
      cuota({ id: 'q-2' }),
    ]);
    repo.registrarAvisoPorVencer
      .mockRejectedValueOnce(new Error('falló'))
      .mockImplementationOnce(registrarQueEnvia);
    notificaciones.enviar.mockResolvedValue({ id: 'n-1', destinatarios: 1 });

    await expect(service.avisarPorVencer()).resolves.toBe(1);
  });

  it('tareaDiaria invoca el aviso', async () => {
    repo.findPendientesQueVencen.mockResolvedValue([]);
    await service.tareaDiaria();
    expect(repo.findPendientesQueVencen).toHaveBeenCalledTimes(1);
  });
});
