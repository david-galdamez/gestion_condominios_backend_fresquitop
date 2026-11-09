import { ApiProperty } from '@nestjs/swagger';

export class UnidadMorosaDto {
  @ApiProperty({
    example: 'B-204',
    description: 'Identificador legible de la unidad.',
  })
  unidad!: string;

  @ApiProperty({
    example: 3,
    description: 'Cantidad de cuotas en estado VENCIDA.',
  })
  cuotasVencidas!: number;

  @ApiProperty({
    example: 135.0,
    description: 'Suma adeudada en cuotas vencidas.',
  })
  montoAdeudado!: number;

  @ApiProperty({
    example: '2026-08-10',
    description:
      'Fecha de vencimiento (YYYY-MM-DD) de la cuota vencida más antigua.',
  })
  vencidaMasAntigua!: string;
}

export class MorosidadResponseDto {
  @ApiProperty({
    example: 1350.0,
    description:
      'Monto total acumulado en mora sobre el filtro actual (sin paginar).',
  })
  totalMora!: number;

  @ApiProperty({
    example: 9,
    description:
      'Total de unidades morosas activas sobre el filtro actual (sin paginar).',
  })
  unidadesMorosas!: number;

  @ApiProperty({ type: [UnidadMorosaDto] })
  datos!: UnidadMorosaDto[];

  @ApiProperty({
    example: 9,
    description: 'Total de registros para paginación.',
  })
  total!: number;

  @ApiProperty({ example: 1, description: 'Página actual.' })
  pagina!: number;
}
