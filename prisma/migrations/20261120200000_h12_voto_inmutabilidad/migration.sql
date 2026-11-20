-- H12 (DB-12.1): Inmutabilidad de votos.
-- La tabla "voto" ya cuenta con id (UUID PK), asamblea_id (FK), tema_id (FK),
-- opcion_id (FK), unidad_id (FK), residente_id (FK), codigo_verificacion (CHAR(8) UNIQUE),
-- created_at (TIMESTAMP) y UNIQUE (tema_id, unidad_id) creados en H27.
-- Esta migración agrega el trigger en PostgreSQL que impide UPDATE y DELETE sobre "voto".

CREATE OR REPLACE FUNCTION impedir_modificacion_voto()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Los votos emitidos son inmutables y no pueden modificarse ni eliminarse';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_voto_inmutable
BEFORE UPDATE OR DELETE ON "voto"
FOR EACH ROW
EXECUTE FUNCTION impedir_modificacion_voto();