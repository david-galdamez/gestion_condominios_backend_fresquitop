-- CreateEnum
CREATE TYPE "origen_generacion" AS ENUM ('MANUAL', 'AUTOMATICA');

-- CreateEnum
CREATE TYPE "tipo_aviso_cuota" AS ENUM ('POR_VENCER');

-- CreateTable
CREATE TABLE "configuracion_cuota" (
    "id" UUID NOT NULL,
    "monto_mensual" DECIMAL(10,2) NOT NULL,
    "dia_vencimiento" INTEGER NOT NULL,
    "creada_por" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracion_cuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ejecucion_generacion" (
    "id" UUID NOT NULL,
    "periodo" CHAR(7) NOT NULL,
    "origen" "origen_generacion" NOT NULL,
    "creadas" INTEGER NOT NULL,
    "omitidas" INTEGER NOT NULL,
    "ejecutada_por" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ejecucion_generacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aviso_cuota" (
    "id" UUID NOT NULL,
    "cuota_id" UUID NOT NULL,
    "tipo" "tipo_aviso_cuota" NOT NULL,
    "enviado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aviso_cuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "configuracion_cuota_created_at_idx" ON "configuracion_cuota"("created_at");

-- CreateIndex
CREATE INDEX "ejecucion_generacion_periodo_idx" ON "ejecucion_generacion"("periodo");

-- CreateIndex
CREATE UNIQUE INDEX "aviso_cuota_cuota_id_tipo_key" ON "aviso_cuota"("cuota_id", "tipo");

-- AddForeignKey
ALTER TABLE "configuracion_cuota" ADD CONSTRAINT "configuracion_cuota_creada_por_fkey" FOREIGN KEY ("creada_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejecucion_generacion" ADD CONSTRAINT "ejecucion_generacion_ejecutada_por_fkey" FOREIGN KEY ("ejecutada_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aviso_cuota" ADD CONSTRAINT "aviso_cuota_cuota_id_fkey" FOREIGN KEY ("cuota_id") REFERENCES "cuota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas de negocio de H02 (Prisma no genera CHECK).
ALTER TABLE "configuracion_cuota" ADD CONSTRAINT "configuracion_cuota_monto_chk" CHECK ("monto_mensual" BETWEEN 1.00 AND 9999.99);
ALTER TABLE "configuracion_cuota" ADD CONSTRAINT "configuracion_cuota_dia_chk" CHECK ("dia_vencimiento" BETWEEN 1 AND 28);
ALTER TABLE "ejecucion_generacion" ADD CONSTRAINT "ejecucion_generacion_conteos_chk" CHECK ("creadas" >= 0 AND "omitidas" >= 0);
