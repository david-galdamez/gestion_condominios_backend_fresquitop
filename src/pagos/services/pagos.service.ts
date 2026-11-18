import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { hoyEnZonaNegocio } from '@Common/fechas';
import type { ComprobanteDto, CuotasPorPagarDto, PagarCuotasDto, PagoAprobadoDto } from '@Pagos/dto';
import { ClaveIdempotenciaRepetidaError } from '@Pagos/errors';
import { PagoRepository, type CuotaBloqueada, type DatosPago } from '@Pagos/repositories';
import { UnidadRepository, type UnidadResumen } from '@Unidades/repositories';
import { EstadoCuota, EstadoPago, Prisma, type Pago } from '@PrismaClient';
import { PasarelaSimuladaService } from './pasarela-simulada.service.js';

export const MSG_PERMISO = 'No tienes permiso para esta acción';
export const MSG_CUOTA_NO_EXISTE = 'La cuota no existe o no es de tu unidad';
export const MSG_YA_PAGADA = 'Esta cuota ya fue pagada';
export const MSG_UNA_UNIDAD = 'Las cuotas deben ser de una misma unidad';
export const MSG_COMPROBANTE_NO_EXISTE = 'El comprobante no existe';

const aNumero = (d: Prisma.Decimal) => Number(d.toFixed(2));

type Resultado = { tipo: 'aprobado'; pago: Pago; cuotaIds: string[] } | { tipo: 'rechazado'; motivo: string };

@Injectable()
export class PagosService {
  constructor(
    private readonly pagos: PagoRepository,
    private readonly unidades: UnidadRepository,
    private readonly pasarela: PasarelaSimuladaService,
  ) {}

  /** Cuotas Pendientes y Vencidas de una unidad del residente (pantalla de pago). */
  async porPagar(residenteId: string, unidadId?: string): Promise<CuotasPorPagarDto> {
    const unidades = await this.unidades.findDeUsuario(residenteId);
    let unidad: UnidadResumen | null = unidades[0] ?? null;
    if (unidadId) {
      // Unidad ajena o inexistente: 403 igual que estado de cuenta (no revela ids).
      unidad = unidades.find((u) => u.id === unidadId) ?? null;
      if (!unidad) throw new ForbiddenException(MSG_PERMISO);
    }
    if (!unidad) return { unidad: null, unidades, cuotas: [] };

    const cuotas = await this.pagos.findPorPagar(unidad.id);
    return {
      unidad,
      unidades,
      cuotas: cuotas.map((c) => ({
        id: c.id,
        periodo: c.periodo,
        monto: aNumero(c.monto),
        fechaVencimiento: c.fechaVencimiento.toISOString().slice(0, 10),
        estado: c.estado,
      })),
    };
  }

  /**
   * BE-21.2. 201 con el pago aprobado; 422 { estado: RECHAZADO, motivo } si la
   * pasarela rechaza. La misma Idempotency-Key devuelve siempre el pago original.
   */
  async pagar(residenteId: string, clave: string, dto: PagarCuotasDto): Promise<PagoAprobadoDto> {
    const misUnidades = new Set((await this.unidades.findDeUsuario(residenteId)).map((u) => u.id));

    let resultado: Resultado;
    try {
      resultado = await this.procesar(residenteId, misUnidades, clave, dto);
    } catch (error) {
      // Otra solicitud con la misma clave ganó el insert: se responde con ese pago.
      if (!(error instanceof ClaveIdempotenciaRepetidaError)) throw error;
      const original = await this.pagos.findClave(clave);
      if (!original) throw error;
      resultado = this.resultadoDe(original, dto.cuotaIds);
    }

    // El rechazo se lanza fuera de la transacción para que el pago RECHAZADO quede guardado.
    if (resultado.tipo === 'rechazado') {
      throw new UnprocessableEntityException({
        estado: EstadoPago.RECHAZADO,
        motivo: resultado.motivo,
        message: `Pago rechazado: ${resultado.motivo.toLowerCase()}`,
      });
    }
    return this.aprobadoDto(resultado.pago, resultado.cuotaIds);
  }

