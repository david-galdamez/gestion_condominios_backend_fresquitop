import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CrearComunicadoDto, MSG_CONTENIDO, MSG_DESTINO, MSG_TITULO } from './crear-comunicado.dto.js';

const base = () => ({
  titulo: 'Corte de agua',
  contenido: 'El sábado no habrá agua de 8 a 12.',
  categoria: 'AGUA',
  destino: { todos: true },
});

const errores = async (extra: object = {}) => {
  const errs = await validate(plainToInstance(CrearComunicadoDto, { ...base(), ...extra }));
  const planos = (e: (typeof errs)[number]): string[] => [
    ...Object.values(e.constraints ?? {}),
    ...(e.children ?? []).flatMap(planos),
  ];
  return errs.flatMap(planos);
};

describe('CrearComunicadoDto', () => {
  it('acepta un comunicado para todos', async () => {
    expect(await errores()).toEqual([]);
  });

  it.each([
    ['título de 4', { titulo: 'abcd' }, MSG_TITULO],
    ['título de 101', { titulo: 'a'.repeat(101) }, MSG_TITULO],
    ['sin título', { titulo: undefined }, MSG_TITULO],
    ['contenido de 9', { contenido: 'a'.repeat(9) }, MSG_CONTENIDO],
    ['contenido de 2001', { contenido: 'a'.repeat(2001) }, MSG_CONTENIDO],
    ['sin destino', { destino: undefined }, MSG_DESTINO],
    ['ni todos ni torres', { destino: { todos: false, torreIds: [] } }, MSG_DESTINO],
  ])('%s -> mensaje del campo', async (_t, extra, msg) => {
    expect(await errores(extra)).toContain(msg);
  });

  it('acepta torres concretas y límites exactos', async () => {
    expect(
      await errores({
        titulo: 'abcde',
        contenido: 'a'.repeat(2000),
        destino: { todos: false, torreIds: ['7d9f2c1e-3b4a-4c5d-8e6f-0a1b2c3d4e5f'] },
      }),
    ).toEqual([]);
  });

  it('categoría fuera de la lista y fecha mal formada fallan', async () => {
    expect((await errores({ categoria: 'OTRA' })).length).toBeGreaterThan(0);
    expect((await errores({ fechaPublicacion: '20-11-2026' })).length).toBeGreaterThan(0);
  });
});
