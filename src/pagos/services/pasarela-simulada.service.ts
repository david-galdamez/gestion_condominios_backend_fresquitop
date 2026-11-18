import { setTimeout as esperar } from 'node:timers/promises';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@PrismaClient';

/** Tarjetas de prueba (sección 3 de la especificación). */
export const TARJETA_APRUEBA = '4242424242424242';
export const TARJETA_FONDOS_INSUFICIENTES = '4000000000000002';
export const MOTIVO_FONDOS = 'Fondos insuficientes';
export const MOTIVO_NO_RECONOCIDA = 'Tarjeta no reconocida';

export interface TarjetaCobro {
  numero: string;
  vencimiento: string;
  cvv: string;
  titular: string;
}

export type ResultadoCobro =
  | { aprobado: true; ultimos4: string }
  | { aprobado: false; motivo: string; ultimos4: string };

/**
 * BE-21.1: pasarela de pago simulada, con la misma forma que tendría una real.
 * Responde después de 2 s (PASARELA_ESPERA_MS para acortarlo en pruebas).
 * No guarda ni escribe en logs el número completo ni el CVV.
 */
@Injectable()
export class PasarelaSimuladaService {
  private readonly esperaMs = Number(process.env.PASARELA_ESPERA_MS ?? 2000);

  async cobrar(_monto: Prisma.Decimal, tarjeta: TarjetaCobro): Promise<ResultadoCobro> {
    if (this.esperaMs > 0) await esperar(this.esperaMs);
    const ultimos4 = tarjeta.numero.slice(-4);
    if (tarjeta.numero === TARJETA_APRUEBA) return { aprobado: true, ultimos4 };
    if (tarjeta.numero === TARJETA_FONDOS_INSUFICIENTES) {
      return { aprobado: false, motivo: MOTIVO_FONDOS, ultimos4 };
    }
    return { aprobado: false, motivo: MOTIVO_NO_RECONOCIDA, ultimos4 };
  }
}
