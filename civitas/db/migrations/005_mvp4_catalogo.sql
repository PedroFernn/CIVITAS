-- 005_mvp4_catalogo.sql — MVP-4: Catálogo v1 (mapa, lista y ficha de zona con mediana de precio por m²)
-- RF-1.1 · RF-1.3 (parcial: recaptura semanal) · RNF Latencia / Usabilidad / Disponibilidad (ver docs/mvp4/MVP4.md)

-- Resultado del checklist "Para pasar" de MVP-4 (misma forma que mvp2_validaciones y mvp3_validaciones).
CREATE TABLE IF NOT EXISTS mvp4_validaciones (
  id BIGSERIAL PRIMARY KEY,
  ejecutada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  aprobada BOOLEAN NOT NULL,
  modo TEXT,
  resultados JSONB NOT NULL
);

-- Estadísticas de precio por zona para el catálogo. A diferencia de v_renta_zona (MVP-3) cuenta por separado cuántos listados
-- traen precio por m² (los que no declaran superficie no lo tienen): la mediana por m² solo se publica con ≥5 datos de m².
CREATE OR REPLACE VIEW v_zona_precios AS
SELECT l.zona_id,
       count(*)::int AS n_listados,
       count(l.precio_m2)::int AS n_precio_m2,
       percentile_cont(0.5)  WITHIN GROUP (ORDER BY l.precio_mxn) AS renta_mediana,
       percentile_cont(0.25) WITHIN GROUP (ORDER BY l.precio_mxn) AS renta_p25,
       percentile_cont(0.75) WITHIN GROUP (ORDER BY l.precio_mxn) AS renta_p75,
       percentile_cont(0.5)  WITHIN GROUP (ORDER BY l.precio_m2)  AS precio_m2_mediano
FROM listados_renta l
WHERE l.zona_id IS NOT NULL
GROUP BY l.zona_id;
