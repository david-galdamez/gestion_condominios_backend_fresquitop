import {
  areaMasUsada,
  diasDelPeriodo,
  periodoAnterior,
  porcentajeMorosas,
  porcentajeOcupacion,
  variacionPorcentual,
} from './panel.calculos.js';

describe('cálculos del panel (H19)', () => {
  it('cuenta los días con ambos extremos incluidos', () => {
    expect(diasDelPeriodo({ desde: '2026-11-01', hasta: '2026-11-30' })).toBe(30);
    expect(diasDelPeriodo({ desde: '2026-11-05', hasta: '2026-11-05' })).toBe(1);
  });

  it('el periodo anterior tiene igual duración y termina el día antes', () => {
    expect(periodoAnterior({ desde: '2026-11-01', hasta: '2026-11-30' })).toEqual({
      desde: '2026-10-02',
      hasta: '2026-10-31',
    });
    expect(periodoAnterior({ desde: '2026-03-01', hasta: '2026-03-01' })).toEqual({
      desde: '2026-02-28',
      hasta: '2026-02-28',
    });
  });

  it('variación = (actual − anterior) ÷ anterior × 100 con un decimal', () => {
    expect(variacionPorcentual(45, 40)).toBe(12.5);
    expect(variacionPorcentual(9, 10)).toBe(-10);
    expect(variacionPorcentual(1, 3)).toBe(-66.7);
  });

  it('sin base de comparación cuando el anterior vale 0', () => {
    expect(variacionPorcentual(5, 0)).toBeNull();
    expect(variacionPorcentual(0, 0)).toBeNull();
  });

  it('ocupación = horas reservadas ÷ (horas diarias × días) × 100, un decimal', () => {
    // Área abierta 13 h/día, 30 días = 390 h disponibles; 165.75 h reservadas.
    expect(porcentajeOcupacion(165.75, 13, 30)).toBe(42.5);
    expect(porcentajeOcupacion(0, 13, 30)).toBe(0);
    expect(porcentajeOcupacion(10, 0, 30)).toBe(0);
  });

  it('% morosas = morosas ÷ activas × 100, un decimal; sin unidades activas es 0', () => {
    expect(porcentajeMorosas(9, 30)).toBe(30);
    expect(porcentajeMorosas(1, 3)).toBe(33.3);
    expect(porcentajeMorosas(0, 0)).toBe(0);
  });

  it('área más usada: mayor porcentaje; en empate, la primera alfabéticamente', () => {
    expect(
      areaMasUsada([
        { area: 'Salón', porcentaje: 30 },
        { area: 'Alberca', porcentaje: 42.5 },
      ]),
    ).toBe('Alberca');
    expect(
      areaMasUsada([
        { area: 'Salón', porcentaje: 40 },
        { area: 'Gimnasio', porcentaje: 40 },
        { area: 'Alberca', porcentaje: 10 },
      ]),
    ).toBe('Gimnasio');
  });

  it('sin áreas o sin uso no hay área más usada', () => {
    expect(areaMasUsada([])).toBeNull();
    expect(areaMasUsada([{ area: 'Alberca', porcentaje: 0 }])).toBeNull();
  });
});
