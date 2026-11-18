import { ApiProperty } from '@nestjs/swagger';
import { UnidadResumenDto } from '@Unidades/dto';
import { EstadoAutorizacion, TipoDocumento } from '@PrismaClient';

export class EditorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ana Residente' })
  nombre!: string;
}

export class AutorizacionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    example: '048213',
    description: '6 dígitos; único por fecha de visita.',
  })
  codigo!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty({ enum: TipoDocumento, enumName: 'TipoDocumento' })
  tipoDocumento!: TipoDocumento;

  @ApiProperty()
  numeroDocumento!: string;

  @ApiProperty({ nullable: true, type: String })
  placa!: string | null;

  @ApiProperty({ example: '2026-11-10', description: 'YYYY-MM-DD' })
  fechaVisita!: string;

  @ApiProperty({ example: '14:30', description: 'HH:mm' })
  horaEstimada!: string;

  @ApiProperty({ enum: EstadoAutorizacion, enumName: 'EstadoAutorizacion' })
  estado!: EstadoAutorizacion;

  @ApiProperty({ type: UnidadResumenDto })
  unidad!: UnidadResumenDto;

  @ApiProperty({
    type: EditorDto,
    nullable: true,
    description: 'Residente que hizo la última edición (H07b); null si nunca se editó.',
  })
  editadoPor!: EditorDto | null;

  @ApiProperty({ example: '2026-11-17T18:00:00.000Z', description: 'Última modificación (updated_at).' })
  actualizadoEn!: string;
}

export class MisAutorizacionesResponseDto {
  @ApiProperty({ type: AutorizacionDto, isArray: true })
  datos!: AutorizacionDto[];
}
