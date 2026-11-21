import { randomInt } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ArchivosService, type ArchivoSubido } from '@Archivos/services';
import { NotificacionService } from '@Notificaciones/services';
import { MSG_FOTO, type PaqueteDto, type RegistrarPaqueteDto } from '@Paquetes/dto';
import { PaqueteRepository, type PaquetePorteria } from '@Paquetes/repositories';
import { UnidadRepository } from '@Unidades/repositories';
import { Mensajeria } from '@PrismaClient';

export const MSG_UNIDAD_NO_EXISTE = 'La unidad no existe';
export const MSG_UNIDAD_SIN_RESIDENTES = 'La unidad no tiene residentes registrados';
export const TITULO_AVISO = 'Tienes un paquete en portería';

const NOMBRE_MENSAJERIA: Record<Mensajeria, string> = {
  CORREOS: 'Correos',
  DHL: 'DHL',
  FEDEX: 'FedEx',
  UPS: 'UPS',
  AMAZON: 'Amazon',
  OTRA: 'Otra mensajería',
};

export function aDto(p: PaquetePorteria): PaqueteDto {
  return {
    id: p.id,
    codigoPaquete: p.codigoPaquete,
    unidad: p.unidad.codigo,
    destinatario: p.destinatario,
    mensajeria: p.mensajeria,
    guia: p.guia,
    estado: p.estado,
    recibidoEn: p.recibidoEn.toISOString(),
  };
}

/** 6 dígitos aleatorios (con ceros a la izquierda). Solo lo ve el residente. */
export const generarCodigoRetiro = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

@Injectable()
export class PaquetesService {
  private readonly logger = new Logger(PaquetesService.name);

  constructor(
    private readonly paquetes: PaqueteRepository,
    private readonly unidades: UnidadRepository,
    private readonly archivos: ArchivosService,
    private readonly notificaciones: NotificacionService,
  ) {}

  async registrar(guardiaId: string, dto: RegistrarPaqueteDto, foto?: ArchivoSubido): Promise<PaqueteDto> {
    const extension = this.archivos.extensionImagen(foto);
    if (!foto || !extension) throw new BadRequestException(MSG_FOTO);

    const unidad = await this.unidades.findById(dto.unidadId);
    if (!unidad || !unidad.activa) throw new NotFoundException(MSG_UNIDAD_NO_EXISTE);
    if ((await this.unidades.contarResidentesActivos(unidad.id)) === 0) {
      throw new ConflictException(MSG_UNIDAD_SIN_RESIDENTES);
    }

    const fotoUrl = await this.archivos.guardar('paquetes', foto, extension);
    let paquete: PaquetePorteria;
    try {
      paquete = await this.paquetes.create({
        codigoPaquete: await this.paquetes.siguienteCodigo(),
        codigoRetiro: generarCodigoRetiro(),
        unidadId: unidad.id,
        destinatario: dto.destinatario,
        mensajeria: dto.mensajeria,
        guia: dto.guia ?? null,
        fotoUrl,
        recibidoPorId: guardiaId, // de la sesión, nunca del body
      });
    } catch (error) {
      // Sin paquete no tiene sentido conservar la foto.
      await this.archivos.borrar(fotoUrl);
      throw error;
    }

    await this.avisar(unidad.id, paquete);
    return aDto(paquete);
  }

  async listarPorRetirar(): Promise<{ datos: PaqueteDto[] }> {
    const filas = await this.paquetes.findPorRetirar();
    return { datos: filas.map(aDto) };
  }

  /**
   * BE-9.2. El paquete ya quedó registrado: si el aviso falla se deja en el
   * log y no se revierte el registro (el guardia no puede hacer nada al respecto).
   */
  private async avisar(unidadId: string, p: PaquetePorteria): Promise<void> {
    try {
      await this.notificaciones.enviar({
        destinatario: { tipo: 'UNIDAD', id: unidadId },
        titulo: TITULO_AVISO,
        mensaje: `${NOMBRE_MENSAJERIA[p.mensajeria]} · ${p.codigoPaquete}`,
        moduloOrigen: 'PAQUETERIA',
        referencia: `/paquetes/${p.id}`,
      });
    } catch (error) {
      this.logger.error(`No se pudo avisar del paquete ${p.codigoPaquete}`, error instanceof Error ? error.stack : error);
    }
  }

    async listarMisPaquetes(userId: string, filtro: string, pagina: number) {
    const unidadId = await this.paquetes.obtenerUnidadDelUsuario(userId);
    if (!unidadId) throw new NotFoundException('Usuario sin unidad asignada');
    
    const { registros, total } = await this.paquetes.listarPorUnidad(unidadId, filtro, pagina);
    const totalPaginas = Math.ceil(total / 20);

    const datos = registros.map((p) => ({
      id: p.id,
      codigoPaquete: p.codigoPaquete,
      recibidoEn: p.recibidoEn.toISOString(),
      mensajeria: p.mensajeria,
      estado: p.estado,
      entregadoEn: p.estado === 'ENTREGADO' ? p.updatedAt.toISOString() : null,
    }));

    return { datos, total, pagina, totalPaginas };
  }

  async obtenerDetallePaquete(userId: string, paqueteId: string) {
    const unidadId = await this.paquetes.obtenerUnidadDelUsuario(userId);
    if (!unidadId) throw new NotFoundException('Usuario sin unidad asignada');
    
    const paquete = await this.paquetes.buscarPorIdYUnidad(paqueteId, unidadId);
    if (!paquete) throw new NotFoundException('Paquete no encontrado');

    const mostrarCodigo = paquete.estado === 'EN_PORTERIA' || paquete.estado === 'RETENIDO';

    return {
      id: paquete.id,
      codigoPaquete: paquete.codigoPaquete,
      codigoRetiro: mostrarCodigo ? paquete.codigoRetiro : null,
      mensajeria: paquete.mensajeria,
      estado: paquete.estado,
      recibidoEn: paquete.recibidoEn.toISOString(),
      entregadoEn: paquete.estado === 'ENTREGADO' ? paquete.updatedAt.toISOString() : null,
    };
  }
}
