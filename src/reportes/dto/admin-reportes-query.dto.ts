import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CategoriaReporte, EstadoReporte } from '@PrismaClient';

export class AdminReportesQueryDto {
  @ApiPropertyOptional({ enum: EstadoReporte, enumName: 'EstadoReporte' })
  @IsOptional()
  @IsEnum(EstadoReporte, { message: 'El estado no es válido' })
  estado?: EstadoReporte;

  @ApiPropertyOptional({ enum: CategoriaReporte, enumName: 'CategoriaReporte' })
  @IsOptional()
  @IsEnum(CategoriaReporte, { message: 'La categoría no es válida' })
  categoria?: CategoriaReporte;

  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'Página (20 registros por página).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1' })
  @Max(100_000)
  pagina: number = 1;
}