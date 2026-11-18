import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDefined, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { EnVentanaDesdeHoy, EsFechaReal, FECHA_ISO } from '@Common/fechas';
import { TipoDocumento } from '@PrismaClient';
import {
  aTexto,
  DocumentoSegunTipo,
  HORA,
  MAX_DIAS_ANTICIPACION,
  MSG_DOCUMENTO,
  MSG_FECHA,
} from './crear-autorizacion.dto.js';

/** El documento se valida como par: el formato del número depende del tipo. */
const tocaDocumento = (o: EditarAutorizacionDto) => o.tipoDocumento !== undefined || o.numeroDocumento !== undefined;

/**
 * H07b: todos los campos son opcionales, pero la unidad no se puede cambiar
 * (unidadId no está en el DTO y `forbidNonWhitelisted` la rechaza con 400).
 */
export class EditarAutorizacionDto {
  @ApiPropertyOptional({ minLength: 3, maxLength: 60, example: 'María López' })
  @IsOptional()
  @Transform(({ value }) => aTexto(value))
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  nombre?: string;

  @ApiPropertyOptional({
    enum: TipoDocumento,
    enumName: 'TipoDocumento',
    description: 'Obligatorio si se envía numeroDocumento.',
  })
  @ValidateIf(tocaDocumento)
  @IsDefined({ message: MSG_DOCUMENTO })
  @IsEnum(TipoDocumento)
  tipoDocumento?: TipoDocumento;

  @ApiPropertyOptional({
    example: '01234567-8',
    description: 'Obligatorio si se envía tipoDocumento. Mismas reglas que al crear.',
  })
  @ValidateIf(tocaDocumento)
  @Transform(({ value, obj }: { value: unknown; obj: { tipoDocumento?: unknown } }) => {
    const texto = aTexto(value);
    return typeof texto === 'string' && obj.tipoDocumento === TipoDocumento.PASAPORTE ? texto.toUpperCase() : texto;
  })
  @DocumentoSegunTipo(MSG_DOCUMENTO)
  numeroDocumento?: string;

  @ApiPropertyOptional({ maxLength: 10, nullable: true, description: 'Vacío o null = sin placa.' })
  @Transform(({ value }) => {
    const texto = aTexto(value);
    return typeof texto === 'string' ? texto.toUpperCase() || null : texto;
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  placa?: string | null;

  @ApiPropertyOptional({
    example: '2026-11-10',
    description: 'Si cambia, se genera un código nuevo y el anterior deja de funcionar.',
  })
  @IsOptional()
  @Matches(FECHA_ISO, { message: MSG_FECHA })
  @EsFechaReal(MSG_FECHA)
  @EnVentanaDesdeHoy(MAX_DIAS_ANTICIPACION, MSG_FECHA)
  fechaVisita?: string;

  @ApiPropertyOptional({ example: '14:30', description: 'HH:mm' })
  @IsOptional()
  @Matches(HORA, { message: 'La hora estimada debe tener formato HH:mm' })
  horaEstimada?: string;
}
