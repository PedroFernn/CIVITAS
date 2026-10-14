-- 001_base.sql — Esquema base de CIVITAS (subconjunto de ARQUITECTURA_TECNICA.md §3.1 necesario hasta MVP-2)
-- Desviación documentada: colonias.geom es MULTIPOLYGON (el Marco Geoestadístico de INEGI
-- trae AGEB con múltiples partes; ST_Multi evita rechazar zonas válidas). Ver docs/mvp2/ADR-001.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Zonas / colonias (P-01, P-02, P-03)
CREATE TABLE IF NOT EXISTS colonias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  ciudad TEXT NOT NULL,
  geom GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
  renta_mediana NUMERIC,
  ingreso_mediano NUMERIC,
  indice_asequibilidad NUMERIC GENERATED ALWAYS AS (renta_mediana / NULLIF(ingreso_mediano, 0)) STORED,
  cobertura_transporte NUMERIC,
  equipamiento_urbano NUMERIC,
  seguridad_score NUMERIC,
  inflacion_local_proyectada NUMERIC,
  completitud NUMERIC,
  estado TEXT CHECK (estado IN ('borrador', 'revision', 'publicada')) DEFAULT 'borrador',
  actualizado_en TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_colonias_geom ON colonias USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_colonias_publicadas ON colonias (ciudad, estado) WHERE estado = 'publicada';

-- Fuentes de datos abiertas (P-10)
CREATE TABLE IF NOT EXISTS fuentes_datos (
  id SERIAL PRIMARY KEY,
  nombre TEXT,
  estado TEXT CHECK (estado IN ('ok', 'retraso', 'error')),
  ultima_ingesta TIMESTAMPTZ
);
