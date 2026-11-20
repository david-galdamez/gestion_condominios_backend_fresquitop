-- AlterTable: permitir prioridad NULL (sin asignar) y agregar responsable en reporte
ALTER TABLE "reporte"
    ALTER COLUMN "prioridad" DROP NOT NULL,
    ALTER COLUMN "prioridad" DROP DEFAULT,
    ADD COLUMN "responsable" VARCHAR(60);

-- AlterTable: agregar comentario/detalle del cambio en historial_reporte
ALTER TABLE "historial_reporte"
    ADD COLUMN "comentario" VARCHAR(200);

-- CreateIndex: filtros por estado/categoría y ordenamiento por prioridad/fecha
CREATE INDEX "reporte_estado_categoria_created_at_idx"
    ON "reporte"("estado", "categoria", "created_at");

CREATE INDEX "reporte_prioridad_created_at_idx"
    ON "reporte"("prioridad", "created_at");

-- Reversión manual:
-- DROP INDEX "reporte_prioridad_created_at_idx";
-- DROP INDEX "reporte_estado_categoria_created_at_idx";
-- ALTER TABLE "historial_reporte" DROP COLUMN "comentario";
-- ALTER TABLE "reporte" DROP COLUMN "responsable";
-- UPDATE "reporte" SET "prioridad" = 'MEDIA' WHERE "prioridad" IS NULL;
-- ALTER TABLE "reporte" ALTER COLUMN "prioridad" SET DEFAULT 'MEDIA', ALTER COLUMN "prioridad" SET NOT NULL;
-- DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261119120000_h06_priorizar_asignar_reportes';