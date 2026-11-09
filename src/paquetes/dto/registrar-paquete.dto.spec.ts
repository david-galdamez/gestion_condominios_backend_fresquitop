import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MSG_DESTINATARIO, MSG_GUIA, MSG_MENSAJERIA, MSG_UNIDAD, RegistrarPaqueteDto } from './registrar-paquete.dto.js';

const base = () => ({
  unidadId: '3f0f6b2e-5c1d-4b8e-9a37-0d2f6a1c4e55',
  destinatario: 'Carlos Pérez',
  mensajeria: 'DHL',
  guia: '1234567890',
});
const instancia = (extra: object = {}) => plainToInstance(RegistrarPaqueteDto, { ...base(), ...extra });
const errores = async (extra: object = {}) =>
  (await validate(instancia(extra))).flatMap((e) => Object.values(e.constraints ?? {}));

describe('RegistrarPaqueteDto', () => {
  it('acepta un payload válido', async () => {
    expect(await errores()).toEqual([]);
  });

  it('unidadId debe ser uuid', async () => {
    expect(await errores({ unidadId: 'A-101' })).toContain(MSG_UNIDAD);
    expect(await errores({ unidadId: undefined })).toContain(MSG_UNIDAD);
  });

  it.each([
    ['2 caracteres', 'Ab', false],
    ['3 caracteres', 'Abc', true],
    ['60 caracteres', 'a'.repeat(60), true],
    ['61 caracteres', 'a'.repeat(61), false],
    ['solo espacios', '    ', false],
  ])('destinatario: %s', async (_t, destinatario, valido) => {
    const e = await errores({ destinatario });
    expect(e.length === 0).toBe(valido);
    if (!valido) expect(e).toContain(MSG_DESTINATARIO);
  });

  it('mensajería fuera de la lista falla con el mensaje', async () => {
    for (const m of ['CORREOS', 'DHL', 'FEDEX', 'UPS', 'AMAZON', 'OTRA']) {
      expect(await errores({ mensajeria: m })).toEqual([]);
    }
    expect(await errores({ mensajeria: 'TNT' })).toContain(MSG_MENSAJERIA);
  });

  it('guía: opcional, vacía cuenta como ausente, 41 caracteres falla', async () => {
    expect(await errores({ guia: undefined })).toEqual([]);
    expect(instancia({ guia: '   ' }).guia).toBeUndefined();
    expect(await errores({ guia: '' })).toEqual([]);
    expect(await errores({ guia: 'a'.repeat(40) })).toEqual([]);
    expect(await errores({ guia: 'a'.repeat(41) })).toContain(MSG_GUIA);
  });
});
