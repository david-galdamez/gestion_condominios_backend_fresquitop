import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CrearUnidadDto {
  @ApiProperty({ format: 'uuid', description: 'Torre a la que pertenece la unidad.' })
  @IsUUID('all', { message: 'La torre debe ser un UUID válido.' })
  torreId!: string;

  @ApiProperty({ example: 'A-101', maxLength: 20, description: 'Identificador legible y único.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El código es obligatorio.' })
  @MaxLength(20, { message: 'El código no puede superar los 20 caracteres.' })
  codigo!: string;
}
