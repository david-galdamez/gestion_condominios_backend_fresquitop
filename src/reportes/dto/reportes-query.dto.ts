import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ReportesQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'Página (tamaño fijo de 20).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  pagina: number = 1;
}
