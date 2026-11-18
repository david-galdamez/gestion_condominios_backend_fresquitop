import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class PendientesQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Unidad a pagar. Por defecto, la primera por código.' })
  @IsOptional()
  @IsUUID()
  unidadId?: string;
}
