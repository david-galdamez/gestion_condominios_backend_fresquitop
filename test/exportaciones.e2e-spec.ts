import { inflateSync } from 'node:zlib';
import type { INestApplication } from '@nestjs/common';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { hoyEnZonaNegocio, sumarDias } from '@Common/fechas';
import { PrismaService } from '@Prisma/services';
import { EstadoCuota, EstadoReserva, Rol } from '@PrismaClient';
import { crearApp } from './helpers/app.js';
import {
  crearArea,
  crearCuota,
  crearTorre,
  crearUnidad,
  crearUsuario,
  limpiarTablas,
  login,
} from './helpers/fixtures.js';

const URL = '/api/v1/admin/reportescondominio/exportar';
const PANEL = '/api/v1/admin/panel';
const hoy = () => hoyEnZonaNegocio();
const hora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const usd = new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' });
const pct = (n: number) =>
  `${new Intl.NumberFormat('es-SV', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)} %`;

/** Texto de un PDF de pdfkit: descomprime cada stream y decodifica los fragmentos <hex> (Latin-1). */
function textoDelPdf(pdf: Buffer): string {
  const crudo = pdf.toString('latin1');
  const partes: string[] = [];
  for (const m of crudo.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let contenido: string;
    try {
      contenido = inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
    } catch {
      contenido = m[1];
    }
    for (const [, hex] of contenido.matchAll(/<([0-9a-f]+)>/gi))
      partes.push(Buffer.from(hex, 'hex').toString('latin1'));
  }
  return partes.join('');
}

async function textoDelExcel(archivo: Buffer) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(archivo as unknown as ArrayBuffer);
  const celdas: string[] = [];
  libro.eachSheet((h) => h.eachRow((f) => f.eachCell((c) => celdas.push(c.text))));
  return { hojas: libro.worksheets.map((h) => h.name), texto: celdas.join('|') };
}

/** supertest no junta los binarios por defecto. */
const binario = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const partes: Buffer[] = [];
  res.on('data', (c: Buffer) => partes.push(c));
  res.on('end', () => cb(null, Buffer.concat(partes)));
};

