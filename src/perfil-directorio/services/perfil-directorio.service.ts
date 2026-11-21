import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { DatosDirectorioDto, GuardarPerfilDirectorioDto, PerfilDirectorioDto } from '@PerfilDirectorio/dto';
import {
  PERFIL_OCULTO,
  PerfilDirectorioRepository,
  type DatosResidente,
  type OpcionesPerfil,
} from '@PerfilDirectorio/repositories';

export const MSG_SIN_TELEFONO = 'Registra tu teléfono para poder mostrarlo';

/** Todos los datos propios, sin filtrar. */
export function misDatos(d: DatosResidente): DatosDirectorioDto {
  return {
    nombre: d.nombre,
    unidad: d.unidades.length > 0 ? d.unidades.join(', ') : null,
    telefono: d.telefono,
    correo: d.correo,
  };
}

/**
 * Lo que ve un vecino: solo los datos marcados, el resto null (H15, criterio 4).
 * Devuelve null si el perfil está oculto. H16 debe usar esta misma función
 * para que un dato no marcado nunca salga en la respuesta del servidor.
 */
export function aplicarPrivacidad(p: OpcionesPerfil, d: DatosResidente): DatosDirectorioDto | null {
  if (!p.visible) return null;
  const todos = misDatos(d);
  return {
    nombre: p.mostrarNombre ? todos.nombre : null,
    unidad: p.mostrarUnidad ? todos.unidad : null,
    telefono: p.mostrarTelefono ? todos.telefono : null,
    correo: p.mostrarCorreo ? todos.correo : null,
  };
}

const opciones = (p: OpcionesPerfil): OpcionesPerfil => ({
  visible: p.visible,
  mostrarNombre: p.mostrarNombre,
  mostrarUnidad: p.mostrarUnidad,
  mostrarTelefono: p.mostrarTelefono,
  mostrarCorreo: p.mostrarCorreo,
});

@Injectable()
export class PerfilDirectorioService {
  constructor(private readonly perfiles: PerfilDirectorioRepository) {}

  /** Sin fila (usuario anterior a H15) se responde como oculto, sin escribir nada. */
  async obtener(residenteId: string): Promise<PerfilDirectorioDto> {
    const [perfil, datos] = await Promise.all([
      this.perfiles.findByResidente(residenteId),
      this.datos(residenteId),
    ]);
    return this.aDto(perfil ? opciones(perfil) : PERFIL_OCULTO, datos);
  }

  /** El residente sale de la sesión: no hay forma de cambiar el perfil de otro. */
  async guardar(residenteId: string, dto: GuardarPerfilDirectorioDto): Promise<PerfilDirectorioDto> {
    const actuales = await this.datos(residenteId);
    // Omitido: se conserva el teléfono guardado; null o vacío: se borra.
    const telefono = dto.telefono === undefined ? actuales.telefono : dto.telefono;
    if (dto.mostrarTelefono && !telefono) throw new BadRequestException(MSG_SIN_TELEFONO);

    const guardado = await this.perfiles.guardar(residenteId, opciones(dto), dto.telefono);
    return this.aDto(opciones(guardado), { ...actuales, telefono });
  }

  private async datos(residenteId: string): Promise<DatosResidente> {
    const d = await this.perfiles.datosResidente(residenteId);
    if (!d) throw new NotFoundException('El residente no existe');
    return d;
  }

  private aDto(p: OpcionesPerfil, d: DatosResidente): PerfilDirectorioDto {
    return { ...p, misDatos: misDatos(d), vistaPrevia: aplicarPrivacidad(p, d) };
  }
}
