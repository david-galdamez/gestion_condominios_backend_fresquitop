import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hoyEnZonaNegocio, sumarDias } from '@Common/fechas';
import { PrismaService } from '@Prisma/services';
import { EstadoAutorizacion, Rol } from '@PrismaClient';
import { crearApp } from './helpers/app.js';
import { crearAutorizacion, crearTorre, crearUnidad, crearUsuario, limpiarTablas, login } from './helpers/fixtures.js';

const ENTRADA = '/api/v1/accesos/entrada';
const salida = (id: string) => `/api/v1/accesos/${id}/salida`;

describe('Accesos H08 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let guardia: string;
  let unidadId: string;
  let residenteId: string;

  const http = () => request(app.getHttpServer());
  const entrar = (body: object, token = guardia) =>
    http().post(ENTRADA).set('Authorization', `Bearer ${token}`).send(body);
  const salir = (id: string, token = guardia) => http().patch(salida(id)).set('Authorization', `Bearer ${token}`);

  const sinCodigo = (extra: object = {}) => ({
    nombre: 'Ana López',
    tipoDocumento: 'DUI',
    numeroDocumento: '01234567-8',
    unidadId,
    motivo: 'Entrega de documentos',
    ...extra,
  });

  const autorizacion = (codigo: string, extra: { fechaVisita?: string; estado?: EstadoAutorizacion } = {}) =>
    crearAutorizacion(prisma, {
      unidadId,
      residenteId,
      codigo,
      fechaVisita: extra.fechaVisita ?? hoyEnZonaNegocio(),
      estado: extra.estado,
      nombre: 'María Pérez',
    });

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limpiarTablas(prisma);
    const torre = await crearTorre(prisma);
    const unidad = await crearUnidad(prisma, torre.id, 'A-101');
    unidadId = unidad.id;
    residenteId = (await crearUsuario(prisma, 'res@test.com', { unidadIds: [unidadId] })).id;
    await crearUsuario(prisma, 'guardia@test.com', { rol: Rol.SEGURIDAD });
    guardia = await login(app, 'guardia@test.com');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('entrada con código', () => {
    it('código vigente de hoy: 201, queda DENTRO y la autorización pasa a USADA', async () => {
      const a = await autorizacion('048213');
      const res = await entrar({ codigo: '048213' }).expect(201);
      expect(res.body).toMatchObject({
        nombre: 'María Pérez',
        unidad: 'A-101',
        preautorizado: true,
        estado: 'DENTRO',
        motivo: null,
        horaSalida: null,
      });
      expect(Date.parse(res.body.horaEntrada)).not.toBeNaN();
      expect((await prisma.autorizacionVisita.findUniqueOrThrow({ where: { id: a.id } })).estado).toBe('USADA');
      const registro = await prisma.registroAcceso.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(registro.autorizacionId).toBe(a.id);
    });

    it('el mismo código otra vez responde 409 "Código no válido: está usado"', async () => {
      await autorizacion('048213');
      await entrar({ codigo: '048213' }).expect(201);
      const res = await entrar({ codigo: '048213' }).expect(409);
      expect(res.body.message).toBe('Código no válido: está usado');
      expect(await prisma.registroAcceso.count()).toBe(1);
    });

    it.each([
      [EstadoAutorizacion.CANCELADA, 'Código no válido: está cancelado'],
      [EstadoAutorizacion.VENCIDA, 'Código no válido: está vencido'],
    ])('código %s responde 409 y no registra', async (estado, mensaje) => {
      await autorizacion('111111', { estado });
      const res = await entrar({ codigo: '111111' }).expect(409);
      expect(res.body.message).toBe(mensaje);
      expect(await prisma.registroAcceso.count()).toBe(0);
    });

    it('código vencido de un día anterior responde 409 "está vencido"', async () => {
      await autorizacion('222222', { fechaVisita: sumarDias(hoyEnZonaNegocio(), -1), estado: EstadoAutorizacion.VENCIDA });
      const res = await entrar({ codigo: '222222' }).expect(409);
      expect(res.body.message).toBe('Código no válido: está vencido');
    });

    it('código vigente de otra fecha responde 409', async () => {
      await autorizacion('333333', { fechaVisita: sumarDias(hoyEnZonaNegocio(), 2) });
      const res = await entrar({ codigo: '333333' }).expect(409);
      expect(res.body.message).toBe('Código no válido: es para otra fecha');
    });

    it('código inexistente responde 404', async () => {
      await entrar({ codigo: '999999' }).expect(404);
    });

    it('dos entradas simultáneas con el mismo código: solo una pasa', async () => {
      await autorizacion('444444');
      const [a, b] = await Promise.all([entrar({ codigo: '444444' }), entrar({ codigo: '444444' })]);
      expect([a.status, b.status].sort((x, y) => x - y)).toEqual([201, 409]);
      expect(await prisma.registroAcceso.count()).toBe(1);
    });
  });

  describe('entrada sin pre-autorización', () => {
    it('201 con preautorizado = false y el motivo', async () => {
      const res = await entrar(sinCodigo()).expect(201);
      expect(res.body).toMatchObject({ preautorizado: false, estado: 'DENTRO', motivo: 'Entrega de documentos' });
    });

    it('motivo fuera de 5 a 100 caracteres responde 400', async () => {
      const res = await entrar(sinCodigo({ motivo: 'Hola' })).expect(400);
      expect(res.body.message).toContain('El motivo debe tener entre 5 y 100 caracteres');
    });

    it('unidad inexistente responde 404', async () => {
      await entrar(sinCodigo({ unidadId: '6f1c2b0e-8a54-4a8e-9d1b-1f0f3c2a7b11' })).expect(404);
    });

    it('código junto con datos responde 400', async () => {
      await entrar({ codigo: '048213', nombre: 'Ana López' }).expect(400);
    });
  });

  describe('salida', () => {
    it('guarda la hora en el mismo registro y pasa a SALIO; una segunda salida responde 409', async () => {
      const { body } = await entrar(sinCodigo()).expect(201);
      const res = await salir(body.id).expect(200);
      expect(res.body).toMatchObject({ id: body.id, estado: 'SALIO' });
      expect(Date.parse(res.body.horaSalida)).toBeGreaterThanOrEqual(Date.parse(body.horaEntrada));
      expect(await prisma.registroAcceso.count()).toBe(1);

      const otra = await salir(body.id).expect(409);
      expect(otra.body.message).toBe('Este visitante ya registró su salida');
    });

    it('registro inexistente 404 e id inválido 400', async () => {
      await salir('6f1c2b0e-8a54-4a8e-9d1b-1f0f3c2a7b11').expect(404);
      await salir('no-es-uuid').expect(400);
    });
  });

  describe('búsquedas de portería', () => {
    it('autorizaciones de hoy por código o documento, sin las de otros días', async () => {
      await autorizacion('048213');
      await autorizacion('048214', { fechaVisita: sumarDias(hoyEnZonaNegocio(), 1) });

      const porCodigo = await http()
        .get('/api/v1/autorizaciones/buscar')
        .query({ q: '048213' })
        .set('Authorization', `Bearer ${guardia}`)
        .expect(200);
      expect(porCodigo.body.datos).toHaveLength(1);
      expect(porCodigo.body.datos[0]).toMatchObject({ codigo: '048213', estado: 'VIGENTE', unidad: { codigo: 'A-101' } });

      const porDocumento = await http()
        .get('/api/v1/autorizaciones/buscar')
        .query({ q: '01234567-8' })
        .set('Authorization', `Bearer ${guardia}`)
        .expect(200);
      expect(porDocumento.body.datos.map((a: { codigo: string }) => a.codigo)).toEqual(['048213']);
    });

    it('visitantes dentro por documento o por el código con que entraron', async () => {
      await autorizacion('048213');
      await entrar({ codigo: '048213' }).expect(201);
      const { body: otro } = await entrar(sinCodigo({ numeroDocumento: '07654321-0' })).expect(201);
      await salir(otro.id).expect(200);

      const porCodigo = await http()
        .get('/api/v1/accesos/buscar')
        .query({ q: '048213' })
        .set('Authorization', `Bearer ${guardia}`)
        .expect(200);
      expect(porCodigo.body.datos).toHaveLength(1);

      // El que ya salió no aparece.
      const yaSalio = await http()
        .get('/api/v1/accesos/buscar')
        .query({ q: '07654321-0' })
        .set('Authorization', `Bearer ${guardia}`)
        .expect(200);
      expect(yaSalio.body.datos).toEqual([]);
    });
  });

  describe('permisos', () => {
    it.each([Rol.RESIDENTE, Rol.ADMINISTRADOR])('%s recibe 403 "No tienes permiso para esta acción"', async (rol) => {
      await crearUsuario(prisma, 'otro@test.com', { rol });
      const token = await login(app, 'otro@test.com');
      const res = await entrar(sinCodigo(), token).expect(403);
      expect(res.body.message).toBe('No tienes permiso para esta acción');
      await salir('6f1c2b0e-8a54-4a8e-9d1b-1f0f3c2a7b11', token).expect(403);
      await http().get('/api/v1/autorizaciones/buscar').query({ q: '048213' }).set('Authorization', `Bearer ${token}`).expect(403);
    });

    it('sin sesión responde 401', async () => {
      await http().post(ENTRADA).send(sinCodigo()).expect(401);
    });

    it('las rutas de residentes de H07 siguen funcionando', async () => {
      const token = await login(app, 'res@test.com');
      await http().get('/api/v1/autorizaciones/mias').set('Authorization', `Bearer ${token}`).expect(200);
    });
  });
});
