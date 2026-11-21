import PDFDocument from 'pdfkit';
import type { ReporteDocumento } from './reporte-documento.js';

type Pdf = PDFKit.PDFDocument;

const MARGEN = 50;
const COLOR = {
  texto: '#18181b',
  suave: '#52525b',
  borde: '#d4d4d8',
  fondoBarra: '#e4e4e7',
  fondoTabla: '#f4f4f5',
  ocupacion: '#0284c7',
  incidencias: '#d97706',
  participacion: '#059669',
};

/**
 * BE-20.1 · PDF A4 con encabezado, indicadores y gráficos de barras dibujados
 * con primitivas de pdfkit (sin dependencias de navegador). `comprimir: false`
 * deja el contenido legible para las pruebas.
 */
export function generarPdf(doc: ReporteDocumento, { comprimir = true } = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const administrador = doc.encabezado.find((e) => e.etiqueta === 'Administrador')?.valor ?? '';
    const pdf = new PDFDocument({
      size: 'A4',
      margin: MARGEN,
      bufferPages: true,
      compress: comprimir,
      info: { Title: doc.titulo, Author: administrador, Subject: 'Reporte para la mesa directiva' },
    });
    const partes: Buffer[] = [];
    pdf.on('data', (c: Buffer) => partes.push(c));
    pdf.on('end', () => resolve(Buffer.concat(partes)));
    pdf.on('error', reject);

    try {
      dibujar(pdf, doc);
      numerarPaginas(pdf, doc.titulo);
      pdf.end();
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

const anchoUtil = (pdf: Pdf) => pdf.page.width - MARGEN * 2;
const limiteInferior = (pdf: Pdf) => pdf.page.height - MARGEN - 20;

/** Salta de página si lo que sigue (alto `h`) no cabe. */
function asegurarEspacio(pdf: Pdf, h: number) {
  if (pdf.y + h > limiteInferior(pdf)) pdf.addPage();
}

function dibujar(pdf: Pdf, doc: ReporteDocumento) {
  pdf.fillColor(COLOR.texto).font('Helvetica-Bold').fontSize(18).text(doc.titulo, MARGEN, MARGEN);
  pdf.moveDown(0.4);
  for (const { etiqueta, valor } of doc.encabezado) {
    pdf.font('Helvetica-Bold').fontSize(10).fillColor(COLOR.suave).text(`${etiqueta}: `, { continued: true });
    pdf.font('Helvetica').fillColor(COLOR.texto).text(valor);
  }

  seccion(pdf, 'Indicadores principales');
  indicadores(pdf, doc.indicadores);

  seccion(pdf, 'Ocupación de áreas comunes');
  if (doc.ocupacion.length === 0) nota(pdf, 'No hay áreas comunes activas.');
  else
    barras(
      pdf,
      doc.ocupacion.map((o) => ({
        etiqueta: o.area,
        proporcion: o.porcentaje / 100,
        texto: o.texto,
        detalle: o.masUsada ? `Más usada · ${o.variacion}` : o.variacion,
      })),
      COLOR.ocupacion,
    );

  seccion(pdf, 'Incidencias por prioridad');
  nota(pdf, `Reportes abiertos y en proceso creados en el periodo · ${doc.variacionIncidencias}`);
  const maxIncidencias = Math.max(0, ...doc.incidencias.map((i) => i.total));
  barras(
    pdf,
    doc.incidencias.map((i) => ({
      etiqueta: i.prioridad,
      proporcion: maxIncidencias === 0 ? 0 : i.total / maxIncidencias,
      texto: String(i.total),
    })),
    COLOR.incidencias,
  );

  seccion(pdf, 'Participación en asambleas');
  nota(pdf, 'Últimas 3 asambleas cerradas en el periodo');
  if (doc.participacion.length === 0) nota(pdf, 'No hubo asambleas cerradas en este periodo.');
  else
    barras(
      pdf,
      doc.participacion.map((p) => ({ etiqueta: p.asamblea, proporcion: p.porcentaje / 100, texto: p.texto })),
      COLOR.participacion,
    );

  if (doc.morosidadPorUnidad) {
    seccion(pdf, 'Morosidad por unidad');
    if (doc.morosidadPorUnidad.length === 0) nota(pdf, 'No hay unidades morosas.');
    else
      tabla(
        pdf,
        ['Unidad', 'Cuotas vencidas', 'Monto adeudado', 'Vencida más antigua'],
        doc.morosidadPorUnidad.map((m) => [m.unidad, String(m.cuotasVencidas), m.monto, m.vencidaMasAntigua]),
      );
  }
}

function seccion(pdf: Pdf, titulo: string) {
  asegurarEspacio(pdf, 70);
  pdf.moveDown(1.2);
  const y = pdf.y;
  pdf.font('Helvetica-Bold').fontSize(13).fillColor(COLOR.texto).text(titulo, MARGEN, y);
  pdf
    .moveTo(MARGEN, pdf.y + 2)
    .lineTo(MARGEN + anchoUtil(pdf), pdf.y + 2)
    .lineWidth(0.5)
    .strokeColor(COLOR.borde)
    .stroke();
  pdf.moveDown(0.6);
}

function nota(pdf: Pdf, texto: string) {
  pdf
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLOR.suave)
    .text(texto, MARGEN, pdf.y, { width: anchoUtil(pdf) });
  pdf.moveDown(0.4);
}

/** Tarjetas en una grilla de 2 columnas. */
function indicadores(pdf: Pdf, items: ReporteDocumento['indicadores']) {
  const gap = 12;
  const ancho = (anchoUtil(pdf) - gap) / 2;
  const alto = 62;
  for (let i = 0; i < items.length; i += 2) {
    asegurarEspacio(pdf, alto + gap);
    const y = pdf.y;
    items.slice(i, i + 2).forEach((item, j) => {
      const x = MARGEN + j * (ancho + gap);
      pdf.roundedRect(x, y, ancho, alto, 6).lineWidth(0.75).strokeColor(COLOR.borde).stroke();
      pdf
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COLOR.suave)
        .text(item.etiqueta, x + 10, y + 8, { width: ancho - 20 });
      pdf
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor(COLOR.texto)
        .text(item.texto, x + 10, y + 21, { width: ancho - 20, lineBreak: false, ellipsis: true });
      pdf
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLOR.suave)
        .text(item.detalle, x + 10, y + 44, {
          width: ancho - 20,
          lineBreak: false,
          ellipsis: true,
        });
    });
    pdf.y = y + alto + gap;
  }
}

