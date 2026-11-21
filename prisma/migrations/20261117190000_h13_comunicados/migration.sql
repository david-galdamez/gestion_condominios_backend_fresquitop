-- CreateEnum
CREATE TYPE "categoria_comunicado" AS ENUM ('AGUA', 'ELECTRICIDAD', 'MANTENIMIENTO', 'SEGURIDAD', 'AVISO_GENERAL');

-- CreateEnum
CREATE TYPE "estado_comunicado" AS ENUM ('PROGRAMADO', 'PUBLICADO', 'EXPIRADO');

-- CreateTable
CREATE TABLE "comunicado" (
    "id" UUID NOT NULL,
    "titulo" VARCHAR(100) NOT NULL,
    "contenido" VARCHAR(2000) NOT NULL,
    "categoria" "categoria_comunicado" NOT NULL,
    "para_todos" BOOLEAN NOT NULL,
    "fecha_publicacion" TIMESTAMP(3) NOT NULL,
    "fecha_expiracion" TIMESTAMP(3),
    "estado" "estado_comunicado" NOT NULL,
    "autor_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comunicado_pkey" PRIMARY KEY ("id"),
    -- Agregado a mano: la expiración, si existe, es posterior a la publicación.
    CONSTRAINT "comunicado_expiracion_check" CHECK ("fecha_expiracion" IS NULL OR "fecha_expiracion" > "fecha_publicacion")
);

-- CreateTable
CREATE TABLE "comunicado_destino" (
    "comunicado_id" UUID NOT NULL,
    "torre_id" UUID NOT NULL,

    CONSTRAINT "comunicado_destino_pkey" PRIMARY KEY ("comunicado_id","torre_id")
);

-- CreateIndex
CREATE INDEX "comunicado_estado_fecha_publicacion_idx" ON "comunicado"("estado", "fecha_publicacion");

-- CreateIndex
CREATE INDEX "comunicado_destino_torre_id_idx" ON "comunicado_destino"("torre_id");

-- AddForeignKey
ALTER TABLE "comunicado" ADD CONSTRAINT "comunicado_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicado_destino" ADD CONSTRAINT "comunicado_destino_comunicado_id_fkey" FOREIGN KEY ("comunicado_id") REFERENCES "comunicado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicado_destino" ADD CONSTRAINT "comunicado_destino_torre_id_fkey" FOREIGN KEY ("torre_id") REFERENCES "torre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

