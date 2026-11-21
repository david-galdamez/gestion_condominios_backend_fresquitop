$ErrorActionPreference = 'Stop'

$root = (Get-Location).Path
if (-not (Test-Path (Join-Path $root 'package.json')) -or -not (Test-Path (Join-Path $root 'prisma/schema.prisma'))) {
    throw 'Ejecuta este script desde la raíz de gestion_condominios_backend_fresquitop (donde están package.json y prisma/schema.prisma).'
}

function Write-ProjectFile([string]$RelativePath, [string]$Content) {
    $fullPath = Join-Path $root $RelativePath
    $directory = Split-Path -Parent $fullPath
    if (-not (Test-Path $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
    Set-Content -LiteralPath $fullPath -Value $Content -Encoding utf8
    Write-Host "Creado: $RelativePath" -ForegroundColor Green
}

function Replace-Required([string]$Text, [string]$Old, [string]$New, [string]$FileName) {
    if (-not $Text.Contains($Old)) { throw "No encontré el bloque esperado en $FileName. No continúo para evitar modificarlo incorrectamente." }
    return $Text.Replace($Old, $New)
}

# 1) Actualizar Prisma: relaciones, enum y modelo Reserva.
$schemaPath = Join-Path $root 'prisma/schema.prisma'
$schema = Get-Content -LiteralPath $schemaPath -Raw -Encoding UTF8
if ($schema -match '(?m)^model Reserva\s*\{') {
    throw 'El modelo Reserva ya existe en prisma/schema.prisma. No ejecutes el script por segunda vez.'
}
$schema = Replace-Required $schema '  @@map("users")' "  reservas Reserva[]`r`n`r`n  @@map(`"users`" )" 'prisma/schema.prisma'
# Normalizar el mapeo exacto que acabamos de editar.
$schema = $schema.Replace('@@map("users" )', '@@map("users")')
$schema = Replace-Required $schema '  @@map("unidad")' "  reservas Reserva[]`r`n`r`n  @@map(`"unidad`" )" 'prisma/schema.prisma'
$schema = $schema.Replace('@@map("unidad" )', '@@map("unidad")')
$schema = Replace-Required $schema '  @@map("area_comun")' "  reservas Reserva[]`r`n`r`n  @@map(`"area_comun`" )" 'prisma/schema.prisma'
$schema = $schema.Replace('@@map("area_comun" )', '@@map("area_comun")')
# Localiza el encabezado H05 de forma tolerante a CRLF/LF y a la codificación
# usada por Windows PowerShell 5.1. No dependemos del acento ni del texto exacto.
$markerMatch = [regex]::Match($schema, '(?m)^// -{20,}\r?\n// H05\b[^\r\n]*')
if (-not $markerMatch.Success) {
    $markerMatch = [regex]::Match($schema, '(?m)^// H05\b[^\r\n]*')
}
$reservaModel = @'
enum EstadoReserva {
  CONFIRMADA
  CANCELADA
  FINALIZADA

  @@map("estado_reserva")
}

// Reserva de un área común (H04). Una reserva cancelada deja libre el horario.
model Reserva {
  id String @id @default(uuid()) @db.Uuid

  // Código legible RES-000123; la secuencia se crea en la migración SQL.
  codigo String @unique @db.VarChar(10)

  areaId String    @map("area_id") @db.Uuid
  area   AreaComun @relation(fields: [areaId], references: [id], onDelete: Restrict)

  unidadId String @map("unidad_id") @db.Uuid
  unidad   Unidad @relation(fields: [unidadId], references: [id], onDelete: Restrict)

  // Siempre se obtiene del usuario autenticado, nunca del body.
  residenteId String @map("residente_id") @db.Uuid
  residente   User   @relation(fields: [residenteId], references: [id], onDelete: Restrict)

  // Fecha y horas locales del negocio, almacenadas como date/time sin zona.
  fecha      DateTime @db.Date
  horaInicio DateTime @map("hora_inicio") @db.Time(0)
  horaFin    DateTime @map("hora_fin") @db.Time(0)
  asistentes Int

  estado      EstadoReserva @default(CONFIRMADA)
  canceladaEn DateTime?     @map("cancelada_en")
  createdAt   DateTime      @default(now()) @map("created_at")
  updatedAt   DateTime      @updatedAt @map("updated_at")

  @@index([areaId, fecha])
  @@index([residenteId, fecha])
  @@map("reserva")
}

'@
if (-not $markerMatch.Success) { throw 'No pude encontrar el encabezado H05 en prisma/schema.prisma. Verifica que estés en develop actualizado.' }
$schema = $schema.Insert($markerMatch.Index, $reservaModel)
Set-Content -LiteralPath $schemaPath -Value $schema -Encoding utf8
Write-Host 'Actualizado: prisma/schema.prisma' -ForegroundColor Green

# 2) Registrar el nuevo módulo en NestJS.
$appPath = Join-Path $root 'src/app.module.ts'
$app = Get-Content -LiteralPath $appPath -Raw -Encoding UTF8
if ($app -notmatch "from '@Reservas'") {
    $app = Replace-Required $app "import { AsambleasModule } from './asambleas/index.js';" "import { ReservasModule } from '@Reservas';`r`nimport { AsambleasModule } from './asambleas/index.js';" 'src/app.module.ts'
}
if ($app -notmatch '(?m)^\s*ReservasModule,') {
    $app = [regex]::Replace($app, '(?m)^([ \t]*)AreasModule,[ \t]*$', '$1AreasModule,' + "`r`n" + '$1ReservasModule,', 1)
}
Set-Content -LiteralPath $appPath -Value $app -Encoding utf8
Write-Host 'Actualizado: src/app.module.ts' -ForegroundColor Green

# 3) Agregar aliases de TypeScript en ambos tsconfig.
foreach ($configName in @('tsconfig.json', 'tsconfig.build.json')) {
    $configPath = Join-Path $root $configName
    $config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8
    if ($config -notmatch '"@Reservas"') {
        $config = Replace-Required $config '"@Areas": ["./src/areas/index.ts"],' ('"@Areas": ["./src/areas/index.ts"],' + "`r`n      `"@Reservas`": [`"./src/reservas/index.ts`"],") $configName
        $config = Replace-Required $config '"@Areas/*": ["./src/areas/*/index.ts"],' ('"@Areas/*": ["./src/areas/*/index.ts"],' + "`r`n      `"@Reservas/*`": [`"./src/reservas/*/index.ts`"],") $configName
    }
    Set-Content -LiteralPath $configPath -Value $config -Encoding utf8
    Write-Host "Actualizado: $configName" -ForegroundColor Green
}

# 4) Registrar la tabla en la limpieza de la base de pruebas.
$fixturesPath = Join-Path $root 'test/helpers/fixtures.ts'
$fixtures = Get-Content -LiteralPath $fixturesPath -Raw -Encoding UTF8
if ($fixtures -notmatch 'TRUNCATE TABLE reserva,') {
    $fixtures = Replace-Required $fixtures 'TRUNCATE TABLE registro_acceso,' 'TRUNCATE TABLE reserva, registro_acceso,' 'test/helpers/fixtures.ts'
    Set-Content -LiteralPath $fixturesPath -Value $fixtures -Encoding utf8
    Write-Host 'Actualizado: test/helpers/fixtures.ts' -ForegroundColor Green
}

# 5) Migración SQL con restricción de exclusión: PostgreSQL impide cruces incluso en concurrencia.
$migration = @'
-- H04 · Reservas de áreas comunes
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "estado_reserva" AS ENUM ('CONFIRMADA', 'CANCELADA', 'FINALIZADA');

CREATE SEQUENCE "reserva_codigo_seq" START 1 MINVALUE 1 MAXVALUE 999999;

CREATE TABLE "reserva" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "area_id" UUID NOT NULL,
    "unidad_id" UUID NOT NULL,
    "residente_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" TIME(0) NOT NULL,
    "hora_fin" TIME(0) NOT NULL,
    "asistentes" INTEGER NOT NULL,
    "estado" "estado_reserva" NOT NULL DEFAULT 'CONFIRMADA',
    "cancelada_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reserva_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reserva_asistentes_chk" CHECK ("asistentes" >= 1),
    CONSTRAINT "reserva_horario_chk" CHECK ("hora_fin" > "hora_inicio")
);

CREATE UNIQUE INDEX "reserva_codigo_key" ON "reserva"("codigo");
CREATE INDEX "reserva_area_id_fecha_idx" ON "reserva"("area_id", "fecha");
CREATE INDEX "reserva_residente_id_fecha_idx" ON "reserva"("residente_id", "fecha");

ALTER TABLE "reserva"
    ADD CONSTRAINT "reserva_area_id_fkey"
    FOREIGN KEY ("area_id") REFERENCES "area_comun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reserva"
    ADD CONSTRAINT "reserva_unidad_id_fkey"
    FOREIGN KEY ("unidad_id") REFERENCES "unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reserva"
    ADD CONSTRAINT "reserva_residente_id_fkey"
    FOREIGN KEY ("residente_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rangos [inicio, fin): reservas consecutivas (09-10 y 10-11) sí se permiten.
-- Solo CONFIRMADA bloquea; CANCELADA y FINALIZADA no ocupan el horario.
ALTER TABLE "reserva"
    ADD CONSTRAINT "reserva_no_cruce"
    EXCLUDE USING gist (
        "area_id" WITH =,
        (tsrange("fecha" + "hora_inicio", "fecha" + "hora_fin", '[)')) WITH &&
    ) WHERE ("estado" = 'CONFIRMADA');

-- Reversión manual (Prisma no ejecuta down.sql automáticamente):
-- ALTER TABLE "reserva" DROP CONSTRAINT "reserva_no_cruce";
-- DROP TABLE "reserva";
-- DROP SEQUENCE "reserva_codigo_seq";
-- DROP TYPE "estado_reserva";
-- DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261120090000_h04_reservas';
'@
Write-ProjectFile 'prisma/migrations/20261120090000_h04_reservas/migration.sql' $migration
Write-ProjectFile 'prisma/migrations/20261120090000_h04_reservas/down.sql' @'
-- Reversión manual de DB-4.1 (ejecutar únicamente si se decide deshacer H04).
DROP TABLE IF EXISTS "reserva";
DROP SEQUENCE IF EXISTS "reserva_codigo_seq";
DROP TYPE IF EXISTS "estado_reserva";
-- btree_gist no se elimina porque puede ser utilizada por otras tablas.
'@

# 6) DTOs y respuesta.
Write-ProjectFile 'src/reservas/dto/crear-reserva.dto.ts' @'
import { ApiProperty } from '@nestjs/swagger';
import { Matches, IsUUID, IsInt, Min, registerDecorator, type ValidationArguments } from 'class-validator';
import { FECHA_ISO, EsFechaReal } from '@Common/fechas';

export const MSG_FECHA_RESERVA = 'La fecha debe tener formato YYYY-MM-DD y ser una fecha real';
export const MSG_HORA_RESERVA = 'La hora debe ser en punto, en formato HH:00 (24 h)';
export const MSG_HORARIO_RESERVA = 'La hora de fin debe ser posterior a la hora de inicio';

export const HORA_EN_PUNTO = /^([01]\d|2[0-3]):00$/;

function PosteriorA(otra: string, message: string) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'posteriorA',
      target: target.constructor,
      propertyName,
      options: { message },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const otraHora = (args.object as Record<string, unknown>)[otra];
          if (typeof value !== 'string' || typeof otraHora !== 'string') return true;
          if (!HORA_EN_PUNTO.test(value) || !HORA_EN_PUNTO.test(otraHora)) return true;
          return value > otraHora;
        },
      },
    });
}

export class CrearReservaDto {
  @ApiProperty({ format: 'uuid', example: '3f0f6b2e-5c1d-4b8e-9a37-0d2f6a1c4e55' })
  @IsUUID('all', { message: 'El área debe ser un UUID válido' })
  areaId!: string;

  @ApiProperty({ format: 'date', example: '2026-11-23', description: 'Fecha local del condominio (YYYY-MM-DD).' })
  @Matches(FECHA_ISO, { message: MSG_FECHA_RESERVA })
  @EsFechaReal(MSG_FECHA_RESERVA)
  fecha!: string;

  @ApiProperty({ example: '09:00', description: 'Hora en punto, formato HH:00 (24 h).' })
  @Matches(HORA_EN_PUNTO, { message: MSG_HORA_RESERVA })
  horaInicio!: string;

  @ApiProperty({ example: '11:00', description: 'Hora en punto y posterior a horaInicio.' })
  @Matches(HORA_EN_PUNTO, { message: MSG_HORA_RESERVA })
  @PosteriorA('horaInicio', MSG_HORARIO_RESERVA)
  horaFin!: string;

  @ApiProperty({ minimum: 1, example: 12 })
  @IsInt({ message: 'El número de asistentes debe ser un entero mayor o igual a 1' })
  @Min(1, { message: 'El número de asistentes debe ser un entero mayor o igual a 1' })
  asistentes!: number;
}
'@

Write-ProjectFile 'src/reservas/dto/reserva-response.dto.ts' @'
import { ApiProperty } from '@nestjs/swagger';
import { EstadoReserva } from '@PrismaClient';

export class ReservaDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'RES-000123' })
  codigo!: string;

  @ApiProperty({ example: 'Alberca' })
  area!: string;

  @ApiProperty({ example: '2026-11-23', format: 'date' })
  fecha!: string;

  @ApiProperty({ example: '09:00' })
  horaInicio!: string;

  @ApiProperty({ example: '11:00' })
  horaFin!: string;

  @ApiProperty({ example: 12 })
  asistentes!: number;

  @ApiProperty({ enum: EstadoReserva, enumName: 'EstadoReserva' })
  estado!: EstadoReserva;
}

export class MisReservasResponseDto {
  @ApiProperty({ type: [ReservaDto] })
  datos!: ReservaDto[];
}
'@
Write-ProjectFile 'src/reservas/dto/index.ts' @'
export * from './crear-reserva.dto.js';
export * from './reserva-response.dto.js';
'@

# 7) Error de dominio y repositorio Prisma.
Write-ProjectFile 'src/reservas/errors/reserva-horario-ocupado.error.ts' @'
/** La restricción PostgreSQL reserva_no_cruce rechazó el INSERT. */
export class ReservaHorarioOcupadoError extends Error {
  constructor() {
    super('Ese horario ya está reservado');
    this.name = 'ReservaHorarioOcupadoError';
  }
}
'@
Write-ProjectFile 'src/reservas/errors/index.ts' @'
export * from './reserva-horario-ocupado.error.js';
'@

Write-ProjectFile 'src/reservas/repositories/reserva.repository.ts' @'
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { ReservaHorarioOcupadoError } from '@Reservas/errors';
import { EstadoReserva, Prisma } from '@PrismaClient';

const INCLUIR_DETALLE = {
  area: { select: { nombre: true } },
  unidad: { select: { id: true, codigo: true } },
} satisfies Prisma.ReservaInclude;

export type ReservaConDetalle = Prisma.ReservaGetPayload<{ include: typeof INCLUIR_DETALLE }>;

export type DatosNuevaReserva = Pick<
  Prisma.ReservaUncheckedCreateInput,
  'codigo' | 'areaId' | 'unidadId' | 'residenteId' | 'fecha' | 'horaInicio' | 'horaFin' | 'asistentes'
>;

function esViolacionNoCruce(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error);
  const meta = error instanceof Prisma.PrismaClientKnownRequestError ? JSON.stringify(error.meta ?? {}) : '';
  return /23P01|reserva_no_cruce|exclusion constraint/i.test(`${mensaje} ${meta}`);
}

/** Único punto que accede a `reserva`. La exclusión de PostgreSQL resuelve las carreras concurrentes. */
@Injectable()
export class ReservaRepository {
  constructor(private readonly prisma: PrismaService) {}

  enTransaccion<T>(trabajo: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(trabajo, { maxWait: 10_000, timeout: 20_000 });
  }

  hayCruce(
    tx: Prisma.TransactionClient,
    datos: { areaId: string; fecha: Date; horaInicio: Date; horaFin: Date },
  ): Promise<boolean> {
    return tx.reserva
      .findFirst({
        where: {
          areaId: datos.areaId,
          fecha: datos.fecha,
          estado: EstadoReserva.CONFIRMADA,
          horaInicio: { lt: datos.horaFin },
          horaFin: { gt: datos.horaInicio },
        },
        select: { id: true },
      })
      .then(Boolean);
  }

  async siguienteCodigo(tx: Prisma.TransactionClient): Promise<string> {
    const filas = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('reserva_codigo_seq') AS n`;
    return `RES-${String(filas[0].n).padStart(6, '0')}`;
  }

  async crear(tx: Prisma.TransactionClient, datos: DatosNuevaReserva): Promise<ReservaConDetalle> {
    try {
      return await tx.reserva.create({ data: datos, include: INCLUIR_DETALLE });
    } catch (error) {
      // La consulta previa mejora el mensaje; esta captura traduce la carrera protegida por la DB.
      if (esViolacionNoCruce(error)) throw new ReservaHorarioOcupadoError();
      throw error;
    }
  }

  findByResidente(residenteId: string): Promise<ReservaConDetalle[]> {
    return this.prisma.reserva.findMany({
      where: { residenteId },
      include: INCLUIR_DETALLE,
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });
  }

  findOneDeResidente(id: string, residenteId: string): Promise<ReservaConDetalle | null> {
    return this.prisma.reserva.findFirst({ where: { id, residenteId }, include: INCLUIR_DETALLE });
  }

  async cancelarSiConfirmada(id: string, residenteId: string, canceladaEn: Date): Promise<number> {
    const { count } = await this.prisma.reserva.updateMany({
      where: { id, residenteId, estado: EstadoReserva.CONFIRMADA },
      data: { estado: EstadoReserva.CANCELADA, canceladaEn },
    });
    return count;
  }
}
'@
Write-ProjectFile 'src/reservas/repositories/index.ts' @'
export * from './reserva.repository.js';
'@

