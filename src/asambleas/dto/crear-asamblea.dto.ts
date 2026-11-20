import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsString, Length, ValidateNested } from 'class-validator';

export class OpcionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  texto!: string;
}

export class TemaDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 150)
  titulo!: string;

  @IsArray()
  @ArrayMinSize(2, { message: 'Mínimo 2 opciones por tema' })
  @ArrayMaxSize(10, { message: 'Máximo 10 opciones por tema' })
  @ValidateNested({ each: true })
  @Type(() => OpcionDto)
  opciones!: OpcionDto[];
}

export class CrearAsambleaDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(5, 100, { message: 'El título debe tener entre 5 y 100 caracteres' })
  titulo!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 1000, { message: 'La descripción no puede superar los 1000 caracteres' })
  descripcion!: string;

  @IsDateString({}, { message: 'La fecha de apertura no es válida' })
  fechaApertura!: string;

  @IsDateString({}, { message: 'La fecha de cierre no es válida' })
  fechaCierre!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debe haber al menos 1 tema' })
  @ArrayMaxSize(10, { message: 'Máximo 10 temas' })
  @ValidateNested({ each: true })
  @Type(() => TemaDto)
  temas!: TemaDto[];
}
