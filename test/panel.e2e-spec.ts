import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hoyEnZonaNegocio, sumarDias } from '@Common/fechas';
import { PrismaService } from '@Prisma/services';
import { EstadoAsamblea, EstadoCuota, EstadoReporte, EstadoReserva, PrioridadReporte, Rol } from '@PrismaClient';
import { crearApp } from './helpers/app.js';
import { crearArea, crearCuota, crearTorre, crearUnidad, crearUsuario, limpiarTablas, login } from './helpers/fixtures.js';

const URL = '/api/v1/admin/panel';
const hoy = () => hoyEnZonaNegocio();
const mediodia = (fecha: string) => new Date(`${fecha}T12:00:00-06:00`);
const hora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('Panel de salud del condominio (H19)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const auth = (req: request.Test, token: string | null) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  const panel = (token: string | null, desde: string, hasta: string) =>
    auth(request(app.getHttpServer()).get(URL).query({ desde, hasta }), token);

  async function escenario() {
    const torre = await crearTorre(prisma);
    const [u1, u2, u3, u4] = await Promise.all(
      ['A-101', 'A-102', 'A-103', 'A-104'].map((codigo) => crearUnidad(prisma, torre.id, codigo)),
    );
    const inactiva = await crearUnidad(prisma, torre.id, 'A-999');
    await prisma.unidad.update({ where: { id: inactiva.id }, data: { activa: false } });

    const admin = await crearUsuario(prisma, 'admin-panel@test.com', { rol: Rol.ADMINISTRADOR });
    const residente = await crearUsuario(prisma, 'res-panel@test.com', { unidadIds: [u1.id] });
    await crearUsuario(prisma, 'seg-panel@test.com', { rol: Rol.SEGURIDAD });

    // Mora: u1 debe 2 cuotas, u2 una; la unidad inactiva no cuenta.
    const venc = { estado: EstadoCuota.VENCIDA, fechaVencimiento: sumarDias(hoy(), -30) };
    await crearCuota(prisma, { unidadId: u1.id, periodo: '2026-01', monto: '100.50', ...venc });
    await crearCuota(prisma, { unidadId: u1.id, periodo: '2026-02', monto: '50.00', ...venc });
    await crearCuota(prisma, { unidadId: u2.id, periodo: '2026-01', monto: '80.00', ...venc });
    await crearCuota(prisma, { unidadId: inactiva.id, periodo: '2026-01', monto: '999.00', ...venc });

    // Ocupación: Alberca abre 13 h/día; Salón 12 h/día sin reservas.
    const alberca = await crearArea(prisma, { nombre: 'Alberca', horaApertura: '07:00', horaCierre: '20:00' });
    await crearArea(prisma, { nombre: 'Salón', horaApertura: '08:00', horaCierre: '20:00' });
    const reserva = (n: number, fecha: string, ini: string, fin: string, estado: EstadoReserva) =>
      prisma.reserva.create({
        data: {
          codigo: `RES-90000${n}`, areaId: alberca.id, unidadId: u1.id, residenteId: residente.id,
          fecha: dia(fecha), horaInicio: hora(ini), horaFin: hora(fin), asistentes: 5, estado,
        },
      });
    await reserva(1, sumarDias(hoy(), -3), '09:00', '11:00', EstadoReserva.CONFIRMADA); // 2 h
    await reserva(2, sumarDias(hoy(), -3), '14:00', '17:00', EstadoReserva.FINALIZADA); // 3 h
    await reserva(3, sumarDias(hoy(), -3), '12:00', '13:00', EstadoReserva.CANCELADA); // no cuenta
    await reserva(4, sumarDias(hoy(), -15), '09:00', '11:00', EstadoReserva.CONFIRMADA); // periodo anterior, 2 h

    // Incidencias.
    const rep = (creado: string, estado: EstadoReporte, prioridad: PrioridadReporte | null) =>
      prisma.reporte.create({
        data: {
          residenteId: residente.id, titulo: 'Fuga', categoria: 'FUGA', ubicacion: 'Torre A',
          descripcion: 'Descripción', estado, prioridad, createdAt: mediodia(creado),
        },
      });
    const reciente = sumarDias(hoy(), -2);
    await rep(reciente, EstadoReporte.ABIERTO, PrioridadReporte.ALTA);
    await rep(reciente, EstadoReporte.EN_PROCESO, PrioridadReporte.MEDIA);
    await rep(reciente, EstadoReporte.ABIERTO, null);
    await rep(reciente, EstadoReporte.ABIERTO, null);
    await rep(reciente, EstadoReporte.RESUELTO, PrioridadReporte.ALTA); // no cuenta
    await rep(sumarDias(hoy(), -14), EstadoReporte.ABIERTO, PrioridadReporte.BAJA); // anterior
    await rep(sumarDias(hoy(), -14), EstadoReporte.ABIERTO, null); // anterior

    // Asamblea cerrada: 3 de 4 unidades activas votan (una de ellas en dos temas).
    const asamblea = await prisma.asamblea.create({
      data: {
        titulo: 'Asamblea de prueba', descripcion: 'Descripción', estado: EstadoAsamblea.CERRADA,
        fechaApertura: mediodia(sumarDias(hoy(), -5)), fechaCierre: mediodia(sumarDias(hoy(), -1)),
        creadaPorId: admin.id,
        temas: {
          create: [1, 2].map((orden) => ({
            titulo: `Tema ${orden}`, orden, opciones: { create: [{ texto: 'Sí', orden: 1 }] },
          })),
        },
      },
      include: { temas: { include: { opciones: true } } },
    });
    let n = 0;
    for (const [tema, unidad] of [
      [asamblea.temas[0], u1], [asamblea.temas[0], u2], [asamblea.temas[0], u3], [asamblea.temas[1], u1],
    ] as const) {
      await prisma.voto.create({
        data: {
          asambleaId: asamblea.id, temaId: tema.id, opcionId: tema.opciones[0].id, unidadId: unidad.id,
          residenteId: residente.id, codigoVerificacion: `VOTO000${n++}`,
        },
      });
    }
    void u4;

    return {
      asamblea,
      tAdmin: await login(app, 'admin-panel@test.com'),
      tRes: await login(app, 'res-panel@test.com'),
      tSeg: await login(app, 'seg-panel@test.com'),
    };
  }

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => limpiarTablas(prisma));
  afterAll(async () => app.close());

  it('devuelve mora, ocupación, incidencias y participación del periodo', async () => {
    const { tAdmin } = await escenario();
    const res = await panel(tAdmin, sumarDias(hoy(), -10), hoy()).expect(200);

    expect(res.body.mora).toEqual({ monto: 230.5, unidadesMorosas: 2, porcentajeMorosas: 50 });
    // Alberca: 5 h ÷ (13 h × 11 días) = 3.5 %; periodo anterior 2 h = 1.4 % → +150.0 %.
    expect(res.body.ocupacion).toEqual([
      { area: 'Alberca', porcentaje: 3.5, cambio: 150 },
      { area: 'Salón', porcentaje: 0, cambio: null },
    ]);
    expect(res.body.areaMasUsada).toBe('Alberca');
    // 4 abiertos/en proceso hoy contra 2 en el periodo anterior → +100.0 %.
    expect(res.body.incidencias).toEqual({ ALTA: 1, MEDIA: 1, BAJA: 0, SIN_ASIGNAR: 2, cambio: 100 });
    expect(res.body.participacion).toEqual([{ asamblea: 'Asamblea de prueba', porcentaje: 75 }]);
    expect(typeof res.body.generadoEn).toBe('string');
  });

  it('coincide con los módulos de origen: H22 (mora) y H27 (participación)', async () => {
    const { tAdmin, asamblea } = await escenario();
    const res = await panel(tAdmin, sumarDias(hoy(), -10), hoy()).expect(200);

    const morosidad = await auth(request(app.getHttpServer()).get('/api/v1/admin/morosidad'), tAdmin).expect(200);
    expect(res.body.mora.monto).toBe(morosidad.body.totalMora);
    expect(res.body.mora.unidadesMorosas).toBe(morosidad.body.unidadesMorosas);

    const resultados = await auth(
      request(app.getHttpServer()).get(`/api/v1/asambleas/${asamblea.id}/resultados`),
      tAdmin,
    ).expect(200);
    expect(res.body.participacion[0].porcentaje).toBe(resultados.body.participacion);
  });

  it('excluye lo que queda fuera del periodo y devuelve "sin base" cuando el anterior es 0', async () => {
    const { tAdmin } = await escenario();
    // Un solo día sin actividad propia ni previa.
    const res = await panel(tAdmin, sumarDias(hoy(), -60), sumarDias(hoy(), -60)).expect(200);
    expect(res.body.ocupacion).toEqual([
      { area: 'Alberca', porcentaje: 0, cambio: null },
      { area: 'Salón', porcentaje: 0, cambio: null },
    ]);
    expect(res.body.areaMasUsada).toBeNull();
    expect(res.body.incidencias).toEqual({ ALTA: 0, MEDIA: 0, BAJA: 0, SIN_ASIGNAR: 0, cambio: null });
    expect(res.body.participacion).toEqual([]);
  });

  it('valida el periodo: ausente, invertido o mayor a 366 días responde 400', async () => {
    const { tAdmin } = await escenario();
    await auth(request(app.getHttpServer()).get(URL), tAdmin).expect(400);
    await panel(tAdmin, hoy(), sumarDias(hoy(), -1)).expect(400);
    await panel(tAdmin, sumarDias(hoy(), -366), hoy()).expect(400);
    await panel(tAdmin, sumarDias(hoy(), -365), hoy()).expect(200);
  });

  it('exige sesión (401) y rol administrador (403 para residente y seguridad)', async () => {
    const { tRes, tSeg } = await escenario();
    await panel(null, sumarDias(hoy(), -10), hoy()).expect(401);
    for (const token of [tRes, tSeg]) {
      const res = await panel(token, sumarDias(hoy(), -10), hoy()).expect(403);
      expect(res.body.message).toBe('No tienes permiso para esta acción');
    }
  });
});
