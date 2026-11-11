import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MSG_AMBOS,
  MSG_CODIGO,
  MSG_DOCUMENTO,
  MSG_MOTIVO,
  MSG_NOMBRE,
  MSG_UNIDAD,
  RegistrarEntradaDto,
} from './registrar-entrada.dto.js';

const UNIDAD = '6f1c2b0e-8a54-4a8e-9d1b-1f0f3c2a7b11';
const sinCodigo = () => ({
  nombre: 'Ana López',
  tipoDocumento: 'DUI',
  numeroDocumento: '01234567-8',
  unidadId: UNIDAD,
  motivo: 'Entrega de documentos',
});

const errores = async (plano: object) => [
  ...new Set(
    (await validate(plainToInstance(RegistrarEntradaDto, plano))).flatMap((e) => Object.values(e.constraints ?? {})),
  ),
];

describe('RegistrarEntradaDto', () => {
  it('acepta solo el código', async () => {
    expect(await errores({ codigo: '048213' })).toEqual([]);
  });

  it.each(['48213', '0482130', 'abcdef'])('rechaza el código %s', async (codigo) => {
    expect(await errores({ codigo })).toEqual([MSG_CODIGO]);
  });

  it('rechaza código junto con datos del visitante', async () => {
    expect(await errores({ codigo: '048213', nombre: 'Ana López' })).toEqual([MSG_AMBOS]);
  });

  it('acepta un visitante sin pre-autorización completo', async () => {
    expect(await errores(sinCodigo())).toEqual([]);
  });

  it('pasaporte en minúsculas se normaliza', async () => {
    const dto = plainToInstance(RegistrarEntradaDto, {
      ...sinCodigo(),
      tipoDocumento: 'PASAPORTE',
      numeroDocumento: ' ab123456 ',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.numeroDocumento).toBe('AB123456');
  });

  it.each([
    ['motivo de 4', { motivo: 'Visi' }, MSG_MOTIVO],
    ['motivo de 101', { motivo: 'a'.repeat(101) }, MSG_MOTIVO],
    ['motivo solo espacios', { motivo: '        ' }, MSG_MOTIVO],
    ['nombre corto', { nombre: 'Al' }, MSG_NOMBRE],
    ['DUI mal formado', { numeroDocumento: '012345678' }, MSG_DOCUMENTO],
    ['unidad no uuid', { unidadId: 'A-101' }, MSG_UNIDAD],
  ])('rechaza %s', async (_caso, extra, mensaje) => {
    expect(await errores({ ...sinCodigo(), ...extra })).toEqual([mensaje]);
  });

  it('sin código ni datos reporta cada campo faltante', async () => {
    const errs = await errores({});
    expect(errs).toEqual(expect.arrayContaining([MSG_NOMBRE, MSG_DOCUMENTO, MSG_UNIDAD, MSG_MOTIVO]));
  });
});
