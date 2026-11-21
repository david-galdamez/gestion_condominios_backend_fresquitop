-- H20 · Auditoría de exportaciones del reporte del condominio: una fila por archivo generado.

-- CreateEnum
CREATE TYPE "formato_exportacion" AS ENUM ('PDF', 'EXCEL');

-- CreateEnum
CREATE TYPE "version_exportacion" AS ENUM ('DETALLADA', 'RESUMIDA');

-- CreateTable
CREATE TABLE "exportacion" (
    "id" UUID NOT NULL,
    "administrador_id" UUID NOT NULL,
    "formato" "formato_exportacion" NOT NULL,
    "version" "version_exportacion" NOT NULL,
    "periodo_desde" DATE NOT NULL,
    "periodo_hasta" DATE NOT NULL,
    "generada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exportacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exportacion_administrador_id_idx" ON "exportacion"("administrador_id");

-- CreateIndex
CREATE INDEX "exportacion_generada_en_idx" ON "exportacion"("generada_en");

-- AddForeignKey
ALTER TABLE "exportacion" ADD CONSTRAINT "exportacion_administrador_id_fkey" FOREIGN KEY ("administrador_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Agregado a mano: el periodo exportado no puede estar invertido.
ALTER TABLE "exportacion" ADD CONSTRAINT "exportacion_periodo_check" CHECK ("periodo_desde" <= "periodo_hasta");
