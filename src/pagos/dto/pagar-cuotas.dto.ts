import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  registerDecorator,
  ValidateNested,
} from 'class-validator';
import { hoyEnZonaNegocio } from '@Common/fechas';

export const MSG_CUOTAS = 'Marca entre 1 y 12 cuotas';
export const MSG_NUMERO = 'El número de tarjeta debe tener 16 dígitos';
export const MSG_VENCIMIENTO = 'La tarjeta está vencida o la fecha no es válida (MM/AA)';
export const MSG_CVV = 'El CVV debe tener 3 dígitos';
export const MSG_TITULAR = 'El titular debe tener entre 3 y 60 caracteres';

const VENCIMIENTO = /^(0[1-9]|1[0-2])\/\d{2}$/;

/** "MM/AA" no anterior al mes actual (hora de El Salvador). */
export function vencimientoVigente(value: string, ahora: Date = new Date()): boolean {
  if (!VENCIMIENTO.test(value)) return false;
  const [mm, aa] = value.split('/');
  return `20${aa}-${mm}` >= hoyEnZonaNegocio(ahora).slice(0, 7);
}

function VencimientoVigente(message: string) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'vencimientoVigente',
      target: target.constructor,
      propertyName,
      options: { message },
      validator: { validate: (v: unknown) => typeof v === 'string' && vencimientoVigente(v) },
    });
}

const sinEspacios = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value);

/** Datos de la tarjeta de prueba. Solo viajan a la pasarela: nunca se guardan completos. */
export class TarjetaDto {
  @ApiProperty({ example: '4242424242424242', description: '16 dígitos (se aceptan espacios).' })
  @Transform(({ value }) => sinEspacios(value))
  @Matches(/^\d{16}$/, { message: MSG_NUMERO })
  numero!: string;

  @ApiProperty({ example: '12/28', description: 'MM/AA, no vencida.' })
  @VencimientoVigente(MSG_VENCIMIENTO)
  vencimiento!: string;

  @ApiProperty({ example: '123' })
  @Matches(/^\d{3}$/, { message: MSG_CVV })
  cvv!: string;

  @ApiProperty({ example: 'Ana López', minLength: 3, maxLength: 60 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: MSG_TITULAR })
  @MinLength(3, { message: MSG_TITULAR })
  @MaxLength(60, { message: MSG_TITULAR })
  titular!: string;
}

export class PagarCuotasDto {
  @ApiProperty({ type: [String], format: 'uuid', minItems: 1, maxItems: 12 })
  @IsArray({ message: MSG_CUOTAS })
  @ArrayMinSize(1, { message: MSG_CUOTAS })
  @ArrayMaxSize(12, { message: MSG_CUOTAS })
  @ArrayUnique({ message: 'No repitas cuotas' })
  @IsUUID('all', { each: true, message: 'Cada cuota debe ser un id válido' })
  cuotaIds!: string[];

  @ApiProperty({ type: TarjetaDto })
  @ValidateNested()
  @Type(() => TarjetaDto)
  tarjeta!: TarjetaDto;
}
