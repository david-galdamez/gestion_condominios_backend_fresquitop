import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MorosidadQueryDto } from './morosidad-query.dto.js';

const obtenerErrores = async (plain: object): Promise<string[]> =>
  (await validate(plainToInstance(MorosidadQueryDto, plain))).flatMap((e) =>
    Object.values(e.constraints ?? {}),
  );

describe('MorosidadQueryDto', () => {
  it('acepta una consulta vacía y asigna pagina = 1 por defecto', async () => {
    const dto = plainToInstance(MorosidadQueryDto, {});
    expect(await obtenerErrores({})).toEqual([]);
    expect(dto.pagina).toBe(1);
    expect(dto.torreId).toBeUndefined();
  });

  it('acepta un torreId UUID válido y transforma pagina a número', async () => {
    const raw = {
      torreId: '7d9f2c1e-3b4a-4c5d-8e6f-0a1b2c3d4e5f',
      pagina: '2',
    };
    const dto = plainToInstance(MorosidadQueryDto, raw);
    expect(await obtenerErrores(raw)).toEqual([]);
    expect(dto.pagina).toBe(2);
    expect(dto.torreId).toBe('7d9f2c1e-3b4a-4c5d-8e6f-0a1b2c3d4e5f');
  });

  it('rechaza un torreId que no sea UUID', async () => {
    const errores = await obtenerErrores({ torreId: 'no-es-uuid' });
    expect(errores.length).toBeGreaterThan(0);
  });

  it('rechaza pagina menor a 1 o no entera', async () => {
    expect((await obtenerErrores({ pagina: '0' })).length).toBeGreaterThan(0);
    expect((await obtenerErrores({ pagina: '-1' })).length).toBeGreaterThan(0);
    expect((await obtenerErrores({ pagina: '1.5' })).length).toBeGreaterThan(0);
    expect((await obtenerErrores({ pagina: 'abc' })).length).toBeGreaterThan(0);
  });
});
