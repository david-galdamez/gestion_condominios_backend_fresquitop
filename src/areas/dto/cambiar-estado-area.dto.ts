import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class CambiarEstadoAreaDto {
  @ApiProperty({ description: 'false = Inactiva: no acepta reservas nuevas; las Confirmadas se mantienen.' })
  @IsBoolean({ message: 'activa debe ser verdadero o falso' })
  activa!: boolean;
}
