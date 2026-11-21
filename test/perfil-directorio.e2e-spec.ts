import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@Prisma/services';
import { Rol } from '@PrismaClient';
import { crearApp } from './helpers/app.js';
import { crearTorre, crearUnidad, crearUsuario, limpiarTablas, login, PASSWORD } from './helpers/fixtures.js';

const URL = '/api/v1/directorio/mi-perfil';
const MSG_DATO = 'Elige al menos un dato para mostrar';
const oculto = { visible: false, mostrarNombre: false, mostrarUnidad: false, mostrarTelefono: false, mostrarCorreo: false };

describe('Perfil de directorio (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const auth = (req: request.Test, token: string | null) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  const obtener = (token: string | null) => auth(request(app.getHttpServer()).get(URL), token);
  const guardar = (token: string | null, body: object) => auth(request(app.getHttpServer()).put(URL).send(body), token);

  async function escenario() {
    const torre = await crearTorre(prisma);
    const a101 = await crearUnidad(prisma, torre.id, 'A-101');
    const b205 = await crearUnidad(prisma, torre.id, 'B-205');
    const r1 = await crearUsuario(prisma, 'r1@test.com', { unidadIds: [a101.id, b205.id] });
    const r2 = await crearUsuario(prisma, 'r2@test.com', { unidadIds: [a101.id] });
    await crearUsuario(prisma, 'admin@test.com', { rol: Rol.ADMINISTRADOR });
    await crearUsuario(prisma, 'seg@test.com', { rol: Rol.SEGURIDAD });
    return {
      r1,
      r2,
      t1: await login(app, 'r1@test.com'),
      t2: await login(app, 'r2@test.com'),
      tAdmin: await login(app, 'admin@test.com'),
      tSeg: await login(app, 'seg@test.com'),
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

  it('BE-15.2: dar de alta un usuario crea el perfil de directorio oculto', async () => {
    await crearUsuario(prisma, 'admin@test.com', { rol: Rol.ADMINISTRADOR });
    const tAdmin = await login(app, 'admin@test.com');
    const res = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${tAdmin}`)
      .send({ email: 'nuevo@test.com', password: PASSWORD, nombre: 'Vecino Nuevo' })
      .expect(201);
    const fila = await prisma.perfilDirectorio.findUniqueOrThrow({ where: { residenteId: res.body.id } });
    expect(fila).toMatchObject(oculto);

    const t = await login(app, 'nuevo@test.com');
    const perfil = await obtener(t).expect(200);
    expect(perfil.body).toMatchObject({ ...oculto, vistaPrevia: null });
  });

  it('sin fila (usuario anterior a H15) se ve oculto y con todos sus datos propios', async () => {
    const { t1 } = await escenario();
    const res = await obtener(t1).expect(200);
    expect(res.body).toEqual({
      ...oculto,
      misDatos: { nombre: 'r1', unidad: 'A-101, B-205', telefono: null, correo: 'r1@test.com' },
      vistaPrevia: null,
    });
  });

  it('guardar visible con nombre y unidad: la vista previa solo trae esos datos', async () => {
    const { t1, r1 } = await escenario();
    const res = await guardar(t1, { ...oculto, visible: true, mostrarNombre: true, mostrarUnidad: true }).expect(200);
    expect(res.body.vistaPrevia).toEqual({ nombre: 'r1', unidad: 'A-101, B-205', telefono: null, correo: null });
    const fila = await prisma.perfilDirectorio.findUniqueOrThrow({ where: { residenteId: r1.id } });
    expect(fila).toMatchObject({ visible: true, mostrarNombre: true, mostrarCorreo: false });

    // Volver a ocultarse conserva las casillas pero ya no se ve.
    const off = await guardar(t1, { ...oculto, mostrarNombre: true, mostrarUnidad: true }).expect(200);
    expect(off.body.vistaPrevia).toBeNull();
  });

  it('visible sin ningún dato -> 400 con el mensaje y no se guarda', async () => {
    const { t1, r1 } = await escenario();
    const res = await guardar(t1, { ...oculto, visible: true }).expect(400);
    expect(res.body.message).toContain(MSG_DATO);
    expect(await prisma.perfilDirectorio.findUnique({ where: { residenteId: r1.id } })).toBeNull();
  });

  it('no se puede cambiar el perfil de otro: un residenteId en el body -> 400', async () => {
    const { t1, r2 } = await escenario();
    await guardar(t1, { ...oculto, visible: true, mostrarCorreo: true, residenteId: r2.id }).expect(400);
    expect(await prisma.perfilDirectorio.count()).toBe(0);
  });

  it('cada residente ve solo su propio perfil', async () => {
    const { t1, t2 } = await escenario();
    await guardar(t1, { ...oculto, visible: true, mostrarCorreo: true }).expect(200);
    const res = await obtener(t2).expect(200);
    expect(res.body.visible).toBe(false);
    expect(res.body.misDatos.correo).toBe('r2@test.com');
  });

  it('la base rechaza visible sin datos aunque se salte la API (CHECK)', async () => {
    const { r1 } = await escenario();
    await expect(prisma.perfilDirectorio.create({ data: { residenteId: r1.id, visible: true } })).rejects.toThrow();
  });

  it('administrador y seguridad -> 403 con el mensaje; sin token -> 401', async () => {
    const { tAdmin, tSeg } = await escenario();
    const res = await obtener(tAdmin).expect(403);
    expect(res.body.message).toBe('No tienes permiso para esta acción');
    await guardar(tSeg, { ...oculto }).expect(403);
    await obtener(null).expect(401);
  });
});