# 8) Servicio con reglas H03/H04 y la ventana de cancelación de 24 horas.
Write-ProjectFile 'src/reservas/services/reservas.service.ts' @'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { aFechaUtc, hoyEnZonaNegocio } from '@Common/fechas';
import { AreaRepository } from '@Areas/repositories';
import { UnidadRepository } from '@Unidades/repositories';
import { EstadoReserva } from '@PrismaClient';
import type { CrearReservaDto, ReservaDto, MisReservasResponseDto } from '@Reservas/dto';
import { ReservaHorarioOcupadoError } from '@Reservas/errors';
import { ReservaRepository, type ReservaConDetalle } from '@Reservas/repositories';

export const MSG_CRUCE_RESERVA = 'Ese horario ya está reservado';
export const MSG_AREA_NO_DISPONIBLE = 'El área no existe o está inactiva';
export const MSG_FECHA_PASADA = 'No puedes reservar en una fecha pasada';
export const MSG_FUERA_HORARIO = 'Fuera del horario del área';
export const MSG_NO_CANCELAR = 'Ya no puedes cancelar esta reserva';
export const MS_24_HORAS = 24 * 60 * 60 * 1000;

const aHoraUtc = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const horaTexto = (fecha: Date) => fecha.toISOString().slice(11, 16);
const minutos = (hhmm: string) => {
  const [hora, minuto] = hhmm.split(':').map(Number);
  return hora * 60 + minuto;
};

