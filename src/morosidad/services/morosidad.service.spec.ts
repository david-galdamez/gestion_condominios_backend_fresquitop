import { NotFoundException } from '@nestjs/common';
import { MorosidadService } from './morosidad.service.js';
import { TorreNotFoundError } from '../errors/torre-not-found.error.js';
import type { MorosidadRepository } from '../repositories/morosidad.repository.js';
import type { MorosidadQueryDto } from '../dto/morosidad-query.dto.js';

describe('MorosidadService', () => {
  const repoMock = {
    consultarMorosidad: vi.fn(),
  };

  const service = new MorosidadService(
    repoMock as unknown as MorosidadRepository,
  );

  const buildQuery = (
    overrides: Partial<MorosidadQueryDto> = {},
  ): MorosidadQueryDto => ({
    pagina: 1,
    ...overrides,
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('retorna el listado paginado y los agregados globales formateados', async () => {
    repoMock.consultarMorosidad.mockResolvedValue({
      totalMora: 1350,
      unidadesMorosas: 9,
      filas: [
        {
          id: 'u-1',
          unidad: 'B-204',
          cuotasVencidas: 3,
          montoAdeudado: 135,
          vencidaMasAntigua: '2026-08-10',
        },
      ],
    });

    const respuesta = await service.consultar(buildQuery());

    expect(repoMock.consultarMorosidad).toHaveBeenCalledWith(null, 20, 0);
    expect(respuesta).toEqual({
      totalMora: 1350,
      unidadesMorosas: 9,
      datos: [
        {
          unidad: 'B-204',
          cuotasVencidas: 3,
          montoAdeudado: 135,
          vencidaMasAntigua: '2026-08-10',
        },
      ],
      total: 9,
      pagina: 1,
    });
  });

  it('calcula correctamente el offset de paginación (página 2 -> offset 20)', async () => {
    const torreId = '7d9f2c1e-3b4a-4c5d-8e6f-0a1b2c3d4e5f';
    repoMock.consultarMorosidad.mockResolvedValue({
      totalMora: 250.5,
      unidadesMorosas: 22,
      filas: [],
    });

    const respuesta = await service.consultar(
      buildQuery({ torreId, pagina: 2 }),
    );

    expect(repoMock.consultarMorosidad).toHaveBeenCalledWith(torreId, 20, 20);
    expect(respuesta.pagina).toBe(2);
    expect(respuesta.total).toBe(22);
    expect(respuesta.unidadesMorosas).toBe(22);
  });

  it('traduce TorreNotFoundError a NotFoundException (404 "Torre no encontrada")', async () => {
    const torreId = '00000000-0000-4000-8000-000000000000';
    repoMock.consultarMorosidad.mockRejectedValue(
      new TorreNotFoundError(torreId),
    );

    await expect(service.consultar(buildQuery({ torreId }))).rejects.toThrow(
      NotFoundException,
    );

    await expect(
      service.consultar(buildQuery({ torreId })),
    ).rejects.toMatchObject({
      message: 'Torre no encontrada',
    });
  });

  it('propaga errores inesperados sin enmascararlos', async () => {
    const errorInesperado = new Error('Fallo de conexión');
    repoMock.consultarMorosidad.mockRejectedValue(errorInesperado);

    await expect(service.consultar(buildQuery())).rejects.toThrow(
      'Fallo de conexión',
    );
  });
});
