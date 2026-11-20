import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@Prisma/services';
import { CategoriaComunicado, EstadoComunicado, Rol } from '@PrismaClient';
import { crearApp } from './helpers/app.js';
import { crearTorre, crearUnidad, crearUsuario, limpiarTablas, login } from './helpers/fixtures.js';

const URL = '/api/v1/comunicados';
const HORA = 60 * 60_000;

describe('Mis comunicados (H14, e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const get = (ruta: string, token: string | null) => {
    const req = request(app.getHttpServer()).get(`${URL}${ruta}`);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };
  const titulos = (body: { datos: { titulo: string }[] }) => body.datos.map((c) => c.titulo);

  async function escenario() {
    const ta = await crearTorre(prisma, 'Torre A');
    const tb = await crearTorre(prisma, 'Torre B');
    const a101 = await crearUnidad(prisma, ta.id, 'A-101');
    const b201 = await crearUnidad(prisma, tb.id, 'B-201');
    const admin = await crearUsuario(prisma, 'admin@test.com', {
      rol: Rol.ADMINISTRADOR,
    });
    await crearUsuario(prisma, 'resa@test.com', { unidadIds: [a101.id] });
    await crearUsuario(prisma, 'resb@test.com', { unidadIds: [b201.id] });
    await crearUsuario(prisma, 'sinunidad@test.com');
    await crearUsuario(prisma, 'guardia@test.com', { rol: Rol.SEGURIDAD });

    let n = 0;
    /** horasAtras: cuándo se publicó (negativo = futuro). expiraEnHoras: negativo = ya expiró. */
    const comunicado = (
      titulo: string,
      opts: {
        torres?: string[];
        estado?: EstadoComunicado;
        horasAtras?: number;
        expiraEnHoras?: number;
      } = {},
    ) =>
      prisma.comunicado.create({
        data: {
          titulo,
          contenido: `Contenido de ${titulo}.`,
          categoria: CategoriaComunicado.AVISO_GENERAL,
          paraTodos: !opts.torres,
          estado: opts.estado ?? EstadoComunicado.PUBLICADO,
          fechaPublicacion: new Date(Date.now() - (opts.horasAtras ?? ++n) * HORA),
          fechaExpiracion: opts.expiraEnHoras === undefined ? null : new Date(Date.now() + opts.expiraEnHoras * HORA),
          autorId: admin.id,
          destinos: {
            create: (opts.torres ?? []).map((torreId) => ({ torreId })),
          },
        },
      });
    const expirado = (titulo: string, torres?: string[]) =>
      comunicado(titulo, {
        torres,
        estado: EstadoComunicado.EXPIRADO,
        horasAtras: 48,
        expiraEnHoras: -24,
      });

    return {
      ta,
      tb,
      comunicado,
      expirado,
      tAdmin: await login(app, 'admin@test.com'),
      tResA: await login(app, 'resa@test.com'),
      tResB: await login(app, 'resb@test.com'),
      tSinUnidad: await login(app, 'sinunidad@test.com'),
      tGuardia: await login(app, 'guardia@test.com'),
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

  it('principal: solo los de todos y de mi torre, publicados y vigentes, del más reciente al más antiguo', async () => {
    const { ta, tb, comunicado, expirado, tResA, tResB } = await escenario();
    await comunicado('Para todos viejo', { horasAtras: 10 });
    await comunicado('Torre A reciente', { torres: [ta.id], horasAtras: 1 });
    await comunicado('Solo Torre B', { torres: [tb.id], horasAtras: 2 });
    await comunicado('Programado', {
      estado: EstadoComunicado.PROGRAMADO,
      horasAtras: -5,
    });
    await expirado('Expirado');
    await comunicado('Vigente con expiración', {
      horasAtras: 5,
      expiraEnHoras: 24,
    });

    const r = await get('/mios', tResA).expect(200);
    expect(titulos(r.body)).toEqual(['Torre A reciente', 'Vigente con expiración', 'Para todos viejo']);
    expect(r.body).toMatchObject({ total: 3, pagina: 1 });
    expect(r.body.datos[0]).toEqual({
      id: expect.any(String),
      titulo: 'Torre A reciente',
      categoria: 'AVISO_GENERAL',
      fechaPublicacion: expect.any(String),
      leido: false,
    });

    // Un residente de la Torre B no ve el de la Torre A, pero sí el suyo.
    const b = await get('/mios', tResB).expect(200);
    expect(titulos(b.body)).toEqual(['Solo Torre B', 'Vigente con expiración', 'Para todos viejo']);
  });

  it('archivo=true devuelve solo los expirados (incluye los vencidos que la tarea aún no marca)', async () => {
    const { ta, tb, comunicado, expirado, tResA } = await escenario();
    await comunicado('Vigente', { horasAtras: 1 });
    await expirado('Expirado A', [ta.id]);
    await comunicado('Vencido sin marcar', {
      horasAtras: 3,
      expiraEnHoras: -1,
    });
    await expirado('Expirado B', [tb.id]);

    const r = await get('/mios?archivo=true', tResA).expect(200);
    expect(titulos(r.body)).toEqual(['Vencido sin marcar', 'Expirado A']);
    expect(r.body.total).toBe(2);

    const principal = await get('/mios?archivo=false', tResA).expect(200);
    expect(titulos(principal.body)).toEqual(['Vigente']);
  });

  it('pestaña vacía: datos [] y total 0; sin unidades solo ve los de todos', async () => {
    const { ta, comunicado, tResA, tSinUnidad } = await escenario();
    expect((await get('/mios?archivo=true', tResA).expect(200)).body).toEqual({
      datos: [],
      total: 0,
      pagina: 1,
    });

    await comunicado('Para todos');
    await comunicado('Torre A', { torres: [ta.id] });
    expect(titulos((await get('/mios', tSinUnidad).expect(200)).body)).toEqual(['Para todos']);
  });

  it('pagina de 20 en 20', async () => {
    const { comunicado, tResA } = await escenario();
    for (let i = 1; i <= 21; i++) await comunicado(`Comunicado ${i}`, { horasAtras: i });

    const p1 = await get('/mios', tResA).expect(200);
    expect(p1.body.datos).toHaveLength(20);
    expect(p1.body).toMatchObject({ total: 21, pagina: 1 });
    expect(p1.body.datos[0].titulo).toBe('Comunicado 1');

    const p2 = await get('/mios?pagina=2', tResA).expect(200);
    expect(titulos(p2.body)).toEqual(['Comunicado 21']);
  });

  it('abrir un no leído lo marca leído y el conteo baja en 1 (abrirlo otra vez no cambia nada)', async () => {
    const { ta, tb, comunicado, expirado, tResA } = await escenario();
    const uno = await comunicado('Uno');
    await comunicado('Dos', { torres: [ta.id] });
    await comunicado('De la B', { torres: [tb.id] });
    await expirado('Expirado');

    expect((await get('/no-leidos/conteo', tResA).expect(200)).body).toEqual({
      noLeidos: 2,
    });

    const det = await get(`/mios/${uno.id}`, tResA).expect(200);
    expect(det.body).toEqual({
      id: uno.id,
      titulo: 'Uno',
      contenido: 'Contenido de Uno.',
      categoria: 'AVISO_GENERAL',
      fechaPublicacion: uno.fechaPublicacion.toISOString(),
      fechaExpiracion: null,
      archivado: false,
      leido: true,
    });
    expect((await get('/no-leidos/conteo', tResA).expect(200)).body).toEqual({
      noLeidos: 1,
    });

    await get(`/mios/${uno.id}`, tResA).expect(200);
    expect((await get('/no-leidos/conteo', tResA).expect(200)).body).toEqual({
      noLeidos: 1,
    });
    expect(await prisma.lecturaComunicado.count()).toBe(1);

    const lista = await get('/mios', tResA).expect(200);
    expect(lista.body.datos.find((c: { id: string }) => c.id === uno.id).leido).toBe(true);
  });

  it('otra torre, programado, inexistente o enlace mal formado -> 404 "Comunicado no encontrado"', async () => {
    const { tb, comunicado, tResA } = await escenario();
    const deLaB = await comunicado('De la B', { torres: [tb.id] });
    const programado = await comunicado('Programado', {
      estado: EstadoComunicado.PROGRAMADO,
      horasAtras: -5,
    });

    for (const id of [deLaB.id, programado.id, '3f0f6b2e-5c1d-4b8e-9a37-0d2f6a1c4e55', 'no-es-uuid']) {
      const r = await get(`/mios/${id}`, tResA).expect(404);
      expect(r.body.message).toBe('Comunicado no encontrado');
    }
    expect(await prisma.lecturaComunicado.count()).toBe(0);
  });

  it('un expirado se puede abrir desde "Archivo" y viene marcado como archivado', async () => {
    const { expirado, tResA } = await escenario();
    const exp = await expirado('Expirado');
    expect((await get(`/mios/${exp.id}`, tResA).expect(200)).body).toMatchObject({ archivado: true, leido: true });
  });

  it('parámetros inválidos -> 400', async () => {
    const { tResA } = await escenario();
    expect((await get('/mios?archivo=si', tResA).expect(400)).body.message).toContain('archivo debe ser true o false');
    expect((await get('/mios?pagina=0', tResA).expect(400)).body.message).toContain(
      'pagina debe ser un número entero mayor o igual a 1',
    );
  });

  it('administrador y seguridad -> 403; sin sesión -> 401', async () => {
    const { comunicado, tAdmin, tGuardia } = await escenario();
    const c = await comunicado('Uno');
    for (const ruta of ['/mios', '/no-leidos/conteo', `/mios/${c.id}`]) {
      expect((await get(ruta, tAdmin).expect(403)).body.message).toBe('No tienes permiso para esta acción');
      await get(ruta, tGuardia).expect(403);
      await get(ruta, null).expect(401);
    }
  });

  it('la base no permite dos lecturas del mismo comunicado por el mismo residente', async () => {
    const { comunicado } = await escenario();
    const c = await comunicado('Uno');
    const res = await prisma.user.findUniqueOrThrow({
      where: { email: 'resa@test.com' },
    });
    await prisma.lecturaComunicado.create({
      data: { comunicadoId: c.id, residenteId: res.id },
    });
    await expect(
      prisma.lecturaComunicado.create({
        data: { comunicadoId: c.id, residenteId: res.id },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
