import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PanelMoraDto {
  @ApiProperty({ example: 1350.0, description: 'Suma de cuotas VENCIDA de unidades activas, al día de hoy.' })
  monto!: number;

  @ApiProperty({ example: 9 })
  unidadesMorosas!: number;

  @ApiProperty({ example: 30.0, description: 'Unidades morosas ÷ unidades activas × 100, un decimal.' })
  porcentajeMorosas!: number;
}

export class PanelOcupacionDto {
  @ApiProperty({ example: 'Alberca' })
  area!: string;

  @ApiProperty({ example: 42.5, description: 'Horas reservadas ÷ horas disponibles × 100, un decimal.' })
  porcentaje!: number;

  @ApiProperty({
    example: 5.2,
    nullable: true,
    description: 'Variación contra el periodo anterior; null si el anterior vale 0 (“Sin base de comparación”).',
  })
  cambio!: number | null;
}

export class PanelIncidenciasDto {
  @ApiProperty({ example: 2 }) ALTA!: number;
  @ApiProperty({ example: 4 }) MEDIA!: number;
  @ApiProperty({ example: 1 }) BAJA!: number;
  @ApiProperty({ example: 3 }) SIN_ASIGNAR!: number;

  @ApiProperty({
    example: -10.0,
    nullable: true,
    description: 'Variación del total contra el periodo anterior; null si el anterior vale 0.',
  })
  cambio!: number | null;
}

export class PanelParticipacionDto {
  @ApiProperty({ example: 'Asamblea ordinaria de noviembre' })
  asamblea!: string;

  @ApiProperty({ example: 70.0, description: 'Mismo cálculo que H27.' })
  porcentaje!: number;
}

export class PanelResponseDto {
  @ApiProperty({ type: PanelMoraDto }) mora!: PanelMoraDto;
  @ApiProperty({ type: [PanelOcupacionDto] }) ocupacion!: PanelOcupacionDto[];

  @ApiPropertyOptional({ example: 'Alberca', nullable: true, description: 'En empate, la primera en orden alfabético.' })
  areaMasUsada!: string | null;

  @ApiProperty({ type: PanelIncidenciasDto }) incidencias!: PanelIncidenciasDto;
  @ApiProperty({ type: [PanelParticipacionDto], description: 'Últimas 3 asambleas CERRADA con cierre en el periodo.' })
  participacion!: PanelParticipacionDto[];

  @ApiProperty({ example: '2026-11-20T18:00:00.000Z' })
  generadoEn!: string;
}
