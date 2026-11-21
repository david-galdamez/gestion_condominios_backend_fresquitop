import ExcelJS from 'exceljs';
import type { ReporteDocumento } from './reporte-documento.js';

const FMT_USD = '"$"#,##0.00';
// 42.5 se muestra "42.5 %" igual que el panel (el valor no se multiplica por 100).
const FMT_PORCENTAJE = '0.0" %"';
const NEGRITA = { bold: true };
const FONDO_ENCABEZADO: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };

/**
 * BE-20.2 · Libro de Excel con los mismos indicadores del panel. Los montos y
 * porcentajes van como números con formato, para que la mesa directiva pueda
 * operar con ellos. DETALLADA agrega la hoja "Morosidad por unidad".
 */
export async function generarExcel(doc: ReporteDocumento): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = doc.encabezado.find((e) => e.etiqueta === 'Administrador')?.valor ?? '';
  libro.title = doc.titulo;

  const hoja = libro.addWorksheet('Resumen');
  hoja.columns = [{ width: 34 }, { width: 22 }, { width: 34 }];

  hoja.addRow([doc.titulo]).font = { bold: true, size: 14 };
  for (const { etiqueta, valor } of doc.encabezado) {
    const fila = hoja.addRow([etiqueta, valor]);
    fila.getCell(1).font = NEGRITA;
  }

  titulo(hoja, 'Indicadores principales', ['Indicador', 'Valor', 'Detalle']);
  const filaMonto = hoja.addRow(['Monto en mora', doc.mora.monto, 'Cuotas vencidas al día de hoy']);
  filaMonto.getCell(2).numFmt = FMT_USD;
  const filaMorosas = hoja.addRow([
    'Unidades morosas',
    doc.mora.porcentajeMorosas,
    doc.indicadores.find((i) => i.etiqueta === 'Unidades morosas')?.detalle ?? '',
  ]);
  filaMorosas.getCell(2).numFmt = FMT_PORCENTAJE;
  hoja.addRow(['Incidencias abiertas', doc.incidencias.reduce((s, i) => s + i.total, 0), doc.variacionIncidencias]);
  hoja.addRow(['Área más usada', doc.indicadores.find((i) => i.etiqueta === 'Área más usada')?.texto ?? '—']);

  titulo(hoja, 'Ocupación de áreas comunes', ['Área', 'Ocupación', 'Variación']);
  if (doc.ocupacion.length === 0) hoja.addRow(['No hay áreas comunes activas.']);
  for (const o of doc.ocupacion) {
    const fila = hoja.addRow([o.masUsada ? `${o.area} (más usada)` : o.area, o.porcentaje, o.variacion]);
    fila.getCell(2).numFmt = FMT_PORCENTAJE;
  }

  titulo(hoja, 'Incidencias por prioridad', ['Prioridad', 'Abiertas y en proceso']);
  for (const i of doc.incidencias) hoja.addRow([i.prioridad, i.total]);

  titulo(hoja, 'Participación en asambleas', ['Asamblea', 'Participación']);
  if (doc.participacion.length === 0) hoja.addRow(['No hubo asambleas cerradas en este periodo.']);
  for (const p of doc.participacion) {
    hoja.addRow([p.asamblea, p.porcentaje]).getCell(2).numFmt = FMT_PORCENTAJE;
  }

  if (doc.morosidadPorUnidad) {
    const detalle = libro.addWorksheet('Morosidad por unidad');
    detalle.columns = [{ width: 14 }, { width: 18 }, { width: 18 }, { width: 22 }];
    encabezadoTabla(detalle.addRow(['Unidad', 'Cuotas vencidas', 'Monto adeudado', 'Vencida más antigua']));
    for (const m of doc.morosidadPorUnidad) {
      detalle.addRow([m.unidad, m.cuotasVencidas, m.montoAdeudado, m.vencidaMasAntigua]).getCell(3).numFmt = FMT_USD;
    }
    if (doc.morosidadPorUnidad.length === 0) detalle.addRow(['No hay unidades morosas.']);
  }

  return Buffer.from(await libro.xlsx.writeBuffer());
}

function titulo(hoja: ExcelJS.Worksheet, texto: string, columnas: string[]) {
  hoja.addRow([]);
  hoja.addRow([texto]).font = { bold: true, size: 12 };
  encabezadoTabla(hoja.addRow(columnas));
}

function encabezadoTabla(fila: ExcelJS.Row) {
  fila.font = NEGRITA;
  fila.eachCell((c) => (c.fill = FONDO_ENCABEZADO));
}
