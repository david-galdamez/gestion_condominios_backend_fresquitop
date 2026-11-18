import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, registerDecorator, type ValidationArguments } from 'class-validator';

export const MSG_AL_MENOS_UN_DATO = 'Elige al menos un dato para mostrar';
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
}
