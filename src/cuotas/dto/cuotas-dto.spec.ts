import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { periodoActual, sumarMeses } from '../periodos.js';
import {
  GenerarCuotasDto,
  MSG_PERIODO,
  MSG_PERIODO_FUTURO,
} from './generar-cuotas.dto.js';
import {
  GuardarConfiguracionDto,
  MSG_DIA,
  MSG_MONTO,
} from './guardar-configuracion.dto.js';

const errores = async <T extends object>(cls: new () => T, plano: object) => [
  ...new Set(
    (await validate(plainToInstance(cls, plano))).flatMap((e) =>
      Object.values(e.constraints ?? {}),
    ),
  ),
];

describe('GuardarConfiguracionDto', () => {
  it.each([
    [1, true],
    [45.5, true],
    [9999.99, true],
    [0.99, false],
    [10000, false],
    [45.123, false],
    ['45', false],
  ])('montoMensual %s -> válido=%s', async (montoMensual, ok) => {
    const errs = await errores(GuardarConfiguracionDto, {
      montoMensual,
      diaVencimiento: 10,
    });
    expect(errs).toEqual(ok ? [] : [MSG_MONTO]);
  });

  it.each([
    [1, true],
    [28, true],
    [0, false],
    [29, false],
    [10.5, false],
  ])('diaVencimiento %s -> válido=%s', async (diaVencimiento, ok) => {
    const errs = await errores(GuardarConfiguracionDto, {
      montoMensual: 45,
      diaVencimiento,
    });
    expect(errs).toEqual(ok ? [] : [MSG_DIA]);
  });
});

describe('GenerarCuotasDto', () => {
  it('acepta el mes actual, el siguiente y meses pasados', async () => {
    const actual = periodoActual();
    for (const periodo of [
      actual,
      sumarMeses(actual, 1),
      sumarMeses(actual, -3),
    ]) {
      expect(await errores(GenerarCuotasDto, { periodo })).toEqual([]);
    }
  });

  it('rechaza un periodo posterior al mes siguiente', async () => {
    const periodo = sumarMeses(periodoActual(), 2);
    expect(await errores(GenerarCuotasDto, { periodo })).toEqual([
      MSG_PERIODO_FUTURO,
    ]);
  });

  it.each(['2026-13', '2026-1', '202612', '2026-12-01', ''])(
    'rechaza el formato "%s"',
    async (periodo) => {
      expect(await errores(GenerarCuotasDto, { periodo })).toEqual([
        MSG_PERIODO,
      ]);
    },
  );
});
