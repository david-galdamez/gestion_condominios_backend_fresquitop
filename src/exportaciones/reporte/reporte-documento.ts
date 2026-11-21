import type { UnidadMorosaDto } from '@Morosidad/dto';
import type { PanelResponseDto } from '@Panel/dto';
import { VersionExportacion } from '@PrismaClient';
import { ZONA_NEGOCIO } from '@Common/fechas';

/**
 * Contenido del reporte, independiente del formato. El PDF y el Excel solo
 * dibujan esto, así que la regla de la versión resumida (sin unidades ni
 * nombres de residentes) se cumple en un único lugar y se prueba aquí.
 */
export interface ReporteDocumento {
  titulo: string;
  version: VersionExportacion;
  /** Periodo, generación, administrador y versión. */
  encabezado: { etiqueta: string; valor: string }[];
  indicadores: { etiqueta: string; texto: string; detalle: string }[];
  mora: { monto: number; unidadesMorosas: number; porcentajeMorosas: number };
  ocupacion: { area: string; porcentaje: number; texto: string; variacion: string; masUsada: boolean }[];
  incidencias: { prioridad: string; total: number }[];
  variacionIncidencias: string;
  participacion: { asamblea: string; porcentaje: number; texto: string }[];
  /** Solo en DETALLADA; null en RESUMIDA. */
  morosidadPorUnidad:
    | { unidad: string; cuotasVencidas: number; montoAdeudado: number; monto: string; vencidaMasAntigua: string }[]
    | null;
}

export interface DatosReporte {
  panel: PanelResponseDto;
  /** Requerido para DETALLADA; se ignora en RESUMIDA. */
  morosidad: UnidadMorosaDto[];
  version: VersionExportacion;
  desde: string;
  hasta: string;
  administrador: string;
  generadoEn: Date;
}

// Mismos formatos que la pantalla del panel (es-SV): "$1,350.00" y "42.5 %".
const usd = new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' });
const decimal = new Intl.NumberFormat('es-SV', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fechaHora = new Intl.DateTimeFormat('es-SV', {
  timeZone: ZONA_NEGOCIO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export const formatUsd = (n: number) => usd.format(n);
export const formatPorcentaje = (n: number) => `${decimal.format(n)} %`;

/** "2026-11-05" -> "05/11/2026", sin pasar por Date. */
export function formatFecha(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

/** Igual que el panel: "+5.2 %", "-10.0 %" o "Sin base de comparación". */
export function formatVariacion(cambio: number | null): string {
  if (cambio === null) return 'Sin base de comparación';
  const signo = cambio > 0 ? '+' : cambio < 0 ? '-' : '';
  return `${signo}${formatPorcentaje(Math.abs(cambio))} vs. periodo anterior`;
}

const PRIORIDADES = [
  ['ALTA', 'Alta'],
  ['MEDIA', 'Media'],
  ['BAJA', 'Baja'],
  ['SIN_ASIGNAR', 'Sin asignar'],
] as const;

export const ETIQUETA_VERSION: Record<VersionExportacion, string> = {
  DETALLADA: 'Detallada',
  RESUMIDA: 'Resumida (solo totales)',
};

export function construirDocumento(d: DatosReporte): ReporteDocumento {
  const { panel } = d;
  const incidencias = PRIORIDADES.map(([clave, prioridad]) => ({ prioridad, total: panel.incidencias[clave] }));
  const totalIncidencias = incidencias.reduce((s, i) => s + i.total, 0);
  const n = panel.mora.unidadesMorosas;

  return {
    titulo: 'Reporte de salud del condominio',
    version: d.version,
    encabezado: [
      { etiqueta: 'Periodo', valor: `${formatFecha(d.desde)} al ${formatFecha(d.hasta)}` },
      { etiqueta: 'Generado', valor: `${fechaHora.format(d.generadoEn)} (hora de El Salvador)` },
      { etiqueta: 'Administrador', valor: d.administrador },
      { etiqueta: 'Versión', valor: ETIQUETA_VERSION[d.version] },
    ],
    indicadores: [
      { etiqueta: 'Monto en mora', texto: formatUsd(panel.mora.monto), detalle: 'Cuotas vencidas al día de hoy' },
      {
        etiqueta: 'Unidades morosas',
        texto: formatPorcentaje(panel.mora.porcentajeMorosas),
        detalle: `${n} ${n === 1 ? 'unidad' : 'unidades'} con cuotas vencidas`,
      },
      {
        etiqueta: 'Incidencias abiertas',
        texto: String(totalIncidencias),
        detalle: formatVariacion(panel.incidencias.cambio),
      },
      { etiqueta: 'Área más usada', texto: panel.areaMasUsada ?? '—', detalle: 'Mayor ocupación del periodo' },
    ],
    mora: {
      monto: panel.mora.monto,
      unidadesMorosas: panel.mora.unidadesMorosas,
      porcentajeMorosas: panel.mora.porcentajeMorosas,
    },
    ocupacion: panel.ocupacion.map((o) => ({
      area: o.area,
      porcentaje: o.porcentaje,
      texto: formatPorcentaje(o.porcentaje),
      variacion: formatVariacion(o.cambio),
      masUsada: o.area === panel.areaMasUsada,
    })),
    incidencias,
    variacionIncidencias: formatVariacion(panel.incidencias.cambio),
    participacion: panel.participacion.map((p) => ({
      asamblea: p.asamblea,
      porcentaje: p.porcentaje,
      texto: formatPorcentaje(p.porcentaje),
    })),
    morosidadPorUnidad:
      d.version === VersionExportacion.DETALLADA
        ? d.morosidad.map((m) => ({
            unidad: m.unidad,
            cuotasVencidas: m.cuotasVencidas,
            montoAdeudado: m.montoAdeudado,
            monto: formatUsd(m.montoAdeudado),
            vencidaMasAntigua: formatFecha(m.vencidaMasAntigua),
          }))
        : null,
  };
}
