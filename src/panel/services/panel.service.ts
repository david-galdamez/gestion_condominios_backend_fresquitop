import { Injectable } from '@nestjs/common';
import { MorosidadService } from '@Morosidad/services';
import { calcularParticipacion } from '@Asambleas';
import { PanelRepository, type OcupacionAreaFila } from '../repositories/index.js';
import type { PanelQueryDto, PanelResponseDto } from '../dto/index.js';
import {
  areaMasUsada,
  diasDelPeriodo,
  periodoAnterior,
  porcentajeMorosas,
  porcentajeOcupacion,
  variacionPorcentual,
  type Periodo,
} from '../panel.calculos.js';

export const ASAMBLEAS_EN_PANEL = 3;

@Injectable()
export class PanelService {
  constructor(
    private readonly repositorio: PanelRepository,
    private readonly morosidad: MorosidadService,
  ) {}

  async consultar({ desde, hasta }: PanelQueryDto): Promise<PanelResponseDto> {
    const periodo: Periodo = { desde, hasta };
    const anterior = periodoAnterior(periodo);

    const [mora, unidadesActivas, ocupacionActual, ocupacionPrevia, incidenciasActual, incidenciasPrevia, asambleas] =
      await Promise.all([
        this.morosidad.resumen(),
        this.repositorio.contarUnidadesActivas(),
        this.repositorio.ocupacionPorArea(periodo),
        this.repositorio.ocupacionPorArea(anterior),
        this.repositorio.incidenciasPorPrioridad(periodo),
        this.repositorio.incidenciasPorPrioridad(anterior),
        this.repositorio.ultimasAsambleasCerradas(periodo, ASAMBLEAS_EN_PANEL),
      ]);

    const dias = diasDelPeriodo(periodo);
    const porcentajeDe = (fila: OcupacionAreaFila) =>
      porcentajeOcupacion(fila.horasReservadas, fila.horasDiarias, dias);
    const previaPorArea = new Map(ocupacionPrevia.map((f) => [f.area, porcentajeDe(f)]));

    const ocupacion = ocupacionActual.map((fila) => {
      const porcentaje = porcentajeDe(fila);
      return { area: fila.area, porcentaje, cambio: variacionPorcentual(porcentaje, previaPorArea.get(fila.area) ?? 0) };
    });

    const cuenta = (grupos: { prioridad: string | null; total: number }[], clave: string | null) =>
      grupos.find((g) => g.prioridad === clave)?.total ?? 0;
    const desglose = (grupos: { prioridad: string | null; total: number }[]) => ({
      ALTA: cuenta(grupos, 'ALTA'),
      MEDIA: cuenta(grupos, 'MEDIA'),
      BAJA: cuenta(grupos, 'BAJA'),
      SIN_ASIGNAR: cuenta(grupos, null),
    });
    const actual = desglose(incidenciasActual);
    const totalActual = actual.ALTA + actual.MEDIA + actual.BAJA + actual.SIN_ASIGNAR;
    const previo = desglose(incidenciasPrevia);
    const totalPrevio = previo.ALTA + previo.MEDIA + previo.BAJA + previo.SIN_ASIGNAR;

    return {
      mora: {
        monto: mora.totalMora,
        unidadesMorosas: mora.unidadesMorosas,
        porcentajeMorosas: porcentajeMorosas(mora.unidadesMorosas, unidadesActivas),
      },
      ocupacion,
      areaMasUsada: areaMasUsada(ocupacion),
      incidencias: { ...actual, cambio: variacionPorcentual(totalActual, totalPrevio) },
      participacion: asambleas.map((a) => ({
        asamblea: a.asamblea,
        porcentaje: calcularParticipacion(a.unidadesQueVotaron, unidadesActivas),
      })),
      generadoEn: new Date().toISOString(),
    };
  }
}
