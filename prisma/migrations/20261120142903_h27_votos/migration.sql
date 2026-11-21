-- CreateTable
CREATE TABLE "voto" (
    "id" UUID NOT NULL,
    "tema_id" UUID NOT NULL,
    "opcion_id" UUID NOT NULL,
    "unidad_id" UUID NOT NULL,
    "residente_id" UUID NOT NULL,
    "codigo_verificacion" CHAR(8) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voto_codigo_verificacion_key" ON "voto"("codigo_verificacion");

-- CreateIndex
CREATE UNIQUE INDEX "voto_tema_id_unidad_id_key" ON "voto"("tema_id", "unidad_id");

-- AddForeignKey
ALTER TABLE "voto" ADD CONSTRAINT "voto_tema_id_fkey" FOREIGN KEY ("tema_id") REFERENCES "tema_votacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voto" ADD CONSTRAINT "voto_opcion_id_fkey" FOREIGN KEY ("opcion_id") REFERENCES "opcion_tema"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voto" ADD CONSTRAINT "voto_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voto" ADD CONSTRAINT "voto_residente_id_fkey" FOREIGN KEY ("residente_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
