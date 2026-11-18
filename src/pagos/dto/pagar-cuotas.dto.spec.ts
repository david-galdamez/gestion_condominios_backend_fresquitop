import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MSG_CUOTAS,
  MSG_CVV,
  MSG_NUMERO,
  MSG_TITULAR,
  MSG_VENCIMIENTO,
  PagarCuotasDto,
  vencimientoVigente,
} from './pagar-cuotas.dto.js';

const ID = '3f0f6b2e-5c1d-4b8e-9a37-0d2f6a1c4e55';
const base = (tarjeta: object = {}, extra: object = {}) => ({
  cuotaIds: [ID],
  tarjeta: { numero: '4242 4242 4242 4242', vencimiento: '12/39', cvv: '123', titular: ' Ana López ', ...tarjeta },
  ...extra,
});
const mensajes = async (body: object) => {
  const errores = await validate(plainToInstance(PagarCuotasDto, body));
  const todos: string[] = [];
  const recorrer = (es: typeof errores) =>
    es.forEach((e) => {
      todos.push(...Object.values(e.constraints ?? {}));
      recorrer(e.children ?? []);
    });
  recorrer(errores);
  return todos;
};

describe('PagarCuotasDto', () => {
  it('acepta un pago válido; quita espacios del número y recorta el titular', async () => {
    expect(await mensajes(base())).toEqual([]);
    const dto = plainToInstance(PagarCuotasDto, base());
    expect(dto.tarjeta.numero).toBe('4242424242424242');
    expect(dto.tarjeta.titular).toBe('Ana López');
  });

  it('cuotaIds: de 1 a 12, sin repetir y uuid', async () => {
    expect(await mensajes(base({}, { cuotaIds: [] }))).toContain(MSG_CUOTAS);
    expect(await mensajes(base({}, { cuotaIds: Array.from({ length: 13 }, (_, i) => ID.slice(0, -2) + String(i).padStart(2, '0')) }))).toContain(MSG_CUOTAS);
    expect((await mensajes(base({}, { cuotaIds: [ID, ID] }))).length).toBeGreaterThan(0);
    expect((await mensajes(base({}, { cuotaIds: ['abc'] }))).length).toBeGreaterThan(0);
  });

  it('tarjeta: número, CVV y titular con su mensaje', async () => {
    expect(await mensajes(base({ numero: '4242' }))).toContain(MSG_NUMERO);
    expect(await mensajes(base({ cvv: '12' }))).toContain(MSG_CVV);
    expect(await mensajes(base({ titular: 'Al' }))).toContain(MSG_TITULAR);
    expect(await mensajes(base({ vencimiento: '13/30' }))).toContain(MSG_VENCIMIENTO);
  });

  it('vencimiento: el mes actual sirve, el anterior no (hora de El Salvador)', () => {
    const ahora = new Date('2026-11-17T18:00:00Z');
    expect(vencimientoVigente('11/26', ahora)).toBe(true);
    expect(vencimientoVigente('12/26', ahora)).toBe(true);
    expect(vencimientoVigente('10/26', ahora)).toBe(false);
    expect(vencimientoVigente('11/25', ahora)).toBe(false);
    expect(vencimientoVigente('1/27', ahora)).toBe(false);
  });
});
