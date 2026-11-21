import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, Matches, registerDecorator, type ValidationArguments } from 'class-validator';

export const MSG_AL_MENOS_UN_DATO = 'Elige al menos un dato para mostrar';
export const MSG_TELEFONO = 'El teléfono debe tener 8 dígitos y empezar con 2, 6 o 7 (ej. 7044-2727)';
/** Formato guardado: ####-####, fijo (2) o móvil (6, 7) de El Salvador. */
export const TELEFONO_GUARDADO = /^[267]\d{3}-\d{4}$/;

/**
 * "7044 2727", "70442727" o "7044-2727" -> "7044-2727". Vacío -> null (borra el
 * teléfono). Lo que no tenga 8 dígitos se deja igual para que falle la validación.
 */
export function normalizarTelefono(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  const limpio = value.trim();
  if (limpio === '') return null;
  const digitos = limpio.replace(/[\s-]/g, '');
  return /^\d{8}$/.test(digitos) ? `${digitos.slice(0, 4)}-${digitos.slice(4)}` : limpio;
}
const MSG_BOOLEANO = 'Debe ser verdadero o falso';

/** visible = true exige al menos una casilla marcada. Mira las otras propiedades del DTO. */
function ConAlMenosUnDato(message: string) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'conAlMenosUnDato',
      target: target.constructor,
      propertyName,
      options: { message },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (value !== true) return true;
          const o = args.object as GuardarPerfilDirectorioDto;
          return [o.mostrarNombre, o.mostrarUnidad, o.mostrarTelefono, o.mostrarCorreo].some((v) => v === true);
        },
      },
    });
}

/**
 * Cuerpo de PUT /directorio/mi-perfil. No lleva id de residente: el perfil es
 * siempre el del usuario de la sesión (y forbidNonWhitelisted rechaza un id).
 */
export class GuardarPerfilDirectorioDto {
  @ApiProperty({ description: 'Aparecer en el directorio. true exige al menos un dato marcado.' })
  @IsBoolean({ message: MSG_BOOLEANO })
  @ConAlMenosUnDato(MSG_AL_MENOS_UN_DATO)
  visible!: boolean;

  @ApiProperty()
  @IsBoolean({ message: MSG_BOOLEANO })
  mostrarNombre!: boolean;

  @ApiProperty()
  @IsBoolean({ message: MSG_BOOLEANO })
  mostrarUnidad!: boolean;

  @ApiProperty()
  @IsBoolean({ message: MSG_BOOLEANO })
  mostrarTelefono!: boolean;

  @ApiProperty()
  @IsBoolean({ message: MSG_BOOLEANO })
  mostrarCorreo!: boolean;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    example: '7044-2727',
    description: 'Hotfix 1.0.1. Omitido: no cambia. Vacío o null: lo borra. Acepta 8 dígitos con o sin guion.',
  })
  @IsOptional()
  @Transform(({ value }) => normalizarTelefono(value))
  @Matches(TELEFONO_GUARDADO, { message: MSG_TELEFONO })
  telefono?: string | null;
}
