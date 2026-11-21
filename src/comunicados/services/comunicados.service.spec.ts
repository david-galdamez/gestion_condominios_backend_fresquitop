import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { NotificacionService } from '@Notificaciones/services';
import type { CrearComunicadoDto } from '../dto/crear-comunicado.dto.js';
import type { ComunicadoRepository } from '../repositories/comunicado.repository.js';
import { ComunicadosPublicacionService } from './comunicados-publicacion.service.js';
import { ComunicadosService } from './comunicados.service.js';

const AHORA = new Date('2026-11-17T18:00:00.000Z');

describe('Comunicados', () => {
  const repo = {
    contarTorres: vi.fn(),
    create: vi.fn(),
    findTodos: vi.fn(),
    findProgramadosVencidos: vi.fn(),
    publicarSiProgramado: vi.fn(),
    expirar: vi.fn(),
  };
  const notif = { enviar: vi.fn() };
  const service = new ComunicadosService(
    repo as unknown as ComunicadoRepository,
    notif as unknown as NotificacionService,
  );
  const tarea = new ComunicadosPublicacionService(
    repo as unknown as ComunicadoRepository,
    notif as unknown as NotificacionService,
  );

  const dto = (extra: Partial<CrearComunicadoDto> = {}) =>
    ({
      titulo: 'Corte de agua',
      contenido: 'El sábado no habrá agua.',
      categoria: 'AGUA',
      destino: { todos: true },
      ...extra,
    }) as CrearComunicadoDto;

  const fila = (data: Record<string, unknown>) => ({
    id: 'c-1',
    destinos: ((data.torreIds as string[] | undefined) ?? []).map((id) => ({ torre: { id, nombre: id } })),
    autor: { id: 'adm', nombre: 'Admin' },
    ...data,
  });

  beforeEach(() => {
    vi.resetAllMocks();
    repo.create.mockImplementation(async (data: Record<string, unknown>) => fila(data));
    notif.enviar.mockResolvedValue({ id: 'n', destinatarios: 1 });
  });

  describe('crear', () => {
    it('sin fecha: PUBLICADO ahora y avisa a TODOS con el título del aviso', async () => {
      const r = await service.crear('adm', dto(), AHORA);
      expect(r).toMatchObject({ estado: 'PUBLICADO', fechaPublicacion: AHORA.toISOString(), paraTodos: true });
      expect(repo.create.mock.calls[0][0].autorId).toBe('adm');
      expect(notif.enviar).toHaveBeenCalledTimes(1);
      expect(notif.enviar).toHaveBeenCalledWith(
        expect.objectContaining({
          destinatario: { tipo: 'TODOS' },
          titulo: 'Nuevo comunicado: Corte de agua',
          moduloOrigen: 'COMUNICADOS',
          referencia: '/comunicados/c-1',
        }),
      );
    });

    it('fecha futura: PROGRAMADO y sin aviso', async () => {
      const r = await service.crear('adm', dto({ fechaPublicacion: '2026-11-20T14:00:00.000Z' }), AHORA);
      expect(r.estado).toBe('PROGRAMADO');
      expect(notif.enviar).not.toHaveBeenCalled();
    });

    it('un aviso por torre destino', async () => {
      repo.contarTorres.mockResolvedValue(2);
      await service.crear('adm', dto({ destino: { todos: false, torreIds: ['t1', 't2'] } }), AHORA);
      expect(notif.enviar.mock.calls.map((c) => c[0].destinatario)).toEqual([
        { tipo: 'TORRE', id: 't1' },
        { tipo: 'TORRE', id: 't2' },
      ]);
    });

    it('torre inexistente -> 404 y no guarda', async () => {
      repo.contarTorres.mockResolvedValue(1);
      await expect(
        service.crear('adm', dto({ destino: { todos: false, torreIds: ['t1', 't2'] } }), AHORA),
      ).rejects.toThrow(new NotFoundException('La torre no existe'));
      expect(repo.create).not.toHaveBeenCalled();
    });

    it.each([
      ['igual a la publicación', '2026-11-20T14:00:00.000Z'],
      ['anterior a la publicación', '2026-11-19T14:00:00.000Z'],
    ])('expiración %s -> 400', async (_t, fechaExpiracion) => {
      await expect(
        service.crear('adm', dto({ fechaPublicacion: '2026-11-20T14:00:00.000Z', fechaExpiracion }), AHORA),
      ).rejects.toThrow(new BadRequestException('La expiración debe ser posterior a la publicación'));
    });

    it('recorta el título del aviso a 80 caracteres', async () => {
      await service.crear('adm', dto({ titulo: 'a'.repeat(100) }), AHORA);
      expect(notif.enviar.mock.calls[0][0].titulo).toHaveLength(80);
    });

    it('si el aviso falla, el comunicado igual queda publicado', async () => {
      notif.enviar.mockRejectedValue(new Error('caído'));
      await expect(service.crear('adm', dto(), AHORA)).resolves.toMatchObject({ estado: 'PUBLICADO' });
    });
  });

  describe('tarea de publicación', () => {
    it('publica los programados vencidos, avisa una vez y expira', async () => {
      repo.findProgramadosVencidos.mockResolvedValue([
        fila({ id: 'c-1', titulo: 'Uno', contenido: 'x'.repeat(10), paraTodos: true }),
        fila({ id: 'c-2', titulo: 'Dos', contenido: 'x'.repeat(10), paraTodos: true }),
      ]);
      // c-2 ya lo publicó otra corrida.
      repo.publicarSiProgramado.mockImplementation(async (id: string) => id === 'c-1');
      repo.expirar.mockResolvedValue(3);
      expect(await tarea.ejecutar(AHORA)).toEqual({ publicados: 1, expirados: 3 });
      expect(notif.enviar).toHaveBeenCalledTimes(1);
      expect(repo.expirar).toHaveBeenCalledWith(AHORA);
    });
  });
});
