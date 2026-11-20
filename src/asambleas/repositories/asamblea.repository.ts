import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { EstadoAsamblea } from '@PrismaClient';
import type { CrearAsambleaDto } from '../dto/crear-asamblea.dto.js';

@Injectable()
export class AsambleaRepository {
  constructor(private readonly prisma: PrismaService) {}

  crear(creadaPorId: string, dto: CrearAsambleaDto) {
    return this.prisma.asamblea.create({
      data: {
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        fechaApertura: new Date(dto.fechaApertura),
        fechaCierre: new Date(dto.fechaCierre),
        estado: EstadoAsamblea.BORRADOR,
        creadaPorId,
        temas: {
          create: dto.temas.map((t, i) => ({
            titulo: t.titulo,
            orden: i + 1,
            opciones: { create: t.opciones.map((o, oi) => ({ texto: o.texto, orden: oi + 1 })) },
          })),
        },
      },
      include: { temas: { include: { opciones: true } } },
    });
  }

  findById(id: string) {
    return this.prisma.asamblea.findUnique({
      where: { id },
      include: { temas: { include: { opciones: true } } },
    });
  }

  contarUnidadesActivas() {
    return this.prisma.unidad.count({ where: { activa: true } });
  }

  async marcarPublicada(id: string): Promise<boolean> {
    const { count } = await this.prisma.asamblea.updateMany({
      where: { id, estado: EstadoAsamblea.BORRADOR },
      data: { estado: EstadoAsamblea.PUBLICADA, publicadaEn: new Date() },
    });
    return count === 1;
  }
}
