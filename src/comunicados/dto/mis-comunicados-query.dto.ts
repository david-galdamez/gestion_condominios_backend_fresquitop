import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, Min } from 'class-validator';

export const MIS_COMUNICADOS_POR_PAGINA = 20;
export const MSG_ARCHIVO = 'archivo debe ser true o false';
export const MSG_PAGINA = 'pagina debe ser un número entero mayor o igual a 1';

/** "true"/"false" del query string a booleano; cualquier otro valor llega tal cual y falla la validación. */
const aBooleano = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);

export class MisComunicadosQueryDto {
  @ApiPropertyOptional({
    default: false,
    description: 'false = pestaña principal (vigentes); true = pestaña "Archivo" (expirados).',
  })
  @Transform(aBooleano)
  @IsBoolean({ message: MSG_ARCHIVO })
  archivo: boolean = false;

  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
    description: `Página (${MIS_COMUNICADOS_POR_PAGINA} por página).`,
  })
  @Type(() => Number)
  @IsInt({ message: MSG_PAGINA })
  @Min(1, { message: MSG_PAGINA })
  pagina: number = 1;
}
