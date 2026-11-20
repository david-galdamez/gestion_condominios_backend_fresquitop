import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { MENSAJE_COMENTARIO_CIERRE } from '../reportes.constants.js';
import { ResolverReporteDto } from './resolver-reporte.dto.js';

async function mensajes(plano: Record<string, unknown>) {
  const errores = await validate(plainToInstance(ResolverReporteDto, plano));
  return errores.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('ResolverReporteDto (H24)', () => {
  it('acepta un comentario válido en los límites (10 y 300 caracteres)', async () => {
    expect(await mensajes({ comentario: 'x'.repeat(10) })).toEqual([]);
    expect(await mensajes({ comentario: 'x'.repeat(300) })).toEqual([]);
  });

  it.each([
    ['ausente', {}],
    ['vacío', { comentario: '' }],
    ['solo espacios', { comentario: '            ' }],
    ['menor a 10 caracteres', { comentario: '123456789' }],
    ['mayor a 300 caracteres', { comentario: 'x'.repeat(301) }],
    ['no es string', { comentario: 1234567890 }],
  ])('rechaza cuando el comentario es %s', async (_caso, payload) => {
    const errs = await mensajes(payload);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs).toContain(MENSAJE_COMENTARIO_CIERRE);
  });
});