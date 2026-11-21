-- CreateIndex
CREATE INDEX "reserva_fecha_estado_idx" ON "reserva"("fecha", "estado");

-- CreateIndex
CREATE INDEX "reporte_created_at_estado_idx" ON "reporte"("created_at", "estado");
