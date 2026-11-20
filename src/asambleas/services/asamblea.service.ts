import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AsambleaRepository } from '../repositories/index.js';
import { NotificacionService } from '@Notificaciones/services';
import type { CrearAsambleaDto } from '../dto/crear-asamblea.dto.js';

const MSG_CIERRE = 'El cierre debe ser al menos 1 hora después de la apertura';
const MSG_PUBLICAR = 'Publica con al menos 48 horas de anticipación';

@Injectable()
export class AsambleaService {
  private readonly logger = new Logger(AsambleaService.name);

  constructor(
    private readonly repo: AsambleaRepository,
    private readonly notificaciones: NotificacionService,
  ) {}

  async crear(creadaPorId: string, dto: CrearAsambleaDto) {
    const apertura = new Date(dto.fechaApertura).getTime();
    const cierre = new Date(dto.fechaCierre).getTime();
    if (cierre < apertura + 3_600_000) throw new BadRequestException(MSG_CIERRE);

    return this.repo.crear(creadaPorId, dto);
  }

  async publicar(id: string) {
    const asamblea = await this.repo.findById(id);
    if (!asamblea) throw new NotFoundException('La asamblea no existe');
    if (asamblea.estado !== 'BORRADOR') {
      throw new BadRequestException('La asamblea ya fue publicada y no se puede editar');
    }

    const horasRestantes = (asamblea.fechaApertura.getTime() - Date.now()) / 3_600_000;
    if (horasRestantes < 48) throw new BadRequestException(MSG_PUBLICAR);

    const publicado = await this.repo.marcarPublicada(id);
    if (!publicado) throw new BadRequestException('La asamblea ya fue publicada y no se puede editar');

    const unidadesConvocadas = await this.repo.contarUnidadesActivas();

    try {
      await this.notificaciones.enviar({
        destinatario: { tipo: 'TODOS' },
        titulo: `Nueva asamblea: ${asamblea.titulo}`,
        mensaje: `Apertura: ${asamblea.fechaApertura.toLocaleString('es-SV')}. Cierre: ${asamblea.fechaCierre.toLocaleString('es-SV')}.`,
        moduloOrigen: 'VOTACIONES',
        referencia: `/asambleas/${id}`,
      });
    } catch (error) {
      this.logger.error('No se pudo enviar el aviso de asamblea', error instanceof Error ? error.stack : error);
    }

    return { id, estado: 'PUBLICADA', publicadaEn: new Date().toISOString(), unidadesConvocadas };
  }
}