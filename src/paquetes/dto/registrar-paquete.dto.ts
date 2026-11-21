import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Mensajeria } from '@PrismaClient';

export const MSG_UNIDAD = 'Selecciona una unidad';
export const MSG_DESTINATARIO = 'El destinatario debe tener entre 3 y 60 caracteres';
export const MSG_MENSAJERIA = 'Elige una mensajería de la lista';
export const MSG_GUIA = 'El número de guía no puede superar los 40 caracteres';
export const MSG_FOTO = 'Solo JPG o PNG de hasta 5 MB';

const aTexto = (value: unknown) => (typeof value === 'string' ? value.trim() : value);

/**
 * Campos de texto del multipart de POST /paquetes. La foto llega aparte
 * (@UploadedFile) y la valida el servicio por sus primeros bytes.
 */
export class RegistrarPaqueteDto {
  @ApiProperty({ format: 'uuid', description: 'Unidad destinataria (de GET /unidades).' })
  @IsUUID('all', { message: MSG_UNIDAD })
  unidadId!: string;

  @ApiProperty({ minLength: 3, maxLength: 60, example: 'Carlos Pérez', description: 'Nombre que trae la etiqueta.' })
  @Transform(({ value }) => aTexto(value))
  @IsString({ message: MSG_DESTINATARIO })
  @MinLength(3, { message: MSG_DESTINATARIO })
  @MaxLength(60, { message: MSG_DESTINATARIO })
  destinatario!: string;

  @ApiProperty({ enum: Mensajeria, enumName: 'Mensajeria' })
  @IsEnum(Mensajeria, { message: MSG_MENSAJERIA })
  mensajeria!: Mensajeria;

  @ApiPropertyOptional({ maxLength: 40, example: '1234567890', description: 'Vacío = sin guía.' })
  // En multipart un campo vacío llega como "": se trata como ausente.
  @Transform(({ value }) => {
    const texto = aTexto(value);
    return texto === '' ? undefined : texto;
  })
  @IsOptional()
  @IsString({ message: MSG_GUIA })
  @MaxLength(40, { message: MSG_GUIA })
  guia?: string;
}
