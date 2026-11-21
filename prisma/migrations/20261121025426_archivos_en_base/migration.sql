-- CreateTable
CREATE TABLE "archivo" (
    "id" UUID NOT NULL,
    "clave" VARCHAR(255) NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "archivo_clave_key" ON "archivo"("clave");
