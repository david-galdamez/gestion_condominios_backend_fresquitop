import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, registerDecorator, type ValidationArguments } from 'class-validator';
import { esFechaReal } from '@Common/fechas';
import { RangoValido } from '@Panel/dto';
import { FormatoExportacion, VersionExportacion } from '@PrismaClient';

export const MSG_PERIODO = 'Selecciona un periodo';
export const MSG_FECHA_INVALIDA = 'La fecha no es válida (YYYY-MM-DD)';
export const MSG_FORMATO = 'Selecciona un formato (PDF o EXCEL)';
export const MSG_VERSION = 'Selecciona una versión (DETALLADA o RESUMIDA)';

/** Fecha obligatoria del periodo: ausente -> "Selecciona un periodo"; mal formada -> fecha no válida. */
function FechaDelPeriodo() {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'fechaDelPeriodo',
      target: target.constructor,
      propertyName,
      validator: {
        validate: (value: unknown) => typeof value === 'string' && esFechaReal(value),
        defaultMessage: (args: ValidationArguments) =>
          args.value === undefined || args.value === null || args.value === '' ? MSG_PERIODO : MSG_FECHA_INVALIDA,
      },
    });
}

/** Mismas reglas de periodo que el panel (H19): fechas reales, desde ≤ hasta, máximo 366 días. */
export class ExportarReporteQueryDto {
  @ApiProperty({ enum: FormatoExportacion, enumName: 'FormatoExportacion' })
  @IsEnum(FormatoExportacion, { message: MSG_FORMATO })
  formato!: FormatoExportacion;

  @ApiProperty({
    enum: VersionExportacion,
    enumName: 'VersionExportacion',
    description: 'RESUMIDA: solo totales, sin unidades ni nombres. DETALLADA: agrega la morosidad por unidad.',
  })
  @IsEnum(VersionExportacion, { message: MSG_VERSION })
  version!: VersionExportacion;

  @ApiProperty({ example: '2026-11-01', description: 'Inicio del periodo (YYYY-MM-DD).' })
  @FechaDelPeriodo()
  desde!: string;

  @ApiProperty({ example: '2026-11-30', description: 'Fin del periodo (YYYY-MM-DD), máximo 366 días desde `desde`.' })
  @FechaDelPeriodo()
  @RangoValido()
  hasta!: string;
}
