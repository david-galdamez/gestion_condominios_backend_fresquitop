-- Reversión manual de 20261111210000_h08_registro_acceso (Prisma no ejecuta este archivo).
-- Uso: psql "$DATABASE_URL" -f down.sql  y luego quitar el registro de la migración:
--      DELETE FROM _prisma_migrations WHERE migration_name = '20261111210000_h08_registro_acceso';
DROP TABLE IF EXISTS "registro_acceso";
DROP TYPE IF EXISTS "estado_acceso";
