import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, registerDecorator, type ValidationArguments } from 'class-validator';
import { EsFechaReal, FECHA_ISO } from '@Common/fechas';
import { diasDelPeriodo, MAX_DIAS_PERIODO } from '../panel.calculos.js';

export const MSG_FECHAS_REQUERIDAS = 'desde y hasta son obligatorias (YYYY-MM-DD)';
export const MSG_FECHAS_INVERTIDAS = 'desde no puede ser posterior a hasta';
export const MSG_RANGO_MAXIMO = `El periodo no puede superar ${MAX_DIAS_PERIODO} días`;

/** Aplica sobre `hasta`: compara contra `desde` cuando ambas son fechas reales. */
function RangoValido() {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'rangoValido',
      target: target.constructor,
      propertyName,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const desde = (args.object as Record<string, unknown>).desde;
          if (typeof value !== 'string' || typeof desde !== 'string') return true;
          if (!FECHA_ISO.test(value) || !FECHA_ISO.test(desde)) return true;
          return value >= desde && diasDelPeriodo({ desde, hasta: value }) <= MAX_DIAS_PERIODO;
        },
        defaultMessage(args: ValidationArguments) {
          const { desde, hasta } = args.object as { desde: string; hasta: string };
          return hasta < desde ? MSG_FECHAS_INVERTIDAS : MSG_RANGO_MAXIMO;
        },
      },
    });
}

export class PanelQueryDto {
  @ApiProperty({ example: '2026-11-01', description: 'Inicio del periodo (YYYY-MM-DD).' })
  @IsString({ message: MSG_FECHAS_REQUERIDAS })
  @Matches(FECHA_ISO, { message: MSG_FECHAS_REQUERIDAS })
  @EsFechaReal('desde no es una fecha real')
  desde!: string;

  @ApiProperty({ example: '2026-11-30', description: 'Fin del periodo (YYYY-MM-DD), máximo 366 días desde `desde`.' })
  @IsString({ message: MSG_FECHAS_REQUERIDAS })
  @Matches(FECHA_ISO, { message: MSG_FECHAS_REQUERIDAS })
  @EsFechaReal('hasta no es una fecha real')
  @RangoValido()
  hasta!: string;
}
