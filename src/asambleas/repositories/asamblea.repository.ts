import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { EstadoAsamblea, Prisma } from '@PrismaClient';
import type { CrearAsambleaDto } from '../dto/crear-asamblea.dto.js';
import { CodigoVerificacionColisionError, UnidadYaVotoError } from '../errors/index.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

export interface DatosVotoNuevo {
  temaId: string;
  opcionId: string;
  codigoVerificacion: string;
}

export interface VotoRegistrado {
  temaId: string;
  codigoVerificacion: string;
  createdAt: Date;
}

function esErrorP2002(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === UNIQUE_CONSTRAINT_VIOLATION;
  }
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === UNIQUE_CONSTRAINT_VIOLATION
  );
}

function esColisionCodigoVerificacion(error: unknown): boolean {
  const detalle =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? `${error.message} ${JSON.stringify(error.meta ?? {})}`
      : `${error instanceof Error ? error.message : String(error)} ${JSON.stringify(error)}`;
  return /codigo_verificacion|codigoVerificacion/i.test(detalle);
}

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
      include: {
        temas: {
          orderBy: { orden: 'asc' },
          include: { opciones: { orderBy: { orden: 'asc' } } },
        },
      },
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

  async obtenerDatosResultados(id: string) {
    // El include ya trae 'votos' y los temas/opciones.
    return this.prisma.asamblea.findUnique({
      where: { id },
      include: {
        votos: { select: { unidadId: true } },
        temas: {
          orderBy: { orden: 'asc' },
          include: {
            opciones: {
              orderBy: { orden: 'asc' },
              include: { _count: { select: { votos: true } } },
            },
          },
        },
      },
    });
  }

  async buscarComprobante(codigo: string) {
    return this.prisma.voto.findUnique({
      where: { codigoVerificacion: codigo },
      include: {
        tema: {
          include: { asamblea: { select: { titulo: true } } },
        },
      },
    });
  }

  listar() {
    return this.prisma.asamblea.findMany({
      orderBy: { createdAt: 'desc' },
      include: { temas: { include: { opciones: true } } },
    });
  }

  async listarParaResidente(unidadId: string | null) {
    const asambleas = await this.prisma.asamblea.findMany({
      where: { estado: { not: EstadoAsamblea.BORRADOR } },
      orderBy: { fechaApertura: 'desc' },
      include: {
        temas: {
          orderBy: { orden: 'asc' },
          include: { opciones: { orderBy: { orden: 'asc' } } },
        },
      },
    });

    if (!unidadId || asambleas.length === 0) {
      return asambleas.map((asamblea) => ({ asamblea, votosUnidad: [] as VotoRegistrado[] }));
    }

    const votos = await this.prisma.voto.findMany({
      where: {
        unidadId,
        asambleaId: { in: asambleas.map((a) => a.id) },
      },
      select: { asambleaId: true, temaId: true, codigoVerificacion: true, createdAt: true },
    });

    const votosPorAsamblea = new Map<string, VotoRegistrado[]>();
    for (const voto of votos) {
      const lista = votosPorAsamblea.get(voto.asambleaId) ?? [];
      lista.push({
        temaId: voto.temaId,
        codigoVerificacion: voto.codigoVerificacion,
        createdAt: voto.createdAt,
      });
      votosPorAsamblea.set(voto.asambleaId, lista);
    }

    return asambleas.map((asamblea) => ({
      asamblea,
      votosUnidad: votosPorAsamblea.get(asamblea.id) ?? [],
    }));
  }

  async findDetalleConVotosUnidad(id: string, unidadId: string | null) {
    const asamblea = await this.findById(id);
    if (!asamblea) return null;

    const votosUnidad: VotoRegistrado[] = unidadId
      ? await this.prisma.voto.findMany({
          where: { asambleaId: id, unidadId },
          select: { temaId: true, codigoVerificacion: true, createdAt: true },
        })
      : [];

    return { asamblea, votosUnidad };
  }

  async registrarVotosEnTransaccion(
    asambleaId: string,
    unidadId: string,
    residenteId: string,
    votos: DatosVotoNuevo[],
  ): Promise<VotoRegistrado[]> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const votoExistente = await tx.voto.findFirst({
          where: {
            unidadId,
            temaId: { in: votos.map((v) => v.temaId) },
          },
          select: { id: true },
        });

        if (votoExistente) {
          throw new UnidadYaVotoError();
        }

        const registrados: VotoRegistrado[] = [];
        for (const item of votos) {
          const creado = await tx.voto.create({
            data: {
              asambleaId,
              temaId: item.temaId,
              opcionId: item.opcionId,
              unidadId,
              residenteId,
              codigoVerificacion: item.codigoVerificacion,
            },
            select: {
              temaId: true,
              codigoVerificacion: true,
              createdAt: true,
            },
          });
          registrados.push(creado);
        }

        return registrados;
      });
    } catch (error) {
      if (error instanceof UnidadYaVotoError) {
        throw error;
      }
      if (esErrorP2002(error)) {
        if (esColisionCodigoVerificacion(error)) {
          throw new CodigoVerificacionColisionError();
        }
        throw new UnidadYaVotoError();
      }
      throw error;
    }
  }
}