/*
  Warnings:

  - Added the required column `asamblea_id` to the `voto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "voto" ADD COLUMN     "asamblea_id" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "voto" ADD CONSTRAINT "voto_asamblea_id_fkey" FOREIGN KEY ("asamblea_id") REFERENCES "asamblea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
