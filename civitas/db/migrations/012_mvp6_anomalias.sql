-- 012_mvp6_anomalias.sql — MVP-6 · H6: motor de anomalías v1 (Justo / Inflado / Subprecio)
-- Método (plan Scrum, MVP-6): mediana y MAD del precio por m² por grupo comparable; z robusto = 0.6745·(x − mediana)/MAD.
-- El grupo es la zona y el número de recámaras; si tiene pocos datos se amplía (municipio, tipo y recámaras; luego el estado).
-- Una fila por listado con superficie. La tabla NO guarda datos personales: solo derivados del precio.

CREATE TABLE IF NOT EXISTS listados_anomalias (
  listado_id  BIGINT PRIMARY KEY REFERENCES listados_renta (id) ON DELETE CASCADE,
  etiqueta    TEXT NOT NULL CHECK (etiqueta IN ('justo', 'inflado', 'subprecio')),
  z_robusto   NUMERIC(8, 3) NOT NULL,
  nivel       TEXT NOT NULL CHECK (nivel IN ('zona', 'municipio', 'estado')),   -- qué tan local fue la comparación
  mediana_m2  NUMERIC(10, 2) NOT NULL,
  n_grupo     INTEGER NOT NULL CHECK (n_grupo >= 1),
  umbral      NUMERIC(4, 2) NOT NULL,
  calculado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anomalias_etiqueta ON listados_anomalias (etiqueta);

-- Resultado de cada corrida del checklist de MVP-6 (misma forma que mvp4_validaciones y mvp5_validaciones).
CREATE TABLE IF NOT EXISTS mvp6_validaciones (
  id            BIGSERIAL PRIMARY KEY,
  ejecutada_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  aprobada      BOOLEAN NOT NULL,
  modo          TEXT NOT NULL,
  resultados    JSONB NOT NULL
);
