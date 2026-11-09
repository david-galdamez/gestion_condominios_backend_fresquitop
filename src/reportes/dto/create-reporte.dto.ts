import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, Length } from 'class-validator';
import { CategoriaReporte } from '@PrismaClient';
import {
  DESCRIPCION_MAX,
  DESCRIPCION_MIN,
  MENSAJE_DESCRIPCION,
  MENSAJE_TITULO,
  TITULO_MAX,
  TITULO_MIN,
} from '../reportes.constants.js';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Campos de texto del multipart. Las fotos viajan aparte (campo `fotos`). */
export class CreateReporteDto {
  @ApiProperty({ minLength: TITULO_MIN, maxLength: TITULO_MAX, example: 'Fuga de agua en el pasillo' })
  @Transform(recortar)
  @Length(TITULO_MIN, TITULO_MAX, { message: MENSAJE_TITULO })
  titulo!: string;

  @ApiProperty({ enum: CategoriaReporte, enumName: 'CategoriaReporte' })
  @IsEnum(CategoriaReporte, { message: 'La categoría no es válida' })
  categoria!: CategoriaReporte;

  @ApiProperty({ example: 'Torre A', description: 'Una torre o un área común (ver GET /reportes/ubicaciones).' })
  @Transform(recortar)
  @IsString({ message: 'La ubicación es obligatoria' })
  ubicacion!: string;

  @ApiProperty({ minLength: DESCRIPCION_MIN, maxLength: DESCRIPCION_MAX })
  @Transform(recortar)
  @Length(DESCRIPCION_MIN, DESCRIPCION_MAX, { message: MENSAJE_DESCRIPCION })
  descripcion!: string;
}
