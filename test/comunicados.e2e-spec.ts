import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ComunicadosPublicacionService } from '@Comunicados/services';
import { NotificacionService } from '@Notificaciones/services';
import { PrismaService } from '@Prisma/services';
import { EstadoComunicado, Rol } from '@PrismaClient';
import { crearApp } from './helpers/app.js';
import { crearTorre, crearUsuario, limpiarTablas, login } from './helpers/fixtures.js';

const URL = '/api/v1/comunicados';

describe('Comunicados (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let enviar: ReturnType<typeof vi.spyOn>;

  const auth = (req: request.Test, token: string | null) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  const post = (token: string | null, body: object) => auth(request(app.getHttpServer()).post(URL).send(body), token);

  const valido = (extra: object = {}) => ({
    titulo: 'Corte de agua',
    contenido: 'El sábado no habrá agua de 8 a 12.',
    categoria: 'AGUA',
    destino: { todos: true },
    ...extra,
  });

  async function escenario() {
    const ta = await crearTorre(prisma, 'Torre A');
    const tb = await crearTorre(prisma, 'Torre B');
    await crearUsuario(prisma, 'admin@test.com', { rol: Rol.ADMINISTRADOR });
    await crearUsuario(prisma, 'res@test.com');
    await crearUsuario(prisma, 'guardia@test.com', { rol: Rol.SEGURIDAD });
    return {
      ta,
      tb,
      tAdmin: await login(app, 'admin@test.com'),
      tRes: await login(app, 'res@test.com'),
      tGuardia: await login(app, 'guardia@test.com'),
    };
  }

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    enviar = vi.spyOn(app.get(NotificacionService), 'enviar');
  });
  beforeEach(async () => {
    await limpiarTablas(prisma);
    enviar.mockClear();
  });
  afterAll(async () => {
    await app.close();
  });

  it('publica para una torre: 201 PUBLICADO, guarda destino y avisa solo a esa torre', async () => {
    const { tAdmin, ta } = await escenario();
    const res = await post(tAdmin, valido({ destino: { todos: false, torreIds: [ta.id] } })).expect(201);
    expect(res.body).toMatchObject({ estado: 'PUBLICADO', paraTodos: false, torres: [{ nombre: 'Torre A' }] });
    expect(await prisma.comunicadoDestino.count()).toBe(1);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][0]).toMatchObject({
      destinatario: { tipo: 'TORRE', id: ta.id },
      titulo: 'Nuevo comunicado: Corte de agua',
    });
  });

  it('fecha futura queda PROGRAMADO; la tarea lo publica y luego lo expira', async () => {
    const { tAdmin } = await escenario();
    const pub = new Date(Date.now() + 60 * 60_000);
    const exp = new Date(Date.now() + 2 * 60 * 60_000);
    const res = await post(
      tAdmin,
      valido({ fechaPublicacion: pub.toISOString(), fechaExpiracion: exp.toISOString() }),
    ).expect(201);
    expect(res.body.estado).toBe('PROGRAMADO');
    expect(enviar).not.toHaveBeenCalled();

    const tarea = app.get(ComunicadosPublicacionService);
    expect(await tarea.ejecutar(new Date(pub.getTime() + 60_000))).toEqual({ publicados: 1, expirados: 0 });
    expect(enviar).toHaveBeenCalledTimes(1);
    // Segunda corrida: no repite el aviso.
    expect(await tarea.ejecutar(new Date(pub.getTime() + 60_000))).toEqual({ publicados: 0, expirados: 0 });
    expect(enviar).toHaveBeenCalledTimes(1);

    await tarea.ejecutar(new Date(exp.getTime() + 60_000));
    const fila = await prisma.comunicado.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(fila.estado).toBe(EstadoComunicado.EXPIRADO);
  });

  it('expiración no posterior -> 400 con el mensaje exacto y no guarda', async () => {
    const { tAdmin } = await escenario();
    const pub = new Date(Date.now() + 60 * 60_000).toISOString();
    const res = await post(tAdmin, valido({ fechaPublicacion: pub, fechaExpiracion: pub })).expect(400);
    expect(res.body.message).toBe('La expiración debe ser posterior a la publicación');
    expect(await prisma.comunicado.count()).toBe(0);
  });

  it('sin título, contenido o destinatarios -> 400 con el mensaje del campo', async () => {
    const { tAdmin } = await escenario();
    const res = await post(tAdmin, { categoria: 'AGUA' }).expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([
        'El título debe tener entre 5 y 100 caracteres',
        'El contenido debe tener entre 10 y 2000 caracteres',
        'Selecciona los destinatarios',
      ]),
    );
  });

  it('torre inexistente -> 404', async () => {
    const { tAdmin } = await escenario();
    const res = await post(
      tAdmin,
      valido({ destino: { todos: false, torreIds: ['3f0f6b2e-5c1d-4b8e-9a37-0d2f6a1c4e55'] } }),
    ).expect(404);
    expect(res.body.message).toBe('La torre no existe');
  });

  it('residente y seguridad -> 403; sin token -> 401', async () => {
    const { tRes, tGuardia } = await escenario();
    const r = await post(tRes, valido()).expect(403);
    expect(r.body.message).toBe('No tienes permiso para esta acción');
    await post(tGuardia, valido()).expect(403);
    await post(null, valido()).expect(401);
  });

  it('GET lista los comunicados y GET /torres las torres por nombre', async () => {
    const { tAdmin, tRes } = await escenario();
    await post(tAdmin, valido()).expect(201);
    const lista = await auth(request(app.getHttpServer()).get(URL), tAdmin).expect(200);
    expect(lista.body.datos).toHaveLength(1);
    const torres = await auth(request(app.getHttpServer()).get('/api/v1/torres'), tAdmin).expect(200);
    expect(torres.body.map((t: { nombre: string }) => t.nombre)).toEqual(['Torre A', 'Torre B']);
    await auth(request(app.getHttpServer()).get('/api/v1/torres'), tRes).expect(403);
  });
});
