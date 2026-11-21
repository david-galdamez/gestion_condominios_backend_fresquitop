-- CreateIndex
CREATE INDEX "paquete_unidad_id_estado_recibido_en_idx" ON "paquete"("unidad_id", "estado", "recibido_en" DESC);
