import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { hoyEnZonaNegocio, sumarDias } from '@Common/fechas';
import { DisponibilidadQueryDto, MSG_FECHA_DISPONIBILIDAD } from './disponibilidad.dto.js';

const errores = (query: object) =>
  validateSync(plainToInstance(DisponibilidadQueryDto, query)).flatMap((e) => Object.values(e.constraints ?? {}));

describe('DisponibilidadQueryDto', () => {
  const hoy = () => hoyEnZonaNegocio();

  it('acepta hoy y hoy + 30 días', () => {
    expect(errores({ fecha: hoy() })).toEqual([]);
    expect(errores({ fecha: sumarDias(hoy(), 30) })).toEqual([]);
  });

  it.each([
    ['ausente', {}],
    ['ayer', { fecha: sumarDias(hoyEnZonaNegocio(), -1) }],
    ['hoy + 31', { fecha: sumarDias(hoyEnZonaNegocio(), 31) }],
    ['formato inválido', { fecha: '20/11/2026' }],
    ['día imposible', { fecha: '2026-02-31' }],
  ])('%s -> un solo mensaje de rango', (_caso, query) => {
    expect(errores(query)).toEqual([MSG_FECHA_DISPONIBILIDAD]);
  });
});
