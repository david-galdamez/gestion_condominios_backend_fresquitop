-- CreateTable
CREATE TABLE "perfil_directorio" (
    "residente_id" UUID NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "mostrar_nombre" BOOLEAN NOT NULL DEFAULT false,
    "mostrar_unidad" BOOLEAN NOT NULL DEFAULT false,
    "mostrar_telefono" BOOLEAN NOT NULL DEFAULT false,
    "mostrar_correo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perfil_directorio_pkey" PRIMARY KEY ("residente_id")
);

-- AddForeignKey
ALTER TABLE "perfil_directorio" ADD CONSTRAINT "perfil_directorio_residente_id_fkey" FOREIGN KEY ("residente_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Regla de negocio (H15), agregada a mano: Prisma no modela CHECK.
-- Un perfil visible tiene que mostrar al menos un dato.
ALTER TABLE "perfil_directorio" ADD CONSTRAINT "perfil_directorio_visible_con_dato_chk" CHECK (
    NOT "visible" OR "mostrar_nombre" OR "mostrar_unidad" OR "mostrar_telefono" OR "mostrar_correo"
);

-- Reversión (Prisma no ejecuta "down"; correr a mano si hace falta deshacer):
-- DROP TABLE "perfil_directorio";
-- DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261118000000_perfil_directorio';
