-- 002_mvp2_datos_abiertos.sql — MVP-2: Datos abiertos y zonas piloto
-- RF-1.1 atributos por zona (comercios, paradas) · RF-1.2 INEGI (MGN, DENUE) + transporte
-- RNF Interoperabilidad / Calidad de datos / Trazabilidad (ver docs/mvp2/MVP2.md)

-- ───────────────────────── Catálogo de fuentes ─────────────────────────
ALTER TABLE fuentes_datos
  ADD COLUMN IF NOT EXISTS clave TEXT,
  ADD COLUMN IF NOT EXISTS descripcion TEXT,
  ADD COLUMN IF NOT EXISTS url TEXT,
  ADD COLUMN IF NOT EXISTS licencia TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fuentes_datos_clave ON fuentes_datos (clave);

INSERT INTO fuentes_datos (clave, nombre, descripcion, url, licencia) VALUES
  ('inegi_mgn',  'INEGI · Marco Geoestadístico',
   'Polígonos de AGEB urbanas (unidad de zona de CIVITAS, ver ADR-001).',
   'https://www.inegi.org.mx/temas/mg/', 'Términos de libre uso de la información del INEGI'),
  ('inegi_denue', 'INEGI · DENUE',
   'Directorio Estadístico Nacional de Unidades Económicas (comercios y servicios).',
   'https://www.inegi.org.mx/app/descarga/', 'Términos de libre uso de la información del INEGI'),
  ('transporte_paradas', 'Transporte público · paradas',
   'Paradas de transporte (GTFS stops.txt, CSV o GeoJSON de puntos).',
   NULL, 'Depende del proveedor; registrar en cada carga')
ON CONFLICT (clave) DO NOTHING;

