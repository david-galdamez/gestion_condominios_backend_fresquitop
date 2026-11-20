import type { AreaRepository } from '../repositories/area.repository.js';
import type { DisponibilidadRepository } from '../repositories/disponibilidad.repository.js';
import { calcularBloques, DisponibilidadService } from './disponibilidad.service.js';

const hora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const reserva = (inicio: string, fin: string, areaId = 'alberca') => ({
  areaId,
  horaInicio: hora(inicio),
  horaFin: hora(fin),
});
const alberca = { horaApertura: hora('07:00'), horaCierre: hora('19:00') };

// 2026-11-20 14:30 en El Salvador (UTC-6).
const AHORA = new Date('2026-11-20T20:30:00.000Z');
const MANANA = '2026-11-21';
const HOY = '2026-11-20';

const ocupados = (bloques: { inicio: string; estado: string }[]) =>
  bloques.filter((b) => b.estado === 'OCUPADO').map((b) => b.inicio);

describe('calcularBloques', () => {
  it('Alberca de 07:00 a 19:00 genera 12 bloques de 1 hora, todos libres sin reservas', () => {
    const bloques = calcularBloques(alberca, [], MANANA, AHORA);
    expect(bloques).toHaveLength(12);
    expect(bloques[0]).toEqual({ inicio: '07:00', fin: '08:00', estado: 'LIBRE' });
    expect(bloques[11]).toEqual({ inicio: '18:00', fin: '19:00', estado: 'LIBRE' });
    expect(ocupados(bloques)).toEqual([]);
  });

  it('una reserva de 08:00 a 10:00 ocupa los bloques 08-09 y 09-10', () => {
    const bloques = calcularBloques(alberca, [reserva('08:00', '10:00')], MANANA, AHORA);
    expect(ocupados(bloques)).toEqual(['08:00', '09:00']);
  });

  it('reservas que solo tocan el borde no ocupan el bloque vecino', () => {
    const bloques = calcularBloques(alberca, [reserva('10:00', '11:00'), reserva('15:00', '17:00')], MANANA, AHORA);
    expect(ocupados(bloques)).toEqual(['10:00', '15:00', '16:00']);
  });

  it('hoy, los bloques que ya empezaron salen OCUPADO', () => {
    // A las 14:30 el bloque de 14:00 ya empezó; el de 15:00 todavía no.
    const bloques = calcularBloques(alberca, [], HOY, AHORA);
    expect(ocupados(bloques)).toEqual(['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00']);
    expect(bloques.find((b) => b.inicio === '15:00')?.estado).toBe('LIBRE');
  });

  it('justo a la hora en punto el bloque que empieza ya cuenta como pasado', () => {
    const enPunto = new Date('2026-11-20T21:00:00.000Z'); // 15:00 local
    const bloques = calcularBloques(alberca, [], HOY, enPunto);
    expect(bloques.find((b) => b.inicio === '15:00')?.estado).toBe('OCUPADO');
    expect(bloques.find((b) => b.inicio === '16:00')?.estado).toBe('LIBRE');
  });

  it('usa el día de El Salvador: a las 23:00 locales (05:00 UTC del día siguiente) hoy sigue siendo hoy', () => {
    const noche = new Date('2026-11-21T05:00:00.000Z');
    expect(ocupados(calcularBloques(alberca, [], HOY, noche))).toHaveLength(12);
    expect(ocupados(calcularBloques(alberca, [], MANANA, noche))).toEqual([]);
  });
});

describe('DisponibilidadService', () => {
  const areas = { findAll: vi.fn() };
  const reservas = { findConfirmadas: vi.fn() };
  const service = new DisponibilidadService(
    areas as unknown as AreaRepository,
    reservas as unknown as DisponibilidadRepository,
  );

  const area = (id: string, nombre: string, extra: object = {}) => ({
    id,
    nombre,
    capacidad: 30,
    horaApertura: hora('07:00'),
    horaCierre: hora('09:00'),
    duracionMaxHoras: 3,
    activa: true,
    ...extra,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pide solo áreas activas y las reservas de esa fecha para esas áreas', async () => {
    areas.findAll.mockResolvedValue([area('alberca', 'Alberca'), area('salon', 'Salón')]);
    reservas.findConfirmadas.mockResolvedValue([]);
    await service.consultar(MANANA, AHORA);
    expect(areas.findAll).toHaveBeenCalledWith(true);
    expect(reservas.findConfirmadas).toHaveBeenCalledWith(new Date('2026-11-21T00:00:00.000Z'), ['alberca', 'salon']);
  });

  it('reparte las reservas por área y no devuelve quién reservó', async () => {
    areas.findAll.mockResolvedValue([area('alberca', 'Alberca'), area('salon', 'Salón', { capacidad: 80 })]);
    reservas.findConfirmadas.mockResolvedValue([reserva('07:00', '08:00', 'salon')]);

    const r = await service.consultar(MANANA, AHORA);

    expect(r).toEqual({
      fecha: MANANA,
      areas: [
        {
          id: 'alberca',
          nombre: 'Alberca',
          capacidad: 30,
          bloques: [
            { inicio: '07:00', fin: '08:00', estado: 'LIBRE' },
            { inicio: '08:00', fin: '09:00', estado: 'LIBRE' },
          ],
        },
        {
          id: 'salon',
          nombre: 'Salón',
          capacidad: 80,
          bloques: [
            { inicio: '07:00', fin: '08:00', estado: 'OCUPADO' },
            { inicio: '08:00', fin: '09:00', estado: 'LIBRE' },
          ],
        },
      ],
    });
    expect(JSON.stringify(r)).not.toMatch(/residente|unidad/i);
  });

  it('sin áreas activas responde una lista vacía', async () => {
    areas.findAll.mockResolvedValue([]);
    reservas.findConfirmadas.mockResolvedValue([]);
    await expect(service.consultar(MANANA, AHORA)).resolves.toEqual({ fecha: MANANA, areas: [] });
  });
});
