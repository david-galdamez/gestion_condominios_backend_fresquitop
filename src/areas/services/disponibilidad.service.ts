import { Injectable } from '@nestjs/common';
import { aFechaUtc } from '@Common/fechas';
import type { BloqueDto, DisponibilidadDto } from '@Areas/dto';
import { AreaRepository, DisponibilidadRepository, type ReservaOcupada } from '@Areas/repositories';

/** El Salvador no usa horario de verano: la hora local es siempre UTC-6. */
const DESFASE_NEGOCIO = '-06:00';

/** @db.Time llega como instante de 1970-01-01 en UTC: se leen horas y minutos UTC. */
const minutosDelDia = (hora: Date) => hora.getUTCHours() * 60 + hora.getUTCMinutes();
const hhmm = (hora: number) => `${String(hora).padStart(2, '0')}:00`;

/**
 * BE-23.1: bloques de 1 hora desde la apertura hasta el cierre. Un bloque está
 * OCUPADO si se cruza con una reserva Confirmada (inicio < fin del bloque y
 * fin > inicio del bloque) o si ya empezó (solo pasa en la fecha de hoy).
 */
export function calcularBloques(
  area: { horaApertura: Date; horaCierre: Date },
  reservas: Pick<ReservaOcupada, 'horaInicio' | 'horaFin'>[],
  fecha: string,
  ahora: Date,
): BloqueDto[] {
  const bloques: BloqueDto[] = [];
  for (let hora = area.horaApertura.getUTCHours(); hora < area.horaCierre.getUTCHours(); hora++) {
    const desde = hora * 60;
    const hasta = desde + 60;
    const reservado = reservas.some((r) => minutosDelDia(r.horaInicio) < hasta && minutosDelDia(r.horaFin) > desde);
    const yaEmpezo = Date.parse(`${fecha}T${hhmm(hora)}:00${DESFASE_NEGOCIO}`) <= ahora.getTime();
    bloques.push({ inicio: hhmm(hora), fin: hhmm(hora + 1), estado: reservado || yaEmpezo ? 'OCUPADO' : 'LIBRE' });
  }
  return bloques;
}

@Injectable()
export class DisponibilidadService {
  constructor(
    private readonly areas: AreaRepository,
    private readonly reservas: DisponibilidadRepository,
  ) {}

  /** La fecha ya viene validada (hoy a hoy + 30) por DisponibilidadQueryDto. */
  async consultar(fecha: string, ahora: Date = new Date()): Promise<DisponibilidadDto> {
    const areas = await this.areas.findAll(true);
    const ocupadas = await this.reservas.findConfirmadas(
      aFechaUtc(fecha),
      areas.map((a) => a.id),
    );

    const porArea = new Map<string, ReservaOcupada[]>();
    for (const r of ocupadas) porArea.set(r.areaId, [...(porArea.get(r.areaId) ?? []), r]);

    return {
      fecha,
      areas: areas.map((a) => ({
        id: a.id,
        nombre: a.nombre,
        capacidad: a.capacidad,
        bloques: calcularBloques(a, porArea.get(a.id) ?? [], fecha, ahora),
      })),
    };
  }
}
