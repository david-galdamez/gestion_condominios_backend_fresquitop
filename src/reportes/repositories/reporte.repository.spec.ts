import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@Prisma/services';
import { EstadoReporte } from '@PrismaClient';
import { ReporteEstadoInvalidoError, ReporteNotFoundError } from '@Reportes/errors';
import { ReporteRepository } from './reporte.repository.js';

const REPORTE_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const RESIDENTE_ID = '33333333-3333-4333-8333-333333333333';

describe('ReporteRepository — resolver (H24)', () => {
  let tx: {
    reporte: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    historialReporte: {
      create: ReturnType<typeof vi.fn>;
    };
  };
  let prisma: {
    $transaction: ReturnType<typeof vi.fn>;
  };
  let repo: ReporteRepository;

  beforeEach(() => {
    tx = {
      reporte: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      historialReporte: {
        create: vi.fn(),
      },
    };
    prisma = {
      $transaction: vi.fn(async (cb: (client: typeof tx) => unknown) => cb(tx)),
    };
    repo = new ReporteRepository(prisma as unknown as PrismaService);
  });

  it('actualiza estado a RESUELTO, guarda resueltoEn y comentarioCierre e inserta entrada en historial_reporte dentro de una transacción', async () => {
    const comentario = 'Se reparó la luminaria dañada del pasillo norte.';
    tx.reporte.findUnique.mockResolvedValue({
      id: REPORTE_ID,
      estado: EstadoReporte.EN_PROCESO,
    });
    tx.reporte.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: REPORTE_ID,
      numero: 123,
      residenteId: RESIDENTE_ID,
      estado: data.estado,
      resueltoEn: data.resueltoEn,
      comentarioCierre: data.comentarioCierre,
    }));
    tx.historialReporte.create.mockResolvedValue({});

    const actualizado = await repo.resolver({
      reporteId: REPORTE_ID,
      adminId: ADMIN_ID,
      comentario,
    });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.reporte.update).toHaveBeenCalledWith({
      where: { id: REPORTE_ID },
      data: {
        estado: EstadoReporte.RESUELTO,
        resueltoEn: expect.any(Date),
        comentarioCierre: comentario,
      },
    });
    expect(tx.historialReporte.create).toHaveBeenCalledWith({
      data: {
        reporteId: REPORTE_ID,
        estado: EstadoReporte.RESUELTO,
        cambiadoPorId: ADMIN_ID,
        comentario,
        createdAt: actualizado.resueltoEn,
      },
    });
    expect(actualizado.estado).toBe(EstadoReporte.RESUELTO);
    expect(actualizado.comentarioCierre).toBe(comentario);
    expect(actualizado.resueltoEn).toBeInstanceOf(Date);
  });

  it.each([EstadoReporte.ABIERTO, EstadoReporte.RESUELTO])(
    'lanza ReporteEstadoInvalidoError cuando el reporte está en estado %s',
    async (estado) => {
      tx.reporte.findUnique.mockResolvedValue({ id: REPORTE_ID, estado });

      await expect(
        repo.resolver({
          reporteId: REPORTE_ID,
          adminId: ADMIN_ID,
          comentario: 'Comentario de cierre válido con más de diez caracteres.',
        }),
      ).rejects.toBeInstanceOf(ReporteEstadoInvalidoError);

      expect(tx.reporte.update).not.toHaveBeenCalled();
      expect(tx.historialReporte.create).not.toHaveBeenCalled();
    },
  );

  it('lanza ReporteNotFoundError si el reporte no existe', async () => {
    tx.reporte.findUnique.mockResolvedValue(null);

    await expect(
      repo.resolver({
        reporteId: REPORTE_ID,
        adminId: ADMIN_ID,
        comentario: 'Comentario de cierre válido con más de diez caracteres.',
      }),
    ).rejects.toBeInstanceOf(ReporteNotFoundError);

    expect(tx.reporte.update).not.toHaveBeenCalled();
    expect(tx.historialReporte.create).not.toHaveBeenCalled();
  });
});