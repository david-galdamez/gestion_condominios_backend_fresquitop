import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MSG_ARCHIVO, MSG_PAGINA, MisComunicadosQueryDto } from './mis-comunicados-query.dto.js';

const validar = async (query: Record<string, string>) => {
  const dto = plainToInstance(MisComunicadosQueryDto, query);
  const errores = (await validate(dto)).flatMap((e) => Object.values(e.constraints ?? {}));
  return { dto, errores };
};

describe('MisComunicadosQueryDto', () => {
  it('sin parámetros: pestaña principal, página 1', async () => {
    const { dto, errores } = await validar({});
    expect(errores).toEqual([]);
    expect(dto).toMatchObject({ archivo: false, pagina: 1 });
  });

  it('convierte archivo y pagina del query string', async () => {
    const { dto, errores } = await validar({ archivo: 'true', pagina: '3' });
    expect(errores).toEqual([]);
    expect(dto).toMatchObject({ archivo: true, pagina: 3 });
  });

  it.each([
    ['archivo=si', { archivo: 'si' }, MSG_ARCHIVO],
    ['archivo=1', { archivo: '1' }, MSG_ARCHIVO],
    ['pagina=0', { pagina: '0' }, MSG_PAGINA],
    ['pagina=abc', { pagina: 'abc' }, MSG_PAGINA],
    ['pagina=1.5', { pagina: '1.5' }, MSG_PAGINA],
  ])('%s -> 400 con mensaje', async (_t, query, msg) => {
    expect((await validar(query)).errores).toContain(msg);
  });
});
