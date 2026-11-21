-- CreateEnum
CREATE TYPE "categoria_reporte" AS ENUM ('FUGA', 'LUMINARIA', 'ASCENSOR', 'LIMPIEZA', 'OTRO');

-- CreateEnum
CREATE TYPE "prioridad_reporte" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "estado_reporte" AS ENUM ('ABIERTO', 'EN_PROCESO', 'RESUELTO');

-- CreateTable
CREATE TABLE "reporte" (
    "id" UUID NOT NULL,
    "numero" SERIAL NOT NULL,
    "residente_id" UUID NOT NULL,
    "titulo" VARCHAR(80) NOT NULL,
    "categoria" "categoria_reporte" NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "prioridad" "prioridad_reporte" NOT NULL DEFAULT 'MEDIA',
    "estado" "estado_reporte" NOT NULL DEFAULT 'ABIERTO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidencia_reporte" (
    "id" UUID NOT NULL,
    "reporte_id" UUID NOT NULL,
    "archivo" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidencia_reporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_reporte" (
    "id" UUID NOT NULL,
    "reporte_id" UUID NOT NULL,
    "estado" "estado_reporte" NOT NULL,
    "cambiado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_reporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reporte_numero_key" ON "reporte"("numero");

-- CreateIndex
CREATE INDEX "reporte_residente_id_created_at_idx" ON "reporte"("residente_id", "created_at");

-- CreateIndex
CREATE INDEX "evidencia_reporte_reporte_id_idx" ON "evidencia_reporte"("reporte_id");

-- CreateIndex
CREATE INDEX "historial_reporte_reporte_id_created_at_idx" ON "historial_reporte"("reporte_id", "created_at");

-- AddForeignKey
ALTER TABLE "reporte" ADD CONSTRAINT "reporte_residente_id_fkey" FOREIGN KEY ("residente_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencia_reporte" ADD CONSTRAINT "evidencia_reporte_reporte_id_fkey" FOREIGN KEY ("reporte_id") REFERENCES "reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_reporte" ADD CONSTRAINT "historial_reporte_reporte_id_fkey" FOREIGN KEY ("reporte_id") REFERENCES "reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_reporte" ADD CONSTRAINT "historial_reporte_cambiado_por_id_fkey" FOREIGN KEY ("cambiado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
