import { sumarDias } from '@Common/fechas';

export const MAX_DIAS_PERIODO = 366;
const MS_DIA = 86_400_000;

export interface Periodo {
  desde: string;
  hasta: string;
}

/** Días del periodo, ambos extremos incluidos. */
export function diasDelPeriodo({ desde, hasta }: Periodo): number {
  return Math.round((Date.parse(`${hasta}T00:00:00.000Z`) - Date.parse(`${desde}T00:00:00.000Z`)) / MS_DIA) + 1;
}

/** Periodo inmediatamente anterior y de igual duración. */
export function periodoAnterior(periodo: Periodo): Periodo {
  const dias = diasDelPeriodo(periodo);
  return { desde: sumarDias(periodo.desde, -dias), hasta: sumarDias(periodo.desde, -1) };
}

const aUnDecimal = (valor: number) => Math.round(valor * 10) / 10;

/** (actual − anterior) ÷ anterior × 100 con un decimal; `null` si el anterior vale 0 ("Sin base de comparación"). */
export function variacionPorcentual(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return aUnDecimal(((actual - anterior) / anterior) * 100);
}

/** Horas reservadas ÷ (horas de apertura diarias × días del periodo) × 100, un decimal. */
export function porcentajeOcupacion(horasReservadas: number, horasDiarias: number, dias: number): number {
  const disponibles = horasDiarias * dias;
  return disponibles > 0 ? aUnDecimal((horasReservadas / disponibles) * 100) : 0;
}

/** Porcentaje de unidades morosas sobre unidades activas, un decimal. */
export function porcentajeMorosas(unidadesMorosas: number, unidadesActivas: number): number {
  return unidadesActivas > 0 ? aUnDecimal((unidadesMorosas / unidadesActivas) * 100) : 0;
}

/** Mayor porcentaje; en empate, la primera en orden alfabético. Sin uso (0 %) no hay área más usada. */
export function areaMasUsada(areas: { area: string; porcentaje: number }[]): string | null {
  const ordenadas = [...areas].sort((a, b) => b.porcentaje - a.porcentaje || a.area.localeCompare(b.area, 'es'));
  return ordenadas[0] && ordenadas[0].porcentaje > 0 ? ordenadas[0].area : null;
}
