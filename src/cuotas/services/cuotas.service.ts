import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { aFechaUtc, hoyEnZonaNegocio } from '@Common/fechas';
import {
  ConfiguracionCuotaRepository,
  GeneracionCuotaRepository,
} from '@Cuotas/repositories';
import type {
  ConfiguracionCuotaDto,
  GeneracionCuotasDto,
  GuardarConfiguracionDto,
} from '@Cuotas/dto';
import { OrigenGeneracion, type ConfiguracionCuota } from '@PrismaClient';
import { fechaVencimiento } from '../periodos.js';

export const MSG_SIN_CONFIGURACION = 'No existe configuración de cuota';

export function aConfiguracionDto(
  c: ConfiguracionCuota,
): ConfiguracionCuotaDto {
  return {
    montoMensual: c.montoMensual.toNumber(),
    diaVencimiento: c.diaVencimiento,
    vigenteDesde: hoyEnZonaNegocio(c.createdAt),
  };
}

@Injectable()
export class CuotasService {
  constructor(
    private readonly configuraciones: ConfiguracionCuotaRepository,
    private readonly generaciones: GeneracionCuotaRepository,
  ) {}

  async obtenerConfiguracion(): Promise<ConfiguracionCuotaDto> {
    const vigente = await this.configuraciones.findVigente();
    if (!vigente) throw new NotFoundException(MSG_SIN_CONFIGURACION);
    return aConfiguracionDto(vigente);
  }

  /** Inserta una configuración nueva; las cuotas ya generadas conservan su monto. */
  async guardarConfiguracion(
    adminId: string,
    dto: GuardarConfiguracionDto,
  ): Promise<ConfiguracionCuotaDto> {
    const creada = await this.configuraciones.create({
      montoMensual: dto.montoMensual,
      diaVencimiento: dto.diaVencimiento,
      creadaPorId: adminId,
    });
    return aConfiguracionDto(creada);
  }

  /**
   * Genera las cuotas del periodo con la configuración vigente. Es idempotente:
   * repetir el mismo periodo devuelve creadas = 0 y omitidas = unidades activas.
   */
  async generar(
    periodo: string,
    origen: OrigenGeneracion,
    ejecutadaPorId: string | null,
  ): Promise<GeneracionCuotasDto> {
    const config = await this.configuraciones.findVigente();
    if (!config) throw new ConflictException(MSG_SIN_CONFIGURACION);

    const { creadas, omitidas } = await this.generaciones.generar({
      periodo,
      monto: config.montoMensual,
      fechaVencimiento: aFechaUtc(
        fechaVencimiento(periodo, config.diaVencimiento),
      ),
      origen,
      ejecutadaPorId,
    });
    return { periodo, creadas, omitidas };
  }

  generarManual(
    adminId: string,
    periodo: string,
  ): Promise<GeneracionCuotasDto> {
    return this.generar(periodo, OrigenGeneracion.MANUAL, adminId);
  }
}
