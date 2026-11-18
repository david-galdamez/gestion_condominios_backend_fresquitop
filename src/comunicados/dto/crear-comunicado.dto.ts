import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
  registerDecorator,
} from 'class-validator';
import { CategoriaComunicado } from '@PrismaClient';

export const MSG_TITULO = 'El título debe tener entre 5 y 100 caracteres';
export const MSG_CONTENIDO = 'El contenido debe tener entre 10 y 2000 caracteres';
export const MSG_CATEGORIA = 'Selecciona una categoría';
export const MSG_DESTINO = 'Selecciona los destinatarios';
export const MSG_EXPIRACION = 'La expiración debe ser posterior a la publicación';
export const MSG_FECHA = 'La fecha no es válida';

const aTexto = (value: unknown) => (typeof value === 'string' ? value.trim() : value);

/** Todo el condominio, o al menos una torre. */
function ConDestinatarios(message: string) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'conDestinatarios',
      target: target.constructor,
      propertyName,
      options: { message },
      validator: {
        validate: (value: unknown) => {
          const d = value as DestinoComunicadoDto | undefined;
          return !!d && (d.todos === true || (Array.isArray(d.torreIds) && d.torreIds.length > 0));
        },
      },
    });
}

export class DestinoComunicadoDto {
  @ApiProperty({ description: 'true = todo el condominio (torreIds se ignora).' })
  @IsBoolean({ message: MSG_DESTINO })
  todos!: boolean;

  @ApiPropertyOptional({ type: [String], format: 'uuid', description: 'Torres destino si todos = false.' })
  @IsOptional()
  @IsArray({ message: MSG_DESTINO })
  @ArrayUnique()
  @IsUUID('all', { each: true, message: 'Torre no válida' })
  torreIds?: string[];
}

export class CrearComunicadoDto {
  @ApiProperty({ minLength: 5, maxLength: 100, example: 'Corte de agua el sábado' })
  @Transform(({ value }) => aTexto(value))
  @IsString({ message: MSG_TITULO })
  @Length(5, 100, { message: MSG_TITULO })
  titulo!: string;

  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @Transform(({ value }) => aTexto(value))
  @IsString({ message: MSG_CONTENIDO })
  @Length(10, 2000, { message: MSG_CONTENIDO })
  contenido!: string;

  @ApiProperty({ enum: CategoriaComunicado, enumName: 'CategoriaComunicado' })
  @IsEnum(CategoriaComunicado, { message: MSG_CATEGORIA })
  categoria!: CategoriaComunicado;

  @ApiProperty({ type: DestinoComunicadoDto })
  @IsDefined({ message: MSG_DESTINO })
  @ValidateNested()
  @Type(() => DestinoComunicadoDto)
  @ConDestinatarios(MSG_DESTINO)
  destino!: DestinoComunicadoDto;

  @ApiPropertyOptional({
    example: '2026-11-20T14:00:00.000Z',
    description: 'ISO 8601. Omitida o pasada = se publica ya; futura = queda PROGRAMADO.',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: MSG_FECHA })
  fechaPublicacion?: string;

  @ApiPropertyOptional({ example: '2026-11-30T23:59:00.000Z', description: 'ISO 8601, posterior a la publicación.' })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: MSG_FECHA })
  fechaExpiracion?: string;
}
