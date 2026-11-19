-- CreateTable
CREATE TABLE "notificacion" (
    "id" UUID NOT NULL,
    "modulo_origen" VARCHAR(15) NOT NULL,
    "titulo" VARCHAR(80) NOT NULL,
    "mensaje" VARCHAR(300) NOT NULL,
    "referencia" VARCHAR(200),
    "destino_tipo" VARCHAR(10) NOT NULL,
    "destino_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacion_destinatario" (
    "notificacion_id" UUID NOT NULL,
    "residente_id" UUID NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "leida_en" TIMESTAMP(3),

    CONSTRAINT "notificacion_destinatario_pkey" PRIMARY KEY ("notificacion_id","residente_id")
);

-- CreateIndex
CREATE INDEX "notificacion_destinatario_residente_id_leida_idx" ON "notificacion_destinatario"("residente_id", "leida");

-- AddForeignKey
ALTER TABLE "notificacion_destinatario"
    ADD CONSTRAINT "notificacion_destinatario_notificacion_id_fkey"
    FOREIGN KEY ("notificacion_id") REFERENCES "notificacion"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion_destinatario"
    ADD CONSTRAINT "notificacion_destinatario_residente_id_fkey"
    FOREIGN KEY ("residente_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Constraints CHECK (H18)
ALTER TABLE "notificacion"
    ADD CONSTRAINT "notificacion_modulo_origen_chk"
    CHECK ("modulo_origen" IN ('PAGOS', 'RESERVAS', 'INCIDENCIAS', 'VISITAS', 'PAQUETERIA', 'VOTACIONES', 'COMUNICADOS'));

ALTER TABLE "notificacion"
    ADD CONSTRAINT "notificacion_destino_tipo_chk"
    CHECK ("destino_tipo" IN ('USUARIO', 'UNIDAD', 'TORRE', 'TODOS'));

-- Reversión manual:
-- DROP TABLE "notificacion_destinatario";
-- DROP TABLE "notificacion";
-- DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261119000000_h18_notificaciones';