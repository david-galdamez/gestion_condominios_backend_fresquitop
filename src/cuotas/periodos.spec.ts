import { fechaVencimiento, periodoActual, sumarMeses } from './periodos.js';

describe('periodos', () => {
  it('periodoActual usa la hora de El Salvador (UTC-6)', () => {
    // 1 de diciembre 03:00 UTC sigue siendo 30 de noviembre en El Salvador.
    expect(periodoActual(new Date('2026-12-01T03:00:00Z'))).toBe('2026-11');
    expect(periodoActual(new Date('2026-12-01T06:00:00Z'))).toBe('2026-12');
  });

  it.each([
    ['2026-11', 1, '2026-12'],
    ['2026-12', 1, '2027-01'],
    ['2027-01', -1, '2026-12'],
    ['2026-05', 14, '2027-07'],
  ])('sumarMeses(%s, %i) = %s', (periodo, meses, esperado) => {
    expect(sumarMeses(periodo, meses)).toBe(esperado);
  });

  it('fechaVencimiento rellena el día con cero', () => {
    expect(fechaVencimiento('2026-12', 5)).toBe('2026-12-05');
    expect(fechaVencimiento('2027-02', 28)).toBe('2027-02-28');
  });
});
