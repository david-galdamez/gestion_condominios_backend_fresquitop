import { ConflictException } from '@nestjs/common';
import { EstadoReserva } from '@PrismaClient';
import type { AreaRepository } from '@Areas/repositories';
import type { UnidadRepository } from '@Unidades/repositories';
import type { ReservaRepository, ReservaConDetalle } from '@Reservas/repositories';
import { ReservasService, MSG_NO_CANCELAR } from './reservas.service.js';

describe('ReservasService · cancelación', () => {
  const reservas = {
    findOneDeResidente: vi.fn(),
    cancelarSiConfirmada: vi.fn(),
  };
  const service = new ReservasService(
    reservas as unknown as ReservaRepository,
    {} as AreaRepository,
    {} as UnidadRepository,
  );

  const fila = (estado: EstadoReserva = EstadoReserva.CONFIRMADA) => ({
    id: 'reserva-1',
    codigo: 'RES-000001',
    areaId: 'area-1',
    unidadId: 'unidad-1',
    residenteId: 'residente-1',
    fecha: new Date('2026-11-21T00:00:00.000Z'),
    horaInicio: new Date('1970-01-01T10:00:00.000Z'), // representación UTC de 10:00 local
    horaFin: new Date('1970-01-01T11:00:00.000Z'),
    asistentes: 5,
    estado,
    canceladaEn: estado === EstadoReserva.CANCELADA ? new Date() : null,
    createdAt: new Date(),
    updatedAt: new Date(),
    area: { nombre: 'Alberca' },
    unidad: { id: 'unidad-1', codigo: 'A-101' },
  }) as unknown as ReservaConDetalle;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T16:00:00.000Z'));
    vi.resetAllMocks();
    reservas.findOneDeResidente.mockResolvedValue(fila());
    reservas.cancelarSiConfirmada.mockResolvedValue(1);
  });
  afterEach(() => vi.useRealTimers());

  it('permite cancelar cuando faltan exactamente 24 horas', async () => {
    reservas.findOneDeResidente
      .mockResolvedValueOnce(fila())
      .mockResolvedValueOnce(fila(EstadoReserva.CANCELADA));
    const result = await service.cancelar('reserva-1', 'residente-1');
    expect(result.estado).toBe(EstadoReserva.CANCELADA);
    expect(reservas.cancelarSiConfirmada).toHaveBeenCalledOnce();
  });

  it('bloquea la cancelación cuando falta menos de 24 horas', async () => {
    vi.setSystemTime(new Date('2026-11-20T16:00:01.000Z'));
    await expect(service.cancelar('reserva-1', 'residente-1')).rejects.toThrow(
      new ConflictException(MSG_NO_CANCELAR),
    );
    expect(reservas.cancelarSiConfirmada).not.toHaveBeenCalled();
  });
});
