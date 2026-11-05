-- MVP-5 · entrevistas de precio y checklist «Para pasar».
-- Privacidad: las entrevistas se guardan con un alias (seudónimo), nunca con nombre, correo ni teléfono. Solo las lee el rol administrador.

CREATE TABLE IF NOT EXISTS entrevistas_precio (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                 TEXT NOT NULL CHECK (tipo IN ('inquilino', 'b2b')),           -- b2b: inmobiliaria o administradora
  alias                TEXT NOT NULL CHECK (char_length(alias) BETWEEN 2 AND 60),
  realizada_en         DATE NOT NULL,
  modalidad            TEXT NOT NULL DEFAULT 'presencial' CHECK (modalidad IN ('presencial', 'remota')),
  duracion_min         INTEGER CHECK (duracion_min BETWEEN 1 AND 240),
  zona_id              UUID REFERENCES colonias(id) ON DELETE SET NULL,              -- zona de la que habló (opcional)
  renta_actual_mxn     INTEGER CHECK (renta_actual_mxn BETWEEN 1000 AND 250000),     -- lo que paga o administra hoy
  renta_justa_mxn      INTEGER CHECK (renta_justa_mxn BETWEEN 1000 AND 250000),      -- lo que considera justo en esa zona
  acepta_pagar         BOOLEAN,                                                      -- ¿pagaría por un reporte de zona?
  monto_dispuesto_mxn  INTEGER CHECK (monto_dispuesto_mxn BETWEEN 0 AND 100000),
  notas                TEXT NOT NULL CHECK (char_length(btrim(notas)) >= 20),
  creada_por           TEXT NOT NULL,
  creada_en            TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizada_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (monto_dispuesto_mxn IS NULL OR acepta_pagar IS TRUE)
);
CREATE INDEX IF NOT EXISTS entrevistas_precio_tipo_idx ON entrevistas_precio (tipo, realizada_en DESC);

-- Resultado de cada corrida del checklist de MVP-5 (misma forma que mvp4_validaciones).
CREATE TABLE IF NOT EXISTS mvp5_validaciones (
  id            BIGSERIAL PRIMARY KEY,
  ejecutada_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  aprobada      BOOLEAN NOT NULL,
  modo          TEXT NOT NULL,
  resultados    JSONB NOT NULL
);
