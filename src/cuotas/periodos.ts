import { hoyEnZonaNegocio } from '@Common/fechas';

/** Periodo de cuota "YYYY-MM" (mes 01 a 12). */
export const PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Mes actual en la zona del negocio, como "YYYY-MM". */
export function periodoActual(ahora: Date = new Date()): string {
  return hoyEnZonaNegocio(ahora).slice(0, 7);
}

/** Suma `meses` (puede ser negativo) a un periodo "YYYY-MM". */
export function sumarMeses(periodo: string, meses: number): string {
  const [anio, mes] = periodo.split('-').map(Number);
  const total = anio * 12 + (mes - 1) + meses;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Fecha de vencimiento "YYYY-MM-DD" de un periodo con el día configurado (1 a 28). */
export function fechaVencimiento(periodo: string, dia: number): string {
  return `${periodo}-${String(dia).padStart(2, '0')}`;
}
