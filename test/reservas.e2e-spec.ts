import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hoyEnZonaNegocio, sumarDias } from '@Common/fechas';
import { PrismaService } from '@Prisma/services';
import { Rol } from '@PrismaClient';
import { crearApp } from './helpers/app.js';
import { crearArea, crearTorre, crearUnidad, crearUsuario, limpiarTablas, login } from './helpers/fixtures.js';

const URL = '/api/v1/reservas';
const MSG_CRUCE = 'Ese horario ya está reservado';
const MSG_PASADA = 'No puedes reservar en una fecha pasada';
const MSG_FUERA = 'Fuera del horario del área';
const ID_INEXISTENTE = '3f0f6b2e-5c1d-4b8e-9a37-0d2f6a1c4e55';

describe('Reservas de áreas comunes (H04)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const auth = (req: request.Test, token: string | null) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  const post = (token: string | null, body: object) => auth(request(app.getHttpServer()).post(URL).send(body), token);
  const mias = (token: string | null) => auth(request(app.getHttpServer()).get(`${URL}/mias`), token);
  const cancelar = (token: string | null, id: string) => auth(request(app.getHttpServer()).patch(`${URL}/${id}/cancelar`), token);
  const hoy = () => hoyEnZonaNegocio();

  const valido = (areaId: string, extra: object = {}) => ({
    areaId,
    fecha: sumarDias(hoy(), 2),
    horaInicio: '09:00',
    horaFin: '11:00',
    asistentes: 12,
    ...extra,
  });

  async function escenario() {
    const torre = await crearTorre(prisma);
    const unidad1 = await crearUnidad(prisma, torre.id, 'A-101');
    const unidad2 = await crearUnidad(prisma, torre.id, 'A-102');
    const r1 = await crearUsuario(prisma, 'r1-reservas@test.com', { unidadIds: [unidad1.id] });
    const r2 = await crearUsuario(prisma, 'r2-reservas@test.com', { unidadIds: [unidad2.id] });
    await crearUsuario(prisma, 'admin-reservas@test.com', { rol: Rol.ADMINISTRADOR });
    const area = await crearArea(prisma, {
      nombre: 'Alberca', capacidad: 20, horaApertura: '07:00', horaCierre: '20:00', duracionMaxHoras: 3,
    });
    return {
      r1,
      area,
      t1: await login(app, 'r1-reservas@test.com'),
      t2: await login(app, 'r2-reservas@test.com'),
      tAdmin: await login(app, 'admin-reservas@test.com'),
    };
  }

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => limpiarTablas(prisma));
  afterAll(async () => app.close());

  it('crea una reserva válida, genera RES-000001 en formato y toma unidad/residente de la sesión', async () => {
    const { t1, area, r1 } = await escenario();
    const res = await post(t1, valido(area.id)).expect(201);
    expect(res.body).toMatchObject({
      codigo: expect.stringMatching(/^RES-\d{6}$/),
      area: 'Alberca',
      fecha: sumarDias(hoy(), 2),
      horaInicio: '09:00',
      horaFin: '11:00',
      asistentes: 12,
      estado: 'CONFIRMADA',
    });
    const fila = await prisma.reserva.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(fila.residenteId).toBe(r1.id);
    expect(fila.unidadId).toBeTruthy();
  });

  it('rechaza bloques que se cruzan y no guarda la segunda reserva', async () => {
    const { t1, area } = await escenario();
    await post(t1, valido(area.id)).expect(201);
    const res = await post(t1, valido(area.id, { horaInicio: '10:00', horaFin: '12:00' })).expect(409);
    expect(res.body.message).toBe(MSG_CRUCE);
    expect(await prisma.reserva.count()).toBe(1);
  });

  it('dos residentes reservando el mismo bloque a la vez: solo una recibe 201 y la otra 409', async () => {
    const { t1, t2, area } = await escenario();
    const cuerpo = valido(area.id, { horaInicio: '13:00', horaFin: '14:00' });
    const obtenerEstado = async (token: string) => {
      try {
        return (await post(token, cuerpo)).status;
      } catch (error) {
        return (error as { response: { status: number } }).response.status;
      }
    };
    const estados = await Promise.all([obtenerEstado(t1), obtenerEstado(t2)]);
    expect(estados.sort()).toEqual([201, 409]);
    expect(await prisma.reserva.count()).toBe(1);
  });

  it('valida fecha pasada, horario del área, duración máxima y capacidad', async () => {
    const { t1, area } = await escenario();
    let res = await post(t1, valido(area.id, { fecha: sumarDias(hoy(), -1) })).expect(400);
    expect(res.body.message).toContain(MSG_PASADA);
    res = await post(t1, valido(area.id, { horaInicio: '06:00', horaFin: '08:00' })).expect(400);
    expect(res.body.message).toBe(MSG_FUERA);
    res = await post(t1, valido(area.id, { horaInicio: '09:00', horaFin: '13:00' })).expect(400);
    expect(res.body.message).toBe('Supera la duración máxima de 3 horas');
    res = await post(t1, valido(area.id, { asistentes: 21 })).expect(400);
    expect(res.body.message).toBe('Supera la capacidad de 20 personas');
    expect(await prisma.reserva.count()).toBe(0);
  });

  it('lista solo las propias y permite cancelar con más de 24 horas', async () => {
    const { t1, t2, area } = await escenario();
    const creada = await post(t1, valido(area.id)).expect(201);
    expect((await mias(t1).expect(200)).body.datos).toHaveLength(1);
    expect((await mias(t2).expect(200)).body.datos).toHaveLength(0);
    const cancelada = await cancelar(t1, creada.body.id).expect(200);
    expect(cancelada.body.estado).toBe('CANCELADA');
    const repetida = await cancelar(t1, creada.body.id).expect(409);
    expect(repetida.body.message).toBe('Ya no puedes cancelar esta reserva');
    // Una CANCELADA deja libre el mismo horario para otro residente.
    await post(t2, valido(area.id)).expect(201);
  });

  it('rechaza unidad/residente enviados por el cliente y restringe rol y sesión', async () => {
    const { t1, tAdmin, area } = await escenario();
    await post(t1, valido(area.id, { residenteId: '00000000-0000-0000-0000-000000000001' })).expect(400);
    await post(tAdmin, valido(area.id)).expect(403);
    await post(null, valido(area.id)).expect(401);
    await post(t1, valido(ID_INEXISTENTE)).expect(404);
  });
});
