-- Hotfix 1.0.1 · Teléfono del residente para el directorio de vecinos (H15/H16).

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "telefono" VARCHAR(9);


-- Agregado a mano: 8 dígitos de El Salvador (fijo 2, móvil 6 o 7) con guion.
ALTER TABLE "users" ADD CONSTRAINT "users_telefono_check" CHECK ("telefono" IS NULL OR "telefono" ~ '^[267][0-9]{3}-[0-9]{4}$');
