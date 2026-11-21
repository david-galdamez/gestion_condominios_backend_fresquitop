import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export const MOROSIDAD_PAGE_SIZE = 20;

export class MorosidadQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filtra las unidades morosas por el UUID de la torre.',
  })
  @IsOptional()
  @IsUUID('all', { message: 'torreId debe ser un UUID válido' })
  torreId?: string;

  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
    description: 'Número de página (20 registros por página).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pagina debe ser un número entero' })
  @Min(1, { message: 'pagina debe ser mayor o igual a 1' })
  pagina: number = 1;
}
