import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { NotificacionService } from '@Notificaciones/services';
import { EstadoAsamblea, Rol, type User } from '@PrismaClient';
import { UnidadRepository } from '@Unidades/repositories';
import type {
  CrearAsambleaDto,
  DetalleAsambleaResidenteDto,
  EmitirVotosDto,
  EmitirVotosResponseDto,
  ResultadoAsambleaDto,
  TemaResultadoDto,
  ComprobanteVerificacionDto,
} from '../dto/index.js';
import {
  AsambleaNoEncontradaError,
  CodigoVerificacionColisionError,
  UnidadYaVotoError,
  VotacionNoAbiertaError,
  VotoInvalidoError,
} from '../errors/index.js';
import { AsambleaRepository, type VotoRegistrado } from '../repositories/index.js';

const MSG_CIERRE = 'El cierre debe ser al menos 1 hora después de la apertura';
const MSG_PUBLICAR = 'Publica con al menos 48 horas de anticipación';
const ALFABETO_CODIGO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LONGITUD_CODIGO = 8;
const MAX_INTENTOS_CODIGO = 5;
const MAX_VOTOS_POR_PETICION = 10;

function generarCodigoVerificacion(): string {
  let codigo = '';
  for (let i = 0; i < LONGITUD_CODIGO; i++) {
    codigo += ALFABETO_CODIGO[randomInt(0, ALFABETO_CODIGO.length)];
  }
  return codigo;
}

function generarCodigosUnicos(cantidad: number): string[] {
  const codigos = new Set<string>();
  while (codigos.size < cantidad) {
    codigos.add(generarCodigoVerificacion());
  }
  return Array.from(codigos);
}

@Injectable()
export class AsambleaService {
  private readonly logger = new Logger(AsambleaService.name);

  constructor(
    private readonly repo: AsambleaRepository,
    private readonly notificaciones: NotificacionService,
    private readonly unidades: UnidadRepository,
  ) {}

  async crear(creadaPorId: string, dto: CrearAsambleaDto) {
    const apertura = new Date(dto.fechaApertura).getTime();
    const cierre = new Date(dto.fechaCierre).getTime();
    if (cierre < apertura + 3_600_000) throw new BadRequestException(MSG_CIERRE);

    return this.repo.crear(creadaPorId, dto);
  }

  async publicar(id: string) {
    const asamblea = await this.repo.findById(id);
    if (!asamblea) throw new NotFoundException('La asamblea no existe');
    if (asamblea.estado !== EstadoAsamblea.BORRADOR) {
      throw new BadRequestException('La asamblea ya fue publicada y no se puede editar');
    }

    const horasRestantes = (asamblea.fechaApertura.getTime() - Date.now()) / 3_600_000;
    if (horasRestantes < 48) throw new BadRequestException(MSG_PUBLICAR);

    const publicado = await this.repo.marcarPublicada(id);
    if (!publicado) throw new BadRequestException('La asamblea ya fue publicada y no se puede editar');

    const unidadesConvocadas = await this.repo.contarUnidadesActivas();

    try {
      await this.notificaciones.enviar({
        destinatario: { tipo: 'TODOS' },
        titulo: `Nueva asamblea: ${asamblea.titulo}`,
        mensaje: `Apertura: ${asamblea.fechaApertura.toLocaleString('es-SV')}. Cierre: ${asamblea.fechaCierre.toLocaleString('es-SV')}.`,
        moduloOrigen: 'VOTACIONES',
        referencia: `/asambleas/${id}`,
      });
    } catch (error) {
      this.logger.error('No se pudo enviar el aviso de asamblea', error instanceof Error ? error.stack : error);
    }

    return { id, estado: EstadoAsamblea.PUBLICADA, publicadaEn: new Date().toISOString(), unidadesConvocadas };
  }

  async listar() {
    return this.repo.listar();
  }

  async listarParaResidente(residenteId: string): Promise<DetalleAsambleaResidenteDto[]> {
    const unidadesUsuario = await this.unidades.findDeUsuario(residenteId);
    const unidadId = unidadesUsuario[0]?.id ?? null;

    const registros = await this.repo.listarParaResidente(unidadId);
    return registros.map(({ asamblea, votosUnidad }) => this.mapearDetalleResidente(asamblea, votosUnidad));
  }