  /** Comprobante de un pago aprobado de alguna unidad del residente; si no, 404. */
  async comprobante(residenteId: string, numeroTransaccion: string): Promise<ComprobanteDto> {
    const [pago, unidades] = await Promise.all([
      this.pagos.findByNumero(numeroTransaccion),
      this.unidades.findDeUsuario(residenteId),
    ]);
    if (!pago || !pago.numeroTransaccion || !unidades.some((u) => u.id === pago.unidadId)) {
      throw new NotFoundException(MSG_COMPROBANTE_NO_EXISTE);
    }
    return {
      numeroTransaccion: pago.numeroTransaccion,
      fecha: pago.createdAt.toISOString(),
      monto: aNumero(pago.monto),
      unidad: pago.unidad.codigo,
      ultimos4: pago.ultimos4,
      titular: pago.titular,
      cuotas: pago.cuotas.map((c) => ({ periodo: c.cuota.periodo, monto: aNumero(c.monto) })),
    };
  }

  private procesar(
    residenteId: string,
    misUnidades: Set<string>,
    clave: string,
    dto: PagarCuotasDto,
  ): Promise<Resultado> {
    return this.pagos.enTransaccion(async (tx) => {
      // 1. Bloquea las cuotas: una segunda solicitud con las mismas espera aquí
      //    hasta que esta termine, y luego las ve PAGADA (409) sin cobrar.
      const cuotas = await tx.bloquearCuotas(dto.cuotaIds);

      // 2. Misma clave ya procesada (doble clic): se devuelve el original sin cobrar.
      const previo = await tx.findByClave(clave);
      if (previo) return this.resultadoDe(previo, dto.cuotaIds);

      this.validarCuotas(cuotas, dto.cuotaIds, misUnidades);

      const monto = cuotas.reduce((s, c) => s.plus(c.monto), new Prisma.Decimal(0));
      const datos: DatosPago = {
        unidadId: cuotas[0].unidadId,
        residenteId, // de la sesión, nunca del body
        monto,
        ultimos4: dto.tarjeta.numero.slice(-4),
        titular: dto.tarjeta.titular,
        idempotencyKey: clave,
      };

      // 3. Cobro (2 s). Solo viaja la tarjeta; nunca se guarda completa ni el CVV.
      const cobro = await this.pasarela.cobrar(monto, dto.tarjeta);
      if (!cobro.aprobado) {
        await tx.crearRechazado(datos, cobro.motivo);
        return { tipo: 'rechazado', motivo: cobro.motivo };
      }

      // 4. Aprobado: pago + pago_cuota + cuotas PAGADA, todo en esta transacción.
      const numero = await tx.siguienteNumero(hoyEnZonaNegocio().replaceAll('-', ''));
      const pago = await tx.crearAprobado(datos, numero, cuotas);
      await tx.marcarPagadas(
        cuotas.map((c) => c.id),
        new Date(),
      );
      return { tipo: 'aprobado', pago, cuotaIds: cuotas.map((c) => c.id) };
    });
  }

  private validarCuotas(cuotas: CuotaBloqueada[], pedidas: string[], misUnidades: Set<string>): void {
    // Inexistente o de otra unidad: 404 sin distinguir, para no revelar qué ids existen.
    if (cuotas.length !== pedidas.length || cuotas.some((c) => !misUnidades.has(c.unidadId))) {
      throw new NotFoundException(MSG_CUOTA_NO_EXISTE);
    }
    if (new Set(cuotas.map((c) => c.unidadId)).size > 1) throw new BadRequestException(MSG_UNA_UNIDAD);
    if (cuotas.some((c) => c.estado === EstadoCuota.PAGADA)) throw new ConflictException(MSG_YA_PAGADA);
  }

  private resultadoDe(pago: Pago, cuotaIds: string[]): Resultado {
    return pago.estado === EstadoPago.APROBADO
      ? { tipo: 'aprobado', pago, cuotaIds }
      : { tipo: 'rechazado', motivo: pago.motivo ?? 'Pago rechazado' };
  }

  private aprobadoDto(pago: Pago, cuotaIds: string[]): PagoAprobadoDto {
    return {
      numeroTransaccion: pago.numeroTransaccion ?? '',
      estado: EstadoPago.APROBADO,
      monto: aNumero(pago.monto),
      ultimos4: pago.ultimos4,
      fecha: pago.createdAt.toISOString(),
      cuotas: cuotaIds,
    };
  }
}
