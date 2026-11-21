import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@Prisma/services';
import { Rol } from '@PrismaClient';
import { crearApp } from './helpers/app.js';
import { crearArea, crearUsuario, limpiarTablas, login } from './helpers/fixtures.js';

const URL = '/api/v1/areas';
const MSG_PERMISO = 'No tienes permiso para esta acción';
const MSG_DUPLICADO = 'Ya existe un área con ese nombre';
const MSG_HORARIO = 'La hora de cierre debe ser posterior a la de apertura';
const MSG_CAPACIDAD = 'La capacidad debe estar entre 1 y 200 personas';
const MSG_HORA = 'La hora debe ser en punto, en formato HH:00 (24 h)';
const ID_INEXISTENTE = '3f0f6b2e-5c1d-4b8e-9a37-0d2f6a1c4e55';

describe('Áreas comunes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const auth = (req: request.Test, token: string | null) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  const listar = (token: string | null) => auth(request(app.getHttpServer()).get(URL), token);
  const crear = (token: string | null, body: object) => auth(request(app.getHttpServer()).post(URL).send(body), token);
  const editar = (token: string | null, id: string, body: object) =>
    auth(request(app.getHttpServer()).put(`${URL}/${id}`).send(body), token);
  const estado = (token: string | null, id: string, body: object) =>
    auth(request(app.getHttpServer()).patch(`${URL}/${id}/estado`).send(body), token);

  const valida = (extra: object = {}) => ({
    nombre: 'Salón de eventos',
    capacidad: 80,
    horaApertura: '08:00',
    horaCierre: '22:00',
    duracionMaxHoras: 3,
    ...extra,
  });

  async function escenario() {
    await crearUsuario(prisma, 'admin@test.com', { rol: Rol.ADMINISTRADOR });
    await crearUsuario(prisma, 'r1@test.com');
    await crearUsuario(prisma, 'seg@test.com', { rol: Rol.SEGURIDAD });
    return {
      tAdmin: await login(app, 'admin@test.com'),
      tRes: await login(app, 'r1@test.com'),
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

  describe('POST /areas', () => {
    it('registra un área válida: 201, Activa y forma completa', async () => {
      const { tAdmin } = await escenario();
      const res = await crear(tAdmin, valida({ nombre: '  Salón de eventos  ' })).expect(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        nombre: 'Salón de eventos',
        capacidad: 80,
        horaApertura: '08:00',
        horaCierre: '22:00',
        duracionMaxHoras: 3,
        activa: true,
      });
    });

    it('sin duracionMaxHoras guarda 3', async () => {
      const { tAdmin } = await escenario();
      const { duracionMaxHoras: _omitida, ...sinDuracion } = valida();
      const res = await crear(tAdmin, sinDuracion).expect(201);
      expect(res.body.duracionMaxHoras).toBe(3);
    });

    it('capacidad fuera de rango, hora no en punto y cierre <= apertura -> 400 con el mensaje', async () => {
      const { tAdmin } = await escenario();
      let res = await crear(tAdmin, valida({ capacidad: 201 })).expect(400);
      expect(res.body.message).toContain(MSG_CAPACIDAD);
      res = await crear(tAdmin, valida({ capacidad: 0 })).expect(400);
      expect(res.body.message).toContain(MSG_CAPACIDAD);
      res = await crear(tAdmin, valida({ horaApertura: '08:30' })).expect(400);
      expect(res.body.message).toContain(MSG_HORA);
      res = await crear(tAdmin, valida({ horaApertura: '22:00', horaCierre: '08:00' })).expect(400);
      expect(res.body.message).toContain(MSG_HORARIO);
      res = await crear(tAdmin, valida({ horaApertura: '10:00', horaCierre: '10:00' })).expect(400);
      expect(res.body.message).toContain(MSG_HORARIO);
      expect(await prisma.areaComun.count()).toBe(0);
    });

    it('nombre repetido, aunque cambien mayúsculas -> 409 y no se guarda', async () => {
      const { tAdmin } = await escenario();
      await crear(tAdmin, valida()).expect(201);
      const res = await crear(tAdmin, valida({ nombre: 'SALÓN DE EVENTOS' })).expect(409);
      expect(res.body.message).toBe(MSG_DUPLICADO);
      expect(await prisma.areaComun.count()).toBe(1);
    });

    it('rechaza campos que no son del DTO (activa en el alta) -> 400', async () => {
      const { tAdmin } = await escenario();
      await crear(tAdmin, valida({ activa: false })).expect(400);
    });

    it('residente y seguridad -> 403 con el mensaje; sin token -> 401', async () => {
      const { tRes, tSeg } = await escenario();
      const res = await crear(tRes, valida()).expect(403);
      expect(res.body.message).toBe(MSG_PERMISO);
      await crear(tSeg, valida()).expect(403);
      await crear(null, valida()).expect(401);
      expect(await prisma.areaComun.count()).toBe(0);
    });
  });

  describe('PUT /areas/:id', () => {
    it('edita horario y capacidad conservando su nombre', async () => {
      const { tAdmin } = await escenario();
      const area = await crearArea(prisma, { nombre: 'Alberca' });
      const res = await editar(
        tAdmin,
        area.id,
        valida({ nombre: 'Alberca', capacidad: 25, horaApertura: '06:00', horaCierre: '20:00' }),
      ).expect(200);
      expect(res.body).toMatchObject({ capacidad: 25, horaApertura: '06:00', horaCierre: '20:00', activa: true });
    });

    it('nombre de otra área -> 409; id inexistente -> 404; id no uuid -> 400', async () => {
      const { tAdmin } = await escenario();
      await crearArea(prisma, { nombre: 'Gimnasio' });
      const alberca = await crearArea(prisma, { nombre: 'Alberca' });
      const dup = await editar(tAdmin, alberca.id, valida({ nombre: 'gimnasio' })).expect(409);
      expect(dup.body.message).toBe(MSG_DUPLICADO);
      const no = await editar(tAdmin, ID_INEXISTENTE, valida()).expect(404);
      expect(no.body.message).toBe('El área no existe');
      await editar(tAdmin, 'abc', valida()).expect(400);
    });

    it('residente -> 403', async () => {
      const { tRes } = await escenario();
      const area = await crearArea(prisma, { nombre: 'Alberca' });
      await editar(tRes, area.id, valida()).expect(403);
    });
  });

  describe('PATCH /areas/:id/estado', () => {
    it('desactiva y reactiva; el residente deja de verla mientras está Inactiva', async () => {
      const { tAdmin, tRes } = await escenario();
      const area = await crearArea(prisma, { nombre: 'Asador' });
      await crearArea(prisma, { nombre: 'Gimnasio' });

      const off = await estado(tAdmin, area.id, { activa: false }).expect(200);
      expect(off.body.activa).toBe(false);
      let res = await listar(tRes).expect(200);
      expect(res.body.datos.map((a: { nombre: string }) => a.nombre)).toEqual(['Gimnasio']);

      // El administrador sigue viendo la inactiva.
      res = await listar(tAdmin).expect(200);
      expect(res.body.datos.map((a: { nombre: string }) => a.nombre)).toEqual(['Asador', 'Gimnasio']);

      await estado(tAdmin, area.id, { activa: true }).expect(200);
      res = await listar(tRes).expect(200);
      expect(res.body.datos).toHaveLength(2);
    });

    it('activa no booleana -> 400; inexistente -> 404; residente -> 403', async () => {
      const { tAdmin, tRes } = await escenario();
      const area = await crearArea(prisma, { nombre: 'Asador' });
      await estado(tAdmin, area.id, { activa: 'no' }).expect(400);
      await estado(tAdmin, ID_INEXISTENTE, { activa: false }).expect(404);
      await estado(tRes, area.id, { activa: false }).expect(403);
    });
  });

  describe('GET /areas', () => {
    it('ordena por nombre; seguridad -> 403; sin token -> 401', async () => {
      const { tAdmin, tSeg } = await escenario();
      await crearArea(prisma, { nombre: 'Salón de eventos' });
      await crearArea(prisma, { nombre: 'Alberca' });
      const res = await listar(tAdmin).expect(200);
      expect(res.body.datos.map((a: { nombre: string }) => a.nombre)).toEqual(['Alberca', 'Salón de eventos']);
      await listar(tSeg).expect(403);
      await listar(null).expect(401);
    });
  });

  describe('restricciones en la base (DB-3.1)', () => {
    it('los CHECK rechazan capacidad, duración, horario y minutos inválidos aunque se salte la API', async () => {
      for (const extra of [
        { capacidad: 0 },
        { capacidad: 201 },
        { duracionMaxHoras: 9 },
        { horaApertura: '22:00', horaCierre: '08:00' },
        { horaApertura: '08:30' },
      ]) {
        await expect(crearArea(prisma, { nombre: `Prueba ${Math.random()}`.slice(0, 40), ...extra })).rejects.toThrow();
      }
      expect(await prisma.areaComun.count()).toBe(0);
    });
  });
});
