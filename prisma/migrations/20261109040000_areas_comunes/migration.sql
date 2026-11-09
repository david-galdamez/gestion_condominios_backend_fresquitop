-- CreateTable
CREATE TABLE "area_comun" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(40) NOT NULL,
    "capacidad" INTEGER NOT NULL,
    "hora_apertura" TIME(0) NOT NULL,
    "hora_cierre" TIME(0) NOT NULL,
    "duracion_max_horas" INTEGER NOT NULL DEFAULT 3,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "area_comun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "area_comun_nombre_key" ON "area_comun"("nombre");

-- Reglas de negocio (H03): Prisma no modela CHECK, se agregan a mano.
ALTER TABLE "area_comun" ADD CONSTRAINT "area_comun_capacidad_chk" CHECK ("capacidad" BETWEEN 1 AND 200);
ALTER TABLE "area_comun" ADD CONSTRAINT "area_comun_duracion_max_horas_chk" CHECK ("duracion_max_horas" BETWEEN 1 AND 8);
ALTER TABLE "area_comun" ADD CONSTRAINT "area_comun_horario_chk" CHECK ("hora_cierre" > "hora_apertura");
ALTER TABLE "area_comun" ADD CONSTRAINT "area_comun_hora_en_punto_chk" CHECK (
    EXTRACT(MINUTE FROM "hora_apertura") = 0 AND EXTRACT(SECOND FROM "hora_apertura") = 0
    AND EXTRACT(MINUTE FROM "hora_cierre") = 0 AND EXTRACT(SECOND FROM "hora_cierre") = 0
);

-- Reversión (Prisma no ejecuta "down"; correr a mano si hace falta deshacer):
-- DROP TABLE "area_comun";
-- DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261109040000_areas_comunes';
