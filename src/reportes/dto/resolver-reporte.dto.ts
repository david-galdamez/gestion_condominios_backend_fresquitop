import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import {
  COMENTARIO_CIERRE_MAX,
  COMENTARIO_CIERRE_MIN,
  MENSAJE_COMENTARIO_CIERRE,
} from '../reportes.constants.js';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ResolverReporteDto {
  @ApiProperty({
    minLength: COMENTARIO_CIERRE_MIN,
    maxLength: COMENTARIO_CIERRE_MAX,
    example: 'Se reemplazó el empaque de la tubería y se verificó que no existen más fugas.',
  })
  @Transform(recortar)
  @IsString({ message: MENSAJE_COMENTARIO_CIERRE })
  @Length(COMENTARIO_CIERRE_MIN, COMENTARIO_CIERRE_MAX, { message: MENSAJE_COMENTARIO_CIERRE })
  comentario!: string;
}