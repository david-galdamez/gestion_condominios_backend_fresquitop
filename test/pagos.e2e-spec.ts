import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@Prisma/services';
import { EstadoCuota, Rol } from '@PrismaClient';
import { crearApp } from './helpers/app.js';
import { crearCuota, crearTorre, crearUnidad, crearUsuario, limpiarTablas, login } from './helpers/fixtures.js';

const URL = '/api/v1/pagos';
const APRUEBA = '4242 4242 4242 4242';
const FONDOS = '4000000000000002';
const MSG_PERMISO = 'No tienes permiso para esta acción';

describe('Pagos con tarjeta (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const auth = (req: request.Test, token: string | null) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  const tarjeta = (numero = APRUEBA, extra: object = {}) => ({
    numero,
    vencimiento: '12/39',
    cvv: '123',
    titular: 'Residente Uno',
    ...extra,
  });
  const pagar = (token: string | null, cuotaIds: string[], opts: { clave?: string | null; tarjeta?: object } = {}) => {
    let req = auth(request(app.getHttpServer()).post(URL), token).send({ cuotaIds, tarjeta: opts.tarjeta ?? tarjeta() });
    const clave = opts.clave === undefined ? randomUUID() : opts.clave;
    if (clave) req = req.set('Idempotency-Key', clave);
    return req;
  };
  const estadoDe = async (id: string) => (await prisma.cuota.findUniqueOrThrow({ where: { id } })).estado;

  async function escenario() {
    const torre = await crearTorre(prisma);
    const a101 = await crearUnidad(prisma, torre.id, 'A-101');
    const b205 = await crearUnidad(prisma, torre.id, 'B-205');
    const a102 = await crearUnidad(prisma, torre.id, 'A-102');
    await crearUsuario(prisma, 'r1@test.com', { unidadIds: [a101.id, b205.id] });
    await crearUsuario(prisma, 'r2@test.com', { unidadIds: [a102.id] });
    await crearUsuario(prisma, 'admin@test.com', { rol: Rol.ADMINISTRADOR });
    const cuota = (unidadId: string, periodo: string, estado: EstadoCuota = EstadoCuota.VENCIDA) =>
      crearCuota(prisma, { unidadId, periodo, monto: 45, fechaVencimiento: `${periodo}-10`, estado });
    return {
      a101,
      b205,
      sep: await cuota(a101.id, '2026-09'),
      oct: await cuota(a101.id, '2026-10'),
      nov: await cuota(a101.id, '2026-11', EstadoCuota.PENDIENTE),
      ago: await cuota(a101.id, '2026-08', EstadoCuota.PAGADA),
      deB205: await cuota(b205.id, '2026-10'),
      ajena: await cuota(a102.id, '2026-10'),
      t1: await login(app, 'r1@test.com'),
      t2: await login(app, 'r2@test.com'),
      tAdmin: await login(app, 'admin@test.com'),
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

  describe('POST /pagos', () => {
    it('4242: 201, cuotas PAGADA con pagada_en, comprobante y nada de la tarjeta completa en la base', async () => {
      const { t1, sep, oct, nov } = await escenario();
      const res = await pagar(t1, [sep.id, oct.id]).expect(201);
      expect(res.body).toMatchObject({ estado: 'APROBADO', monto: 90, ultimos4: '4242' });
      expect(res.body.numeroTransaccion).toMatch(/^TX-\d{8}-\d{6}$/);
      expect(res.body.cuotas.sort()).toEqual([sep.id, oct.id].sort());

      const pagadas = await prisma.cuota.findMany({ where: { id: { in: [sep.id, oct.id] } } });
      for (const c of pagadas) {
        expect(c.estado).toBe('PAGADA');
        expect(c.pagadaEn).not.toBeNull();
      }
      expect(await estadoDe(nov.id)).toBe('PENDIENTE');

      const filas = await prisma.$queryRawUnsafe<object[]>('SELECT row_to_json(p)::text AS fila FROM pago p');
      expect(JSON.stringify(filas)).not.toContain('4242424242424242');
      expect(JSON.stringify(filas)).not.toContain('"123"');
    });

    it('0002: 422 con el motivo, cuotas sin cambio y pago RECHAZADO guardado', async () => {
      const { t1, sep } = await escenario();
      const res = await pagar(t1, [sep.id], { tarjeta: tarjeta(FONDOS) }).expect(422);
      expect(res.body).toMatchObject({ estado: 'RECHAZADO', motivo: 'Fondos insuficientes' });
      expect(res.body.message).toBe('Pago rechazado: fondos insuficientes');
      expect(await estadoDe(sep.id)).toBe('VENCIDA');
      const pago = await prisma.pago.findFirstOrThrow();
      expect(pago).toMatchObject({ estado: 'RECHAZADO', motivo: 'Fondos insuficientes', numeroTransaccion: null });
    });

    it('otra tarjeta: 422 "Tarjeta no reconocida"', async () => {
      const { t1, sep } = await escenario();
      const res = await pagar(t1, [sep.id], { tarjeta: tarjeta('5555555555554444') }).expect(422);
      expect(res.body.motivo).toBe('Tarjeta no reconocida');
    });

    it('doble clic (misma Idempotency-Key): un solo cobro y la misma respuesta', async () => {
      const { t1, sep } = await escenario();
      const clave = randomUUID();
      const [a, b] = await Promise.all([pagar(t1, [sep.id], { clave }), pagar(t1, [sep.id], { clave })]);
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      expect(a.body.numeroTransaccion).toBe(b.body.numeroTransaccion);
      expect(await prisma.pago.count()).toBe(1);
    });

    it('dos solicitudes simultáneas con distinta clave: un solo pago aprobado, la otra 409', async () => {
      const { t1, sep, oct } = await escenario();
      const [a, b] = await Promise.all([pagar(t1, [sep.id, oct.id]), pagar(t1, [oct.id, sep.id])]);
      expect([a.status, b.status].sort((x, y) => x - y)).toEqual([201, 409]);
      expect(await prisma.pago.count({ where: { estado: 'APROBADO' } })).toBe(1);
      expect(await prisma.pagoCuota.count()).toBe(2);
    });

    it('cuota ya PAGADA -> 409 "Esta cuota ya fue pagada" y no se cobra', async () => {
      const { t1, ago, sep } = await escenario();
      const res = await pagar(t1, [sep.id, ago.id]).expect(409);
      expect(res.body.message).toBe('Esta cuota ya fue pagada');
      expect(await estadoDe(sep.id)).toBe('VENCIDA');
      expect(await prisma.pago.count()).toBe(0);
    });

    it('cuota de otra unidad o inexistente -> 404 y no se cobra; mezclar unidades propias -> 400', async () => {
      const { t1, sep, ajena, deB205 } = await escenario();
      await pagar(t1, [ajena.id]).expect(404);
      await pagar(t1, [sep.id, randomUUID()]).expect(404);
      const mix = await pagar(t1, [sep.id, deB205.id]).expect(400);
      expect(mix.body.message).toBe('Las cuotas deben ser de una misma unidad');
      expect(await prisma.pago.count()).toBe(0);
      expect(await estadoDe(ajena.id)).toBe('VENCIDA');
    });

    it('datos inválidos: sin Idempotency-Key, lista vacía, tarjeta mal formada o vencida -> 400', async () => {
      const { t1, sep } = await escenario();
      const sin = await pagar(t1, [sep.id], { clave: null }).expect(400);
      expect(sin.body.message).toBe('Falta el encabezado Idempotency-Key (uuid)');
      await pagar(t1, []).expect(400);
      await pagar(t1, [sep.id], { tarjeta: tarjeta('4242') }).expect(400);
      await pagar(t1, [sep.id], { tarjeta: tarjeta(APRUEBA, { vencimiento: '01/20' }) }).expect(400);
      await pagar(t1, [sep.id], { tarjeta: tarjeta(APRUEBA, { cvv: '12' }) }).expect(400);
      expect(await prisma.pago.count()).toBe(0);
    });

    it('administrador -> 403 con el mensaje; sin token -> 401', async () => {
      const { tAdmin, sep } = await escenario();
      const res = await pagar(tAdmin, [sep.id]).expect(403);
      expect(res.body.message).toBe(MSG_PERMISO);
      await pagar(null, [sep.id]).expect(401);
    });
  });

  describe('GET /pagos/pendientes y /pagos/:numeroTransaccion', () => {
    it('pendientes: solo Pendiente y Vencida de la unidad, de la más antigua a la más nueva', async () => {
      const { t1, a101, b205 } = await escenario();
      let res = await auth(request(app.getHttpServer()).get(`${URL}/pendientes`), t1).expect(200);
      expect(res.body.unidad).toEqual({ id: a101.id, codigo: 'A-101' });
      expect(res.body.cuotas.map((c: { periodo: string }) => c.periodo)).toEqual(['2026-09', '2026-10', '2026-11']);
      res = await auth(request(app.getHttpServer()).get(`${URL}/pendientes?unidadId=${b205.id}`), t1).expect(200);
      expect(res.body.cuotas).toHaveLength(1);
    });

    it('pendientes de una unidad ajena -> 403', async () => {
      const { t2, a101 } = await escenario();
      await auth(request(app.getHttpServer()).get(`${URL}/pendientes?unidadId=${a101.id}`), t2).expect(403);
    });

    it('comprobante: el dueño lo ve; otro residente o un número inexistente -> 404', async () => {
      const { t1, t2, sep } = await escenario();
      const pago = await pagar(t1, [sep.id]).expect(201);
      const ruta = `${URL}/${pago.body.numeroTransaccion}`;
      const res = await auth(request(app.getHttpServer()).get(ruta), t1).expect(200);
      expect(res.body).toMatchObject({
        numeroTransaccion: pago.body.numeroTransaccion,
        monto: 45,
        unidad: 'A-101',
        ultimos4: '4242',
        cuotas: [{ periodo: '2026-09', monto: 45 }],
      });
      await auth(request(app.getHttpServer()).get(ruta), t2).expect(404);
      await auth(request(app.getHttpServer()).get(`${URL}/TX-00000000-000000`), t1).expect(404);
    });
  });
});
