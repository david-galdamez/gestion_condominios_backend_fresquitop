import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MSG_FECHAS_INVERTIDAS, MSG_RANGO_MAXIMO } from '@Panel/dto';
import {
  ExportarReporteQueryDto,
  MSG_FECHA_INVALIDA,
  MSG_FORMATO,
  MSG_PERIODO,
  MSG_VERSION,
} from './exportar-reporte-query.dto.js';

const base = { formato: 'PDF', version: 'RESUMIDA', desde: '2026-11-01', hasta: '2026-11-30' };

const errores = async (extra: Record<string, unknown> = {}) => {
  const dto = plainToInstance(ExportarReporteQueryDto, { ...base, ...extra });
  return (await validate(dto)).flatMap((e) => Object.values(e.constraints ?? {}));
};

describe('ExportarReporteQueryDto', () => {
  it('acepta un periodo válido en PDF y EXCEL, DETALLADA y RESUMIDA', async () => {
    expect(await errores()).toEqual([]);
    expect(await errores({ formato: 'EXCEL', version: 'DETALLADA' })).toEqual([]);
  });

  it.each([
    ['sin desde', { desde: undefined }],
    ['sin hasta', { hasta: undefined }],
    ['desde vacío', { desde: '' }],
  ])('%s -> "Selecciona un periodo"', async (_t, extra) => {
    expect(await errores(extra)).toEqual([MSG_PERIODO]);
  });

  it('sin ninguna fecha: solo el mensaje de periodo', async () => {
    expect(new Set(await errores({ desde: undefined, hasta: undefined }))).toEqual(new Set([MSG_PERIODO]));
  });

  it.each([
    ['formato inválido', { formato: 'CSV' }, MSG_FORMATO],
    ['sin formato', { formato: undefined }, MSG_FORMATO],
    ['versión inválida', { version: 'COMPLETA' }, MSG_VERSION],
    ['fecha mal formada', { desde: '01-11-2026' }, MSG_FECHA_INVALIDA],
    ['fecha inexistente', { hasta: '2026-02-30' }, MSG_FECHA_INVALIDA],
    ['periodo invertido', { desde: '2026-12-01' }, MSG_FECHAS_INVERTIDAS],
    ['más de 366 días', { desde: '2025-01-01', hasta: '2026-11-30' }, MSG_RANGO_MAXIMO],
  ])('%s -> mensaje', async (_t, extra, msg) => {
    expect(await errores(extra)).toContain(msg);
  });
});
