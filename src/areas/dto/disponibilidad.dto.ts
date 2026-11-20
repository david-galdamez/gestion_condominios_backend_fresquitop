import { ApiProperty } from '@nestjs/swagger';
import { EnVentanaDesdeHoy } from '@Common/fechas';

/** Días hacia adelante que se pueden consultar (hoy cuenta como día 0). */
export const DIAS_DISPONIBILIDAD = 30;
export const MSG_FECHA_DISPONIBILIDAD = 'Elige una fecha entre hoy y los próximos 30 días';

export class DisponibilidadQueryDto {
  @ApiProperty({
    format: 'date',
    example: '2026-11-23',
    description: 'Fecha local del condominio (YYYY-MM-DD), entre hoy y hoy + 30 días.',
  })
  // Un solo validador: ausente, mal formada, pasada o lejana dan el mismo mensaje.
  @EnVentanaDesdeHoy(DIAS_DISPONIBILIDAD, MSG_FECHA_DISPONIBILIDAD)
  fecha!: string;
}

export const ESTADOS_BLOQUE = ['LIBRE', 'OCUPADO'] as const;
export type EstadoBloque = (typeof ESTADOS_BLOQUE)[number];

export class BloqueDto {
  @ApiProperty({ example: '07:00' })
  inicio!: string;

  @ApiProperty({ example: '08:00' })
  fin!: string;

  @ApiProperty({ enum: ESTADOS_BLOQUE, example: 'LIBRE' })
  estado!: EstadoBloque;
}

/** Sin datos de quién reservó: solo el área y el estado de cada bloque. */
export class AreaDisponibilidadDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Alberca' })
  nombre!: string;

  @ApiProperty({ example: 30 })
  capacidad!: number;

  @ApiProperty({ type: BloqueDto, isArray: true })
  bloques!: BloqueDto[];
}

export class DisponibilidadDto {
  @ApiProperty({ format: 'date', example: '2026-11-23' })
  fecha!: string;

  @ApiProperty({ type: AreaDisponibilidadDto, isArray: true })
  areas!: AreaDisponibilidadDto[];
}
