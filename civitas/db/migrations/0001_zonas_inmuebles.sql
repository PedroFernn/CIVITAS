-- MVP-1 · RF-1.1 (base): modelo de datos Zona e Inmueble.
-- Zona = colonia (nombre UML). Las métricas llegan en Sprints 2-5; aquí solo la estructura.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE zonas (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre               TEXT NOT NULL,
  ciudad               TEXT NOT NULL,
  coordenadas          GEOMETRY(POINT, 4326),     -- centroide (se llena con Catastro/INEGI)
  geom                 GEOMETRY(POLYGON, 4326),   -- límites reales (Sprint 2)
  renta_mediana        NUMERIC CHECK (renta_mediana >= 0),
  ingreso_mediano      NUMERIC CHECK (ingreso_mediano >= 0),
  indice_asequibilidad NUMERIC GENERATED ALWAYS AS (renta_mediana / NULLIF(ingreso_mediano, 0)) STORED,
  estado               TEXT NOT NULL DEFAULT 'borrador'
                       CHECK (estado IN ('borrador', 'revision', 'publicada')),
  actualizado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT zonas_ciudad_nombre_uq UNIQUE (ciudad, nombre)
);
CREATE INDEX idx_zonas_geom ON zonas USING GIST (geom);
CREATE INDEX idx_zonas_publicadas ON zonas (ciudad, nombre) WHERE estado = 'publicada';

CREATE TABLE inmuebles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zona_id           UUID NOT NULL REFERENCES zonas(id) ON DELETE RESTRICT,
  ubicacion         GEOMETRY(POINT, 4326),
  precio_renta      NUMERIC CHECK (precio_renta >= 0),
  tipo_inmueble     TEXT,
  superficie        NUMERIC CHECK (superficie > 0),
  fecha_publicacion TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inmuebles_ubicacion ON inmuebles USING GIST (ubicacion);
CREATE INDEX idx_inmuebles_zona_tipo_precio ON inmuebles (zona_id, tipo_inmueble, precio_renta);
