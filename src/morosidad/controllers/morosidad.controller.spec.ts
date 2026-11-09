// src/morosidad/controllers/morosidad.controller.spec.ts
import { ROLES_KEY } from '@Auth/decorators';
import { MorosidadController } from './morosidad.controller.js';
import type { MorosidadService } from '../services/morosidad.service.js';
import type { MorosidadQueryDto } from '../dto/morosidad-query.dto.js';

describe('MorosidadController', () => {
  const serviceMock = {
    consultar: vi.fn(),
  };

  const controller = new MorosidadController(
    serviceMock as unknown as MorosidadService,
  );

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('delega la consulta al MorosidadService y devuelve su respuesta', async () => {
    const esperado = {
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
    };
    serviceMock.consultar.mockResolvedValue(esperado);

    const query: MorosidadQueryDto = { pagina: 1 };
    const resultado = await controller.consultar(query);

    expect(serviceMock.consultar).toHaveBeenCalledWith(query);
    expect(resultado).toEqual(esperado);
  });

  it('restringe el endpoint exclusivamente al rol ADMINISTRADOR mediante @Roles', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      MorosidadController.prototype,
      'consultar',
    );
    const roles = Reflect.getMetadata(ROLES_KEY, descriptor?.value as object);
    expect(roles).toEqual(['ADMINISTRADOR']);
  });
});
