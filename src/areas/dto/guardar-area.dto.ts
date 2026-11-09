import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
  type ValidationArguments,
} from 'class-validator';

export const MSG_NOMBRE = 'El nombre debe tener entre 3 y 40 caracteres';
export const MSG_CAPACIDAD = 'La capacidad debe estar entre 1 y 200 personas';
export const MSG_HORA = 'La hora debe ser en punto, en formato HH:00 (24 h)';
export const MSG_HORARIO = 'La hora de cierre debe ser posterior a la de apertura';
export const MSG_DURACION = 'La duración máxima debe estar entre 1 y 8 horas';

/** Duración máxima por reserva cuando el administrador no la indica. */
export const DURACION_MAX_DEFAULT = 3;

/** Solo horas en punto: 00:00 a 23:00. */
export const HORA_EN_PUNTO = /^([01]\d|2[0-3]):00$/;

const aTexto = (value: unknown) => (typeof value === 'string' ? value.trim() : value);

/** El cierre se compara con otra propiedad del DTO. "HH:00" compara igual como texto que como hora. */
function PosteriorA(otra: string, message: string) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'posteriorA',
      target: target.constructor,
      propertyName,
      options: { message },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const otraHora = (args.object as Record<string, unknown>)[otra];
          // Si alguna no tiene formato, ese error ya lo reporta @Matches.
          if (typeof value !== 'string' || typeof otraHora !== 'string') return true;
          if (!HORA_EN_PUNTO.test(value) || !HORA_EN_PUNTO.test(otraHora)) return true;
          return value > otraHora;
        },
      },
    });
}

/** Cuerpo de POST /areas y PUT /areas/:id (el PUT reemplaza la configuración completa). */
export class GuardarAreaDto {
  @ApiProperty({ minLength: 3, maxLength: 40, example: 'Salón de eventos' })
  @Transform(({ value }) => aTexto(value))
  @IsString({ message: MSG_NOMBRE })
  @MinLength(3, { message: MSG_NOMBRE })
  @MaxLength(40, { message: MSG_NOMBRE })
  nombre!: string;

  @ApiProperty({ minimum: 1, maximum: 200, example: 80 })
  @IsInt({ message: MSG_CAPACIDAD })
  @Min(1, { message: MSG_CAPACIDAD })
  @Max(200, { message: MSG_CAPACIDAD })
  capacidad!: number;

  @ApiProperty({ example: '08:00', description: 'HH:00, hora en punto (24 h).' })
  @Matches(HORA_EN_PUNTO, { message: MSG_HORA })
  horaApertura!: string;

  @ApiProperty({ example: '22:00', description: 'HH:00, posterior a horaApertura.' })
  @Matches(HORA_EN_PUNTO, { message: MSG_HORA })
  @PosteriorA('horaApertura', MSG_HORARIO)
  horaCierre!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 8, default: DURACION_MAX_DEFAULT })
  @IsOptional()
  @IsInt({ message: MSG_DURACION })
  @Min(1, { message: MSG_DURACION })
  @Max(8, { message: MSG_DURACION })
  duracionMaxHoras: number = DURACION_MAX_DEFAULT;
}
