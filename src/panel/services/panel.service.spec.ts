import type { MorosidadService } from '@Morosidad/services';
import type { PanelRepository } from '../repositories/index.js';
import { PanelService } from './panel.service.js';

describe('PanelService', () => {
  const repo = {
    contarUnidadesActivas: vi.fn(),
    ocupacionPorArea: vi.fn(),
    incidenciasPorPrioridad: vi.fn(),
    ultimasAsambleasCerradas: vi.fn(),
  };
  const morosidad = { resumen: vi.fn() };
  const service = new PanelService(repo as unknown as PanelRepository, morosidad as unknown as MorosidadService);
  const periodo = { desde: '2026-11-01', hasta: '2026-11-30' };

  beforeEach(() => {
    vi.resetAllMocks();
    morosidad.resumen.mockResolvedValue({ totalMora: 1350, unidadesMorosas: 9 });
    repo.contarUnidadesActivas.mockResolvedValue(30);
    repo.ultimasAsambleasCerradas.mockResolvedValue([]);
    repo.incidenciasPorPrioridad.mockResolvedValue([]);
    repo.ocupacionPorArea.mockResolvedValue([]);
  });

  it('arma la mora con los valores del servicio compartido (H22) y el % de morosas', async () => {
    const r = await service.consultar(periodo);
    expect(r.mora).toEqual({ monto: 1350, unidadesMorosas: 9, porcentajeMorosas: 30 });
  });

  it('calcula ocupación por área, cambio contra el periodo anterior y el área más usada', async () => {
    repo.ocupacionPorArea.mockImplementation(async ({ desde }: { desde: string }) =>
      desde === '2026-11-01'
        ? [
            { area: 'Alberca', horasDiarias: 13, horasReservadas: 165.75 }, // 42.5 %
            { area: 'Salón', horasDiarias: 10, horasReservadas: 30 }, // 10 %
          ]
        : [
            { area: 'Alberca', horasDiarias: 13, horasReservadas: 157.5 }, // 40.4 %
            { area: 'Salón', horasDiarias: 10, horasReservadas: 0 }, // 0 %
          ],
    );
    const r = await service.consultar(periodo);
    expect(r.ocupacion).toEqual([
      { area: 'Alberca', porcentaje: 42.5, cambio: 5.2 },
      { area: 'Salón', porcentaje: 10, cambio: null },
    ]);
    expect(r.areaMasUsada).toBe('Alberca');
  });

  it('consulta el periodo anterior de igual duración', async () => {
    await service.consultar(periodo);
    expect(repo.ocupacionPorArea).toHaveBeenCalledWith({ desde: '2026-10-02', hasta: '2026-10-31' });
    expect(repo.incidenciasPorPrioridad).toHaveBeenCalledWith({ desde: '2026-10-02', hasta: '2026-10-31' });
  });

  it('agrupa incidencias por prioridad con SIN_ASIGNAR y compara el total', async () => {
    repo.incidenciasPorPrioridad.mockImplementation(async ({ desde }: { desde: string }) =>
      desde === '2026-11-01'
        ? [
            { prioridad: 'ALTA', total: 2 },
            { prioridad: 'MEDIA', total: 4 },
            { prioridad: 'BAJA', total: 1 },
            { prioridad: null, total: 3 },
          ]
        : [{ prioridad: 'ALTA', total: 11 }],
    );
    const r = await service.consultar(periodo);
    expect(r.incidencias).toEqual({ ALTA: 2, MEDIA: 4, BAJA: 1, SIN_ASIGNAR: 3, cambio: -9.1 });
  });

  it('incidencias sin base de comparación cuando el periodo anterior no tuvo reportes', async () => {
    repo.incidenciasPorPrioridad.mockImplementation(async ({ desde }: { desde: string }) =>
      desde === '2026-11-01' ? [{ prioridad: 'ALTA', total: 2 }] : [],
    );
    const r = await service.consultar(periodo);
    expect(r.incidencias).toMatchObject({ ALTA: 2, MEDIA: 0, BAJA: 0, SIN_ASIGNAR: 0, cambio: null });
  });

  it('participación con la fórmula de H27 sobre unidades activas', async () => {
    repo.ultimasAsambleasCerradas.mockResolvedValue([
      { asamblea: 'Asamblea B', unidadesQueVotaron: 21 },
      { asamblea: 'Asamblea A', unidadesQueVotaron: 10 },
    ]);
    const r = await service.consultar(periodo);
    expect(r.participacion).toEqual([
      { asamblea: 'Asamblea B', porcentaje: 70 },
      { asamblea: 'Asamblea A', porcentaje: 33.3 },
    ]);
    expect(repo.ultimasAsambleasCerradas).toHaveBeenCalledWith(periodo, 3);
  });

  it('sin datos devuelve ceros y listas vacías sin fallar', async () => {
    morosidad.resumen.mockResolvedValue({ totalMora: 0, unidadesMorosas: 0 });
    repo.contarUnidadesActivas.mockResolvedValue(0);
    const r = await service.consultar(periodo);
    expect(r.mora).toEqual({ monto: 0, unidadesMorosas: 0, porcentajeMorosas: 0 });
    expect(r.ocupacion).toEqual([]);
    expect(r.areaMasUsada).toBeNull();
    expect(r.participacion).toEqual([]);
    expect(typeof r.generadoEn).toBe('string');
  });
});
