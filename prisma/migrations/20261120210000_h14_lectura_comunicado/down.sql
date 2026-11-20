-- Reversión manual de 20261120210000_h14_lectura_comunicado (Prisma no ejecuta este archivo).
-- Uso: psql "$DATABASE_URL" -f down.sql  y luego quitar el registro de la migración:
--      DELETE FROM _prisma_migrations WHERE migration_name = '20261120210000_h14_lectura_comunicado';
DROP TABLE IF EXISTS "lectura_comunicado";
