import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { MENSAJE_DESCRIPCION, MENSAJE_TITULO } from '../reportes.constants.js';
import { CreateReporteDto } from './create-reporte.dto.js';

const valido = {
  titulo: 'Fuga de agua',
  categoria: 'FUGA',
  ubicacion: 'Torre A',
  descripcion: 'Hay una fuga en el pasillo.',
};

async function mensajes(plano: Record<string, unknown>) {
  const errores = await validate(plainToInstance(CreateReporteDto, plano));
  return errores.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('CreateReporteDto', () => {
  it('acepta un reporte válido', async () => {
    expect(await mensajes(valido)).toEqual([]);
  });

  it.each([
    ['muy corto', 'abcd'],
    ['muy largo', 'x'.repeat(81)],
    ['solo espacios', '      '],
  ])('rechaza un título %s', async (_caso, titulo) => {
    expect(await mensajes({ ...valido, titulo })).toEqual([MENSAJE_TITULO]);
  });

  it('acepta los límites del título (5 y 80)', async () => {
    expect(await mensajes({ ...valido, titulo: 'x'.repeat(5) })).toEqual([]);
    expect(await mensajes({ ...valido, titulo: 'x'.repeat(80) })).toEqual([]);
  });

  it.each([
    ['muy corta', 'corta'],
    ['muy larga', 'x'.repeat(501)],
  ])('rechaza una descripción %s', async (_caso, descripcion) => {
    expect(await mensajes({ ...valido, descripcion })).toEqual([MENSAJE_DESCRIPCION]);
  });

  it('rechaza una categoría fuera del enum', async () => {
    expect(await mensajes({ ...valido, categoria: 'PLOMERIA' })).toHaveLength(1);
  });
});
