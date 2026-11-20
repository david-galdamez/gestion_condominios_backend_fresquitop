-- Reversión manual de DB-4.1 (ejecutar únicamente si se decide deshacer H04).
DROP TABLE IF EXISTS "reserva";
DROP SEQUENCE IF EXISTS "reserva_codigo_seq";
DROP TYPE IF EXISTS "estado_reserva";
-- btree_gist no se elimina porque puede ser utilizada por otras tablas.
