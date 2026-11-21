export class NotificacionDto {
  id!: string;
  titulo!: string;
  mensaje!: string;
  moduloOrigen!: string;
  referencia!: string | null;
  leida!: boolean;
  leidaEn!: string | null;
  createdAt!: string;
}

export class NotificacionesResponseDto {
  datos!: NotificacionDto[];
  total!: number;
  pagina!: number;
  totalPaginas!: number;
}

export class ConteoNoLeidasDto {
  noLeidas!: number;
}