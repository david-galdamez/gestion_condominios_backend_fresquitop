export class OpcionDetalleDto {
  id!: string;
  texto!: string;
  orden!: number;
}

export class TemaDetalleResidenteDto {
  id!: string;
  titulo!: string;
  orden!: number;
  yaVoto!: boolean;
  codigoVerificacion!: string | null;
  fechaVoto!: string | null;
  opciones!: OpcionDetalleDto[];
}

export class DetalleAsambleaResidenteDto {
  id!: string;
  titulo!: string;
  descripcion!: string;
  fechaApertura!: string;
  fechaCierre!: string;
  estado!: string;
  temasVotados!: string[];
  temas!: TemaDetalleResidenteDto[];
}