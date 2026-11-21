import type { AsambleaRepository } from '../repositories/asamblea.repository.js';
import { AsambleasEstadoService } from './asambleas-estado.service.js';

function crear(cerradas = 0, abiertas = 0) {
  const repo = {
    cerrarVencidas: vi.fn().mockResolvedValue(cerradas),
    abrirPublicadasVigentes: vi.fn().mockResolvedValue(abiertas),
  };
  return { repo, service: new AsambleasEstadoService(repo as unknown as AsambleaRepository) };
}

describe('AsambleasEstadoService', () => {
  it('abre las publicadas vigentes con la fecha recibida', async () => {
    const { repo, service } = crear(0, 3);
    const ahora = new Date('2026-11-20T15:00:00Z');
    expect(await service.actualizarEstados(ahora)).toEqual({ cerradas: 0, abiertas: 3 });
    expect(repo.abrirPublicadasVigentes).toHaveBeenCalledWith(ahora);
  });

  it('cierra las vencidas con la fecha recibida', async () => {
    const { repo, service } = crear(2, 0);
    const ahora = new Date('2026-11-20T23:00:00Z');
    expect(await service.actualizarEstados(ahora)).toEqual({ cerradas: 2, abiertas: 0 });
    expect(repo.cerrarVencidas).toHaveBeenCalledWith(ahora);
  });

  it('cierra antes de abrir para que una ventana ya vencida no quede ABIERTA', async () => {
    const { repo, service } = crear(1, 0);
    await service.actualizarEstados();
    expect(repo.cerrarVencidas.mock.invocationCallOrder[0]).toBeLessThan(
      repo.abrirPublicadasVigentes.mock.invocationCallOrder[0],
    );
  });

  it('es idempotente: la segunda corrida no cambia nada', async () => {
    const repo = {
      cerrarVencidas: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
      abrirPublicadasVigentes: vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(0),
    };
    const service = new AsambleasEstadoService(repo as unknown as AsambleaRepository);
    const ahora = new Date('2026-11-20T15:00:00Z');
    expect(await service.actualizarEstados(ahora)).toEqual({ cerradas: 1, abiertas: 2 });
    expect(await service.actualizarEstados(ahora)).toEqual({ cerradas: 0, abiertas: 0 });
  });

  it('tareaPeriodica delega en actualizarEstados', async () => {
    const { repo, service } = crear();
    await service.tareaPeriodica();
    expect(repo.cerrarVencidas).toHaveBeenCalledTimes(1);
    expect(repo.abrirPublicadasVigentes).toHaveBeenCalledTimes(1);
  });
});
