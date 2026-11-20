-- AlterTable: agregar resuelto_en y comentario_cierre en reporte (H24)
ALTER TABLE "reporte"
    ADD COLUMN "resuelto_en" TIMESTAMP(3),
    ADD COLUMN "comentario_cierre" VARCHAR(300);

-- AlterTable: ampliar comentario en historial_reporte a VARCHAR(300) para almacenar comentarios de cierre
ALTER TABLE "historial_reporte"
    ALTER COLUMN "comentario" TYPE VARCHAR(300);

-- Reversión manual:
-- ALTER TABLE "historial_reporte" ALTER COLUMN "comentario" TYPE VARCHAR(200);
-- ALTER TABLE "reporte" DROP COLUMN "comentario_cierre", DROP COLUMN "resuelto_en";
-- DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261120220000_h24_resolver_reportes';