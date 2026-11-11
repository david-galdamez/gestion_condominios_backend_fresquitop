import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  aFechaUtc,
  hoyEnZonaNegocio,
  sumarDias,
  ZONA_NEGOCIO,
} from '@Common/fechas';
import {
  GeneracionCuotaRepository,
  type CuotaPorVencer,
} from '@Cuotas/repositories';
import { NotificacionService, type Aviso } from '@Notificaciones/services';

/** Días de anticipación del aviso "Tu cuota vence pronto". */
export const DIAS_AVISO = 3;

/** "2026-12-10" -> "10/12/2026". */
const fechaLegible = (iso: string) => iso.split('-').reverse().join('/');

export function avisoPorVencer(c: CuotaPorVencer): Aviso {
  const fecha = fechaLegible(c.fechaVencimiento.toISOString().slice(0, 10));
  return {
    destinatario: { tipo: 'UNIDAD', id: c.unidadId },
    titulo: 'Tu cuota vence pronto',
    mensaje: `La cuota de ${c.periodo} por $${c.monto.toFixed(2)} vence el ${fecha}.`,
    moduloOrigen: 'PAGOS',
    referencia: '/estado-cuenta',
  };
}

@Injectable()
export class AvisoCuotasService {
  private readonly logger = new Logger(AvisoCuotasService.name);

  constructor(
    private readonly repo: GeneracionCuotaRepository,
    private readonly notificaciones: NotificacionService,
  ) {}

  /** Todos los días a las 08:00 de El Salvador. */
  @Cron('0 8 * * *', { timeZone: ZONA_NEGOCIO })
  async tareaDiaria(): Promise<void> {
    await this.avisarPorVencer();
  }

  /**
   * Avisa a la unidad de cada cuota PENDIENTE que vence en DIAS_AVISO días.
   * Segura si corre dos veces: el UNIQUE de aviso_cuota evita el segundo envío.
   * Un fallo en una cuota se registra y no detiene las demás.
   */
  async avisarPorVencer(ahora: Date = new Date()): Promise<number> {
    const objetivo = sumarDias(hoyEnZonaNegocio(ahora), DIAS_AVISO);
    const cuotas = await this.repo.findPendientesQueVencen(aFechaUtc(objetivo));

    let enviados = 0;
    for (const cuota of cuotas) {
      try {
        const enviado = await this.repo.registrarAvisoPorVencer(cuota.id, () =>
          this.notificaciones.enviar(avisoPorVencer(cuota)),
        );
        if (enviado) enviados++;
      } catch (e) {
        this.logger.error(
          `No se pudo avisar la cuota ${cuota.id}: ${(e as Error).message}`,
        );
      }
    }
    this.logger.log(
      `Avisos de cuota por vencer enviados: ${enviados} (vencen el ${objetivo})`,
    );
    return enviados;
  }
}