/** Gráfico de barras horizontales: etiqueta, barra proporcional y valor. */
function barras(
  pdf: Pdf,
  items: { etiqueta: string; proporcion: number; texto: string; detalle?: string }[],
  color: string,
) {
  const anchoEtiqueta = 150;
  const anchoValor = 60;
  const anchoBarra = anchoUtil(pdf) - anchoEtiqueta - anchoValor - 20;
  for (const item of items) {
    const alto = item.detalle ? 30 : 20;
    asegurarEspacio(pdf, alto);
    const y = pdf.y;
    pdf
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COLOR.texto)
      .text(item.etiqueta, MARGEN, y + 1, { width: anchoEtiqueta, lineBreak: false, ellipsis: true });
    const xBarra = MARGEN + anchoEtiqueta + 10;
    pdf
      .roundedRect(xBarra, y + 2, anchoBarra, 9, 4)
      .fillColor(COLOR.fondoBarra)
      .fill();
    const lleno = Math.max(0, Math.min(1, item.proporcion)) * anchoBarra;
    if (lleno > 0)
      pdf
        .roundedRect(xBarra, y + 2, Math.max(lleno, 4), 9, 4)
        .fillColor(color)
        .fill();
    pdf
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(COLOR.texto)
      .text(item.texto, xBarra + anchoBarra + 10, y + 1, { width: anchoValor, align: 'right', lineBreak: false });
    if (item.detalle) {
      pdf
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLOR.suave)
        .text(item.detalle, xBarra, y + 15, { width: anchoBarra, lineBreak: false, ellipsis: true });
    }
    pdf.y = y + alto;
  }
}

/** Tabla simple; repite el encabezado al saltar de página. */
function tabla(pdf: Pdf, columnas: string[], filas: string[][]) {
  const ancho = anchoUtil(pdf) / columnas.length;
  const alto = 18;
  const fila = (valores: string[], negrita: boolean) => {
    const y = pdf.y;
    if (negrita) pdf.rect(MARGEN, y, anchoUtil(pdf), alto).fillColor(COLOR.fondoTabla).fill();
    valores.forEach((v, i) =>
      pdf
        .font(negrita ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(9)
        .fillColor(COLOR.texto)
        .text(v, MARGEN + i * ancho + 6, y + 5, { width: ancho - 12, lineBreak: false, ellipsis: true }),
    );
    pdf
      .moveTo(MARGEN, y + alto)
      .lineTo(MARGEN + anchoUtil(pdf), y + alto)
      .lineWidth(0.5)
      .strokeColor(COLOR.borde)
      .stroke();
    pdf.y = y + alto;
  };

  asegurarEspacio(pdf, alto * 2);
  fila(columnas, true);
  for (const valores of filas) {
    if (pdf.y + alto > limiteInferior(pdf)) {
      pdf.addPage();
      fila(columnas, true);
    }
    fila(valores, false);
  }
}

/** "Página i de n" al pie de cada página (requiere bufferPages). */
function numerarPaginas(pdf: Pdf, titulo: string) {
  const { start, count } = pdf.bufferedPageRange();
  for (let i = start; i < start + count; i++) {
    pdf.switchToPage(i);
    // Escribir dentro del margen inferior no debe crear otra página.
    const margenInferior = pdf.page.margins.bottom;
    pdf.page.margins.bottom = 0;
    pdf
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLOR.suave)
      .text(`${titulo} · Página ${i - start + 1} de ${count}`, MARGEN, pdf.page.height - MARGEN + 10, {
        width: anchoUtil(pdf),
        align: 'center',
        lineBreak: false,
      });
    pdf.page.margins.bottom = margenInferior;
  }
}
