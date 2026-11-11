import { ApiProperty } from '@nestjs/swagger';

export class ConfiguracionCuotaDto {
  @ApiProperty({ example: 45 })
  montoMensual!: number;

  @ApiProperty({ example: 10 })
  diaVencimiento!: number;

  @ApiProperty({
    example: '2026-11-02',
    description: 'YYYY-MM-DD (America/El_Salvador).',
  })
  vigenteDesde!: string;
}
