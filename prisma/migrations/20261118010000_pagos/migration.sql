-- CreateEnum
CREATE TYPE "estado_pago" AS ENUM ('APROBADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "pago" (
    "id" UUID NOT NULL,
    "numero_transaccion" VARCHAR(20),
    "unidad_id" UUID NOT NULL,
    "residente_id" UUID NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "estado" "estado_pago" NOT NULL,
    "motivo" VARCHAR(100),
    "ultimos4" CHAR(4) NOT NULL,
    "titular" VARCHAR(60) NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pago_cuota" (
    "pago_id" UUID NOT NULL,
    "cuota_id" UUID NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "pago_cuota_pkey" PRIMARY KEY ("pago_id","cuota_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pago_numero_transaccion_key" ON "pago"("numero_transaccion");

-- CreateIndex
CREATE UNIQUE INDEX "pago_idempotency_key_key" ON "pago"("idempotency_key");

-- CreateIndex
CREATE INDEX "pago_unidad_id_created_at_idx" ON "pago"("unidad_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "pago_cuota_cuota_id_key" ON "pago_cuota"("cuota_id");

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_residente_id_fkey" FOREIGN KEY ("residente_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_cuota" ADD CONSTRAINT "pago_cuota_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_cuota" ADD CONSTRAINT "pago_cuota_cuota_id_fkey" FOREIGN KEY ("cuota_id") REFERENCES "cuota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Agregado a mano (H21): Prisma no modela secuencias sueltas ni CHECK.
-- Número de transacción TX-AAAAMMDD-000123: la parte numérica no se repite.
CREATE SEQUENCE "pago_transaccion_seq" START 1 MINVALUE 1 MAXVALUE 999999;
ALTER TABLE "pago" ADD CONSTRAINT "pago_monto_positivo_chk" CHECK ("monto" > 0);
ALTER TABLE "pago_cuota" ADD CONSTRAINT "pago_cuota_monto_positivo_chk" CHECK ("monto" > 0);
-- Nunca se guarda el número completo de la tarjeta: solo 4 dígitos.
ALTER TABLE "pago" ADD CONSTRAINT "pago_ultimos4_chk" CHECK ("ultimos4" ~ '^[0-9]{4}$');
-- Aprobado lleva número de transacción y no motivo; rechazado lleva motivo y no número.
ALTER TABLE "pago" ADD CONSTRAINT "pago_estado_datos_chk" CHECK (
    ("estado" = 'APROBADO' AND "numero_transaccion" IS NOT NULL AND "motivo" IS NULL)
    OR ("estado" = 'RECHAZADO' AND "numero_transaccion" IS NULL AND "motivo" IS NOT NULL)
);

-- Reversión (Prisma no ejecuta "down"; correr a mano si hace falta deshacer):
-- DROP TABLE "pago_cuota";
-- DROP TABLE "pago";
-- DROP SEQUENCE "pago_transaccion_seq";
-- DROP TYPE "estado_pago";
-- DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261118010000_pagos';
