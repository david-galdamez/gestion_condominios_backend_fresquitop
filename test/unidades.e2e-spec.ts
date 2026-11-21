import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@Prisma/services';
import { Rol } from '@PrismaClient';
import { crearApp } from './helpers/app.js';
import { crearUsuario, limpiarTablas, login } from './helpers/fixtures.js';

const URL = '/api/v1/unidades';

describe('Alta de unidades (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let torreId: string;

  const crear = (token: string | null, body: unknown) => {
    const req = request(app.getHttpServer()).post(URL).send(body as object);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await limpiarTablas(prisma);
    await crearUsuario(prisma, 'res@test.com');
    await crearUsuario(prisma, 'admin@test.com', { rol: Rol.ADMINISTRADOR });
    torreId = (await prisma.torre.create({ data: { nombre: 'Torre T' } })).id;
  });
  afterAll(async () => {
    await app.close();
  });

  it('sin sesión 401 y residente 403', async () => {
    await crear(null, { torreId, codigo: 'T-1' }).expect(401);
    await crear(await login(app, 'res@test.com'), { torreId, codigo: 'T-1' }).expect(403);
    expect(await prisma.unidad.count()).toBe(0);
  });

  it('administrador crea la unidad activa (201) y recorta espacios', async () => {
    const token = await login(app, 'admin@test.com');
    const res = await crear(token, { torreId, codigo: '  T-101 ' }).expect(201);
    expect(res.body.codigo).toBe('T-101');
    const fila = await prisma.unidad.findUniqueOrThrow({ where: { codigo: 'T-101' } });
    expect(fila.activa).toBe(true);
  });

  it('código duplicado responde 409', async () => {
    const token = await login(app, 'admin@test.com');
    await crear(token, { torreId, codigo: 'T-101' }).expect(201);
    await crear(token, { torreId, codigo: 'T-101' }).expect(409);
  });

  it('torre inexistente o datos inválidos responden 400', async () => {
    const token = await login(app, 'admin@test.com');
    await crear(token, { torreId: '0b5e3c1e-7f0a-4c55-9a53-2f4f3f5f0a11', codigo: 'X-1' }).expect(400);
    await crear(token, { torreId, codigo: '' }).expect(400);
    await crear(token, { torreId: 'x', codigo: 'X-1' }).expect(400);
  });
});
