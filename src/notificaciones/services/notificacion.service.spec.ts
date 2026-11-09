import { DatoInvalidoError, type Aviso } from './notificacion.service.js';
import { NotificacionServiceTemporal } from './notificacion-temporal.service.js';

describe('NotificacionService (contrato y versión temporal)', () => {
  const service = new NotificacionServiceTemporal();
  const aviso = (extra: Partial<Aviso> = {}): Aviso => ({
    destinatario: { tipo: 'UNIDAD', id: 'u-1' },
    titulo: 'Tienes un paquete en portería',
    mensaje: 'DHL · PAQ-000001',
    moduloOrigen: 'PAQUETERIA',
    referencia: '/paquetes/p-1',
    ...extra,
  });

  it('acepta un aviso válido', async () => {
    await expect(service.enviar(aviso())).resolves.toMatchObject({ destinatarios: 0 });
  });

  it.each([
    ['sin título', { titulo: '' }],
    ['título de 81', { titulo: 'a'.repeat(81) }],
    ['mensaje de 301', { mensaje: 'a'.repeat(301) }],
    ['sin id con UNIDAD', { destinatario: { tipo: 'UNIDAD' as const } }],
    ['módulo fuera de la lista', { moduloOrigen: 'OTRO' as never }],
  ])('rechaza %s con DatoInvalidoError', (_t, extra) => {
    expect(() => service.enviar(aviso(extra))).toThrow(DatoInvalidoError);
  });

  it('TODOS no necesita id', async () => {
    await expect(service.enviar(aviso({ destinatario: { tipo: 'TODOS' } }))).resolves.toBeDefined();
  });
});
