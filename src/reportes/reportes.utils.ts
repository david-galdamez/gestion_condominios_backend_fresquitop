import type { PrioridadReporte } from '@PrismaClient';
import type { TipoImagen } from './reportes.types.js';

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const FIRMA_JPG = [0xff, 0xd8, 0xff];

const PESO_PRIORIDAD: Record<PrioridadReporte, number> = {
  ALTA: 1,
  MEDIA: 2,
  BAJA: 3,
};

const empiezaCon = (buffer: Buffer, firma: number[]) =>
  buffer.length >= firma.length && firma.every((byte, i) => buffer[i] === byte);

/**
 * Detecta el tipo real por los primeros bytes del archivo. El mimetype que
 * manda el cliente se puede falsear, la firma del contenido no.
 */
export function detectarTipoImagen(buffer: Buffer): TipoImagen | null {
  if (empiezaCon(buffer, FIRMA_PNG)) return 'png';
  if (empiezaCon(buffer, FIRMA_JPG)) return 'jpg';
  return null;
}

/** 123 -> "REP-000123" */
export const formatearNumero = (numero: number) => `REP-${String(numero).padStart(6, '0')}`;

/** "REP-000123" -> 123; null si no tiene el formato. */
export function parsearNumero(texto: string): number | null {
  const m = /^REP-(\d{1,9})$/i.exec(texto);
  return m ? Number(m[1]) : null;
}

/** Orden H06: ALTA (1), MEDIA (2), BAJA (3), sin asignar/NULL (4); desempate por createdAt ASC. */
export function compararPrioridadReporte(
  a: { prioridad: PrioridadReporte | null; createdAt: Date },
  b: { prioridad: PrioridadReporte | null; createdAt: Date },
): number {
  const pesoA = a.prioridad ? PESO_PRIORIDAD[a.prioridad] : 4;
  const pesoB = b.prioridad ? PESO_PRIORIDAD[b.prioridad] : 4;
  if (pesoA !== pesoB) return pesoA - pesoB;
  return a.createdAt.getTime() - b.createdAt.getTime();
}