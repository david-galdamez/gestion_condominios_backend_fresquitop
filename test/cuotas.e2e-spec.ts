import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hoyEnZonaNegocio, sumarDias } from '@Common/fechas';
import {
  AvisoCuotasService,
  GeneracionAutomaticaService,
} from '@Cuotas/services';
import { NotificacionService } from '@Notificaciones/services';
import { PrismaService } from '@Prisma/services';
import { EstadoCuota, Rol } from '@PrismaClient';
import { crearApp } from './helpers/app.js';
import {
  crearCuota,
  crearTorre,
  crearUnidad,
  crearUsuario,
  limpiarTablas,
  login,
} from './helpers/fixtures.js';

const CONFIG = '/api/v1/cuotas/configuracion';
const GENERAR = '/api/v1/cuotas/generar';

/** Mes actual y siguiente en El Salvador ("YYYY-MM"). */
const mesActual = () => hoyEnZonaNegocio().slice(0, 7);
const mesSiguiente = () => {
  const [a, m] = mesActual().split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
};

describe('Cuotas H02 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: string;

  const http = () => request(app.getHttpServer());
  const put = (token: string, body: object) =>
    http().put(CONFIG).set('Authorization', `Bearer ${token}`).send(body);
  const generar = (token: string, periodo: string) =>
    http()
      .post(GENERAR)
      .set('Authorization', `Bearer ${token}`)
      .send({ periodo });

  /** 3 unidades activas y 1 inactiva. */
  async function unidades() {
    const torre = await crearTorre(prisma);
    const activas = await Promise.all(
      ['A-101', 'A-102', 'A-103'].map((c) => crearUnidad(prisma, torre.id, c)),
    );
    const inactiva = await prisma.unidad.create({
      data: { torreId: torre.id, codigo: 'A-104', activa: false },
    });
    return { activas, inactiva };
  }

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limpiarTablas(prisma);
    await crearUsuario(prisma, 'admin@test.com', { rol: Rol.ADMINISTRADOR });
    admin = await login(app, 'admin@test.com');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('configuración', () => {
    it('guarda y devuelve la configuración vigente', async () => {
      await http()
        .get(CONFIG)
        .set('Authorization', `Bearer ${admin}`)
        .expect(404);

      const res = await put(admin, {
        montoMensual: 45.5,
        diaVencimiento: 10,
      }).expect(200);
      expect(res.body).toEqual({
        montoMensual: 45.5,
        diaVencimiento: 10,
        vigenteDesde: hoyEnZonaNegocio(),
      });

      const get = await http()
        .get(CONFIG)
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(get.body).toEqual(res.body);
    });

    it('rechaza el día 29 con el mensaje de negocio y no guarda', async () => {
      const res = await put(admin, {
        montoMensual: 45,
        diaVencimiento: 29,
      }).expect(400);
      expect(res.body.message).toContain(
        'El día de vencimiento debe estar entre 1 y 28',
      );
      expect(await prisma.configuracionCuota.count()).toBe(0);
    });

    it('rechaza montos fuera de $1.00 a $9,999.99', async () => {
      await put(admin, { montoMensual: 0.5, diaVencimiento: 10 }).expect(400);
      await put(admin, { montoMensual: 10000, diaVencimiento: 10 }).expect(400);
    });

    it.each([Rol.RESIDENTE, Rol.SEGURIDAD])(
      '%s recibe 403 "No tienes permiso para esta acción"',
      async (rol) => {
        await crearUsuario(prisma, 'otro@test.com', { rol });
        const token = await login(app, 'otro@test.com');
        const res = await put(token, {
          montoMensual: 45,
          diaVencimiento: 10,
        }).expect(403);
        expect(res.body.message).toBe('No tienes permiso para esta acción');
        await http()
          .get(CONFIG)
          .set('Authorization', `Bearer ${token}`)
          .expect(403);
        await generar(token, mesActual()).expect(403);
      },
    );

    it('sin sesión responde 401', async () => {
      await http().get(CONFIG).expect(401);
    });
  });

  describe('generación', () => {
    it('crea una cuota Pendiente por unidad activa con el monto y el día vigentes', async () => {
      const { activas, inactiva } = await unidades();
      await put(admin, { montoMensual: 45, diaVencimiento: 5 }).expect(200);
      const periodo = mesSiguiente();

      const res = await generar(admin, periodo).expect(201);
      expect(res.body).toEqual({ periodo, creadas: 3, omitidas: 0 });

      const cuotas = await prisma.cuota.findMany({ where: { periodo } });
      expect(cuotas).toHaveLength(3);
      expect(new Set(cuotas.map((c) => c.unidadId))).toEqual(
        new Set(activas.map((u) => u.id)),
      );
      expect(cuotas.some((c) => c.unidadId === inactiva.id)).toBe(false);
      for (const c of cuotas) {
        expect(c.estado).toBe(EstadoCuota.PENDIENTE);
        expect(c.monto.toFixed(2)).toBe('45.00');
        expect(c.fechaVencimiento.toISOString().slice(0, 10)).toBe(
          `${periodo}-05`,
        );
      }

      const ejecucion = await prisma.ejecucionGeneracion.findFirstOrThrow();
      expect(ejecucion).toMatchObject({
        periodo,
        origen: 'MANUAL',
        creadas: 3,
        omitidas: 0,
      });
    });

    it('repetir el mismo periodo no duplica: creadas 0 y omitidas = unidades activas', async () => {
      await unidades();
      await put(admin, { montoMensual: 45, diaVencimiento: 10 }).expect(200);
      const periodo = mesActual();

      await generar(admin, periodo).expect(201);
      const res = await generar(admin, periodo).expect(201);
      expect(res.body).toEqual({ periodo, creadas: 0, omitidas: 3 });
      expect(await prisma.cuota.count({ where: { periodo } })).toBe(3);
    });

    it('cambiar el monto no altera las cuotas generadas; aplica a la siguiente generación', async () => {
      await unidades();
      await put(admin, { montoMensual: 45, diaVencimiento: 10 }).expect(200);
      await generar(admin, mesActual()).expect(201);

      await put(admin, { montoMensual: 60, diaVencimiento: 10 }).expect(200);
      await generar(admin, mesSiguiente()).expect(201);

      const actuales = await prisma.cuota.findMany({
        where: { periodo: mesActual() },
      });
      const siguientes = await prisma.cuota.findMany({
        where: { periodo: mesSiguiente() },
      });
      expect(actuales.every((c) => c.monto.toFixed(2) === '45.00')).toBe(true);
      expect(siguientes.every((c) => c.monto.toFixed(2) === '60.00')).toBe(
        true,
      );
    });

    it('una unidad que ya tenía cuota del periodo se omite', async () => {
      const { activas } = await unidades();
      await crearCuota(prisma, {
        unidadId: activas[0].id,
        periodo: mesActual(),
        monto: 30,
        fechaVencimiento: `${mesActual()}-10`,
      });
      await put(admin, { montoMensual: 45, diaVencimiento: 10 }).expect(200);

      const res = await generar(admin, mesActual()).expect(201);
      expect(res.body).toMatchObject({ creadas: 2, omitidas: 1 });
    });

    it('sin configuración responde 409', async () => {
      await unidades();
      const res = await generar(admin, mesActual()).expect(409);
      expect(res.body.message).toBe('No existe configuración de cuota');
    });

    it('rechaza un periodo con otro formato o posterior al mes siguiente', async () => {
      await put(admin, { montoMensual: 45, diaVencimiento: 10 }).expect(200);
      await generar(admin, '2026-13').expect(400);
      const [a, m] = mesSiguiente().split('-').map(Number);
      const lejano =
        m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
      await generar(admin, lejano).expect(400);
    });

    it('la tarea automática genera el mes actual con origen AUTOMATICA', async () => {
      await unidades();
      await put(admin, { montoMensual: 45, diaVencimiento: 10 }).expect(200);

      const r = await app.get(GeneracionAutomaticaService).generarMesActual();
      expect(r).toEqual({ periodo: mesActual(), creadas: 3, omitidas: 0 });
      const ejecucion = await prisma.ejecucionGeneracion.findFirstOrThrow();
      expect(ejecucion).toMatchObject({
        origen: 'AUTOMATICA',
        ejecutadaPorId: null,
      });
    });
  });

  describe('aviso de cuota por vencer', () => {
    it('avisa solo las Pendientes que vencen en 3 días, una sola vez', async () => {
      const { activas } = await unidades();
      const hoy = hoyEnZonaNegocio();
      const enviar = vi.spyOn(app.get(NotificacionService), 'enviar');

      const objetivo = await crearCuota(prisma, {
        unidadId: activas[0].id,
        periodo: '2030-01',
        monto: 45,
        fechaVencimiento: sumarDias(hoy, 3),
      });
      await crearCuota(prisma, {
        unidadId: activas[1].id,
        periodo: '2030-01',
        monto: 45,
        fechaVencimiento: sumarDias(hoy, 3),
        estado: EstadoCuota.PAGADA,
      });
      await crearCuota(prisma, {
        unidadId: activas[2].id,
        periodo: '2030-01',
        monto: 45,
        fechaVencimiento: sumarDias(hoy, 2),
      });
      await crearCuota(prisma, {
        unidadId: activas[2].id,
        periodo: '2030-02',
        monto: 45,
        fechaVencimiento: sumarDias(hoy, 4),
      });

      const servicio = app.get(AvisoCuotasService);
      expect(await servicio.avisarPorVencer()).toBe(1);
      expect(enviar).toHaveBeenCalledTimes(1);
      expect(enviar).toHaveBeenCalledWith(
        expect.objectContaining({
          destinatario: { tipo: 'UNIDAD', id: activas[0].id },
          titulo: 'Tu cuota vence pronto',
          moduloOrigen: 'PAGOS',
        }),
      );
      expect(await prisma.avisoCuota.findMany()).toEqual([
        expect.objectContaining({ cuotaId: objetivo.id, tipo: 'POR_VENCER' }),
      ]);

      // Segunda corrida el mismo día: no reenvía.
      expect(await servicio.avisarPorVencer()).toBe(0);
      expect(enviar).toHaveBeenCalledTimes(1);
      enviar.mockRestore();
    });

    it('si el envío falla no queda registrado el aviso', async () => {
      const { activas } = await unidades();
      await crearCuota(prisma, {
        unidadId: activas[0].id,
        periodo: '2030-01',
        monto: 45,
        fechaVencimiento: sumarDias(hoyEnZonaNegocio(), 3),
      });
      const enviar = vi
        .spyOn(app.get(NotificacionService), 'enviar')
        .mockRejectedValueOnce(new Error('caído'));

      expect(await app.get(AvisoCuotasService).avisarPorVencer()).toBe(0);
      expect(await prisma.avisoCuota.count()).toBe(0);
      enviar.mockRestore();
    });
  });
});
