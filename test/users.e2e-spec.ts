import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@Prisma/services';
import { Rol } from '@PrismaClient';
import { crearApp } from './helpers/app.js';
import { crearUsuario, limpiarTablas, login, PASSWORD } from './helpers/fixtures.js';

const URL = '/api/v1/users';

describe('Alta de usuarios (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const body = { email: 'nuevo@test.com', password: PASSWORD, nombre: 'Vecino Nuevo' };
  const crear = (token: string | null) => {
    const req = request(app.getHttpServer()).post(URL).send(body);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await limpiarTablas(prisma);
    await crearUsuario(prisma, 'res@test.com');
    await crearUsuario(prisma, 'seg@test.com', { rol: Rol.SEGURIDAD });
    await crearUsuario(prisma, 'admin@test.com', { rol: Rol.ADMINISTRADOR });
  });
  afterAll(async () => {
    await app.close();
  });

  it('sin sesión responde 401 y no crea el usuario', async () => {
    await crear(null).expect(401);
    expect(await prisma.user.count({ where: { email: body.email } })).toBe(0);
  });

  it('residente responde 403', async () => {
    await crear(await login(app, 'res@test.com')).expect(403);
    expect(await prisma.user.count({ where: { email: body.email } })).toBe(0);
  });

  it('seguridad responde 403', async () => {
    await crear(await login(app, 'seg@test.com')).expect(403);
    expect(await prisma.user.count({ where: { email: body.email } })).toBe(0);
  });

  it('administrador responde 201; queda como RESIDENTE y sin passwordHash', async () => {
    const res = await crear(await login(app, 'admin@test.com')).expect(201);
    expect(res.body).not.toHaveProperty('passwordHash');
    const fila = await prisma.user.findUniqueOrThrow({ where: { email: body.email } });
    expect(fila.rol).toBe(Rol.RESIDENTE);
  });
});
