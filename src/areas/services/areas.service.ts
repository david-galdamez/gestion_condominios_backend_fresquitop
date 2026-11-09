import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AreaNombreDuplicadoError } from '@Areas/errors';
import { AreaRepository, type DatosArea } from '@Areas/repositories';
import type { AreaDto, GuardarAreaDto } from '@Areas/dto';
import { Rol, type AreaComun } from '@PrismaClient';

export const MSG_NOMBRE_DUPLICADO = 'Ya existe un área con ese nombre';
export const MSG_AREA_NO_EXISTE = 'El área no existe';

/** "HH:00" -> Date en 1970-01-01 UTC, que es como Prisma maneja @db.Time. */
const aHoraUtc = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

/** Serializa en UTC: @db.Time llega como instante UTC y otra zona lo correría. */
export function aDto(a: AreaComun): AreaDto {
  return {
    id: a.id,
    nombre: a.nombre,
    capacidad: a.capacidad,
    horaApertura: a.horaApertura.toISOString().slice(11, 16),
    horaCierre: a.horaCierre.toISOString().slice(11, 16),
    duracionMaxHoras: a.duracionMaxHoras,
    activa: a.activa,
  };
}

const aDatos = (dto: GuardarAreaDto): DatosArea => ({
  nombre: dto.nombre,
  capacidad: dto.capacidad,
  horaApertura: aHoraUtc(dto.horaApertura),
  horaCierre: aHoraUtc(dto.horaCierre),
  duracionMaxHoras: dto.duracionMaxHoras,
});

@Injectable()
export class AreasService {
  constructor(private readonly areas: AreaRepository) {}

  /** El administrador ve todas; el residente solo las activas. */
  async listar(rol: Rol): Promise<{ datos: AreaDto[] }> {
    const filas = await this.areas.findAll(rol !== Rol.ADMINISTRADOR);
    return { datos: filas.map(aDto) };
  }

  async crear(dto: GuardarAreaDto): Promise<AreaDto> {
    await this.asegurarNombreLibre(dto.nombre);
    return aDto(await this.guardarOConflicto(() => this.areas.create(aDatos(dto))));
  }

  /** Cambiar el horario no toca las reservas Confirmadas ya hechas (H03, criterio 3). */
  async actualizar(id: string, dto: GuardarAreaDto): Promise<AreaDto> {
    await this.obtener(id);
    await this.asegurarNombreLibre(dto.nombre, id);
    return aDto(await this.guardarOConflicto(() => this.areas.update(id, aDatos(dto))));
  }

  /** Desactivar solo bloquea reservas nuevas; las futuras Confirmadas se mantienen. */
  async cambiarEstado(id: string, activa: boolean): Promise<AreaDto> {
    const actual = await this.obtener(id);
    if (actual.activa === activa) return aDto(actual);
    return aDto(await this.areas.setActiva(id, activa));
  }

  private async obtener(id: string): Promise<AreaComun> {
    const area = await this.areas.findById(id);
    if (!area) throw new NotFoundException(MSG_AREA_NO_EXISTE);
    return area;
  }

  private async asegurarNombreLibre(nombre: string, excluirId?: string): Promise<void> {
    if (await this.areas.existeNombre(nombre, excluirId)) throw new ConflictException(MSG_NOMBRE_DUPLICADO);
  }

  /** Dos altas simultáneas pueden pasar la consulta previa: el índice único decide. */
  private async guardarOConflicto(guardar: () => Promise<AreaComun>): Promise<AreaComun> {
    try {
      return await guardar();
    } catch (error) {
      if (error instanceof AreaNombreDuplicadoError) throw new ConflictException(MSG_NOMBRE_DUPLICADO);
      throw error;
    }
  }
}
