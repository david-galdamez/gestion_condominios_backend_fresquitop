import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Length, Min } from 'class-validator';

export const DIRECTORIO_POR_PAGINA = 20;
export const MSG_BUSQUEDA = 'Escribe entre 2 y 60 caracteres';
export const MSG_PAGINA = 'pagina debe ser un número entero mayor o igual a 1';

/** H16 · GET /directorio?q=&pagina= */
export class BuscarVecinosQueryDto {
  @ApiProperty({
    minLength: 2,
    maxLength: 60,
    example: 'ana',
    description: 'Nombre o unidad. No distingue mayúsculas ni acentos.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: MSG_BUSQUEDA })
  @Length(2, 60, { message: MSG_BUSQUEDA })
  q!: string;

  @ApiPropertyOptional({ minimum: 1, default: 1, description: `Página (${DIRECTORIO_POR_PAGINA} por página).` })
  @Type(() => Number)
  @IsInt({ message: MSG_PAGINA })
  @Min(1, { message: MSG_PAGINA })
  pagina: number = 1;
}
