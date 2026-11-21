-- H14 · Lecturas de comunicados: una fila por (comunicado, residente) que ya lo abrió.
-- La PK compuesta impide registrar dos lecturas del mismo comunicado por el mismo residente.

-- CreateTable
CREATE TABLE "lectura_comunicado" (
    "comunicado_id" UUID NOT NULL,
    "residente_id" UUID NOT NULL,
    "leido_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lectura_comunicado_pkey" PRIMARY KEY ("comunicado_id","residente_id")
);

-- CreateIndex
CREATE INDEX "ix_lectura_residente" ON "lectura_comunicado"("residente_id");

-- AddForeignKey
ALTER TABLE "lectura_comunicado" ADD CONSTRAINT "lectura_comunicado_comunicado_id_fkey" FOREIGN KEY ("comunicado_id") REFERENCES "comunicado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectura_comunicado" ADD CONSTRAINT "lectura_comunicado_residente_id_fkey" FOREIGN KEY ("residente_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

