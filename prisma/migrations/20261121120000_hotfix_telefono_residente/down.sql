-- Reversión manual de 20261121120000_hotfix_telefono_residente (Prisma no ejecuta este archivo).
-- Uso: psql "$DATABASE_URL" -f down.sql  y luego quitar el registro de la migración:
--      DELETE FROM _prisma_migrations WHERE migration_name = '20261121120000_hotfix_telefono_residente';
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_telefono_check";
ALTER TABLE "users" DROP COLUMN IF EXISTS "telefono";
