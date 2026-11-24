import { Injectable } from '@nestjs/common';
import { PerfilDirectorioRepository } from '@PerfilDirectorio/repositories';
import { aplicarPrivacidad } from '@PerfilDirectorio/services';
import type { DatosDirectorioDto } from '@PerfilDirectorio/dto';
import { DIRECTORIO_POR_PAGINA, type BuscarVecinosQueryDto, type DirectorioResponseDto } from '../dto/index.js';

/** Minúsculas y sin acentos: "José" y "jose" son iguales. */
export const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Por nombre; los que ocultan su nombre van al final, ordenados por unidad. */
const porNombreYUnidad = (a: DatosDirectorioDto, b: DatosDirectorioDto) => {
  if (a.nombre !== b.nombre) {
    if (a.nombre === null) return 1;
    if (b.nombre === null) return -1;
    return a.nombre.localeCompare(b.nombre, 'es');
  }
  return (a.unidad ?? '').localeCompare(b.unidad ?? '', 'es');
};

/**
 * H16 · Busca vecinos por nombre o unidad. Primero aplica la privacidad de H15
 * y después compara, así un dato que el vecino no marcó ni sale en la
 * respuesta ni sirve para encontrarlo.
 */
@Injectable()
export class DirectorioService {
  constructor(private readonly perfiles: PerfilDirectorioRepository) {}

  async buscar(residenteId: string, { q, pagina }: BuscarVecinosQueryDto): Promise<DirectorioResponseDto> {
    const buscado = normalizar(q);
    const coincide = (v: DatosDirectorioDto) =>
      [v.nombre, v.unidad].some((campo) => campo !== null && normalizar(campo).includes(buscado));

    const encontrados = (await this.perfiles.findVisibles(residenteId))
      .map((p) => aplicarPrivacidad(p.opciones, p.datos))
      .filter((v): v is DatosDirectorioDto => v !== null && coincide(v))
      .sort(porNombreYUnidad);

    const inicio = (pagina - 1) * DIRECTORIO_POR_PAGINA;
    return {
      datos: encontrados.slice(inicio, inicio + DIRECTORIO_POR_PAGINA),
      total: encontrados.length,
      pagina,
    };
  }
}
