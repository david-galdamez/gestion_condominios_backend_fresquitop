import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MSG_FECHAS_INVERTIDAS, MSG_FECHAS_REQUERIDAS, MSG_RANGO_MAXIMO, PanelQueryDto } from './panel-query.dto.js';

async function errores(datos: object): Promise<string[]> {
  const fallos = await validate(plainToInstance(PanelQueryDto, datos));
  return fallos.flatMap((f) => Object.values(f.constraints ?? {}));
}

describe('PanelQueryDto', () => {
  it('acepta un periodo válido y el máximo de 366 días', async () => {
    expect(await errores({ desde: '2026-11-01', hasta: '2026-11-30' })).toEqual([]);
    expect(await errores({ desde: '2025-11-20', hasta: '2026-11-20' })).toEqual([]);
  });

  it('acepta un solo día', async () => {
    expect(await errores({ desde: '2026-11-05', hasta: '2026-11-05' })).toEqual([]);
  });

  it('rechaza fechas ausentes', async () => {
    expect(await errores({})).toContain(MSG_FECHAS_REQUERIDAS);
    expect(await errores({ desde: '2026-11-01' })).toContain(MSG_FECHAS_REQUERIDAS);
  });

  it('rechaza fechas que no existen o con mal formato', async () => {
    expect(await errores({ desde: '2026-02-31', hasta: '2026-03-05' })).toContain('desde no es una fecha real');
    expect(await errores({ desde: '01/11/2026', hasta: '2026-11-30' })).toContain(MSG_FECHAS_REQUERIDAS);
  });

  it('rechaza fechas invertidas', async () => {
    expect(await errores({ desde: '2026-11-30', hasta: '2026-11-01' })).toContain(MSG_FECHAS_INVERTIDAS);
  });

  it('rechaza rangos de más de 366 días', async () => {
    expect(await errores({ desde: '2025-11-19', hasta: '2026-11-20' })).toContain(MSG_RANGO_MAXIMO);
  });
});
