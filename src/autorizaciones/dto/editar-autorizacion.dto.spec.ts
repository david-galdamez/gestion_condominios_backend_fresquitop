import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { hoyEnZonaNegocio, sumarDias } from '@Common/fechas';
import { MSG_DOCUMENTO, MSG_FECHA } from './crear-autorizacion.dto.js';
import { EditarAutorizacionDto } from './editar-autorizacion.dto.js';

const errores = async (plain: object) =>
  (await validate(plainToInstance(EditarAutorizacionDto, plain))).flatMap((e) => Object.values(e.constraints ?? {}));

describe('EditarAutorizacionDto', () => {
  it('acepta un cambio parcial (solo hora o solo placa)', async () => {
    expect(await errores({ horaEstimada: '08:00' })).toEqual([]);
    expect(await errores({ placa: '' })).toEqual([]);
  });

  it('nombre con las reglas de H07 (3 a 60)', async () => {
    expect((await errores({ nombre: 'Ab' })).length).toBeGreaterThan(0);
    expect(await errores({ nombre: 'Abc' })).toEqual([]);
    expect((await errores({ nombre: 'a'.repeat(61) })).length).toBeGreaterThan(0);
  });

  it('placa de más de 10 falla', async () => {
    expect((await errores({ placa: 'A'.repeat(11) })).length).toBeGreaterThan(0);
  });

  it('documento inválido usa el mensaje de H07', async () => {
    expect(await errores({ tipoDocumento: 'DUI', numeroDocumento: '123' })).toContain(MSG_DOCUMENTO);
    expect(await errores({ tipoDocumento: 'PASAPORTE', numeroDocumento: 'ab12cd' })).toEqual([]);
  });

  it('número sin tipo (o tipo sin número) se rechaza', async () => {
    expect(await errores({ numeroDocumento: '01234567-8' })).toContain(MSG_DOCUMENTO);
    expect((await errores({ tipoDocumento: 'DUI' })).length).toBeGreaterThan(0);
  });

  it('fecha fuera de hoy..hoy+30 falla con el mensaje exacto', async () => {
    const hoy = hoyEnZonaNegocio();
    expect(await errores({ fechaVisita: sumarDias(hoy, -1) })).toContain(MSG_FECHA);
    expect(await errores({ fechaVisita: sumarDias(hoy, 31) })).toContain(MSG_FECHA);
    expect(await errores({ fechaVisita: sumarDias(hoy, 30) })).toEqual([]);
  });
});