/** En El Salvador la hora local del negocio es UTC-6; date/time se comparan como valores locales. */
function fechaHoraLocal(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hora}:00-06:00`);
}

export function reservaADto(reserva: ReservaConDetalle): ReservaDto {
  return {
    id: reserva.id,
    codigo: reserva.codigo,
    area: reserva.area.nombre,
    fecha: reserva.fecha.toISOString().slice(0, 10),
    horaInicio: horaTexto(reserva.horaInicio),
    horaFin: horaTexto(reserva.horaFin),
    asistentes: reserva.asistentes,
    estado: reserva.estado,
  };
}

@Injectable()
export class ReservasService {
  constructor(
    private readonly reservas: ReservaRepository,
    private readonly areas: AreaRepository,
    private readonly unidades: UnidadRepository,
  ) {}

  async crear(residenteId: string, dto: CrearReservaDto): Promise<ReservaDto> {
    const area = await this.areas.findById(dto.areaId);
    if (!area || !area.activa) throw new NotFoundException(MSG_AREA_NO_DISPONIBLE);

    const unidades = await this.unidades.findDeUsuario(residenteId);
    if (unidades.length === 0) throw new BadRequestException('No tienes unidades asignadas');
    // H04 no recibe unidadId: se deriva de la sesión y se usa la primera unidad ordenada por código,
    // igual que el flujo de consulta de pagos cuando el residente tiene varias unidades.
    const unidad = unidades[0];

    this.validarReglas(area, dto);

    const fecha = aFechaUtc(dto.fecha);
    const horaInicio = aHoraUtc(dto.horaInicio);
    const horaFin = aHoraUtc(dto.horaFin);

    try {
      return await this.reservas.enTransaccion(async (tx) => {
        const datosHorario = { areaId: area.id, fecha, horaInicio, horaFin };
        if (await this.reservas.hayCruce(tx, datosHorario)) throw new ReservaHorarioOcupadoError();

        const codigo = await this.reservas.siguienteCodigo(tx);
        const reserva = await this.reservas.crear(tx, {
          codigo,
          areaId: area.id,
          unidadId: unidad.id,
          residenteId,
          fecha,
          horaInicio,
          horaFin,
          asistentes: dto.asistentes,
        });
        return reservaADto(reserva);
      });
    } catch (error) {
      if (error instanceof ReservaHorarioOcupadoError) throw new ConflictException(MSG_CRUCE_RESERVA);
      throw error;
    }
  }

  async listarMias(residenteId: string): Promise<MisReservasResponseDto> {
    const filas = await this.reservas.findByResidente(residenteId);
    return { datos: filas.map(reservaADto) };
  }

  async cancelar(id: string, residenteId: string): Promise<ReservaDto> {
    const actual = await this.reservas.findOneDeResidente(id, residenteId);
    if (!actual) throw new NotFoundException('La reserva no existe');
    if (actual.estado !== EstadoReserva.CONFIRMADA) throw new ConflictException(MSG_NO_CANCELAR);

    const fecha = actual.fecha.toISOString().slice(0, 10);
    const hora = horaTexto(actual.horaInicio);
    const inicio = fechaHoraLocal(fecha, hora);
    if (inicio.getTime() - Date.now() < MS_24_HORAS) throw new ConflictException(MSG_NO_CANCELAR);

    // UPDATE condicional: si otra petición ya la canceló, no se devuelve una falsa cancelación.
    const count = await this.reservas.cancelarSiConfirmada(id, residenteId, new Date());
    if (count === 0) throw new ConflictException(MSG_NO_CANCELAR);

    const cancelada = await this.reservas.findOneDeResidente(id, residenteId);
    if (!cancelada) throw new NotFoundException('La reserva no existe');
    return reservaADto(cancelada);
  }

  private validarReglas(
    area: { capacidad: number; horaApertura: Date; horaCierre: Date; duracionMaxHoras: number },
    dto: CrearReservaDto,
  ): void {
    const hoy = hoyEnZonaNegocio();
    if (dto.fecha < hoy || (dto.fecha === hoy && fechaHoraLocal(dto.fecha, dto.horaInicio).getTime() <= Date.now())) {
      throw new BadRequestException(MSG_FECHA_PASADA);
    }

    const apertura = horaTexto(area.horaApertura);
    const cierre = horaTexto(area.horaCierre);
    if (dto.horaInicio < apertura || dto.horaFin > cierre) {
      throw new BadRequestException(MSG_FUERA_HORARIO);
    }

    const duracionHoras = (minutos(dto.horaFin) - minutos(dto.horaInicio)) / 60;
    if (duracionHoras > area.duracionMaxHoras) {
      throw new BadRequestException(`Supera la duración máxima de ${area.duracionMaxHoras} horas`);
    }

    if (dto.asistentes > area.capacidad) {
      throw new BadRequestException(`Supera la capacidad de ${area.capacidad} personas`);
    }
  }
}
'@
Write-ProjectFile 'src/reservas/services/index.ts' @'
export * from './reservas.service.js';
'@

# 9) Controller y módulo.
Write-ProjectFile 'src/reservas/controllers/reservas.controller.ts' @'
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { Rol, type User } from '@PrismaClient';
import { CrearReservaDto, MisReservasResponseDto, ReservaDto } from '@Reservas/dto';
import { ReservasService } from '@Reservas/services';

@ApiTags('reservas')
@Roles(Rol.RESIDENTE)
@ApiUnauthorizedResponse({ description: 'Sin sesión.' })
@ApiForbiddenResponse({ description: 'Rol no permitido.' })
@Controller('reservas')
export class ReservasController {
  constructor(private readonly service: ReservasService) {}

  @Post()
  @ApiOperation({ summary: 'Reservar un área común sin cruces de horario' })
  @ApiCreatedResponse({ type: ReservaDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos, fecha pasada, horario, duración o capacidad no permitidos.' })
  @ApiNotFoundResponse({ description: 'El área no existe o está inactiva.' })
  @ApiConflictResponse({ description: 'Ese horario ya está reservado.' })
  crear(@CurrentUser() user: User, @Body() dto: CrearReservaDto): Promise<ReservaDto> {
    return this.service.crear(user.id, dto);
  }

  @Get('mias')
  @ApiOperation({ summary: 'Listar las reservas del residente autenticado' })
  @ApiOkResponse({ type: MisReservasResponseDto })
  mias(@CurrentUser() user: User): Promise<MisReservasResponseDto> {
    return this.service.listarMias(user.id);
  }

  @Patch(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una reserva propia con al menos 24 horas de anticipación' })
  @ApiOkResponse({ type: ReservaDto })
  @ApiBadRequestResponse({ description: 'El id no es UUID.' })
  @ApiNotFoundResponse({ description: 'La reserva no existe o no pertenece al residente.' })
  @ApiConflictResponse({ description: 'Ya no puedes cancelar esta reserva.' })
  cancelar(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<ReservaDto> {
    return this.service.cancelar(id, user.id);
  }
}
'@
Write-ProjectFile 'src/reservas/controllers/index.ts' @'
export * from './reservas.controller.js';
'@
Write-ProjectFile 'src/reservas/reservas.module.ts' @'
import { Module } from '@nestjs/common';
import { AreasModule } from '@Areas';
import { UnidadesModule } from '@Unidades';
import { ReservasController } from '@Reservas/controllers';
import { ReservaRepository } from '@Reservas/repositories';
import { ReservasService } from '@Reservas/services';

@Module({
  imports: [AreasModule, UnidadesModule],
  controllers: [ReservasController],
  providers: [ReservasService, ReservaRepository],
})
export class ReservasModule {}
'@
Write-ProjectFile 'src/reservas/index.ts' @'
export * from './reservas.module.js';
'@

# 10) Pruebas de integración: cruce, concurrencia, validaciones y cancelación.
Write-ProjectFile 'src/reservas/services/reservas.service.spec.ts' @'
import { ConflictException } from '@nestjs/common';
import { EstadoReserva } from '@PrismaClient';
import type { AreaRepository } from '@Areas/repositories';
import type { UnidadRepository } from '@Unidades/repositories';
import type { ReservaRepository, ReservaConDetalle } from '@Reservas/repositories';
import { ReservasService, MSG_NO_CANCELAR } from './reservas.service.js';

describe('ReservasService · cancelación', () => {
  const reservas = {
    findOneDeResidente: vi.fn(),
    cancelarSiConfirmada: vi.fn(),
  };
  const service = new ReservasService(
    reservas as unknown as ReservaRepository,
    {} as AreaRepository,
    {} as UnidadRepository,
  );

  const fila = (estado = EstadoReserva.CONFIRMADA) => ({
    id: 'reserva-1',
    codigo: 'RES-000001',
    areaId: 'area-1',
    unidadId: 'unidad-1',
    residenteId: 'residente-1',
    fecha: new Date('2026-11-21T00:00:00.000Z'),
    horaInicio: new Date('1970-01-01T10:00:00.000Z'), // representación UTC de 10:00 local
    horaFin: new Date('1970-01-01T11:00:00.000Z'),
    asistentes: 5,
    estado,
    canceladaEn: estado === EstadoReserva.CANCELADA ? new Date() : null,
    createdAt: new Date(),
    updatedAt: new Date(),
    area: { nombre: 'Alberca' },
    unidad: { id: 'unidad-1', codigo: 'A-101' },
  }) as unknown as ReservaConDetalle;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T16:00:00.000Z'));
    vi.resetAllMocks();
    reservas.findOneDeResidente.mockResolvedValue(fila());
    reservas.cancelarSiConfirmada.mockResolvedValue(1);
  });
  afterEach(() => vi.useRealTimers());

  it('permite cancelar cuando faltan exactamente 24 horas', async () => {
    reservas.findOneDeResidente
      .mockResolvedValueOnce(fila())
      .mockResolvedValueOnce(fila(EstadoReserva.CANCELADA));
    const result = await service.cancelar('reserva-1', 'residente-1');
    expect(result.estado).toBe(EstadoReserva.CANCELADA);
    expect(reservas.cancelarSiConfirmada).toHaveBeenCalledOnce();
  });

  it('bloquea la cancelación cuando falta menos de 24 horas', async () => {
    vi.setSystemTime(new Date('2026-11-20T16:00:01.000Z'));
    await expect(service.cancelar('reserva-1', 'residente-1')).rejects.toThrow(
      new ConflictException(MSG_NO_CANCELAR),
    );
    expect(reservas.cancelarSiConfirmada).not.toHaveBeenCalled();
  });
});
'@

Write-ProjectFile 'test/reservas.e2e-spec.ts' @'
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hoyEnZonaNegocio, sumarDias } from '@Common/fechas';
import { PrismaService } from '@Prisma/services';
import { Rol } from '@PrismaClient';
import { crearApp } from './helpers/app.js';
import { crearArea, crearTorre, crearUnidad, crearUsuario, limpiarTablas, login } from './helpers/fixtures.js';

const URL = '/api/v1/reservas';
const MSG_CRUCE = 'Ese horario ya está reservado';
const MSG_PASADA = 'No puedes reservar en una fecha pasada';
const MSG_FUERA = 'Fuera del horario del área';
const ID_INEXISTENTE = '3f0f6b2e-5c1d-4b8e-9a37-0d2f6a1c4e55';

describe('Reservas de áreas comunes (H04)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const auth = (req: request.Test, token: string | null) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  const post = (token: string | null, body: object) => auth(request(app.getHttpServer()).post(URL).send(body), token);
  const mias = (token: string | null) => auth(request(app.getHttpServer()).get(`${URL}/mias`), token);
  const cancelar = (token: string | null, id: string) => auth(request(app.getHttpServer()).patch(`${URL}/${id}/cancelar`), token);
  const hoy = () => hoyEnZonaNegocio();

  const valido = (areaId: string, extra: object = {}) => ({
    areaId,
    fecha: sumarDias(hoy(), 2),
    horaInicio: '09:00',
    horaFin: '11:00',
    asistentes: 12,
    ...extra,
  });

  async function escenario() {
    const torre = await crearTorre(prisma);
    const unidad1 = await crearUnidad(prisma, torre.id, 'A-101');
    const unidad2 = await crearUnidad(prisma, torre.id, 'A-102');
    const r1 = await crearUsuario(prisma, 'r1-reservas@test.com', { unidadIds: [unidad1.id] });
    const r2 = await crearUsuario(prisma, 'r2-reservas@test.com', { unidadIds: [unidad2.id] });
    await crearUsuario(prisma, 'admin-reservas@test.com', { rol: Rol.ADMINISTRADOR });
    const area = await crearArea(prisma, {
      nombre: 'Alberca', capacidad: 20, horaApertura: '07:00', horaCierre: '20:00', duracionMaxHoras: 3,
    });
    return {
      r1,
      area,
      t1: await login(app, 'r1-reservas@test.com'),
      t2: await login(app, 'r2-reservas@test.com'),
      tAdmin: await login(app, 'admin-reservas@test.com'),
    };
  }

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => limpiarTablas(prisma));
  afterAll(async () => app.close());

  it('crea una reserva válida, genera RES-000001 en formato y toma unidad/residente de la sesión', async () => {
    const { t1, area, r1 } = await escenario();
    const res = await post(t1, valido(area.id)).expect(201);
    expect(res.body).toMatchObject({
      codigo: expect.stringMatching(/^RES-\d{6}$/),
      area: 'Alberca',
      fecha: sumarDias(hoy(), 2),
      horaInicio: '09:00',
      horaFin: '11:00',
      asistentes: 12,
      estado: 'CONFIRMADA',
    });
    const fila = await prisma.reserva.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(fila.residenteId).toBe(r1.id);
    expect(fila.unidadId).toBeTruthy();
  });

  it('rechaza bloques que se cruzan y no guarda la segunda reserva', async () => {
    const { t1, area } = await escenario();
    await post(t1, valido(area.id)).expect(201);
    const res = await post(t1, valido(area.id, { horaInicio: '10:00', horaFin: '12:00' })).expect(409);
    expect(res.body.message).toBe(MSG_CRUCE);
    expect(await prisma.reserva.count()).toBe(1);
  });

  it('dos residentes reservando el mismo bloque a la vez: solo una recibe 201 y la otra 409', async () => {
    const { t1, t2, area } = await escenario();
    const cuerpo = valido(area.id, { horaInicio: '13:00', horaFin: '14:00' });
    const obtenerEstado = async (token: string) => {
      try {
        return (await post(token, cuerpo)).status;
      } catch (error) {
        return (error as { response: { status: number } }).response.status;
      }
    };
    const estados = await Promise.all([obtenerEstado(t1), obtenerEstado(t2)]);
    expect(estados.sort()).toEqual([201, 409]);
    expect(await prisma.reserva.count()).toBe(1);
  });

  it('valida fecha pasada, horario del área, duración máxima y capacidad', async () => {
    const { t1, area } = await escenario();
    let res = await post(t1, valido(area.id, { fecha: sumarDias(hoy(), -1) })).expect(400);
    expect(res.body.message).toContain(MSG_PASADA);
    res = await post(t1, valido(area.id, { horaInicio: '06:00', horaFin: '08:00' })).expect(400);
    expect(res.body.message).toBe(MSG_FUERA);
    res = await post(t1, valido(area.id, { horaInicio: '09:00', horaFin: '13:00' })).expect(400);
    expect(res.body.message).toBe('Supera la duración máxima de 3 horas');
    res = await post(t1, valido(area.id, { asistentes: 21 })).expect(400);
    expect(res.body.message).toBe('Supera la capacidad de 20 personas');
    expect(await prisma.reserva.count()).toBe(0);
  });

  it('lista solo las propias y permite cancelar con más de 24 horas', async () => {
    const { t1, t2, area } = await escenario();
    const creada = await post(t1, valido(area.id)).expect(201);
    expect((await mias(t1).expect(200)).body.datos).toHaveLength(1);
    expect((await mias(t2).expect(200)).body.datos).toHaveLength(0);
    const cancelada = await cancelar(t1, creada.body.id).expect(200);
    expect(cancelada.body.estado).toBe('CANCELADA');
    const repetida = await cancelar(t1, creada.body.id).expect(409);
    expect(repetida.body.message).toBe('Ya no puedes cancelar esta reserva');
    // Una CANCELADA deja libre el mismo horario para otro residente.
    await post(t2, valido(area.id)).expect(201);
  });

  it('rechaza unidad/residente enviados por el cliente y restringe rol y sesión', async () => {
    const { t1, tAdmin, area } = await escenario();
    await post(t1, valido(area.id, { residenteId: '00000000-0000-0000-0000-000000000001' })).expect(400);
    await post(tAdmin, valido(area.id)).expect(403);
    await post(null, valido(area.id)).expect(401);
    await post(t1, valido(ID_INEXISTENTE)).expect(404);
  });
});
'@

Write-Host ''
Write-Host 'H04 backend creado. Archivos principales:' -ForegroundColor Cyan
Write-Host '  prisma/migrations/20261120090000_h04_reservas/migration.sql'
Write-Host '  src/reservas/**'
Write-Host '  prisma/schema.prisma, src/app.module.ts, tsconfig*.json'
Write-Host '  test/reservas.e2e-spec.ts'
Write-Host ''
Write-Host 'Siguiente: ejecuta npm ci, npx prisma format, npx prisma generate y npm run build.' -ForegroundColor Yellow