describe('Exportar el reporte para la mesa directiva (H20)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const auth = (req: request.Test, token: string | null) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  const exportar = (token: string | null, query: Record<string, string>) =>
    auth(request(app.getHttpServer()).get(URL).query(query), token).buffer(true).parse(binario);
  const periodo = () => ({ desde: sumarDias(hoy(), -29), hasta: hoy() });

  async function escenario() {
    const torre = await crearTorre(prisma);
    const u1 = await crearUnidad(prisma, torre.id, 'A-101');
    const u2 = await crearUnidad(prisma, torre.id, 'A-102');
    await crearUnidad(prisma, torre.id, 'A-103');

    await crearUsuario(prisma, 'admin-exp@test.com', { rol: Rol.ADMINISTRADOR });
    await prisma.user.update({ where: { email: 'admin-exp@test.com' }, data: { nombre: 'Ana Administradora' } });
    const residente = await crearUsuario(prisma, 'moroso@test.com', { unidadIds: [u1.id] });
    await prisma.user.update({ where: { id: residente.id }, data: { nombre: 'Residente Moroso' } });
    await crearUsuario(prisma, 'seg-exp@test.com', { rol: Rol.SEGURIDAD });

    const venc = { estado: EstadoCuota.VENCIDA, fechaVencimiento: sumarDias(hoy(), -40) };
    await crearCuota(prisma, { unidadId: u1.id, periodo: '2026-01', monto: '100.50', ...venc });
    await crearCuota(prisma, { unidadId: u1.id, periodo: '2026-02', monto: '50.00', ...venc });
    await crearCuota(prisma, { unidadId: u2.id, periodo: '2026-01', monto: '80.00', ...venc });

    const alberca = await crearArea(prisma, { nombre: 'Alberca', horaApertura: '07:00', horaCierre: '20:00' });
    await prisma.reserva.create({
      data: {
        codigo: 'RES-900001',
        areaId: alberca.id,
        unidadId: u1.id,
        residenteId: residente.id,
        fecha: dia(sumarDias(hoy(), -3)),
        horaInicio: hora('09:00'),
        horaFin: hora('12:00'),
        asistentes: 5,
        estado: EstadoReserva.CONFIRMADA,
      },
    });

    return {
      tAdmin: await login(app, 'admin-exp@test.com'),
      tRes: await login(app, 'moroso@test.com'),
      tSeg: await login(app, 'seg-exp@test.com'),
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

  it('PDF: mismos valores que el panel para el mismo periodo, encabezado completo y fila de auditoría', async () => {
    const { tAdmin } = await escenario();
    const { desde, hasta } = periodo();
    const panel = (await auth(request(app.getHttpServer()).get(PANEL).query({ desde, hasta }), tAdmin).expect(200))
      .body;

    const res = await exportar(tAdmin, { formato: 'PDF', version: 'RESUMIDA', desde, hasta }).expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="reporte-condominio-${hoy()}.pdf"`);

    const texto = textoDelPdf(res.body as Buffer);
    const esperados = [
      usd.format(panel.mora.monto),
      pct(panel.mora.porcentajeMorosas),
      `${panel.mora.unidadesMorosas} unidades con cuotas vencidas`,
      ...panel.ocupacion.map((o: { area: string; porcentaje: number }) => pct(o.porcentaje)),
      panel.areaMasUsada,
      'Ana Administradora',
      `${desde.split('-').reverse().join('/')} al ${hasta.split('-').reverse().join('/')}`,
      'hora de El Salvador',
    ];
    for (const e of esperados) expect(texto).toContain(e);
    expect(panel.mora.monto).toBe(230.5);

    const auditoria = await prisma.exportacion.findMany();
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]).toMatchObject({
      formato: 'PDF',
      version: 'RESUMIDA',
      periodoDesde: dia(desde),
      periodoHasta: dia(hasta),
    });
  });

  it('la versión resumida no contiene ningún número de unidad ni nombre (PDF y Excel)', async () => {
    const { tAdmin } = await escenario();
    for (const formato of ['PDF', 'EXCEL']) {
      const res = await exportar(tAdmin, { formato, version: 'RESUMIDA', ...periodo() }).expect(200);
      const texto =
        formato === 'PDF' ? textoDelPdf(res.body as Buffer) : (await textoDelExcel(res.body as Buffer)).texto;
      expect(texto).toContain('Alberca');
      for (const prohibido of ['A-101', 'A-102', 'Residente Moroso']) expect(texto).not.toContain(prohibido);
    }
  });

  it('la versión detallada agrega la morosidad por unidad (PDF y Excel)', async () => {
    const { tAdmin } = await escenario();
    const pdf = await exportar(tAdmin, { formato: 'PDF', version: 'DETALLADA', ...periodo() }).expect(200);
    const textoPdf = textoDelPdf(pdf.body as Buffer);
    expect(textoPdf).toContain('Morosidad por unidad');
    expect(textoPdf).toContain('A-101');
    expect(textoPdf).toContain('$150.50');

    const xlsx = await exportar(tAdmin, { formato: 'EXCEL', version: 'DETALLADA', ...periodo() }).expect(200);
    expect(xlsx.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(xlsx.headers['content-disposition']).toContain('.xlsx');
    const { hojas, texto } = await textoDelExcel(xlsx.body as Buffer);
    expect(hojas).toEqual(['Resumen', 'Morosidad por unidad']);
    expect(texto).toContain('A-101');
    expect(texto).toContain('A-102');
    expect(texto).not.toContain('Residente Moroso');
    expect(await prisma.exportacion.count()).toBe(2);
  });

  it('sin desde o hasta -> 400 "Selecciona un periodo" y no se registra nada', async () => {
    const { tAdmin } = await escenario();
    for (const query of [{ hasta: hoy() }, { desde: hoy() }, {}] as Record<string, string>[]) {
      const res = await exportar(tAdmin, { formato: 'PDF', version: 'RESUMIDA', ...query }).expect(400);
      expect(JSON.parse((res.body as Buffer).toString()).message).toContain('Selecciona un periodo');
    }
    const invertido = await exportar(tAdmin, {
      formato: 'PDF',
      version: 'RESUMIDA',
      desde: hoy(),
      hasta: sumarDias(hoy(), -1),
    }).expect(400);
    expect(JSON.parse((invertido.body as Buffer).toString()).message).toContain('desde no puede ser posterior a hasta');
    await exportar(tAdmin, { formato: 'CSV', version: 'RESUMIDA', ...periodo() }).expect(400);
    expect(await prisma.exportacion.count()).toBe(0);
  });

  it('residente y seguridad -> 403; sin sesión -> 401', async () => {
    const { tRes, tSeg } = await escenario();
    const query = { formato: 'PDF', version: 'RESUMIDA', ...periodo() };
    const res = await exportar(tRes, query).expect(403);
    expect(JSON.parse((res.body as Buffer).toString()).message).toBe('No tienes permiso para esta acción');
    await exportar(tSeg, query).expect(403);
    await exportar(null, query).expect(401);
    expect(await prisma.exportacion.count()).toBe(0);
  });
});
