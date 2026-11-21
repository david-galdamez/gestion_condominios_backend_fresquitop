import { MorosidadRepository } from './morosidad.repository.js';
import { TorreNotFoundError } from '../errors/torre-not-found.error.js';
import type { PrismaService } from '@Prisma/services';

describe('MorosidadRepository', () => {
  const prismaMock = {
    torre: {
      findUnique: vi.fn(),
    },
    $queryRaw: vi.fn(),
  };

  const repository = new MorosidadRepository(
    prismaMock as unknown as PrismaService,
  );

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('consulta sin torreId sin verificar torre y retorna filas y resumen global', async () => {
    const filasMock = [
      {
        id: 'u-1',
        unidad: 'B-204',
        cuotasVencidas: 3,
        montoAdeudado: 135,
        vencidaMasAntigua: '2026-08-10',
      },
    ];
    prismaMock.$queryRaw
      .mockResolvedValueOnce(filasMock)
      .mockResolvedValueOnce([{ totalMora: 1350, unidadesMorosas: 9 }]);

    const resultado = await repository.consultarMorosidad(null, 20, 0);

    expect(prismaMock.torre.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    expect(resultado).toEqual({
      totalMora: 1350,
      unidadesMorosas: 9,
      filas: filasMock,
    });
  });

  it('verifica la existencia de la torre cuando se envía torreId y existe', async () => {
    const torreId = '7d9f2c1e-3b4a-4c5d-8e6f-0a1b2c3d4e5f';
    prismaMock.torre.findUnique.mockResolvedValue({ id: torreId });
    prismaMock.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ totalMora: 0, unidadesMorosas: 0 }]);

    const resultado = await repository.consultarMorosidad(torreId, 20, 0);

    expect(prismaMock.torre.findUnique).toHaveBeenCalledWith({
      where: { id: torreId },
      select: { id: true },
    });
    expect(resultado).toEqual({
      totalMora: 0,
      unidadesMorosas: 0,
      filas: [],
    });
  });

  it('lanza TorreNotFoundError y no ejecuta $queryRaw si la torre no existe', async () => {
    const torreId = '00000000-0000-4000-8000-000000000000';
    prismaMock.torre.findUnique.mockResolvedValue(null);

    await expect(repository.consultarMorosidad(torreId, 20, 0)).rejects.toThrow(
      TorreNotFoundError,
    );
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});
