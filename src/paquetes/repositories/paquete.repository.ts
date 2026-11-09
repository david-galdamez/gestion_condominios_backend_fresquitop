import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { EstadoPaquete, type Prisma } from '@PrismaClient';

/** Lo que ve portería: sin el código de retiro (no se selecciona). */
const SELECT_PORTERIA = {
  id: true,
  codigoPaquete: true,
  destinatario: true,
  mensajeria: true,
  guia: true,
  estado: true,
  recibidoEn: true,
  unidad: { select: { codigo: true } },
} satisfies Prisma.PaqueteSelect;

export type PaquetePorteria = Prisma.PaqueteGetPayload<{ select: typeof SELECT_PORTERIA }>;

export type NuevoPaquete = Pick<
  Prisma.PaqueteUncheckedCreateInput,
  'codigoPaquete' | 'codigoRetiro' | 'unidadId' | 'destinatario' | 'mensajeria' | 'guia' | 'fotoUrl' | 'recibidoPorId'
>;

/** Pendientes de retirar: los que siguen en portería, incluidos los retenidos. */
export const ESTADOS_POR_RETIRAR = [EstadoPaquete.EN_PORTERIA, EstadoPaquete.RETENIDO];

/** Único punto que habla con `paquete`. Sin borrado físico. */
@Injectable()
export class PaqueteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** "PAQ-000123" desde la secuencia de la base: no se repite aunque registren dos guardias a la vez. */
  async siguienteCodigo(): Promise<string> {
    const [{ n }] = await this.prisma.$queryRaw<{ n: number }[]>`SELECT nextval('paquete_codigo_seq')::int AS n`;
    return `PAQ-${String(n).padStart(6, '0')}`;
  }

  create(data: NuevoPaquete): Promise<PaquetePorteria> {
    return this.prisma.paquete.create({ data, select: SELECT_PORTERIA });
  }

  /** Más recientes primero. */
  findPorRetirar(): Promise<PaquetePorteria[]> {
    return this.prisma.paquete.findMany({
      where: { estado: { in: ESTADOS_POR_RETIRAR } },
      select: SELECT_PORTERIA,
      orderBy: { recibidoEn: 'desc' },
    });
  }
}
