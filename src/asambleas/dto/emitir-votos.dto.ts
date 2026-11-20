import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class VotoItemDto {
  @IsUUID('all', { message: 'El temaId debe ser un UUID válido' })
  temaId!: string;

  @IsUUID('all', { message: 'El opcionId debe ser un UUID válido' })
  opcionId!: string;
}

export class EmitirVotosDto {
  @IsArray({ message: 'Los votos deben enviarse en un arreglo' })
  @ArrayMinSize(1, { message: 'Debe enviar al menos 1 voto' })
  @ArrayMaxSize(10, { message: 'Máximo 10 votos por petición' })
  @ArrayUnique((item: VotoItemDto) => item?.temaId, {
    message: 'No se pueden enviar temas repetidos en la misma petición',
  })
  @ValidateNested({ each: true })
  @Type(() => VotoItemDto)
  votos!: VotoItemDto[];
}

export class ComprobanteVotoDto {
  temaId!: string;
  codigoVerificacion!: string;
  fecha!: string;
}

export class EmitirVotosResponseDto {
  comprobantes!: ComprobanteVotoDto[];
}