import { ApiProperty } from '@nestjs/swagger';
import { DatosDirectorioDto } from '@PerfilDirectorio/dto';

export class DirectorioResponseDto {
  @ApiProperty({
    type: DatosDirectorioDto,
    isArray: true,
    description: 'Solo los datos que cada vecino marcó; el resto llega como null.',
  })
  datos!: DatosDirectorioDto[];

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  pagina!: number;
}
