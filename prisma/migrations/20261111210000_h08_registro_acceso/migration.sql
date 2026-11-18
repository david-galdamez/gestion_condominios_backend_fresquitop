-- CreateEnum
CREATE TYPE "estado_acceso" AS ENUM ('DENTRO', 'SALIO');

-- CreateTable
CREATE TABLE "registro_acceso" (
    "id" UUID NOT NULL,
    "autorizacion_id" UUID,
    "unidad_id" UUID NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "tipo_documento" "tipo_documento" NOT NULL,
    "numero_documento" VARCHAR(12) NOT NULL,
    "motivo" VARCHAR(100),
    "preautorizado" BOOLEAN NOT NULL,
    "estado" "estado_acceso" NOT NULL DEFAULT 'DENTRO',
    "hora_entrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hora_salida" TIMESTAMP(3),
    "entrada_por" UUID NOT NULL,
    "salida_por" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registro_acceso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registro_acceso_autorizacion_id_key" ON "registro_acceso"("autorizacion_id");

-- CreateIndex
CREATE INDEX "registro_acceso_estado_hora_entrada_idx" ON "registro_acceso"("estado", "hora_entrada");

-- CreateIndex
CREATE INDEX "registro_acceso_numero_documento_idx" ON "registro_acceso"("numero_documento");

-- AddForeignKey
ALTER TABLE "registro_acceso" ADD CONSTRAINT "registro_acceso_autorizacion_id_fkey" FOREIGN KEY ("autorizacion_id") REFERENCES "autorizacion_visita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_acceso" ADD CONSTRAINT "registro_acceso_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_acceso" ADD CONSTRAINT "registro_acceso_entrada_por_fkey" FOREIGN KEY ("entrada_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_acceso" ADD CONSTRAINT "registro_acceso_salida_por_fkey" FOREIGN KEY ("salida_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Reglas de negocio de H08 (Prisma no genera CHECK).
-- Con código siempre es pre-autorizado y viceversa.
ALTER TABLE "registro_acceso" ADD CONSTRAINT "registro_acceso_preautorizado_chk" CHECK ("preautorizado" = ("autorizacion_id" IS NOT NULL));
-- Sin pre-autorización el motivo es obligatorio (5 a 100 caracteres).
ALTER TABLE "registro_acceso" ADD CONSTRAINT "registro_acceso_motivo_chk" CHECK ("preautorizado" OR char_length(btrim("motivo")) BETWEEN 5 AND 100);
-- Hay hora de salida si y solo si ya salió, y nunca antes de la entrada.
ALTER TABLE "registro_acceso" ADD CONSTRAINT "registro_acceso_salida_chk" CHECK (("estado" = 'SALIO') = ("hora_salida" IS NOT NULL) AND ("hora_salida" IS NULL OR "hora_salida" >= "hora_entrada"));
