import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  GuardarPerfilDirectorioDto,
  MSG_AL_MENOS_UN_DATO,
  MSG_TELEFONO,
  normalizarTelefono,
} from './guardar-perfil-directorio.dto.js';

const base = {
  visible: true,
  mostrarNombre: true,
  mostrarUnidad: false,
  mostrarTelefono: false,
  mostrarCorreo: false,
};
const errores = async (extra: object = {}) =>
  (await validate(plainToInstance(GuardarPerfilDirectorioDto, { ...base, ...extra }))).flatMap((e) =>
    Object.values(e.constraints ?? {}),
  );

describe('GuardarPerfilDirectorioDto', () => {
  it('visible con un dato marcado es válido', async () => {
    expect(await errores()).toEqual([]);
  });

  it.each(['mostrarUnidad', 'mostrarTelefono', 'mostrarCorreo'])('basta con %s', async (campo) => {
    expect(await errores({ mostrarNombre: false, [campo]: true })).toEqual([]);
  });

  it('visible sin ningún dato falla con el mensaje exacto', async () => {
    expect(await errores({ mostrarNombre: false })).toContain(MSG_AL_MENOS_UN_DATO);
  });

  it('oculto sin datos marcados es válido (estado por defecto)', async () => {
    expect(await errores({ visible: false, mostrarNombre: false })).toEqual([]);
  });

  it('todos los campos son booleanos obligatorios', async () => {
    expect((await errores({ visible: 'true' })).length).toBeGreaterThan(0);
    expect((await errores({ mostrarCorreo: undefined })).length).toBeGreaterThan(0);
    expect((await errores({ mostrarUnidad: 1 })).length).toBeGreaterThan(0);
  });

  describe('telefono (hotfix 1.0.1)', () => {
    it.each([
      ['7044-2727', '7044-2727'],
      ['70442727', '7044-2727'],
      [' 2222 3333 ', '2222-3333'],
      ['6123-4567', '6123-4567'],
    ])('%s -> %s', (entrada, esperado) => {
      expect(normalizarTelefono(entrada)).toBe(esperado);
    });

    it('vacío -> null; null y undefined se mantienen', () => {
      expect(normalizarTelefono('  ')).toBeNull();
      expect(normalizarTelefono(null)).toBeNull();
      expect(normalizarTelefono(undefined)).toBeUndefined();
    });

    it.each(['1234-5678', '7044-272', '70442727a', '+503 7044 2727'])('%s no es válido', async (telefono) => {
      expect(await errores({ telefono })).toContain(MSG_TELEFONO);
    });

    it('válido, vacío u omitido no da error', async () => {
      expect(await errores({ telefono: '70442727' })).toEqual([]);
      expect(await errores({ telefono: '' })).toEqual([]);
      expect(await errores({})).toEqual([]);
    });
  });
});
