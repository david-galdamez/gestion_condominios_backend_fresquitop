import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@Prisma/services';
import { Rol } from '@PrismaClient';
import { crearApp } from './helpers/app.js';
import { crearTorre, crearUnidad, crearUsuario, limpiarTablas, login } from './helpers/fixtures.js';

const URL = '/api/v1/paquetes';
const MSG_FOTO = 'Solo JPG o PNG de hasta 5 MB';
const MSG_PERMISO = 'No tienes permiso para esta acción';
const ID_INEXISTENTE = '3f0f6b2e-5c1d-4b8e-9a37-0d2f6a1c4e55';

// Basta con la firma: el backend reconoce JPG/PNG por sus primeros bytes.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const PDF = Buffer.from('%PDF-1.7 documento');

describe('Paquetes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const auth = (req: request.Test, token: string | null) => (token ? req.set('Authorization', `Bearer ${token}`) : req);

  /** POST multipart: campos de texto + foto opcional. */
  function registrar(
    token: string | null,
    campos: Record<string, string>,
    foto: { buffer: Buffer; nombre: string } | null = { buffer: PNG, nombre: 'etiqueta.png' },
  ) {
    let req = auth(request(app.getHttpServer()).post(URL), token);
    for (const [k, v] of Object.entries(campos)) req = req.field(k, v);
    if (foto) req = req.attach('foto', foto.buffer, foto.nombre);
    return req;
  }
  const listar = (token: string | null) => auth(request(app.getHttpServer()).get(URL), token);

  async function escenario() {
    const torre = await crearTorre(prisma);
    const a101 = await crearUnidad(prisma, torre.id, 'A-101');
    const vacia = await crearUnidad(prisma, torre.id, 'A-102');
    await crearUsuario(prisma, 'r1@test.com', { unidadIds: [a101.id] });
    await crearUsuario(prisma, 'seg@test.com', { rol: Rol.SEGURIDAD });
    await crearUsuario(prisma, 'admin@test.com', { rol: Rol.ADMINISTRADOR });
    return {
      a101,
      vacia,
      tSeg: await login(app, 'seg@test.com'),
      tRes: await login(app, 'r1@test.com'),
      tAdmin: await login(app, 'admin@test.com'),
      campos: (extra: Record<string, string> = {}) => ({
        unidadId: a101.id,
        destinatario: 'Carlos Pérez',
        mensajeria: 'DHL',
        guia: '1234567890',
        ...extra,
      }),
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

  describe('POST /paquetes', () => {
    it('registra: 201 En portería, código PAQ-, sin código de retiro; guarda guardia, retiro y foto', async () => {
      const { tSeg, campos } = await escenario();
      const res = await registrar(tSeg, campos({ destinatario: '  Carlos Pérez  ' })).expect(201);
      expect(res.body).toMatchObject({
        unidad: 'A-101',
        destinatario: 'Carlos Pérez',
        mensajeria: 'DHL',
        guia: '1234567890',
        estado: 'EN_PORTERIA',
      });
      expect(res.body.codigoPaquete).toMatch(/^PAQ-\d{6}$/);
      expect(res.body).not.toHaveProperty('codigoRetiro');

      const fila = await prisma.paquete.findUniqueOrThrow({ where: { id: res.body.id }, include: { recibidoPor: true } });
      expect(fila.codigoRetiro).toMatch(/^\d{6}$/);
      expect(fila.recibidoPor.email).toBe('seg@test.com');
      expect(fila.fotoUrl).toMatch(/^paquetes\/[0-9a-f-]{36}\.png$/);
      expect(existsSync(join(resolve(process.env.UPLOAD_DIR ?? 'uploads'), fila.fotoUrl))).toBe(true);
    });

    it('acepta JPG y guía vacía (queda null); los códigos no se repiten', async () => {
      const { tSeg, campos } = await escenario();
      const a = await registrar(tSeg, campos({ guia: '' }), { buffer: JPG, nombre: 'f.jpg' }).expect(201);
      const b = await registrar(tSeg, campos()).expect(201);
      expect(a.body.guia).toBeNull();
      expect(a.body.codigoPaquete).not.toBe(b.body.codigoPaquete);
    });

    it('foto ausente, PDF (aunque se llame .jpg) o de más de 5 MB -> 400 con el mensaje', async () => {
      const { tSeg, campos } = await escenario();
      let res = await registrar(tSeg, campos(), null).expect(400);
      expect(res.body.message).toBe(MSG_FOTO);
      res = await registrar(tSeg, campos(), { buffer: PDF, nombre: 'etiqueta.jpg' }).expect(400);
      expect(res.body.message).toBe(MSG_FOTO);
      const grande = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
      res = await registrar(tSeg, campos(), { buffer: grande, nombre: 'grande.png' }).expect(400);
      expect(res.body.message).toBe(MSG_FOTO);
      expect(await prisma.paquete.count()).toBe(0);
    });

    it('campos inválidos -> 400 con el mensaje del campo', async () => {
      const { tSeg, campos } = await escenario();
      let res = await registrar(tSeg, campos({ destinatario: 'Ab' })).expect(400);
      expect(res.body.message).toContain('El destinatario debe tener entre 3 y 60 caracteres');
      res = await registrar(tSeg, campos({ mensajeria: 'TNT' })).expect(400);
      expect(res.body.message).toContain('Elige una mensajería de la lista');
      res = await registrar(tSeg, campos({ guia: 'a'.repeat(41) })).expect(400);
      expect(res.body.message).toContain('El número de guía no puede superar los 40 caracteres');
    });

    it('unidad sin residentes activos -> 409; residente desactivado no cuenta', async () => {
      const { tSeg, campos, vacia, a101 } = await escenario();
      let res = await registrar(tSeg, campos({ unidadId: vacia.id })).expect(409);
      expect(res.body.message).toBe('La unidad no tiene residentes registrados');
      await prisma.user.updateMany({ where: { unidades: { some: { unidadId: a101.id } } }, data: { isActive: false } });
      res = await registrar(tSeg, campos()).expect(409);
      expect(await prisma.paquete.count()).toBe(0);
    });

    it('unidad inexistente -> 404', async () => {
      const { tSeg, campos } = await escenario();
      const res = await registrar(tSeg, campos({ unidadId: ID_INEXISTENTE })).expect(404);
      expect(res.body.message).toBe('La unidad no existe');
    });

    it('residente y administrador -> 403 con el mensaje; sin token -> 401', async () => {
      const { tRes, tAdmin, campos } = await escenario();
      const res = await registrar(tRes, campos()).expect(403);
      expect(res.body.message).toBe(MSG_PERMISO);
      await registrar(tAdmin, campos()).expect(403);
      await registrar(null, campos()).expect(401);
      expect(await prisma.paquete.count()).toBe(0);
    });
  });

  describe('GET /paquetes', () => {
    it('lista En portería y Retenidos, más recientes primero, sin código de retiro', async () => {
      const { tSeg, campos } = await escenario();
      const p1 = await registrar(tSeg, campos({ destinatario: 'Primero' })).expect(201);
      const p2 = await registrar(tSeg, campos({ destinatario: 'Segundo' })).expect(201);
      const p3 = await registrar(tSeg, campos({ destinatario: 'Entregado' })).expect(201);
      await prisma.paquete.update({ where: { id: p1.body.id }, data: { estado: 'RETENIDO', recibidoEn: new Date('2026-01-01') } });
      await prisma.paquete.update({ where: { id: p3.body.id }, data: { estado: 'ENTREGADO' } });

      const res = await listar(tSeg).expect(200);
      expect(res.body.datos.map((p: { id: string }) => p.id)).toEqual([p2.body.id, p1.body.id]);
      expect(res.body.datos[1].estado).toBe('RETENIDO');
      for (const p of res.body.datos) expect(p).not.toHaveProperty('codigoRetiro');
    });

    it('residente y administrador -> 403', async () => {
      const { tRes, tAdmin } = await escenario();
      await listar(tRes).expect(403);
      await listar(tAdmin).expect(403);
    });
  });

  describe('GET /unidades (selector de portería)', () => {
    it('seguridad y administrador ven todas las activas; residente -> 403', async () => {
      const { tSeg, tAdmin, tRes, vacia } = await escenario();
      await prisma.unidad.update({ where: { id: vacia.id }, data: { activa: false } });
      const res = await auth(request(app.getHttpServer()).get('/api/v1/unidades'), tSeg).expect(200);
      expect(res.body).toEqual([{ id: expect.any(String), codigo: 'A-101' }]);
      await auth(request(app.getHttpServer()).get('/api/v1/unidades'), tAdmin).expect(200);
      await auth(request(app.getHttpServer()).get('/api/v1/unidades'), tRes).expect(403);
    });
  });
});
