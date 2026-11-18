-- Reversión manual de 20261111010912_h02_generacion_cuotas (Prisma no ejecuta este archivo).
-- Uso: psql "$DATABASE_URL" -f down.sql  y luego quitar el registro de la migración:
--      DELETE FROM _prisma_migrations WHERE migration_name = '20261111010912_h02_generacion_cuotas';
DROP TABLE IF EXISTS "aviso_cuota";
DROP TABLE IF EXISTS "ejecucion_generacion";
DROP TABLE IF EXISTS "configuracion_cuota";
DROP TYPE IF EXISTS "tipo_aviso_cuota";
DROP TYPE IF EXISTS "origen_generacion";
