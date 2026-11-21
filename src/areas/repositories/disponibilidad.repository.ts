import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { EstadoReserva } from '@PrismaClient';

/** Lo único que la disponibilidad necesita de una reserva: nunca quién ni qué unidad. */
export interface ReservaOcupada {
  areaId: string;
  horaInicio: Date;
  horaFin: Date;
}

/**
 * DB-23.1: reservas Confirmadas de una fecha para las áreas pedidas. Usa el
 * índice (area_id, fecha) de H04. Vive en el módulo de áreas porque reservas
 * ya importa áreas y al revés se formaría un ciclo.
 */
@Injectable()
export class DisponibilidadRepository {
  constructor(private readonly prisma: PrismaService) {}

  findConfirmadas(fecha: Date, areaIds: string[]): Promise<ReservaOcupada[]> {
    if (areaIds.length === 0) return Promise.resolve([]);
    return this.prisma.reserva.findMany({
      where: { fecha, estado: EstadoReserva.CONFIRMADA, areaId: { in: areaIds } },
      select: { areaId: true, horaInicio: true, horaFin: true },
      orderBy: [{ areaId: 'asc' }, { horaInicio: 'asc' }],
    });
  }
}
