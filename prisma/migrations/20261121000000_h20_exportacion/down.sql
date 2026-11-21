-- Reversión manual de 20261121000000_h20_exportacion (Prisma no ejecuta este archivo).
-- Uso: psql "$DATABASE_URL" -f down.sql  y luego quitar el registro de la migración:
--      DELETE FROM _prisma_migrations WHERE migration_name = '20261121000000_h20_exportacion';
DROP TABLE IF EXISTS "exportacion";
DROP TYPE IF EXISTS "version_exportacion";
DROP TYPE IF EXISTS "formato_exportacion";
