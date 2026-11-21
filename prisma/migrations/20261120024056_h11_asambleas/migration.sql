-- CreateEnum
CREATE TYPE "estado_asamblea" AS ENUM ('BORRADOR', 'PUBLICADA', 'ABIERTA', 'CERRADA');

-- CreateTable
CREATE TABLE "asamblea" (
    "id" UUID NOT NULL,
    "titulo" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(1000) NOT NULL,
    "fecha_apertura" TIMESTAMP(3) NOT NULL,
    "fecha_cierre" TIMESTAMP(3) NOT NULL,
    "estado" "estado_asamblea" NOT NULL DEFAULT 'BORRADOR',
    "publicada_en" TIMESTAMP(3),
    "creada_por" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asamblea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tema_votacion" (
    "id" UUID NOT NULL,
    "asamblea_id" UUID NOT NULL,
    "titulo" VARCHAR(150) NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "tema_votacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opcion_tema" (
    "id" UUID NOT NULL,
    "tema_id" UUID NOT NULL,
    "texto" VARCHAR(100) NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "opcion_tema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tema_votacion_asamblea_id_orden_key" ON "tema_votacion"("asamblea_id", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "opcion_tema_tema_id_orden_key" ON "opcion_tema"("tema_id", "orden");

-- AddForeignKey
ALTER TABLE "asamblea" ADD CONSTRAINT "asamblea_creada_por_fkey" FOREIGN KEY ("creada_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tema_votacion" ADD CONSTRAINT "tema_votacion_asamblea_id_fkey" FOREIGN KEY ("asamblea_id") REFERENCES "asamblea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opcion_tema" ADD CONSTRAINT "opcion_tema_tema_id_fkey" FOREIGN KEY ("tema_id") REFERENCES "tema_votacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asamblea" ADD CONSTRAINT "asamblea_cierre_check" CHECK ("fecha_cierre" >= "fecha_apertura" + interval '1 hour');
