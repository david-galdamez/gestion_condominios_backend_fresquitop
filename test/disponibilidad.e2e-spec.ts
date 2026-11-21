import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { aFechaUtc, hoyEnZonaNegocio, sumarDias } from '@Common/fechas';
import { PrismaService } from '@Prisma/services';
import { EstadoReserva, Rol } from '@PrismaClient';
import { crearApp } from './helpers/app.js';
import { crearArea, crearTorre, crearUnidad, crearUsuario, limpiarTablas, login } from './helpers/fixtures.js';

const URL = '/api/v1/areas/disponibilidad';
const MSG_FECHA = 'Elige una fecha entre hoy y los próximos 30 días';

interface Bloque {
  inicio: string;
  fin: string;
  estado: 'LIBRE' | 'OCUPADO';
}
interface AreaDisp {
  id: string;
  nombre: string;
  capacidad: number;
  bloques: Bloque[];
}

describe('Disponibilidad de áreas (H23)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let codigo = 0;

  const consultar = (token: string | null, fecha?: string) => {
    const req = request(app.getHttpServer()).get(URL);
    if (fecha !== undefined) req.query({ fecha });
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };
  const manana = () => sumarDias(hoyEnZonaNegocio(), 1);
  const ocupados = (area: AreaDisp) => area.bloques.filter((b) => b.estado === 'OCUPADO').map((b) => b.inicio);
  const buscar = (areas: AreaDisp[], nombre: string) => areas.find((a) => a.nombre === nombre);

  async function escenario() {
    const torre = await crearTorre(prisma);
    const unidad = await crearUnidad(prisma, torre.id, 'A-101');
    const residente = await crearUsuario(prisma, 'r1-disp@test.com', { unidadIds: [unidad.id] });
    await crearUsuario(prisma, 'admin-disp@test.com', { rol: Rol.ADMINISTRADOR });
    await crearUsuario(prisma, 'seg-disp@test.com', { rol: Rol.SEGURIDAD });
    const alberca = await crearArea(prisma, { nombre: 'Alberca', capacidad: 30, horaApertura: '07:00', horaCierre: '19:00' });
    const salon = await crearArea(prisma, { nombre: 'Salón', capacidad: 80, horaApertura: '10:00', horaCierre: '14:00' });
    await crearArea(prisma, { nombre: 'Gimnasio', activa: false });

    const reservar = (areaId: string, fecha: string, inicio: string, fin: string, estado: EstadoReserva = EstadoReserva.CONFIRMADA) =>
      prisma.reserva.create({
        data: {
          codigo: `RES-${String(++codigo).padStart(6, '0')}`,
          areaId,
          unidadId: unidad.id,
          residenteId: residente.id,
          fecha: aFechaUtc(fecha),
          horaInicio: new Date(`1970-01-01T${inicio}:00.000Z`),
          horaFin: new Date(`1970-01-01T${fin}:00.000Z`),
          asistentes: 5,
          estado,
        },
      });

    return {
      alberca,
      salon,
      reservar,
      tRes: await login(app, 'r1-disp@test.com'),
      tAdmin: await login(app, 'admin-disp@test.com'),
      tSeg: await login(app, 'seg-disp@test.com'),
    };
  }

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => limpiarTablas(prisma));
  afterAll(async () => app.close());

  it('devuelve cada área activa con sus bloques de 1 hora; la inactiva no aparece', async () => {
    const { tRes, alberca } = await escenario();
    const res = await consultar(tRes, manana()).expect(200);

    expect(res.body.fecha).toBe(manana());
    const areas = res.body.areas as AreaDisp[];
    expect(areas.map((a) => a.nombre)).toEqual(['Alberca', 'Salón']);

    const a = buscar(areas, 'Alberca')!;
    expect(a).toMatchObject({ id: alberca.id, capacidad: 30 });
    expect(a.bloques).toHaveLength(12);
    expect(a.bloques[0]).toEqual({ inicio: '07:00', fin: '08:00', estado: 'LIBRE' });
    expect(a.bloques[11]).toEqual({ inicio: '18:00', fin: '19:00', estado: 'LIBRE' });
    expect(buscar(areas, 'Salón')!.bloques.map((b) => b.inicio)).toEqual(['10:00', '11:00', '12:00', '13:00']);
  });

  it('una reserva Confirmada ocupa sus bloques; Cancelada y Finalizada no; otra fecha no cuenta', async () => {
    const { tRes, alberca, salon, reservar } = await escenario();
    await reservar(alberca.id, manana(), '08:00', '10:00');
    await reservar(alberca.id, manana(), '12:00', '13:00', EstadoReserva.CANCELADA);
    await reservar(alberca.id, manana(), '15:00', '16:00', EstadoReserva.FINALIZADA);
    await reservar(alberca.id, sumarDias(manana(), 1), '17:00', '18:00');
    await reservar(salon.id, manana(), '13:00', '14:00');

    const areas = (await consultar(tRes, manana()).expect(200)).body.areas as AreaDisp[];
    expect(ocupados(buscar(areas, 'Alberca')!)).toEqual(['08:00', '09:00']);
    expect(ocupados(buscar(areas, 'Salón')!)).toEqual(['13:00']);
  });

  it('si la reserva se cancela, el bloque vuelve a Libre', async () => {
    const { tRes, alberca, reservar } = await escenario();
    const r = await reservar(alberca.id, manana(), '09:00', '10:00');
    let areas = (await consultar(tRes, manana()).expect(200)).body.areas as AreaDisp[];
    expect(ocupados(buscar(areas, 'Alberca')!)).toEqual(['09:00']);

    await prisma.reserva.update({ where: { id: r.id }, data: { estado: EstadoReserva.CANCELADA, canceladaEn: new Date() } });
    areas = (await consultar(tRes, manana()).expect(200)).body.areas as AreaDisp[];
    expect(ocupados(buscar(areas, 'Alberca')!)).toEqual([]);
  });

  it('la respuesta no trae quién reservó', async () => {
    const { tRes, alberca, reservar } = await escenario();
    await reservar(alberca.id, manana(), '08:00', '09:00');
    const res = await consultar(tRes, manana()).expect(200);
    expect(JSON.stringify(res.body)).not.toMatch(/residente|unidad|A-101|r1-disp|RES-/i);
    expect(Object.keys(res.body.areas[0].bloques[0]).sort((x, y) => x.localeCompare(y))).toEqual([
      'estado',
      'fin',
      'inicio',
    ]);
  });

  it('hoy: los bloques que ya empezaron salen Ocupado y los siguientes Libre', async () => {
    const { tRes } = await escenario();
    const hoy = hoyEnZonaNegocio();
    const antes = Date.now();
    const res = await consultar(tRes, hoy).expect(200);
    const despues = Date.now();

    for (const b of buscar(res.body.areas as AreaDisp[], 'Alberca')!.bloques) {
      const inicio = Date.parse(`${hoy}T${b.inicio}:00-06:00`);
      if (inicio <= antes) expect(b.estado).toBe('OCUPADO');
      if (inicio > despues) expect(b.estado).toBe('LIBRE');
    }
  });

  it('acepta hoy + 30; rechaza ayer, hoy + 31, formato inválido y fecha ausente con 400', async () => {
    const { tRes } = await escenario();
    const hoy = hoyEnZonaNegocio();
    await consultar(tRes, sumarDias(hoy, 30)).expect(200);
    for (const fecha of [sumarDias(hoy, -1), sumarDias(hoy, 31), '2026-13-01', undefined]) {
      const res = await consultar(tRes, fecha).expect(400);
      expect(res.body.message).toContain(MSG_FECHA);
    }
  });

  it('administrador y seguridad -> 403; sin sesión -> 401', async () => {
    const { tAdmin, tSeg } = await escenario();
    await consultar(tAdmin, manana()).expect(403);
    await consultar(tSeg, manana()).expect(403);
    await consultar(null, manana()).expect(401);
  });
});
