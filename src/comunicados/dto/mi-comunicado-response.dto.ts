import { ApiProperty } from '@nestjs/swagger';
import { CategoriaComunicado } from '@PrismaClient';

/** Fila de la lista del residente (H14). */
export class MiComunicadoResumenDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Corte de agua el sábado' })
  titulo!: string;

  @ApiProperty({ enum: CategoriaComunicado, enumName: 'CategoriaComunicado' })
  categoria!: CategoriaComunicado;

  @ApiProperty({ example: '2026-11-20T14:00:00.000Z' })
  fechaPublicacion!: string;

  @ApiProperty({ description: 'true si el residente ya lo abrió.' })
  leido!: boolean;
}

export class MisComunicadosResponseDto {
  @ApiProperty({ type: MiComunicadoResumenDto, isArray: true })
  datos!: MiComunicadoResumenDto[];

  @ApiProperty({
    example: 15,
    description: 'Total de la pestaña (sin paginar).',
  })
  total!: number;

  @ApiProperty({ example: 1 })
  pagina!: number;
}

export class ConteoNoLeidosDto {
  @ApiProperty({
    example: 3,
    description: 'Comunicados vigentes que el residente aún no abre.',
  })
  noLeidos!: number;
}

/** Detalle que ve el residente al abrir un comunicado; abrirlo lo deja leído. */
export class MiComunicadoDetalleDto extends MiComunicadoResumenDto {
  @ApiProperty()
  contenido!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '2026-11-30T23:59:00.000Z',
  })
  fechaExpiracion!: string | null;

  @ApiProperty({
    description: 'true si ya expiró (aparece en la pestaña "Archivo").',
  })
  archivado!: boolean;
}
