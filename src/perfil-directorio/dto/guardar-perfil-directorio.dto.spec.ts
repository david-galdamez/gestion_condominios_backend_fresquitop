import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GuardarPerfilDirectorioDto, MSG_AL_MENOS_UN_DATO } from './guardar-perfil-directorio.dto.js';

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
});
