import { ApiProperty } from '@nestjs/swagger';
import { AutorizacionDto } from '@Autorizaciones/dto';
import { EstadoAcceso, TipoDocumento } from '@PrismaClient';

export class AccesoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ana López' })
  nombre!: string;

  @ApiProperty({ enum: TipoDocumento, enumName: 'TipoDocumento' })
  tipoDocumento!: TipoDocumento;

  @ApiProperty({ example: '01234567-8' })
  numeroDocumento!: string;

  @ApiProperty({ example: 'A-101', description: 'Código de la unidad visitada.' })
  unidad!: string;

  @ApiProperty({ nullable: true, type: String, description: 'Solo sin pre-autorización.' })
  motivo!: string | null;

  @ApiProperty()
  preautorizado!: boolean;

  @ApiProperty({ enum: EstadoAcceso, enumName: 'EstadoAcceso' })
  estado!: EstadoAcceso;

  @ApiProperty({ format: 'date-time' })
  horaEntrada!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  horaSalida!: string | null;
}

export class AccesosResponseDto {
  @ApiProperty({ type: AccesoDto, isArray: true })
  datos!: AccesoDto[];
}

export class AutorizacionesPorteriaResponseDto {
  @ApiProperty({ type: AutorizacionDto, isArray: true })
  datos!: AutorizacionDto[];
}
