import { ApiProperty } from '@nestjs/swagger';
import { Matches, IsUUID, IsInt, Min, registerDecorator, type ValidationArguments } from 'class-validator';
import { FECHA_ISO, EsFechaReal } from '@Common/fechas';

export const MSG_FECHA_RESERVA = 'La fecha debe tener formato YYYY-MM-DD y ser una fecha real';
export const MSG_HORA_RESERVA = 'La hora debe ser en punto, en formato HH:00 (24 h)';
export const MSG_HORARIO_RESERVA = 'La hora de fin debe ser posterior a la hora de inicio';

export const HORA_EN_PUNTO = /^([01]\d|2[0-3]):00$/;

function PosteriorA(otra: string, message: string) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'posteriorA',
      target: target.constructor,
      propertyName,
      options: { message },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const otraHora = (args.object as Record<string, unknown>)[otra];
          if (typeof value !== 'string' || typeof otraHora !== 'string') return true;
          if (!HORA_EN_PUNTO.test(value) || !HORA_EN_PUNTO.test(otraHora)) return true;
          return value > otraHora;
        },
      },
    });
}

export class CrearReservaDto {
  @ApiProperty({ format: 'uuid', example: '3f0f6b2e-5c1d-4b8e-9a37-0d2f6a1c4e55' })
  @IsUUID('all', { message: 'El área debe ser un UUID válido' })
  areaId!: string;

  @ApiProperty({ format: 'date', example: '2026-11-23', description: 'Fecha local del condominio (YYYY-MM-DD).' })
  @Matches(FECHA_ISO, { message: MSG_FECHA_RESERVA })
  @EsFechaReal(MSG_FECHA_RESERVA)
  fecha!: string;

  @ApiProperty({ example: '09:00', description: 'Hora en punto, formato HH:00 (24 h).' })
  @Matches(HORA_EN_PUNTO, { message: MSG_HORA_RESERVA })
  horaInicio!: string;

  @ApiProperty({ example: '11:00', description: 'Hora en punto y posterior a horaInicio.' })
  @Matches(HORA_EN_PUNTO, { message: MSG_HORA_RESERVA })
  @PosteriorA('horaInicio', MSG_HORARIO_RESERVA)
  horaFin!: string;

  @ApiProperty({ minimum: 1, example: 12 })
  @IsInt({ message: 'El número de asistentes debe ser un entero mayor o igual a 1' })
  @Min(1, { message: 'El número de asistentes debe ser un entero mayor o igual a 1' })
  asistentes!: number;
}
