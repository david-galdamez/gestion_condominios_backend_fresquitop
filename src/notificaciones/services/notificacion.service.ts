import { Injectable, NotFoundException } from '@nestjs/common';
import { Rol } from '@PrismaClient';
import { DatoInvalidoError, DestinoNoExisteError } from '@Notificaciones/errors';
import { NotificacionRepository } from '@Notificaciones/repositories';
import {
  MODULOS_ORIGEN,
  TIPOS_DESTINO,
  type Aviso,
  type DestinatarioAviso,
  type EnviarAvisoInput,
  type ModuloOrigen,
  type ResultadoEnvio,
  type TipoDestino,
} from '@Notificaciones/types';


const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export {
  DatoInvalidoError,
  DestinoNoExisteError,
  MODULOS_ORIGEN,
  TIPOS_DESTINO,
  type Aviso,
  type DestinatarioAviso,
  type EnviarAvisoInput,
  type ModuloOrigen,
  type ResultadoEnvio,
  type TipoDestino,
};

export function validarAviso(aviso: EnviarAvisoInput): void {
  if (!aviso || typeof aviso !== 'object') {
    throw new DatoInvalidoError('falta el aviso');
  }

  const { destinatario, titulo, mensaje, moduloOrigen, referencia } = aviso;

  if (!destinatario || !TIPOS_DESTINO.includes(destinatario.tipo)) {
    throw new DatoInvalidoError('falta el destinatario o el tipo no es válido');
  }

  if (destinatario.tipo !== 'TODOS') {
    if (!destinatario.id || typeof destinatario.id !== 'string') {
      throw new DatoInvalidoError('falta el id del destinatario');
    }
    if (!UUID_REGEX.test(destinatario.id)) {
      throw new DatoInvalidoError('el id del destinatario debe ser un UUID válido');
    }
  }

  if (typeof titulo !== 'string' || titulo.trim().length < 1 || titulo.length > 80) {
    throw new DatoInvalidoError('el título debe tener entre 1 y 80 caracteres');
  }

  if (typeof mensaje !== 'string' || mensaje.trim().length < 1 || mensaje.length > 300) {
    throw new DatoInvalidoError('el mensaje debe tener entre 1 y 300 caracteres');
  }

  if (!MODULOS_ORIGEN.includes(moduloOrigen)) {
    throw new DatoInvalidoError('módulo de origen no válido');
  }

  if (referencia !== undefined) {
    if (typeof referencia !== 'string' || referencia.length > 200) {
      throw new DatoInvalidoError('la referencia supera 200 caracteres');
    }
  }
}

/**
 * Servicio interno común de notificaciones (H18).
 * Sin rutas HTTP: solo es inyectado por otros servicios del backend.
 */
@Injectable()
export class NotificacionService {
  constructor(private readonly repo: NotificacionRepository) {}

  async enviar(aviso: EnviarAvisoInput): Promise<ResultadoEnvio> {
    validarAviso(aviso);

    const residenteIds = await this.resolverDestinatarios(aviso.destinatario);

    return this.repo.crearConDestinatarios(
      {
        moduloOrigen: aviso.moduloOrigen,
        titulo: aviso.titulo,
        mensaje: aviso.mensaje,
        referencia: aviso.referencia,
        destinoTipo: aviso.destinatario.tipo,
        destinoId: aviso.destinatario.tipo === 'TODOS' ? undefined : aviso.destinatario.id,
      },
      residenteIds,
    );
  }

    async listarMisNotificaciones(residenteId: string, pagina: number = 1) {
    const porPagina = 20;
    const { registros, total } = await this.repo.listarPorResidente(residenteId, pagina, porPagina);
    const totalPaginas = Math.ceil(total / porPagina);

    const datos = registros.map((r) => ({
      id: r.notificacion.id,
      titulo: r.notificacion.titulo,
      mensaje: r.notificacion.mensaje,
      moduloOrigen: r.notificacion.moduloOrigen,
      referencia: r.notificacion.referencia,
      leida: r.leida,
      leidaEn: r.leidaEn?.toISOString() ?? null,
      createdAt: r.notificacion.createdAt.toISOString(),
    }));

    return { datos, total, pagina, totalPaginas };
  }

  async contarNoLeidas(residenteId: string) {
    const noLeidas = await this.repo.contarNoLeidas(residenteId);
    return { noLeidas };
  }

  async marcarComoLeida(residenteId: string, notificacionId: string) {
    const existe = await this.repo.existeNotificacionParaResidente(residenteId, notificacionId);
    if (!existe) throw new NotFoundException('Aviso no encontrado');

    await this.repo.marcarComoLeida(residenteId, notificacionId);
    return { success: true };
  }

  async marcarTodasComoLeidas(residenteId: string) {
    await this.repo.marcarTodasComoLeidas(residenteId);
    return { success: true };
  }

  private async resolverDestinatarios(destinatario: DestinatarioAviso): Promise<string[]> {
    switch (destinatario.tipo) {
      case 'USUARIO': {
        const usuarioId = destinatario.id as string;
        const usuario = await this.repo.findUsuarioById(usuarioId);
        if (!usuario) {
          throw new DestinoNoExisteError('USUARIO', usuarioId);
        }
        return usuario.rol === Rol.RESIDENTE && usuario.isActive ? [usuario.id] : [];
      }

      case 'UNIDAD': {
        const unidadId = destinatario.id as string;
        const existe = await this.repo.existsUnidad(unidadId);
        if (!existe) {
          throw new DestinoNoExisteError('UNIDAD', unidadId);
        }
        return this.repo.findResidentesActivosPorUnidad(unidadId);
      }

      case 'TORRE': {
        const torreId = destinatario.id as string;
        const existe = await this.repo.existsTorre(torreId);
        if (!existe) {
          throw new DestinoNoExisteError('TORRE', torreId);
        }
        return this.repo.findResidentesActivosPorTorre(torreId);
      }

      case 'TODOS':
        return this.repo.findTodosResidentesActivos();
    }
  }
}