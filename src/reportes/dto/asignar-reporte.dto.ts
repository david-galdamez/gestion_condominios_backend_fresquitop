import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, Length, ValidateIf } from 'class-validator';
import { PrioridadReporte } from '@PrismaClient';
import {
  MENSAJE_PRIORIDAD_INVALIDA,
  MENSAJE_RESPONSABLE_LONGITUD,
  RESPONSABLE_MAX,
  RESPONSABLE_MIN,
} from '../reportes.constants.js';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * Validación de formato individual cuando el campo viene con valor; la regla
 * de presencia conjunta ("Asigna prioridad y responsable juntos") se valida en
 * AdminReportesService para responder exactamente con el mensaje de negocio.
 */
export class AsignarReporteDto {
  @ApiProperty({ enum: PrioridadReporte, enumName: 'PrioridadReporte', example: 'ALTA' })
  @ValidateIf((_o: AsignarReporteDto, value: unknown) => value !== undefined && value !== null && value !== '')
  @IsEnum(PrioridadReporte, { message: MENSAJE_PRIORIDAD_INVALIDA })
  prioridad?: PrioridadReporte;

  @ApiProperty({ minLength: RESPONSABLE_MIN, maxLength: RESPONSABLE_MAX, example: 'Fontanería López' })
  @Transform(recortar)
  @ValidateIf((_o: AsignarReporteDto, value: unknown) => value !== undefined && value !== null && value !== '')
  @IsString({ message: MENSAJE_RESPONSABLE_LONGITUD })
  @Length(RESPONSABLE_MIN, RESPONSABLE_MAX, { message: MENSAJE_RESPONSABLE_LONGITUD })
  responsable?: string;
}