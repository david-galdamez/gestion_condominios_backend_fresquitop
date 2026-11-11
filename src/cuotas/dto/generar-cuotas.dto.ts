import { ApiProperty } from '@nestjs/swagger';
import { Matches, registerDecorator } from 'class-validator';
import { PERIODO, periodoActual, sumarMeses } from '../periodos.js';

export const MSG_PERIODO = 'El periodo debe tener el formato AAAA-MM';
export const MSG_PERIODO_FUTURO =
  'Solo puedes generar hasta el mes siguiente al actual';

/** El periodo no puede ser posterior al mes siguiente al actual (zona del negocio). */
function NoPosteriorAlMesSiguiente(message: string) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'noPosteriorAlMesSiguiente',
      target: target.constructor,
      propertyName,
      options: { message },
      validator: {
        validate(value: unknown) {
          // El formato lo reporta @Matches; "YYYY-MM" compara bien como texto.
          if (typeof value !== 'string' || !PERIODO.test(value)) return true;
          return value <= sumarMeses(periodoActual(), 1);
        },
      },
    });
}

export class GenerarCuotasDto {
  @ApiProperty({
    example: '2026-12',
    description: 'AAAA-MM; como máximo el mes siguiente al actual.',
  })
  @Matches(PERIODO, { message: MSG_PERIODO })
  @NoPosteriorAlMesSiguiente(MSG_PERIODO_FUTURO)
  periodo!: string;
}
