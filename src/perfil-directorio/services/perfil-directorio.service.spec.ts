import { NotFoundException } from '@nestjs/common';
import type { GuardarPerfilDirectorioDto } from '../dto/guardar-perfil-directorio.dto.js';
import type { PerfilDirectorioRepository } from '../repositories/perfil-directorio.repository.js';
import { aplicarPrivacidad, PerfilDirectorioService } from './perfil-directorio.service.js';

const datos = { nombre: 'Ana López', correo: 'ana@test.com', unidades: ['A-101', 'B-205'], telefono: null };
const oculto = { visible: false, mostrarNombre: false, mostrarUnidad: false, mostrarTelefono: false, mostrarCorreo: false };

describe('aplicarPrivacidad', () => {
  it('oculto -> null aunque tenga datos marcados', () => {
    expect(aplicarPrivacidad({ ...oculto, mostrarNombre: true }, datos)).toBeNull();
  });

  it('solo devuelve los datos marcados; el resto null', () => {
    expect(aplicarPrivacidad({ ...oculto, visible: true, mostrarNombre: true, mostrarUnidad: true }, datos)).toEqual({
      nombre: 'Ana López',
      unidad: 'A-101, B-205',
      telefono: null,
      correo: null,
    });
    expect(aplicarPrivacidad({ ...oculto, visible: true, mostrarCorreo: true }, datos)).toEqual({
      nombre: null,
      unidad: null,
      telefono: null,
      correo: 'ana@test.com',
    });
  });

  it('sin unidades la unidad es null', () => {
    expect(aplicarPrivacidad({ ...oculto, visible: true, mostrarUnidad: true }, { ...datos, unidades: [] })?.unidad).toBeNull();
  });
});

describe('PerfilDirectorioService', () => {
  const repo = { findByResidente: vi.fn(), guardar: vi.fn(), datosResidente: vi.fn() };
  const service = new PerfilDirectorioService(repo as unknown as PerfilDirectorioRepository);

  beforeEach(() => {
    vi.resetAllMocks();
    repo.datosResidente.mockResolvedValue(datos);
  });

  it('sin fila responde oculto sin escribir (usuario anterior a H15)', async () => {
    repo.findByResidente.mockResolvedValue(null);
    const r = await service.obtener('r-1');
    expect(r).toMatchObject({ ...oculto, vistaPrevia: null });
    expect(r.misDatos).toEqual({ nombre: 'Ana López', unidad: 'A-101, B-205', telefono: null, correo: 'ana@test.com' });
    expect(repo.guardar).not.toHaveBeenCalled();
  });

  it('con fila devuelve sus opciones y la vista previa', async () => {
    repo.findByResidente.mockResolvedValue({ residenteId: 'r-1', ...oculto, visible: true, mostrarUnidad: true });
    const r = await service.obtener('r-1');
    expect(r.visible).toBe(true);
    expect(r.vistaPrevia).toEqual({ nombre: null, unidad: 'A-101, B-205', telefono: null, correo: null });
    expect(r).not.toHaveProperty('residenteId');
  });

  it('guardar usa el residente de la sesión y solo las 5 opciones', async () => {
    const dto = { ...oculto, visible: true, mostrarNombre: true, extra: 'x' } as unknown as GuardarPerfilDirectorioDto;
    repo.guardar.mockImplementation(async (id: string, o: object) => ({ residenteId: id, ...o }));
    const r = await service.guardar('r-1', dto);
    expect(repo.guardar).toHaveBeenCalledWith('r-1', { ...oculto, visible: true, mostrarNombre: true });
    expect(r.vistaPrevia?.nombre).toBe('Ana López');
  });

  it('residente inexistente -> 404', async () => {
    repo.datosResidente.mockResolvedValue(null);
    await expect(service.obtener('x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
