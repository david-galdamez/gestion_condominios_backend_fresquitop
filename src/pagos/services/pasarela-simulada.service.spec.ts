import { Prisma } from '@PrismaClient';
import { MOTIVO_FONDOS, MOTIVO_NO_RECONOCIDA, PasarelaSimuladaService } from './pasarela-simulada.service.js';

describe('PasarelaSimuladaService', () => {
  const tarjeta = (numero: string) => ({ numero, vencimiento: '12/30', cvv: '123', titular: 'Ana' });
  const monto = new Prisma.Decimal(90);

  beforeAll(() => {
    process.env.PASARELA_ESPERA_MS = '0';
  });

  it('4242 4242 4242 4242 aprueba', async () => {
    const s = new PasarelaSimuladaService();
    expect(await s.cobrar(monto, tarjeta('4242424242424242'))).toEqual({ aprobado: true, ultimos4: '4242' });
  });

  it('4000 0000 0000 0002 rechaza por fondos insuficientes', async () => {
    const s = new PasarelaSimuladaService();
    expect(await s.cobrar(monto, tarjeta('4000000000000002'))).toEqual({
      aprobado: false,
      motivo: MOTIVO_FONDOS,
      ultimos4: '0002',
    });
  });

  it('cualquier otra tarjeta: no reconocida', async () => {
    const s = new PasarelaSimuladaService();
    expect(await s.cobrar(monto, tarjeta('5555555555554444'))).toMatchObject({
      aprobado: false,
      motivo: MOTIVO_NO_RECONOCIDA,
    });
  });

  it('espera el tiempo configurado (2 s por defecto)', async () => {
    vi.useFakeTimers();
    process.env.PASARELA_ESPERA_MS = '2000';
    const s = new PasarelaSimuladaService();
    let listo = false;
    const p = s.cobrar(monto, tarjeta('4242424242424242')).then(() => (listo = true));
    await vi.advanceTimersByTimeAsync(1999);
    expect(listo).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(listo).toBe(true);
    vi.useRealTimers();
    process.env.PASARELA_ESPERA_MS = '0';
  });
});
