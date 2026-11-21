import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export enum FiltroPaquetes {
  POR_RETIRAR = 'POR_RETIRAR',
  ENTREGADOS = 'ENTREGADOS',
  TODOS = 'TODOS',
}

export class MisPaquetesQueryDto {
  @IsOptional()
  @IsEnum(FiltroPaquetes, { message: 'Filtro no válido' })
  filtro: FiltroPaquetes = FiltroPaquetes.TODOS;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  pagina: number = 1;
}