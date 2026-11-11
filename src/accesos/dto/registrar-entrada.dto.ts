import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  registerDecorator,
  ValidateIf,
  type ValidationArguments,
} from 'class-validator';
import { TipoDocumento } from '@PrismaClient';

export const MSG_CODIGO = 'El código debe tener 6 dígitos';
export const MSG_NOMBRE = 'El nombre debe tener entre 3 y 60 caracteres';
export const MSG_DOCUMENTO = 'El número de documento no tiene el formato correcto';
export const MSG_MOTIVO = 'El motivo debe tener entre 5 y 100 caracteres';
export const MSG_UNIDAD = 'Selecciona la unidad visitada';
export const MSG_AMBOS = 'Envía el código o los datos del visitante, no ambos';

const DUI = /^\d{8}-\d$/;
const PASAPORTE = /^[A-Z0-9]{6,12}$/;

const aTexto = (value: unknown) => (typeof value === 'string' ? value.trim() : value);

/** Sin código se registra un visitante no pre-autorizado: estos campos aplican. */
const sinCodigo = (o: RegistrarEntradaDto) => o.codigo === undefined;

/** El formato válido depende del tipo de documento (mismas reglas que H07). */
function DocumentoSegunTipo(message: string) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'documentoSegunTipo',
      target: target.constructor,
      propertyName,
      options: { message },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          const { tipoDocumento } = args.object as { tipoDocumento?: TipoDocumento };
          if (tipoDocumento === TipoDocumento.DUI) return DUI.test(value);
          if (tipoDocumento === TipoDocumento.PASAPORTE) return PASAPORTE.test(value);
          return true; // el tipo inválido lo reporta @IsEnum
        },
      },
    });
}

/** Con código no se aceptan datos del visitante: evita registros ambiguos. */
function SoloSiNoHayCodigo(message: string) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'soloSiNoHayCodigo',
      target: target.constructor,
      propertyName,
      options: { message },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const o = args.object as Record<string, unknown>;
          return ['nombre', 'tipoDocumento', 'numeroDocumento', 'unidadId', 'motivo'].every((k) => o[k] === undefined);
        },
      },
    });
}

/**
 * Entrada con código ({ codigo }) o sin pre-autorización
 * ({ nombre, tipoDocumento, numeroDocumento, unidadId, motivo }).
 */
export class RegistrarEntradaDto {
  @ApiPropertyOptional({ example: '048213', description: 'Código de la pre-autorización (6 dígitos).' })
  @ValidateIf((o: RegistrarEntradaDto) => o.codigo !== undefined)
  @Matches(/^\d{6}$/, { message: MSG_CODIGO })
  @SoloSiNoHayCodigo(MSG_AMBOS)
  codigo?: string;

  @ApiPropertyOptional({ minLength: 3, maxLength: 60, example: 'Ana López' })
  @ValidateIf(sinCodigo)
  @Transform(({ value }) => aTexto(value))
  @IsString({ message: MSG_NOMBRE })
  @MinLength(3, { message: MSG_NOMBRE })
  @MaxLength(60, { message: MSG_NOMBRE })
  nombre?: string;

  @ApiPropertyOptional({ enum: TipoDocumento, enumName: 'TipoDocumento' })
  @ValidateIf(sinCodigo)
  @IsEnum(TipoDocumento, { message: 'El tipo de documento debe ser DUI o PASAPORTE' })
  tipoDocumento?: TipoDocumento;

  @ApiPropertyOptional({ example: '01234567-8', description: 'DUI ########-# o pasaporte de 6 a 12 (mayúsculas).' })
  @ValidateIf(sinCodigo)
  @Transform(({ value, obj }: { value: unknown; obj: { tipoDocumento?: unknown } }) => {
    const texto = aTexto(value);
    return typeof texto === 'string' && obj.tipoDocumento === TipoDocumento.PASAPORTE ? texto.toUpperCase() : texto;
  })
  @DocumentoSegunTipo(MSG_DOCUMENTO)
  numeroDocumento?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Unidad visitada.' })
  @ValidateIf(sinCodigo)
  @IsUUID('all', { message: MSG_UNIDAD })
  unidadId?: string;

  @ApiPropertyOptional({ minLength: 5, maxLength: 100, example: 'Entrega de documentos' })
  @ValidateIf(sinCodigo)
  @Transform(({ value }) => aTexto(value))
  @IsString({ message: MSG_MOTIVO })
  @MinLength(5, { message: MSG_MOTIVO })
  @MaxLength(100, { message: MSG_MOTIVO })
  motivo?: string;
}
