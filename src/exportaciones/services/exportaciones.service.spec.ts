import type { MorosidadService } from '@Morosidad/services';
import type { PanelService } from '@Panel/services';
import type { ExportacionRepository } from '../repositories/exportacion.repository.js';
import { ExportacionesService } from './exportaciones.service.js';

// 05:30 UTC del 21 = 23:30 del 20 en El Salvador: el nombre usa la fecha local.
const AHORA = new Date('2026-11-21T05:30:00.000Z');
const ADMIN = { id: 'adm-1', nombre: 'Ana Administradora' };

describe('ExportacionesService (H20)', () => {
  const panel = { consultar: vi.fn() };
  const morosidad = { detallePorUnidad: vi.fn() };
  const repo = { registrar: vi.fn() };
  const service = new ExportacionesService(
    panel as unknown as PanelService,
    morosidad as unknown as MorosidadService,
    repo as unknown as ExportacionRepository,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    panel.consultar.mockResolvedValue({
      mora: { monto: 0, unidadesMorosas: 0, porcentajeMorosas: 0 },
      ocupacion: [],
      areaMasUsada: null,
      incidencias: { ALTA: 0, MEDIA: 0, BAJA: 0, SIN_ASIGNAR: 0, cambio: null },
      participacion: [],
      generadoEn: AHORA.toISOString(),
    });
    morosidad.detallePorUnidad.mockResolvedValue([]);
  });

  const query = (extra = {}) =>
    ({ formato: 'PDF', version: 'RESUMIDA', desde: '2026-11-01', hasta: '2026-11-20', ...extra }) as never;

  it('PDF resumido: consulta el panel con el mismo periodo, no pide la morosidad y audita', async () => {
    const r = await service.exportar(ADMIN, query(), AHORA);
    expect(panel.consultar).toHaveBeenCalledWith({ desde: '2026-11-01', hasta: '2026-11-20' });
    expect(morosidad.detallePorUnidad).not.toHaveBeenCalled();
    expect(r.tipo).toBe('application/pdf');
    expect(r.nombre).toBe('reporte-condominio-2026-11-20.pdf');
    expect(r.contenido.subarray(0, 5).toString()).toBe('%PDF-');
    expect(repo.registrar).toHaveBeenCalledWith({
      administradorId: 'adm-1',
      formato: 'PDF',
      version: 'RESUMIDA',
      desde: '2026-11-01',
      hasta: '2026-11-20',
      generadaEn: AHORA,
    });
  });

  it('Excel detallado: pide la morosidad por unidad y devuelve un .xlsx', async () => {
    const r = await service.exportar(ADMIN, query({ formato: 'EXCEL', version: 'DETALLADA' }), AHORA);
    expect(morosidad.detallePorUnidad).toHaveBeenCalledOnce();
    expect(r.tipo).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(r.nombre).toBe('reporte-condominio-2026-11-20.xlsx');
    // Un .xlsx es un ZIP: empieza con "PK".
    expect(r.contenido.subarray(0, 2).toString()).toBe('PK');
    expect(repo.registrar.mock.calls[0][0]).toMatchObject({ formato: 'EXCEL', version: 'DETALLADA' });
  });

  it('si falla el panel no se audita nada', async () => {
    panel.consultar.mockRejectedValue(new Error('caído'));
    await expect(service.exportar(ADMIN, query(), AHORA)).rejects.toThrow('caído');
    expect(repo.registrar).not.toHaveBeenCalled();
  });
});
