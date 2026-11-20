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
