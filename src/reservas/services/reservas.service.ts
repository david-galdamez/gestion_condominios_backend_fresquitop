import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { aFechaUtc, hoyEnZonaNegocio } from '@Common/fechas';
import { AreaRepository } from '@Areas/repositories';
import { UnidadRepository } from '@Unidades/repositories';
import { EstadoReserva } from '@PrismaClient';
import type { CrearReservaDto, ReservaDto, MisReservasResponseDto } from '@Reservas/dto';
import { ReservaHorarioOcupadoError } from '@Reservas/errors';
import { ReservaRepository, type ReservaConDetalle } from '@Reservas/repositories';

export const MSG_CRUCE_RESERVA = 'Ese horario ya está reservado';
export const MSG_AREA_NO_DISPONIBLE = 'El área no existe o está inactiva';
export const MSG_FECHA_PASADA = 'No puedes reservar en una fecha pasada';
export const MSG_FUERA_HORARIO = 'Fuera del horario del área';
export const MSG_NO_CANCELAR = 'Ya no puedes cancelar esta reserva';
export const MS_24_HORAS = 24 * 60 * 60 * 1000;

const aHoraUtc = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const horaTexto = (fecha: Date) => fecha.toISOString().slice(11, 16);
const minutos = (hhmm: string) => {
  const [hora, minuto] = hhmm.split(':').map(Number);
  return hora * 60 + minuto;
};

/** En El Salvador la hora local del negocio es UTC-6; date/time se comparan como valores locales. */
function fechaHoraLocal(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hora}:00-06:00`);
}

export function reservaADto(reserva: ReservaConDetalle): ReservaDto {
  return {
    id: reserva.id,
    codigo: reserva.codigo,
    area: reserva.area.nombre,
    fecha: reserva.fecha.toISOString().slice(0, 10),
    horaInicio: horaTexto(reserva.horaInicio),
    horaFin: horaTexto(reserva.horaFin),
    asistentes: reserva.asistentes,
    estado: reserva.estado,
  };
}

@Injectable()
export class ReservasService {
  constructor(
    private readonly reservas: ReservaRepository,
    private readonly areas: AreaRepository,
    private readonly unidades: UnidadRepository,
  ) {}

  async crear(residenteId: string, dto: CrearReservaDto): Promise<ReservaDto> {
    const area = await this.areas.findById(dto.areaId);
    if (!area || !area.activa) throw new NotFoundException(MSG_AREA_NO_DISPONIBLE);

    const unidades = await this.unidades.findDeUsuario(residenteId);
    if (unidades.length === 0) throw new BadRequestException('No tienes unidades asignadas');
    // H04 no recibe unidadId: se deriva de la sesión y se usa la primera unidad ordenada por código,
    // igual que el flujo de consulta de pagos cuando el residente tiene varias unidades.
    const unidad = unidades[0];

    this.validarReglas(area, dto);

    const fecha = aFechaUtc(dto.fecha);
    const horaInicio = aHoraUtc(dto.horaInicio);
    const horaFin = aHoraUtc(dto.horaFin);

    try {
      return await this.reservas.enTransaccion(async (tx) => {
        const datosHorario = { areaId: area.id, fecha, horaInicio, horaFin };
        if (await this.reservas.hayCruce(tx, datosHorario)) throw new ReservaHorarioOcupadoError();

        const codigo = await this.reservas.siguienteCodigo(tx);
        const reserva = await this.reservas.crear(tx, {
          codigo,
          areaId: area.id,
          unidadId: unidad.id,
          residenteId,
          fecha,
          horaInicio,
          horaFin,
          asistentes: dto.asistentes,
        });
        return reservaADto(reserva);
      });
    } catch (error) {
      if (error instanceof ReservaHorarioOcupadoError) throw new ConflictException(MSG_CRUCE_RESERVA);
      throw error;
    }
  }

  async listarMias(residenteId: string): Promise<MisReservasResponseDto> {
    const filas = await this.reservas.findByResidente(residenteId);
    return { datos: filas.map(reservaADto) };
  }

  async cancelar(id: string, residenteId: string): Promise<ReservaDto> {
    const actual = await this.reservas.findOneDeResidente(id, residenteId);
    if (!actual) throw new NotFoundException('La reserva no existe');
    if (actual.estado !== EstadoReserva.CONFIRMADA) throw new ConflictException(MSG_NO_CANCELAR);

    const fecha = actual.fecha.toISOString().slice(0, 10);
    const hora = horaTexto(actual.horaInicio);
    const inicio = fechaHoraLocal(fecha, hora);
    if (inicio.getTime() - Date.now() < MS_24_HORAS) throw new ConflictException(MSG_NO_CANCELAR);

    // UPDATE condicional: si otra petición ya la canceló, no se devuelve una falsa cancelación.
    const count = await this.reservas.cancelarSiConfirmada(id, residenteId, new Date());
    if (count === 0) throw new ConflictException(MSG_NO_CANCELAR);

    const cancelada = await this.reservas.findOneDeResidente(id, residenteId);
    if (!cancelada) throw new NotFoundException('La reserva no existe');
    return reservaADto(cancelada);
  }

  private validarReglas(
    area: { capacidad: number; horaApertura: Date; horaCierre: Date; duracionMaxHoras: number },
    dto: CrearReservaDto,
  ): void {
    const hoy = hoyEnZonaNegocio();
    if (dto.fecha < hoy || (dto.fecha === hoy && fechaHoraLocal(dto.fecha, dto.horaInicio).getTime() <= Date.now())) {
      throw new BadRequestException(MSG_FECHA_PASADA);
    }

    const apertura = horaTexto(area.horaApertura);
    const cierre = horaTexto(area.horaCierre);
    if (dto.horaInicio < apertura || dto.horaFin > cierre) {
      throw new BadRequestException(MSG_FUERA_HORARIO);
    }

    const duracionHoras = (minutos(dto.horaFin) - minutos(dto.horaInicio)) / 60;
    if (duracionHoras > area.duracionMaxHoras) {
      throw new BadRequestException(`Supera la duración máxima de ${area.duracionMaxHoras} horas`);
    }

    if (dto.asistentes > area.capacidad) {
      throw new BadRequestException(`Supera la capacidad de ${area.capacidad} personas`);
    }
  }
}
