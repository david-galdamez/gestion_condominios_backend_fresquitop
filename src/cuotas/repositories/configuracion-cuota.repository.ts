import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import type { ConfiguracionCuota } from '@PrismaClient';

/** Único punto que habla con `configuracion_cuota`. Solo inserta: cada cambio es historial. */
@Injectable()
export class ConfiguracionCuotaRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** La vigente es la más reciente. */
  findVigente(): Promise<ConfiguracionCuota | null> {
    return this.prisma.configuracionCuota.findFirst({
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: {
    montoMensual: number;
    diaVencimiento: number;
    creadaPorId: string;
  }): Promise<ConfiguracionCuota> {
    return this.prisma.configuracionCuota.create({ data });
  }
}
