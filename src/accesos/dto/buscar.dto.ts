import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export const MSG_BUSQUEDA = 'Escribe un código de 6 dígitos o un número de documento';

/** Código de autorización o número de documento (se normaliza a mayúsculas). */
export class BuscarDto {
  @ApiProperty({ example: '048213', description: 'Código de 6 dígitos o número de documento.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString({ message: MSG_BUSQUEDA })
  @MinLength(3, { message: MSG_BUSQUEDA })
  @MaxLength(12, { message: MSG_BUSQUEDA })
  q!: string;
}
