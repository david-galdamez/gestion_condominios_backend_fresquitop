import { ApiProperty } from '@nestjs/swagger';

export class AreaDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Salón de eventos' })
  nombre!: string;

  @ApiProperty({ example: 80 })
  capacidad!: number;

  @ApiProperty({ example: '08:00', description: 'HH:00' })
  horaApertura!: string;

  @ApiProperty({ example: '22:00', description: 'HH:00' })
  horaCierre!: string;

  @ApiProperty({ example: 3 })
  duracionMaxHoras!: number;

  @ApiProperty()
  activa!: boolean;
}

export class ListaAreasResponseDto {
  @ApiProperty({ type: AreaDto, isArray: true })
  datos!: AreaDto[];
}
