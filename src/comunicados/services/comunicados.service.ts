import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ComunicadoRepository, type ComunicadoCompleto } from '@Comunicados/repositories';
import { MSG_EXPIRACION, type ComunicadoDto, type CrearComunicadoDto } from '@Comunicados/dto';
import { NotificacionService } from '@Notificaciones/services';
import { EstadoComunicado } from '@PrismaClient';

export const MSG_TORRE_NO_EXISTE = 'La torre no existe';

/** El contrato de avisos limita título a 80 y mensaje a 300 caracteres. */
const recortar = (texto: string, max: number) => (texto.length <= max ? texto : `${texto.slice(0, max - 1)}…`);

export function aDto(c: ComunicadoCompleto): ComunicadoDto {
  return {
    id: c.id,
    titulo: c.titulo,
    contenido: c.contenido,
    categoria: c.categoria,
    paraTodos: c.paraTodos,
    torres: c.destinos.map((d) => d.torre),
    estado: c.estado,
    fechaPublicacion: c.fechaPublicacion.toISOString(),
    fechaExpiracion: c.fechaExpiracion?.toISOString() ?? null,
    autor: c.autor,
  };
}

/**
 * BE-13.1 / BE-13.2. Envía "Nuevo comunicado: {título}" una vez por torre
 * destino (o con TODOS). Si el aviso falla, el comunicado queda publicado y se
 * registra el error: el administrador no puede hacer nada al respecto.
 */
export async function avisarComunicado(
  notificaciones: NotificacionService,
  logger: Logger,
  c: ComunicadoCompleto,
): Promise<void> {
  const destinos = c.paraTodos
    ? [{ tipo: 'TODOS' as const }]
    : c.destinos.map((d) => ({ tipo: 'TORRE' as const, id: d.torre.id }));
  for (const destinatario of destinos) {
    try {
      await notificaciones.enviar({
        destinatario,
        titulo: recortar(`Nuevo comunicado: ${c.titulo}`, 80),
        mensaje: recortar(c.contenido, 300),
        moduloOrigen: 'COMUNICADOS',
        referencia: `/comunicados/${c.id}`,
      });
    } catch (error) {
      logger.error(`No se pudo avisar del comunicado ${c.id}`, error instanceof Error ? error.stack : error);
    }
  }
}

@Injectable()
export class ComunicadosService {
  private readonly logger = new Logger(ComunicadosService.name);

  constructor(
    private readonly comunicados: ComunicadoRepository,
    private readonly notificaciones: NotificacionService,
  ) {}

  async crear(autorId: string, dto: CrearComunicadoDto, ahora: Date = new Date()): Promise<ComunicadoDto> {
    // Omitida o ya pasada: se publica en este momento.
    const pedida = dto.fechaPublicacion ? new Date(dto.fechaPublicacion) : null;
    const programado = pedida !== null && pedida > ahora;
    const fechaPublicacion = programado ? pedida : ahora;
    const fechaExpiracion = dto.fechaExpiracion ? new Date(dto.fechaExpiracion) : null;
    if (fechaExpiracion && fechaExpiracion <= fechaPublicacion) throw new BadRequestException(MSG_EXPIRACION);

    const paraTodos = dto.destino.todos;
    const torreIds = paraTodos ? [] : [...new Set(dto.destino.torreIds ?? [])];
    if (torreIds.length > 0 && (await this.comunicados.contarTorres(torreIds)) !== torreIds.length) {
      throw new NotFoundException(MSG_TORRE_NO_EXISTE);
    }

    const creado = await this.comunicados.create({
      titulo: dto.titulo,
      contenido: dto.contenido,
      categoria: dto.categoria,
      paraTodos,
      torreIds,
      fechaPublicacion,
      fechaExpiracion,
      estado: programado ? EstadoComunicado.PROGRAMADO : EstadoComunicado.PUBLICADO,
      autorId, // de la sesión
    });

    if (!programado) await avisarComunicado(this.notificaciones, this.logger, creado);
    return aDto(creado);
  }

  async listar(): Promise<{ datos: ComunicadoDto[] }> {
    return { datos: (await this.comunicados.findTodos()).map(aDto) };
  }
}
