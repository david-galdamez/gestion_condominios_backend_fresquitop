import ExcelJS from 'exceljs';
import type { PanelResponseDto } from '@Panel/dto';
import { construirDocumento, formatVariacion, type DatosReporte } from './reporte-documento.js';
import { generarExcel } from './reporte-excel.js';
import { generarPdf } from './reporte-pdf.js';

const panel: PanelResponseDto = {
  mora: { monto: 1350, unidadesMorosas: 9, porcentajeMorosas: 30 },
  ocupacion: [
    { area: 'Alberca', porcentaje: 42.5, cambio: 5.2 },
    { area: 'Gimnasio', porcentaje: 10, cambio: null },
  ],
  areaMasUsada: 'Alberca',
  incidencias: { ALTA: 2, MEDIA: 4, BAJA: 1, SIN_ASIGNAR: 3, cambio: -10 },
  participacion: [{ asamblea: 'Asamblea ordinaria de noviembre', porcentaje: 70 }],
  generadoEn: '2026-11-20T18:00:00.000Z',
};

const morosidad = [
  { unidad: 'A-101', cuotasVencidas: 3, montoAdeudado: 135, vencidaMasAntigua: '2026-08-10' },
  { unidad: 'B-205', cuotasVencidas: 1, montoAdeudado: 45, vencidaMasAntigua: '2026-10-10' },
];

const datos = (extra: Partial<DatosReporte> = {}): DatosReporte => ({
  panel,
  morosidad,
  version: 'RESUMIDA',
  desde: '2026-11-01',
  hasta: '2026-11-30',
  administrador: 'Ana Administradora',
  // 18:30 UTC = 12:30 en El Salvador.
  generadoEn: new Date('2026-11-20T18:30:00.000Z'),
  ...extra,
});

/** Texto de un PDF sin comprimir: pdfkit escribe cada fragmento como <hex> en Latin-1. */
function textoDelPdf(pdf: Buffer): string {
  return [...pdf.toString('latin1').matchAll(/<([0-9a-f]+)>/gi)]
    .map(([, hex]) => Buffer.from(hex, 'hex').toString('latin1'))
    .join('');
}

async function textoDelExcel(archivo: Buffer): Promise<{ hojas: string[]; texto: string }> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(archivo as unknown as ArrayBuffer);
  const celdas: string[] = [];
  libro.eachSheet((hoja) => hoja.eachRow((fila) => fila.eachCell((c) => celdas.push(c.text))));
  return { hojas: libro.worksheets.map((h) => h.name), texto: celdas.join('|') };
}

describe('Reporte del condominio (H20)', () => {
  describe('construirDocumento', () => {
    it('encabezado con periodo, fecha y hora de generación y administrador', () => {
      const doc = construirDocumento(datos());
      expect(doc.encabezado).toEqual([
        { etiqueta: 'Periodo', valor: '01/11/2026 al 30/11/2026' },
        { etiqueta: 'Generado', valor: expect.stringMatching(/^20\/11\/2026,? 12:30 \(hora de El Salvador\)$/) },
        { etiqueta: 'Administrador', valor: 'Ana Administradora' },
        { etiqueta: 'Versión', valor: 'Resumida (solo totales)' },
      ]);
    });

    it('mismos valores y formatos que el panel', () => {
      const doc = construirDocumento(datos());
      expect(doc.indicadores.map((i) => i.texto)).toEqual(['$1,350.00', '30.0 %', '10', 'Alberca']);
      expect(doc.ocupacion[0]).toMatchObject({
        texto: '42.5 %',
        variacion: '+5.2 % vs. periodo anterior',
        masUsada: true,
      });
      expect(doc.ocupacion[1].variacion).toBe('Sin base de comparación');
      expect(doc.variacionIncidencias).toBe('-10.0 % vs. periodo anterior');
      expect(doc.participacion[0].texto).toBe('70.0 %');
    });

    it('RESUMIDA no trae la morosidad por unidad; DETALLADA sí', () => {
      expect(construirDocumento(datos()).morosidadPorUnidad).toBeNull();
      expect(construirDocumento(datos({ version: 'DETALLADA' })).morosidadPorUnidad).toEqual([
        { unidad: 'A-101', cuotasVencidas: 3, montoAdeudado: 135, monto: '$135.00', vencidaMasAntigua: '10/08/2026' },
        { unidad: 'B-205', cuotasVencidas: 1, montoAdeudado: 45, monto: '$45.00', vencidaMasAntigua: '10/10/2026' },
      ]);
    });

    it('formatVariacion', () => {
      expect(formatVariacion(0)).toBe('0.0 % vs. periodo anterior');
      expect(formatVariacion(null)).toBe('Sin base de comparación');
    });
  });

  describe('PDF', () => {
    it('genera un PDF con el encabezado, los indicadores y sin unidades en la versión resumida', async () => {
      const pdf = await generarPdf(construirDocumento(datos()), { comprimir: false });
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      const texto = textoDelPdf(pdf);
      for (const esperado of ['01/11/2026 al 30/11/2026', 'Ana Administradora', '$1,350.00', '42.5 %', 'Alberca']) {
        expect(texto).toContain(esperado);
      }
      expect(texto).not.toContain('A-101');
      expect(texto).not.toContain('Morosidad por unidad');
    });

    it('la versión detallada agrega la tabla de morosidad por unidad', async () => {
      const texto = textoDelPdf(
        await generarPdf(construirDocumento(datos({ version: 'DETALLADA' })), { comprimir: false }),
      );
      expect(texto).toContain('Morosidad por unidad');
      expect(texto).toContain('A-101');
      expect(texto).toContain('$135.00');
    });

    it('muchas unidades morosas: pagina la tabla sin fallar', async () => {
      const muchas = Array.from({ length: 120 }, (_, i) => ({
        unidad: `C-${String(i).padStart(3, '0')}`,
        cuotasVencidas: 1,
        montoAdeudado: 45,
        vencidaMasAntigua: '2026-10-10',
      }));
      const texto = textoDelPdf(
        await generarPdf(construirDocumento(datos({ version: 'DETALLADA', morosidad: muchas })), { comprimir: false }),
      );
      expect(texto).toContain('C-119');
      expect(texto).toMatch(/Página 3 de \d/);
    });
  });

  describe('Excel', () => {
    it('RESUMIDA: una hoja con los indicadores y sin unidades', async () => {
      const { hojas, texto } = await textoDelExcel(await generarExcel(construirDocumento(datos())));
      expect(hojas).toEqual(['Resumen']);
      expect(texto).toContain('Ana Administradora');
      expect(texto).toContain('1350');
      expect(texto).toContain('Alberca (más usada)');
      expect(texto).not.toContain('A-101');
    });

    it('DETALLADA: agrega la hoja "Morosidad por unidad"', async () => {
      const { hojas, texto } = await textoDelExcel(
        await generarExcel(construirDocumento(datos({ version: 'DETALLADA' }))),
      );
      expect(hojas).toEqual(['Resumen', 'Morosidad por unidad']);
      expect(texto).toContain('A-101');
    });
  });
});
