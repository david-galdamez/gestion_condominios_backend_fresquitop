-- AlterTable
ALTER TABLE "autorizacion_visita" ADD COLUMN "editado_por_id" UUID;

-- AddForeignKey
ALTER TABLE "autorizacion_visita" ADD CONSTRAINT "autorizacion_visita_editado_por_id_fkey" FOREIGN KEY ("editado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
