import { ApiProperty } from '@nestjs/swagger';
import { CategoriaReporte, EstadoReporte } from '@PrismaClient';

export class ReporteResumenDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'REP-000123' })
  numero!: string;

  @ApiProperty({ example: 'Fuga de agua en el pasillo' })
  titulo!: string;

  @ApiProperty({ enum: CategoriaReporte, enumName: 'CategoriaReporte' })
  categoria!: CategoriaReporte;

  @ApiProperty({ enum: EstadoReporte, enumName: 'EstadoReporte' })
  estado!: EstadoReporte;

  @ApiProperty({ example: '2026-11-08T22:53:00.000Z', description: 'ISO 8601' })
  creadoEn!: string;
}

export class ReporteDto extends ReporteResumenDto {
  @ApiProperty({ example: 'Torre A' })
  ubicacion!: string;

  @ApiProperty()
  descripcion!: string;

  @ApiProperty({
    type: [String],
    example: ['/api/v1/reportes/REP-000123/fotos/2f0a6f8e-0f0e-4a53-9f63-0c1c2f6f9a11'],
    description: 'Rutas de descarga (requieren sesión del dueño del reporte).',
  })
  fotos!: string[];
}

export class ReportesPaginaDto {
  @ApiProperty({ type: [ReporteResumenDto] })
  datos!: ReporteResumenDto[];

  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ example: 1 })
  pagina!: number;

  @ApiProperty({ example: 20 })
  porPagina!: number;
}

export class UbicacionesDto {
  @ApiProperty({ type: [String], example: ['Torre A', 'Torre B'] })
  torres!: string[];

  @ApiProperty({ type: [String], example: ['Lobby', 'Piscina'] })
  areasComunes!: string[];
}
