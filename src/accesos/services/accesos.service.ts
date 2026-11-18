import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { aFechaUtc, hoyEnZonaNegocio } from '@Common/fechas';
import { AccesoRepository, type AccesoConUnidad } from '@Accesos/repositories';
import type { AccesoDto, RegistrarEntradaDto } from '@Accesos/dto';
import type { AutorizacionDto } from '@Autorizaciones/dto';
import { aDto as autorizacionADto } from '@Autorizaciones/services';
import { UnidadRepository } from '@Unidades/repositories';
import { EstadoAutorizacion, type TipoDocumento } from '@PrismaClient';

export const MSG_CODIGO_NO_EXISTE = 'No existe una autorización con ese código';
export const MSG_CODIGO_OTRA_FECHA = 'Código no válido: es para otra fecha';
export const MSG_UNIDAD_NO_EXISTE = 'La unidad no existe';
export const MSG_ACCESO_NO_EXISTE = 'El registro de acceso no existe';
export const MSG_YA_SALIO = 'Este visitante ya registró su salida';

/** Estado de la autorización como se lee en "Código no válido: está {estado}". */
const ESTADO_CODIGO: Record<EstadoAutorizacion, string> = {
  VIGENTE: 'vigente',
  USADA: 'usado',
  CANCELADA: 'cancelado',
  VENCIDA: 'vencido',
};

export const mensajeCodigoNoValido = (estado: EstadoAutorizacion) => `Código no válido: está ${ESTADO_CODIGO[estado]}`;

export function aAccesoDto(a: AccesoConUnidad): AccesoDto {
  return {
    id: a.id,
    nombre: a.nombre,
    tipoDocumento: a.tipoDocumento,
    numeroDocumento: a.numeroDocumento,
    unidad: a.unidad.codigo,
    motivo: a.motivo,
    preautorizado: a.preautorizado,
    estado: a.estado,
    horaEntrada: a.horaEntrada.toISOString(),
    horaSalida: a.horaSalida?.toISOString() ?? null,
  };
}

@Injectable()
export class AccesosService {
  constructor(
    private readonly accesos: AccesoRepository,
    private readonly unidades: UnidadRepository,
  ) {}

  /** La hora y el guardia salen del servidor y de la sesión, nunca del cliente. */
  async registrarEntrada(guardiaId: string, dto: RegistrarEntradaDto, ahora: Date = new Date()): Promise<AccesoDto> {
    if (dto.codigo !== undefined) {
      const r = await this.accesos.entrarConCodigo(dto.codigo, hoyEnZonaNegocio(ahora), guardiaId);
      switch (r.tipo) {
        case 'ok':
          return aAccesoDto(r.acceso);
        case 'no_existe':
          throw new NotFoundException(MSG_CODIGO_NO_EXISTE);
        case 'otra_fecha':
          throw new ConflictException(MSG_CODIGO_OTRA_FECHA);
        case 'no_vigente':
          throw new ConflictException(mensajeCodigoNoValido(r.estado));
      }
    }

    // Sin código: el DTO ya garantizó que vienen todos los datos.
    const unidadId = dto.unidadId!;
    const unidad = await this.unidades.findById(unidadId);
    if (!unidad || !unidad.activa) throw new NotFoundException(MSG_UNIDAD_NO_EXISTE);

    const acceso = await this.accesos.entrarSinCodigo({
      unidadId,
      nombre: dto.nombre!,
      tipoDocumento: dto.tipoDocumento as TipoDocumento,
      numeroDocumento: dto.numeroDocumento!,
      motivo: dto.motivo!,
      entradaPorId: guardiaId,
    });
    return aAccesoDto(acceso);
  }

  /** Guarda la salida en el mismo registro. Una segunda salida responde 409. */
  async registrarSalida(id: string, guardiaId: string, ahora: Date = new Date()): Promise<AccesoDto> {
    const count = await this.accesos.marcarSalida(id, guardiaId, ahora);
    const acceso = await this.accesos.findById(id);
    if (!acceso) throw new NotFoundException(MSG_ACCESO_NO_EXISTE);
    if (count === 0) throw new ConflictException(MSG_YA_SALIO);
    return aAccesoDto(acceso);
  }

  async buscarDentro(q: string): Promise<{ datos: AccesoDto[] }> {
    const filas = await this.accesos.findDentro(q);
    return { datos: filas.map(aAccesoDto) };
  }

  async buscarAutorizacionesDeHoy(q: string, ahora: Date = new Date()): Promise<{ datos: AutorizacionDto[] }> {
    const filas = await this.accesos.findAutorizacionesDeHoy(q, aFechaUtc(hoyEnZonaNegocio(ahora)));
    return { datos: filas.map(autorizacionADto) };
  }
}
