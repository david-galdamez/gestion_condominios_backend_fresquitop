export class OpcionResultadoDto {
  opcionId!: string;
  texto!: string;
  votos!: number;
  porcentaje!: number;
}

export class TemaResultadoDto {
  temaId!: string;
  titulo!: string;
  opciones!: OpcionResultadoDto[];
  ganadora!: string | null;
  empate!: boolean;
  mensajeEmpate?: string;
}

export class ResultadoAsambleaDto {
  asambleaId!: string;
  estado!: string;
  participacion!: number;
  temas!: TemaResultadoDto[];
}

export class ComprobanteVerificacionDto {
  valido!: boolean;
  tema!: string;
  asamblea!: string;
  fecha!: string;
}