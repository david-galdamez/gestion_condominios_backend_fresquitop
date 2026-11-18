import { ApiProperty } from '@nestjs/swagger';
import { CategoriaComunicado, EstadoComunicado } from '@PrismaClient';

export class TorreResumenDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Torre A' })
  nombre!: string;
}

export class AutorComunicadoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Administración' })
  nombre!: string;
}

export class ComunicadoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  titulo!: string;

  @ApiProperty()
  contenido!: string;

  @ApiProperty({ enum: CategoriaComunicado, enumName: 'CategoriaComunicado' })
  categoria!: CategoriaComunicado;

  @ApiProperty({ description: 'true = todo el condominio.' })
  paraTodos!: boolean;

  @ApiProperty({ type: TorreResumenDto, isArray: true, description: 'Vacío si paraTodos.' })
  torres!: TorreResumenDto[];

  @ApiProperty({ enum: EstadoComunicado, enumName: 'EstadoComunicado' })
  estado!: EstadoComunicado;

  @ApiProperty({ example: '2026-11-20T14:00:00.000Z' })
  fechaPublicacion!: string;

  @ApiProperty({ nullable: true, type: String })
  fechaExpiracion!: string | null;

  @ApiProperty({ type: AutorComunicadoDto, description: 'Administrador que lo publicó.' })
  autor!: AutorComunicadoDto;
}

export class ComunicadosResponseDto {
  @ApiProperty({ type: ComunicadoDto, isArray: true })
  datos!: ComunicadoDto[];
}
