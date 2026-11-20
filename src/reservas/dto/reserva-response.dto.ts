import { ApiProperty } from '@nestjs/swagger';
import { EstadoReserva } from '@PrismaClient';

export class ReservaDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'RES-000123' })
  codigo!: string;

  @ApiProperty({ example: 'Alberca' })
  area!: string;

  @ApiProperty({ example: '2026-11-23', format: 'date' })
  fecha!: string;

  @ApiProperty({ example: '09:00' })
  horaInicio!: string;

  @ApiProperty({ example: '11:00' })
  horaFin!: string;

  @ApiProperty({ example: 12 })
  asistentes!: number;

  @ApiProperty({ enum: EstadoReserva, enumName: 'EstadoReserva' })
  estado!: EstadoReserva;
}

export class MisReservasResponseDto {
  @ApiProperty({ type: [ReservaDto] })
  datos!: ReservaDto[];
}
