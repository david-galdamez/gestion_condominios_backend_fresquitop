import { ApiProperty } from '@nestjs/swagger';
import { UnidadResumenDto } from '@Unidades/dto';
import { EstadoCuota } from '@PrismaClient';

export class CuotaPorPagarDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '2026-10' })
  periodo!: string;

  @ApiProperty({ example: 45 })
  monto!: number;

  @ApiProperty({ example: '2026-10-10' })
  fechaVencimiento!: string;

  @ApiProperty({ enum: [EstadoCuota.PENDIENTE, EstadoCuota.VENCIDA] })
  estado!: EstadoCuota;
}

export class CuotasPorPagarDto {
  @ApiProperty({ type: UnidadResumenDto, nullable: true })
  unidad!: UnidadResumenDto | null;

  @ApiProperty({ type: [UnidadResumenDto] })
  unidades!: UnidadResumenDto[];

  @ApiProperty({ type: [CuotaPorPagarDto], description: 'Pendientes y vencidas, de la más antigua a la más nueva.' })
  cuotas!: CuotaPorPagarDto[];
}

/** Respuesta 201 de POST /pagos. */
export class PagoAprobadoDto {
  @ApiProperty({ example: 'TX-20261102-000123' })
  numeroTransaccion!: string;

  @ApiProperty({ example: 'APROBADO' })
  estado!: 'APROBADO';

  @ApiProperty({ example: 90 })
  monto!: number;

  @ApiProperty({ example: '4242' })
  ultimos4!: string;

  @ApiProperty({ example: '2026-11-02T16:15:00.000Z' })
  fecha!: string;

  @ApiProperty({ type: [String], format: 'uuid' })
  cuotas!: string[];
}

export class CuotaPagadaDto {
  @ApiProperty({ example: '2026-10' })
  periodo!: string;

  @ApiProperty({ example: 45 })
  monto!: number;
}

/** GET /pagos/:numeroTransaccion */
export class ComprobanteDto {
  @ApiProperty({ example: 'TX-20261102-000123' })
  numeroTransaccion!: string;

  @ApiProperty({ example: '2026-11-02T16:15:00.000Z' })
  fecha!: string;

  @ApiProperty({ example: 90 })
  monto!: number;

  @ApiProperty({ example: 'A-101' })
  unidad!: string;

  @ApiProperty({ example: '4242' })
  ultimos4!: string;

  @ApiProperty({ example: 'Ana López' })
  titular!: string;

  @ApiProperty({ type: [CuotaPagadaDto] })
  cuotas!: CuotaPagadaDto[];
}
