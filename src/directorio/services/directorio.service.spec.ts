import type { PerfilDirectorioRepository } from '@PerfilDirectorio/repositories';
import { DirectorioService, normalizar } from './directorio.service.js';

const todo = { visible: true, mostrarNombre: true, mostrarUnidad: true, mostrarTelefono: true, mostrarCorreo: true };
const vecino = (nombre: string, unidades: string[], opciones = {}, extra = {}) => ({
  opciones: { ...todo, ...opciones },
  datos: { nombre, correo: `${normalizar(nombre.split(' ')[0])}@test.com`, unidades, telefono: '7000-0000', ...extra },
});

describe('DirectorioService (H16)', () => {
  const repo = { findVisibles: vi.fn() };
  const service = new DirectorioService(repo as unknown as PerfilDirectorioRepository);

  beforeEach(() => {
    vi.resetAllMocks();
    repo.findVisibles.mockResolvedValue([
      vecino('José Pérez', ['A-101']),
      vecino('Ana López', ['B-205']),
      // Oculta su nombre: no se le puede encontrar por nombre, sí por unidad.
      vecino('Mario Secreto', ['A-102'], { mostrarNombre: false, mostrarTelefono: false, mostrarCorreo: false }),
    ]);
  });

  it('normalizar quita acentos y mayúsculas', () => {
    expect(normalizar('JOSÉ Pérez')).toBe('jose perez');
  });

  it('busca por nombre sin distinguir acentos ni mayúsculas y excluye al propio residente', async () => {
    const r = await service.buscar('yo', { q: 'jose', pagina: 1 });
    expect(repo.findVisibles).toHaveBeenCalledWith('yo');
    expect(r).toEqual({
      datos: [{ nombre: 'José Pérez', unidad: 'A-101', telefono: '7000-0000', correo: 'jose@test.com' }],
      total: 1,
      pagina: 1,
    });
  });

  it('busca por unidad y devuelve solo los datos autorizados', async () => {
    const r = await service.buscar('yo', { q: 'a-10', pagina: 1 });
    expect(r.datos).toEqual([
      { nombre: 'José Pérez', unidad: 'A-101', telefono: '7000-0000', correo: 'jose@test.com' },
      { nombre: null, unidad: 'A-102', telefono: null, correo: null },
    ]);
  });

  it('un dato no autorizado no sirve para encontrar al vecino', async () => {
    expect((await service.buscar('yo', { q: 'secreto', pagina: 1 })).total).toBe(0);
  });

  it('pagina de 20 en 20', async () => {
    repo.findVisibles.mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => vecino(`Vecino ${String(i).padStart(2, '0')}`, [`C-${i}`])),
    );
    const p2 = await service.buscar('yo', { q: 'vecino', pagina: 2 });
    expect(p2.total).toBe(25);
    expect(p2.datos.map((d) => d.nombre)).toEqual(['Vecino 20', 'Vecino 21', 'Vecino 22', 'Vecino 23', 'Vecino 24']);
  });
});
