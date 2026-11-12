-- 011_mvp6_inegi_estado.sql — MVP-6: datos de INEGI de todo el estado, consistentes entre sí
-- Cada AGEB trae del Censo 2020 su población y sus viviendas (ADR-001 ya lo anticipaba: «cruce directo con el Censo»).
-- `ciudad` pasa a ser el nombre OFICIAL del municipio (INEGI); `localidad`, el de la localidad. Los 217 municipios se guardan
-- aparte (polígono + población + viviendas) para dibujar la forma del estado y filtrar por municipio.

ALTER TABLE colonias
  ADD COLUMN IF NOT EXISTS localidad TEXT,
  ADD COLUMN IF NOT EXISTS poblacion INTEGER CHECK (poblacion IS NULL OR poblacion >= 0),
  ADD COLUMN IF NOT EXISTS viviendas INTEGER CHECK (viviendas IS NULL OR viviendas >= 0);

CREATE INDEX IF NOT EXISTS idx_colonias_ciudad ON colonias (ciudad);
CREATE INDEX IF NOT EXISTS idx_colonias_municipio ON colonias (cve_ent, cve_mun);

CREATE TABLE IF NOT EXISTS municipios (
  cve_ent   TEXT NOT NULL,
  cve_mun   TEXT NOT NULL,
  nombre    TEXT NOT NULL,
  poblacion INTEGER CHECK (poblacion IS NULL OR poblacion >= 0),
  viviendas INTEGER CHECK (viviendas IS NULL OR viviendas >= 0),
  geom      GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
  carga_id  BIGINT REFERENCES cargas_datos (id),
  PRIMARY KEY (cve_ent, cve_mun),
  CONSTRAINT municipios_geom_valida CHECK (ST_IsValid(geom) AND NOT ST_IsEmpty(geom))
);
CREATE INDEX IF NOT EXISTS idx_municipios_geom ON municipios USING GIST (geom);

INSERT INTO fuentes_datos (clave, nombre, descripcion, url, licencia) VALUES
  ('inegi_mgem', 'INEGI · Marco Geoestadístico (municipios)',
   'Polígonos de los municipios con población y viviendas del Censo 2020 (forma del estado y filtro por municipio).',
   'https://www.inegi.org.mx/temas/mg/', 'Términos de libre uso de la información del INEGI')
ON CONFLICT (clave) DO NOTHING;
