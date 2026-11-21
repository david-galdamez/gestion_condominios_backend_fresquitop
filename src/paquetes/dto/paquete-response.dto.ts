import { ApiProperty } from '@nestjs/swagger';
import { EstadoPaquete, Mensajeria } from '@PrismaClient';

/** Vista de portería: nunca incluye el código de retiro. */
export class PaqueteDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'PAQ-000123' })
  codigoPaquete!: string;

  @ApiProperty({ example: 'A-101' })
  unidad!: string;

  @ApiProperty({ example: 'Carlos Pérez' })
  destinatario!: string;

  @ApiProperty({ enum: Mensajeria, enumName: 'Mensajeria' })
  mensajeria!: Mensajeria;

  @ApiProperty({ nullable: true, type: String })
  guia!: string | null;

  @ApiProperty({ enum: EstadoPaquete, enumName: 'EstadoPaquete' })
  estado!: EstadoPaquete;

  @ApiProperty({ example: '2026-11-04T18:40:00.000Z' })
  recibidoEn!: string;
}

export class ListaPaquetesResponseDto {
  @ApiProperty({ type: PaqueteDto, isArray: true })
  datos!: PaqueteDto[];
}
