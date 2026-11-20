import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AsambleaRepository } from '../repositories/index.js';
import { NotificacionService } from '@Notificaciones/services';
import type { CrearAsambleaDto } from '../dto/crear-asamblea.dto.js';
import { ConflictException } from '@nestjs/common';
import type { ResultadoAsambleaDto, TemaResultadoDto, ComprobanteVerificacionDto } from '../dto/resultado-asamblea.dto.js';

const MSG_CIERRE = 'El cierre debe ser al menos 1 hora después de la apertura';
const MSG_PUBLICAR = 'Publica con al menos 48 horas de anticipación';

@Injectable()
export class AsambleaService {
  private readonly logger = new Logger(AsambleaService.name);

  constructor(
    private readonly repo: AsambleaRepository,
    private readonly notificaciones: NotificacionService,
  ) { }

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

  async listar() {
    return this.repo.listar();
  }

  async obtenerResultados(id: string): Promise<ResultadoAsambleaDto> {
    const asamblea = await this.repo.obtenerDatosResultados(id);

    if (!asamblea) throw new NotFoundException('La asamblea no existe');
    if (asamblea.estado === 'ABIERTA') {
      throw new ConflictException('Los resultados estarán disponibles al cerrar la votación');
    }

    const totalUnidades = await this.repo.contarUnidadesActivas();
    const unidadesQueVotaron = new Set<string>(
      (asamblea.votos as Array<{ unidadId: string }>).map((v) => v.unidadId)
    ).size;
    const participacion = totalUnidades > 0 ? Math.round((unidadesQueVotaron / totalUnidades) * 1000) / 10 : 0;

    const temas: TemaResultadoDto[] = asamblea.temas.map(tema => {
      const opciones = tema.opciones.map(op => ({
        opcionId: op.id,
        texto: op.texto,
        votos: op._count.votos,
      }));

      const totalVotosTema = opciones.reduce((acc, o) => acc + o.votos, 0);
      const opcionesConPorcentaje = opciones.map(o => ({
        ...o,
        porcentaje: totalVotosTema > 0 ? Math.round((o.votos / totalVotosTema) * 1000) / 10 : 0,
      }));

      let ganadora: string | null = null;
      let empate = false;
      let mensajeEmpate: string | undefined;

      if (totalVotosTema > 0) {
        const maxVotos = Math.max(...opcionesConPorcentaje.map(o => o.votos));
        const ganadoras = opcionesConPorcentaje.filter(o => o.votos === maxVotos);

        if (ganadoras.length > 1) {
          empate = true;
          mensajeEmpate = `Empate entre: ${ganadoras.map(g => g.texto).join(' y ')}`;
        } else {
          ganadora = ganadoras[0].texto;
        }
      }

      return { temaId: tema.id, titulo: tema.titulo, opciones: opcionesConPorcentaje, ganadora, empate, mensajeEmpate };
    });

    return { asambleaId: id, estado: asamblea.estado, participacion, temas };
  }

  async verificarComprobante(codigo: string): Promise<ComprobanteVerificacionDto> {
    const voto = await this.repo.buscarComprobante(codigo);
    if (!voto) throw new NotFoundException('Código de verificación no encontrado');

    return {
      valido: true,
      tema: voto.tema.titulo,
      asamblea: voto.tema.asamblea.titulo,
      fecha: voto.createdAt.toISOString(),
    };
  }
}