-- ───────────────────────── Trazabilidad (RNF) ─────────────────────────
-- Una fila por ejecución de importación de una fuente: qué, de dónde, cuándo y cuánto.
CREATE TABLE IF NOT EXISTS cargas_datos (
  id BIGSERIAL PRIMARY KEY,
  fuente_clave TEXT NOT NULL REFERENCES fuentes_datos (clave),
  modo TEXT NOT NULL CHECK (modo IN ('real', 'fixture')),
  estado TEXT NOT NULL DEFAULT 'en_curso' CHECK (estado IN ('en_curso', 'ok', 'error')),
  archivo_origen TEXT,
  sha256 TEXT,
  version_fuente TEXT,
  comando TEXT,
  iniciada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizada_en TIMESTAMPTZ,
  registros_leidos INTEGER NOT NULL DEFAULT 0,
  registros_cargados INTEGER NOT NULL DEFAULT 0,
  registros_descartados INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_cargas_fuente ON cargas_datos (fuente_clave, iniciada_en DESC);

CREATE TABLE IF NOT EXISTS cargas_descartes (
  id BIGSERIAL PRIMARY KEY,
  carga_id BIGINT NOT NULL REFERENCES cargas_datos (id) ON DELETE CASCADE,
  referencia TEXT,
  motivo TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cargas_descartes_carga ON cargas_descartes (carga_id);

-- ───────────────────────── Zonas (RF-1.2 MGN) ─────────────────────────
ALTER TABLE colonias
  ADD COLUMN IF NOT EXISTS tipo_unidad TEXT NOT NULL DEFAULT 'ageb'
    CHECK (tipo_unidad IN ('colonia', 'ageb', 'h3')),
  ADD COLUMN IF NOT EXISTS clave_geo TEXT,          -- CVEGEO de INEGI (AGEB urbana)
  ADD COLUMN IF NOT EXISTS cve_ent TEXT,
  ADD COLUMN IF NOT EXISTS cve_mun TEXT,
  ADD COLUMN IF NOT EXISTS es_piloto BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS carga_id BIGINT REFERENCES cargas_datos (id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_colonias_unidad_clave ON colonias (tipo_unidad, clave_geo);
CREATE INDEX IF NOT EXISTS idx_colonias_piloto ON colonias (ciudad) WHERE es_piloto;

-- RNF Calidad de datos: la base misma rechaza geometrías inválidas o vacías.
ALTER TABLE colonias DROP CONSTRAINT IF EXISTS colonias_geom_valida;
ALTER TABLE colonias ADD CONSTRAINT colonias_geom_valida
  CHECK (ST_IsValid(geom) AND NOT ST_IsEmpty(geom));

-- ───────────────────────── DENUE (RF-1.2) ─────────────────────────
CREATE TABLE IF NOT EXISTS unidades_economicas (
  id BIGSERIAL PRIMARY KEY,
  id_denue TEXT NOT NULL UNIQUE,                   -- clave de la unidad económica en DENUE
  nombre TEXT,
  codigo_act TEXT NOT NULL,                        -- SCIAN (6 dígitos)
  nombre_act TEXT,
  estrato_personal TEXT,
  cve_ent TEXT, cve_mun TEXT,
  geom GEOMETRY(POINT, 4326) NOT NULL,
  -- Comercio = SCIAN sector 43 (al por mayor) o 46 (al por menor)
  es_comercio BOOLEAN GENERATED ALWAYS AS (LEFT(codigo_act, 2) IN ('43', '46')) STORED,
  zona_id UUID REFERENCES colonias (id) ON DELETE SET NULL,
  carga_id BIGINT NOT NULL REFERENCES cargas_datos (id)
);
CREATE INDEX IF NOT EXISTS idx_ue_geom ON unidades_economicas USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_ue_zona ON unidades_economicas (zona_id);

-- ───────────────────────── Transporte (RF-1.2) ─────────────────────────
CREATE TABLE IF NOT EXISTS paradas_transporte (
  id BIGSERIAL PRIMARY KEY,
  sistema TEXT NOT NULL,                           -- p.ej. 'RUTA', 'GTFS-Puebla'
  referencia TEXT NOT NULL,                        -- stop_id u otro identificador de origen
  nombre TEXT,
  modo TEXT,                                       -- bus, brt, tren, ...
  geom GEOMETRY(POINT, 4326) NOT NULL,
  zona_id UUID REFERENCES colonias (id) ON DELETE SET NULL,
  carga_id BIGINT NOT NULL REFERENCES cargas_datos (id),
  UNIQUE (sistema, referencia)
);
CREATE INDEX IF NOT EXISTS idx_paradas_geom ON paradas_transporte USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_paradas_zona ON paradas_transporte (zona_id);

-- ───────────────────────── Atributos por zona (RF-1.1) ─────────────────────────
CREATE TABLE IF NOT EXISTS zona_atributos (
  zona_id UUID PRIMARY KEY REFERENCES colonias (id) ON DELETE CASCADE,
  area_km2 NUMERIC NOT NULL,
  num_unidades_economicas INTEGER NOT NULL DEFAULT 0,
  num_comercios INTEGER NOT NULL DEFAULT 0,
  num_comercios_mayoreo INTEGER NOT NULL DEFAULT 0,
  num_comercios_menudeo INTEGER NOT NULL DEFAULT 0,
  num_paradas INTEGER NOT NULL DEFAULT 0,
  densidad_comercios_km2 NUMERIC,
  densidad_paradas_km2 NUMERIC,
  calculado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  carga_id BIGINT REFERENCES cargas_datos (id)     -- carga que disparó el cálculo
);

-- ───────────────────────── Resultado del checklist "Para pasar" ─────────────────────────
CREATE TABLE IF NOT EXISTS mvp2_validaciones (
  id BIGSERIAL PRIMARY KEY,
  ejecutada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  aprobada BOOLEAN NOT NULL,
  modo TEXT,
  resultados JSONB NOT NULL
);

-- Vista de consumo para API/web
CREATE OR REPLACE VIEW v_zonas_piloto AS
SELECT c.id, c.nombre, c.ciudad, c.tipo_unidad, c.clave_geo, c.estado, c.es_piloto,
       a.area_km2, a.num_comercios, a.num_comercios_mayoreo, a.num_comercios_menudeo,
       a.num_unidades_economicas, a.num_paradas,
       a.densidad_comercios_km2, a.densidad_paradas_km2,
       cd.fuente_clave AS fuente_geom, cd.modo, cd.iniciada_en AS fecha_carga_geom
FROM colonias c
LEFT JOIN zona_atributos a ON a.zona_id = c.id
LEFT JOIN cargas_datos cd ON cd.id = c.carga_id
WHERE c.es_piloto;
