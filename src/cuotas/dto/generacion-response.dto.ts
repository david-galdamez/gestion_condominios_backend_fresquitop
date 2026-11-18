import { ApiProperty } from '@nestjs/swagger';

export class GeneracionCuotasDto {
  @ApiProperty({ example: '2026-12' })
  periodo!: string;

  @ApiProperty({ example: 28, description: 'Cuotas nuevas creadas.' })
  creadas!: number;

  @ApiProperty({
    example: 2,
    description: 'Unidades activas que ya tenían cuota del periodo.',
  })
  omitidas!: number;
}
