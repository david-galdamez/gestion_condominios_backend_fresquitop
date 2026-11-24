import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@Prisma/services';
import { Rol } from '@PrismaClient';
import { crearApp } from './helpers/app.js';
import { crearTorre, crearUnidad, crearUsuario, limpiarTablas, login } from './helpers/fixtures.js';

const DIRECTORIO = '/api/v1/directorio';
const MI_PERFIL = '/api/v1/directorio/mi-perfil';
const todo = { visible: true, mostrarNombre: true, mostrarUnidad: true, mostrarTelefono: false, mostrarCorreo: false };

describe('Directorio de vecinos y teléfono (hotfix 1.0.1, e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const auth = (req: request.Test, token: string | null) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  const buscar = (token: string | null, query: Record<string, string>) =>
    auth(request(app.getHttpServer()).get(DIRECTORIO).query(query), token);
  const guardar = (token: string, body: object) => auth(request(app.getHttpServer()).put(MI_PERFIL).send(body), token);

  async function escenario() {
    const torre = await crearTorre(prisma);
    const a101 = await crearUnidad(prisma, torre.id, 'A-101');
    const a102 = await crearUnidad(prisma, torre.id, 'A-102');
    const b205 = await crearUnidad(prisma, torre.id, 'B-205');
    const jose = await crearUsuario(prisma, 'jose@test.com', { unidadIds: [a101.id] });
    const ana = await crearUsuario(prisma, 'ana@test.com', { unidadIds: [a102.id] });
    const oculto = await crearUsuario(prisma, 'oculto@test.com', { unidadIds: [b205.id] });
    await prisma.user.update({ where: { id: jose.id }, data: { nombre: 'José Pérez' } });
    await prisma.user.update({ where: { id: ana.id }, data: { nombre: 'Ana López' } });
    await prisma.user.update({ where: { id: oculto.id }, data: { nombre: 'José Oculto' } });
    await crearUsuario(prisma, 'admin@test.com', { rol: Rol.ADMINISTRADOR });
    return {
      tJose: await login(app, 'jose@test.com'),
      tAna: await login(app, 'ana@test.com'),
      tOculto: await login(app, 'oculto@test.com'),
      tAdmin: await login(app, 'admin@test.com'),
      jose,
    };
  }

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await limpiarTablas(prisma);
  });
  afterAll(async () => {
    await app.close();
  });

  it('registra el teléfono en Mi directorio (normalizado) y los vecinos lo ven solo si está marcado', async () => {
    const { tJose, tAna } = await escenario();

    const r = await guardar(tJose, { ...todo, mostrarTelefono: true, telefono: '70442727' }).expect(200);
    expect(r.body.misDatos.telefono).toBe('7044-2727');
    expect(r.body.vistaPrevia.telefono).toBe('7044-2727');

    const encontrado = await buscar(tAna, { q: 'jose' }).expect(200);
    expect(encontrado.body).toEqual({
      datos: [{ nombre: 'José Pérez', unidad: 'A-101', telefono: '7044-2727', correo: null }],
      total: 1,
      pagina: 1,
    });

    // Deja de mostrarlo: sigue guardado pero ya no sale en la búsqueda.
    await guardar(tJose, { ...todo }).expect(200);
    expect((await buscar(tAna, { q: 'jose' }).expect(200)).body.datos[0].telefono).toBeNull();
    expect((await guardar(tJose, { ...todo })).body.misDatos.telefono).toBe('7044-2727');
  });

  it('busca por nombre (sin acentos) o por unidad; excluye ocultos y al propio residente', async () => {
    const { tJose, tAna, tOculto } = await escenario();
    await guardar(tJose, todo).expect(200);
    await guardar(tAna, { ...todo, mostrarNombre: false }).expect(200);
    await guardar(tOculto, { ...todo, visible: false }).expect(200);

    // "jose" encuentra a José Pérez, no a José Oculto (perfil oculto).
    expect((await buscar(tAna, { q: 'JOSE' }).expect(200)).body.datos.map((d: { nombre: string }) => d.nombre)).toEqual(
      ['José Pérez'],
    );
    // Ana oculta su nombre: se la encuentra por unidad y sale sin nombre.
    expect((await buscar(tJose, { q: 'a-102' }).expect(200)).body.datos).toEqual([
      { nombre: null, unidad: 'A-102', telefono: null, correo: null },
    ]);
    expect((await buscar(tJose, { q: 'ana' }).expect(200)).body.total).toBe(0);
    // El propio residente no aparece en su búsqueda.
    expect((await buscar(tJose, { q: 'a-10' }).expect(200)).body.datos).toHaveLength(1);
  });

  it('teléfono inválido o mostrar sin teléfono -> 400; la base también rechaza un formato inválido', async () => {
    const { tJose, jose } = await escenario();
    const invalido = await guardar(tJose, { ...todo, telefono: '1234-5678' }).expect(400);
    expect(invalido.body.message).toContain('El teléfono debe tener 8 dígitos y empezar con 2, 6 o 7 (ej. 7044-2727)');
    const sinTelefono = await guardar(tJose, { ...todo, mostrarTelefono: true }).expect(400);
    expect(sinTelefono.body.message).toBe('Registra tu teléfono para poder mostrarlo');
    await expect(prisma.user.update({ where: { id: jose.id }, data: { telefono: '12345678' } })).rejects.toThrow();
  });

  it('búsqueda inválida -> 400; otros roles 403; sin sesión 401', async () => {
    const { tJose, tAdmin } = await escenario();
    expect((await buscar(tJose, { q: 'a' }).expect(400)).body.message).toContain('Escribe entre 2 y 60 caracteres');
    await buscar(tJose, {}).expect(400);
    await buscar(tJose, { q: 'ana', pagina: '0' }).expect(400);
    expect((await buscar(tAdmin, { q: 'ana' }).expect(403)).body.message).toBe('No tienes permiso para esta acción');
    await buscar(null, { q: 'ana' }).expect(401);
  });
});
