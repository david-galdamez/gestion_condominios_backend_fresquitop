import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, Max, Min } from 'class-validator';

export const MONTO_MIN = 1;
export const MONTO_MAX = 9999.99;
export const DIA_MIN = 1;
export const DIA_MAX = 28;

export const MSG_MONTO = 'El monto mensual debe estar entre $1.00 y $9,999.99';
export const MSG_DIA = 'El día de vencimiento debe estar entre 1 y 28';

export class GuardarConfiguracionDto {
  @ApiProperty({
    minimum: MONTO_MIN,
    maximum: MONTO_MAX,
    example: 45,
    description: 'Hasta 2 decimales.',
  })
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: MSG_MONTO },
  )
  @Min(MONTO_MIN, { message: MSG_MONTO })
  @Max(MONTO_MAX, { message: MSG_MONTO })
  montoMensual!: number;

  @ApiProperty({
    minimum: DIA_MIN,
    maximum: DIA_MAX,
    example: 10,
    description:
      'Día del mes en que vence la cuota. Hasta 28 para que exista en todos los meses.',
  })
  @IsInt({ message: MSG_DIA })
  @Min(DIA_MIN, { message: MSG_DIA })
  @Max(DIA_MAX, { message: MSG_DIA })
  diaVencimiento!: number;
}