  async obtenerDetalle(
    asambleaId: string,
    user: Pick<User, 'id' | 'rol'>,
  ): Promise<DetalleAsambleaResidenteDto> {
    try {
      let unidadId: string | null = null;
      if (user.rol === Rol.RESIDENTE) {
        const unidadesUsuario = await this.unidades.findDeUsuario(user.id);
        unidadId = unidadesUsuario[0]?.id ?? null;
      }

      const resultado = await this.repo.findDetalleConVotosUnidad(asambleaId, unidadId);
      if (!resultado) {
        throw new AsambleaNoEncontradaError(asambleaId);
      }

      if (user.rol === Rol.RESIDENTE && resultado.asamblea.estado === EstadoAsamblea.BORRADOR) {
        throw new AsambleaNoEncontradaError(asambleaId);
      }

      return this.mapearDetalleResidente(resultado.asamblea, resultado.votosUnidad);
    } catch (error) {
      throw this.mapearErrorDominio(error);
    }
  }

  async emitirVotos(
    asambleaId: string,
    residenteId: string,
    dto: EmitirVotosDto,
  ): Promise<EmitirVotosResponseDto> {
    try {
      this.validarListaVotos(dto);

      const asamblea = await this.repo.findById(asambleaId);
      if (!asamblea) {
        throw new AsambleaNoEncontradaError(asambleaId);
      }

      const ahora = new Date();
      if (
        asamblea.estado !== EstadoAsamblea.ABIERTA ||
        ahora < asamblea.fechaApertura ||
        ahora > asamblea.fechaCierre
      ) {
        throw new VotacionNoAbiertaError();
      }

      this.validarPertenenciaTemasYOpciones(asamblea.temas, dto);

      const unidadesUsuario = await this.unidades.findDeUsuario(residenteId);
      if (unidadesUsuario.length === 0) {
        throw new VotoInvalidoError('No tienes unidades asignadas');
      }
      const unidadId = unidadesUsuario[0].id;

      let registrados: VotoRegistrado[] | undefined;
      for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento++) {
        const codigos = generarCodigosUnicos(dto.votos.length);
        const votosConCodigo = dto.votos.map((voto, idx) => ({
          temaId: voto.temaId,
          opcionId: voto.opcionId,
          codigoVerificacion: codigos[idx],
        }));

        try {
          registrados = await this.repo.registrarVotosEnTransaccion(
            asambleaId,
            unidadId,
            residenteId,
            votosConCodigo,
          );
          break;
        } catch (error) {
          if (error instanceof CodigoVerificacionColisionError) {
            continue;
          }
          throw error;
        }
      }

      if (!registrados) {
        throw new ServiceUnavailableException(
          'No se pudo generar un código de verificación único, intenta de nuevo',
        );
      }

      return {
        comprobantes: registrados.map((voto) => ({
          temaId: voto.temaId,
          codigoVerificacion: voto.codigoVerificacion,
          fecha: voto.createdAt.toISOString(),
        })),
      };
    } catch (error) {
      throw this.mapearErrorDominio(error);
    }
  }

  async obtenerResultados(id: string): Promise<ResultadoAsambleaDto> {
    const asamblea = await this.repo.obtenerDatosResultados(id);

    if (!asamblea) throw new NotFoundException('La asamblea no existe');
    if (asamblea.estado === EstadoAsamblea.ABIERTA) {
      throw new ConflictException('Los resultados estarán disponibles al cerrar la votación');
    }

    const totalUnidades = await this.repo.contarUnidadesActivas();
    const unidadesQueVotaron = new Set<string>(
      (asamblea.votos as Array<{ unidadId: string }>).map((v) => v.unidadId),
    ).size;
    const participacion = totalUnidades > 0 ? Math.round((unidadesQueVotaron / totalUnidades) * 1000) / 10 : 0;

    const temas: TemaResultadoDto[] = asamblea.temas.map((tema) => {
      const opciones = tema.opciones.map((op) => ({
        opcionId: op.id,
        texto: op.texto,
        votos: op._count.votos,
      }));

      const totalVotosTema = opciones.reduce((acc, o) => acc + o.votos, 0);
      const opcionesConPorcentaje = opciones.map((o) => ({
        ...o,
        porcentaje: totalVotosTema > 0 ? Math.round((o.votos / totalVotosTema) * 1000) / 10 : 0,
      }));

      let ganadora: string | null = null;
      let empate = false;
      let mensajeEmpate: string | undefined;

      if (totalVotosTema > 0) {
        const maxVotos = Math.max(...opcionesConPorcentaje.map((o) => o.votos));
        const ganadoras = opcionesConPorcentaje.filter((o) => o.votos === maxVotos);

        if (ganadoras.length > 1) {
          empate = true;
          mensajeEmpate = `Empate entre: ${ganadoras.map((g) => g.texto).join(' y ')}`;
        } else {
          ganadora = ganadoras[0].texto;
        }
      }

      return { temaId: tema.id, titulo: tema.titulo, opciones: opcionesConPorcentaje, ganadora, empate, mensajeEmpate };
    });

    return { asambleaId: id, estado: asamblea.estado, participacion, temas };
  }

  async verificarComprobante(codigo: string): Promise<ComprobanteVerificacionDto> {
    const voto = await this.repo.buscarComprobante(codigo);
    if (!voto) throw new NotFoundException('Código de verificación no encontrado');

    return {
      valido: true,
      tema: voto.tema.titulo,
      asamblea: voto.tema.asamblea.titulo,
      fecha: voto.createdAt.toISOString(),
    };
  }

  private validarListaVotos(dto: EmitirVotosDto): void {
    if (!Array.isArray(dto.votos) || dto.votos.length === 0) {
      throw new VotoInvalidoError('Debe enviar al menos 1 voto');
    }
    if (dto.votos.length > MAX_VOTOS_POR_PETICION) {
      throw new VotoInvalidoError('Máximo 10 votos por petición');
    }

    const temasVistos = new Set<string>();
    for (const item of dto.votos) {
      if (temasVistos.has(item.temaId)) {
        throw new VotoInvalidoError('No se pueden enviar temas repetidos en la misma petición');
      }
      temasVistos.add(item.temaId);
    }
  }

  private validarPertenenciaTemasYOpciones(
    temas: Array<{ id: string; opciones: Array<{ id: string }> }>,
    dto: EmitirVotosDto,
  ): void {
    const opcionesPorTema = new Map<string, Set<string>>();
    for (const tema of temas) {
      opcionesPorTema.set(
        tema.id,
        new Set(tema.opciones.map((opcion) => opcion.id)),
      );
    }

    for (const voto of dto.votos) {
      const opcionesTema = opcionesPorTema.get(voto.temaId);
      if (!opcionesTema) {
        throw new VotoInvalidoError('El tema indicado no pertenece a esta asamblea');
      }
      if (!opcionesTema.has(voto.opcionId)) {
        throw new VotoInvalidoError('La opción indicada no pertenece al tema seleccionado');
      }
    }
  }

  private mapearDetalleResidente(
    asamblea: {
      id: string;
      titulo: string;
      descripcion: string;
      fechaApertura: Date;
      fechaCierre: Date;
      estado: EstadoAsamblea;
      temas: Array<{
        id: string;
        titulo: string;
        orden: number;
        opciones: Array<{ id: string; texto: string; orden: number }>;
      }>;
    },
    votosUnidad: VotoRegistrado[],
  ): DetalleAsambleaResidenteDto {
    const votoPorTema = new Map<string, VotoRegistrado>(
      votosUnidad.map((voto) => [voto.temaId, voto]),
    );

    return {
      id: asamblea.id,
      titulo: asamblea.titulo,
      descripcion: asamblea.descripcion,
      fechaApertura: asamblea.fechaApertura.toISOString(),
      fechaCierre: asamblea.fechaCierre.toISOString(),
      estado: asamblea.estado,
      temasVotados: votosUnidad.map((voto) => voto.temaId),
      temas: asamblea.temas.map((tema) => {
        const votoTema = votoPorTema.get(tema.id);
        return {
          id: tema.id,
          titulo: tema.titulo,
          orden: tema.orden,
          yaVoto: Boolean(votoTema),
          codigoVerificacion: votoTema ? votoTema.codigoVerificacion : null,
          fechaVoto: votoTema ? votoTema.createdAt.toISOString() : null,
          opciones: tema.opciones.map((opcion) => ({
            id: opcion.id,
            texto: opcion.texto,
            orden: opcion.orden,
          })),
        };
      }),
    };
  }

  private mapearErrorDominio(error: unknown): unknown {
    if (error instanceof AsambleaNoEncontradaError) {
      return new NotFoundException(error.message);
    }
    if (error instanceof VotoInvalidoError) {
      return new BadRequestException(error.message);
    }
    if (error instanceof VotacionNoAbiertaError || error instanceof UnidadYaVotoError) {
      return new ConflictException(error.message);
    }
    return error;
  }
}