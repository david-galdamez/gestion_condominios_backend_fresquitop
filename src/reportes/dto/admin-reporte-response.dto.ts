import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoriaReporte, EstadoReporte, PrioridadReporte, Rol } from '@PrismaClient';

export class ResidenteReporteDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ana Gómez' })
  nombre!: string;

  @ApiProperty({ example: 'ana@condominio.com' })
  email!: string;
}

export class AdminReporteItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'REP-000123' })
  numero!: string;

  @ApiProperty({ example: 'Fuga de agua en el pasillo' })
  titulo!: string;

  @ApiProperty({ enum: CategoriaReporte, enumName: 'CategoriaReporte' })
  categoria!: CategoriaReporte;

  @ApiProperty({ example: 'Torre A' })
  ubicacion!: string;

  @ApiProperty({ enum: EstadoReporte, enumName: 'EstadoReporte' })
  estado!: EstadoReporte;

  @ApiPropertyOptional({ enum: PrioridadReporte, enumName: 'PrioridadReporte', nullable: true })
  prioridad!: PrioridadReporte | null;

  @ApiPropertyOptional({ example: 'Fontanería López', nullable: true })
  responsable!: string | null;

  @ApiProperty({ example: '2026-11-08T22:53:00.000Z', description: 'ISO 8601' })
  creadoEn!: string;

  @ApiProperty({ type: ResidenteReporteDto })
  residente!: ResidenteReporteDto;

  @ApiProperty({ type: [String], example: ['A-101'] })
  unidades!: string[];
}

export class AdminReportesPaginaDto {
  @ApiProperty({ type: [AdminReporteItemDto] })
  datos!: AdminReporteItemDto[];

  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ example: 1 })
  pagina!: number;

  @ApiProperty({ example: 20 })
  porPagina!: number;
}

export class EvidenciaDetalleDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'image/png' })
  mimeType!: string;

  @ApiProperty({ example: 120450 })
  tamanoBytes!: number;

  @ApiProperty({ example: 0 })
  orden!: number;

  @ApiProperty({ example: '/api/v1/reportes/REP-000123/fotos/2f0a6f8e-0f0e-4a53-9f63-0c1c2f6f9a11' })
  url!: string;
}

export class AutorHistorialDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Admin Principal' })
  nombre!: string;

  @ApiProperty({ enum: Rol, enumName: 'Rol' })
  rol!: Rol;
}

export class HistorialReporteItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: EstadoReporte, enumName: 'EstadoReporte' })
  estado!: EstadoReporte;

  @ApiPropertyOptional({ example: 'Prioridad: ALTA · Responsable: Fontanería López', nullable: true })
  comentario!: string | null;

  @ApiProperty({ example: '2026-11-19T18:00:00.000Z', description: 'ISO 8601' })
  fecha!: string;

  @ApiProperty({ type: AutorHistorialDto })
  autor!: AutorHistorialDto;
}

export class AdminReporteDetalleDto extends AdminReporteItemDto {
  @ApiProperty()
  descripcion!: string;

  @ApiProperty({ type: [EvidenciaDetalleDto] })
  evidencias!: EvidenciaDetalleDto[];

  @ApiProperty({ type: [HistorialReporteItemDto] })
  historial!: HistorialReporteItemDto[];
}

export class AsignacionReporteResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'REP-000123' })
  numero!: string;

  @ApiProperty({ enum: EstadoReporte, enumName: 'EstadoReporte', example: 'EN_PROCESO' })
  estado!: EstadoReporte;

  @ApiProperty({ enum: PrioridadReporte, enumName: 'PrioridadReporte', example: 'ALTA' })
  prioridad!: PrioridadReporte;

  @ApiProperty({ example: 'Fontanería López' })
  responsable!: string;
}