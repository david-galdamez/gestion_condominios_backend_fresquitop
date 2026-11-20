import { Injectable, NotFoundException } from '@nestjs/common';
import { ComunicadoRepository } from '@Comunicados/repositories';
import {
  MIS_COMUNICADOS_POR_PAGINA,
  type ConteoNoLeidosDto,
  type MiComunicadoDetalleDto,
  type MisComunicadosQueryDto,
  type MisComunicadosResponseDto,
} from '@Comunicados/dto';
import { EstadoComunicado } from '@PrismaClient';

export const MSG_COMUNICADO_NO_ENCONTRADO = 'Comunicado no encontrado';

/**
 * H14 · Comunicados que le aplican al residente: los de todo el condominio y
 * los de las torres de sus unidades. Las torres salen de la sesión.
 */
@Injectable()
export class MisComunicadosService {
  constructor(private readonly comunicados: ComunicadoRepository) {}

  async listar(
    residenteId: string,
    { archivo, pagina }: MisComunicadosQueryDto,
    ahora: Date = new Date(),
  ): Promise<MisComunicadosResponseDto> {
    const torreIds = await this.comunicados.torresDeResidente(residenteId);
    const [filas, total] = await this.comunicados.findDeResidente({
      residenteId,
      torreIds,
      archivo,
      ahora,
      skip: (pagina - 1) * MIS_COMUNICADOS_POR_PAGINA,
      take: MIS_COMUNICADOS_POR_PAGINA,
    });
    return {
      datos: filas.map((c) => ({
        id: c.id,
        titulo: c.titulo,
        categoria: c.categoria,
        fechaPublicacion: c.fechaPublicacion.toISOString(),
        leido: c.lecturas.length > 0,
      })),
      total,
      pagina,
    };
  }

  async contarNoLeidos(residenteId: string, ahora: Date = new Date()): Promise<ConteoNoLeidosDto> {
    const torreIds = await this.comunicados.torresDeResidente(residenteId);
    return {
      noLeidos: await this.comunicados.contarNoLeidos({
        residenteId,
        torreIds,
        ahora,
      }),
    };
  }

  /** Abrirlo lo deja leído. Uno de otra torre, programado o inexistente responde 404. */
  async abrir(residenteId: string, id: string, ahora: Date = new Date()): Promise<MiComunicadoDetalleDto> {
    const torreIds = await this.comunicados.torresDeResidente(residenteId);
    const c = await this.comunicados.findDeResidenteById(id, torreIds);
    if (!c) throw new NotFoundException(MSG_COMUNICADO_NO_ENCONTRADO);

    await this.comunicados.registrarLectura(c.id, residenteId);
    return {
      id: c.id,
      titulo: c.titulo,
      contenido: c.contenido,
      categoria: c.categoria,
      fechaPublicacion: c.fechaPublicacion.toISOString(),
      fechaExpiracion: c.fechaExpiracion?.toISOString() ?? null,
      archivado: c.estado === EstadoComunicado.EXPIRADO || (c.fechaExpiracion !== null && c.fechaExpiracion <= ahora),
      leido: true,
    };
  }
}
