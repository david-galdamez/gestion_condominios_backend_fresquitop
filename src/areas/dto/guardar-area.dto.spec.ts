import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  DURACION_MAX_DEFAULT,
  GuardarAreaDto,
  MSG_CAPACIDAD,
  MSG_DURACION,
  MSG_HORA,
  MSG_HORARIO,
  MSG_NOMBRE,
} from './guardar-area.dto.js';

const base = () => ({
  nombre: 'Salón de eventos',
  capacidad: 80,
  horaApertura: '08:00',
  horaCierre: '22:00',
  duracionMaxHoras: 3,
});

const instancia = (extra: object = {}) => plainToInstance(GuardarAreaDto, { ...base(), ...extra });
const errores = async (extra: object = {}) =>
  (await validate(instancia(extra))).flatMap((e) => Object.values(e.constraints ?? {}));

describe('GuardarAreaDto', () => {
  it('acepta un payload válido', async () => {
    expect(await errores()).toEqual([]);
  });

  it('sin duracionMaxHoras usa 3 por defecto', async () => {
    const { duracionMaxHoras: _omitida, ...sinDuracion } = base();
    const dto = plainToInstance(GuardarAreaDto, sinDuracion);
    expect(dto.duracionMaxHoras).toBe(DURACION_MAX_DEFAULT);
    expect(await validate(dto)).toEqual([]);
  });

  it.each([
    ['2 caracteres', 'Ab', false],
    ['3 caracteres', 'Abc', true],
    ['40 caracteres', 'a'.repeat(40), true],
    ['41 caracteres', 'a'.repeat(41), false],
    ['solo espacios', '   ', false],
  ])('nombre: %s', async (_t, nombre, valido) => {
    const e = await errores({ nombre });
    expect(e.length === 0).toBe(valido);
    if (!valido) expect(e).toContain(MSG_NOMBRE);
  });

  it('recorta espacios del nombre', () => {
    expect(instancia({ nombre: '  Alberca  ' }).nombre).toBe('Alberca');
  });

  it.each([
    [0, false],
    [1, true],
    [200, true],
    [201, false],
    [2.5, false],
    ['80', false],
  ])('capacidad %s', async (capacidad, valido) => {
    const e = await errores({ capacidad });
    expect(e.length === 0).toBe(valido);
    if (!valido) expect(e).toContain(MSG_CAPACIDAD);
  });

  it.each([
    [0, false],
    [1, true],
    [8, true],
    [9, false],
  ])('duracionMaxHoras %s', async (duracionMaxHoras, valido) => {
    const e = await errores({ duracionMaxHoras });
    expect(e.length === 0).toBe(valido);
    if (!valido) expect(e).toContain(MSG_DURACION);
  });

  it('horas en punto pasan; con minutos, sin cero inicial o 24:00 fallan con el mensaje exacto', async () => {
    expect(await errores({ horaApertura: '00:00', horaCierre: '23:00' })).toEqual([]);
    for (const h of ['08:30', '8:00', '24:00', '0800', '08:00:00']) {
      expect(await errores({ horaApertura: h })).toContain(MSG_HORA);
    }
  });

  it('cierre igual o anterior a la apertura falla con el mensaje exacto', async () => {
    expect(await errores({ horaApertura: '10:00', horaCierre: '10:00' })).toContain(MSG_HORARIO);
    expect(await errores({ horaApertura: '22:00', horaCierre: '08:00' })).toContain(MSG_HORARIO);
    expect(await errores({ horaApertura: '09:00', horaCierre: '10:00' })).toEqual([]);
  });

  it('si la apertura no tiene formato, no reporta además el error de horario', async () => {
    const e = await errores({ horaApertura: '25:00', horaCierre: '08:00' });
    expect(e).toContain(MSG_HORA);
    expect(e).not.toContain(MSG_HORARIO);
  });
});
