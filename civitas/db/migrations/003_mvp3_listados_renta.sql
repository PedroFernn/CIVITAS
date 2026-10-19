-- 003_mvp3_listados_renta.sql — MVP-3: Ingesta de precios de renta
-- RF-1.2 listados de renta de 1 fuente, normalizados y asignados a una zona · RNF Interoperabilidad / Privacidad / Legalidad
-- (ver docs/mvp3/MVP3.md y docs/mvp3/ADR-002-fuente-renta.md)

-- ───────────────────────── Catálogo de fuentes ─────────────────────────
-- Una fila por parser (RNF Interoperabilidad: un parser aislado por fuente).
INSERT INTO fuentes_datos (clave, nombre, descripcion, url, licencia) VALUES
  ('renta_captura_manual', 'Listados de renta · captura manual',
   'Anuncios públicos de renta transcritos a mano en la plantilla CSV (sin teléfono ni nombre del anunciante). Ver ADR-002.',
   NULL, 'Depende del portal de origen; términos de uso revisados en ADR-002')
ON CONFLICT (clave) DO NOTHING;

-- ───────────────────────── Listados de renta (RF-1.2) ─────────────────────────
-- PRIVACIDAD: esta tabla NO tiene (ni debe tener) columnas de teléfono, correo, nombre del anunciante ni texto libre.
-- El validador de MVP-3 falla si aparece una columna con esos nombres.
CREATE TABLE IF NOT EXISTS listados_renta (
  id BIGSERIAL PRIMARY KEY,
  fuente_clave TEXT NOT NULL REFERENCES fuentes_datos (clave),
  id_fuente TEXT NOT NULL,                         -- identificador del anuncio en la fuente
  url TEXT,                                        -- sin query string ni fragmento (ver sanitizarUrl)
  tipo_inmueble TEXT NOT NULL DEFAULT 'otro'
    CHECK (tipo_inmueble IN ('departamento', 'casa', 'cuarto', 'otro')),
  precio_mxn NUMERIC(12, 2) NOT NULL CHECK (precio_mxn > 0),   -- renta mensual en pesos
  superficie_m2 NUMERIC(8, 2) CHECK (superficie_m2 > 0),
  recamaras SMALLINT CHECK (recamaras BETWEEN 0 AND 10),       -- 0 = estudio/loft
  precio_m2 NUMERIC GENERATED ALWAYS AS (ROUND(precio_mxn / NULLIF(superficie_m2, 0), 2)) STORED,
  publicado_en DATE,
  geom GEOMETRY(POINT, 4326) NOT NULL,
  zona_id UUID REFERENCES colonias (id) ON DELETE SET NULL,
  -- Huella para detectar la misma oferta republicada con otro id (NULL si no hay superficie: ver ADR-002).
  huella TEXT,
  capturado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  carga_id BIGINT NOT NULL REFERENCES cargas_datos (id),
  UNIQUE (fuente_clave, id_fuente)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_listados_huella ON listados_renta (fuente_clave, huella) WHERE huella IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listados_geom ON listados_renta USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_listados_zona ON listados_renta (zona_id);
CREATE INDEX IF NOT EXISTS idx_listados_carga ON listados_renta (carga_id);

-- ───────────────────────── Reporte de calidad (PARA PASAR: "Reporte de calidad generado") ─────────────────────────
-- Una fila por carga; la API lo publica y la web lo muestra (el archivo en data/reports es solo una copia de conveniencia).
CREATE TABLE IF NOT EXISTS reportes_calidad (
  carga_id BIGINT PRIMARY KEY REFERENCES cargas_datos (id) ON DELETE CASCADE,
  generado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  resumen JSONB NOT NULL
);

-- ───────────────────────── Resultado del checklist "Para pasar" ─────────────────────────
CREATE TABLE IF NOT EXISTS mvp3_validaciones (
  id BIGSERIAL PRIMARY KEY,
  ejecutada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  aprobada BOOLEAN NOT NULL,
  modo TEXT,
  resultados JSONB NOT NULL
);

-- Resumen por zona para la API/web. Las estadísticas de zonas con pocos listados se suprimen en la API (ver RentaService).
CREATE OR REPLACE VIEW v_renta_zona AS
SELECT z.id AS zona_id, z.nombre, z.clave_geo, z.es_piloto,
       count(*)::int AS n_listados,
       percentile_cont(0.5)  WITHIN GROUP (ORDER BY l.precio_mxn) AS renta_mediana,
       percentile_cont(0.25) WITHIN GROUP (ORDER BY l.precio_mxn) AS renta_p25,
       percentile_cont(0.75) WITHIN GROUP (ORDER BY l.precio_mxn) AS renta_p75,
       percentile_cont(0.5)  WITHIN GROUP (ORDER BY l.precio_m2)  AS precio_m2_mediano
FROM listados_renta l
JOIN colonias z ON z.id = l.zona_id
GROUP BY z.id;
