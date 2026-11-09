-- CreateEnum
CREATE TYPE "mensajeria" AS ENUM ('CORREOS', 'DHL', 'FEDEX', 'UPS', 'AMAZON', 'OTRA');

-- CreateEnum
CREATE TYPE "estado_paquete" AS ENUM ('EN_PORTERIA', 'RETENIDO', 'ENTREGADO');

-- CreateTable
CREATE TABLE "paquete" (
    "id" UUID NOT NULL,
    "codigo_paquete" VARCHAR(10) NOT NULL,
    "codigo_retiro" CHAR(6) NOT NULL,
    "unidad_id" UUID NOT NULL,
    "destinatario" VARCHAR(60) NOT NULL,
    "mensajeria" "mensajeria" NOT NULL,
    "guia" VARCHAR(40),
    "foto_url" VARCHAR(255) NOT NULL,
    "estado" "estado_paquete" NOT NULL DEFAULT 'EN_PORTERIA',
    "recibido_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recibido_por" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paquete_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "paquete_codigo_paquete_key" ON "paquete"("codigo_paquete");

-- CreateIndex
CREATE INDEX "paquete_estado_recibido_en_idx" ON "paquete"("estado", "recibido_en");

-- CreateIndex
CREATE INDEX "paquete_unidad_id_estado_idx" ON "paquete"("unidad_id", "estado");

-- AddForeignKey
ALTER TABLE "paquete" ADD CONSTRAINT "paquete_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paquete" ADD CONSTRAINT "paquete_recibido_por_fkey" FOREIGN KEY ("recibido_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Agregado a mano (H09): Prisma no modela secuencias sueltas ni CHECK.
-- Numeración del código de paquete: PAQ- + 6 dígitos, sin repetirse aunque
-- dos guardias registren a la vez.
CREATE SEQUENCE "paquete_codigo_seq" START 1 MINVALUE 1 MAXVALUE 999999;
ALTER TABLE "paquete" ADD CONSTRAINT "paquete_codigo_paquete_formato_chk" CHECK ("codigo_paquete" ~ '^PAQ-[0-9]{6}$');
ALTER TABLE "paquete" ADD CONSTRAINT "paquete_codigo_retiro_formato_chk" CHECK ("codigo_retiro" ~ '^[0-9]{6}$');

-- Reversión (Prisma no ejecuta "down"; correr a mano si hace falta deshacer):
-- DROP TABLE "paquete";
-- DROP SEQUENCE "paquete_codigo_seq";
-- DROP TYPE "estado_paquete";
-- DROP TYPE "mensajeria";
-- DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261109050000_paquetes';
