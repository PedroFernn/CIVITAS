-- 004_auth.sql — Cuentas, roles y sesiones (P-04 registro · P-11 inicio de sesión · P-12 cuenta · P-10 administración)
-- Roles de Fase I/II: 'usuario' y 'administrador'. Las contraseñas se guardan SOLO como hash scrypt (nunca en claro).

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario TEXT NOT NULL CHECK (usuario ~ '^[a-z0-9_.-]{3,30}$'),   -- se guarda en minúsculas
  correo TEXT CHECK (correo IS NULL OR (length(correo) <= 254 AND correo = lower(correo) AND correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'usuario' CHECK (rol IN ('usuario', 'administrador')),
  proposito TEXT CHECK (proposito IN ('rentar', 'comprar', 'otro')),
  consentimiento_aviso_en TIMESTAMPTZ,       -- cuándo aceptó el aviso de privacidad (NULL en cuentas de demostración)
  es_demo BOOLEAN NOT NULL DEFAULT false,    -- cuentas de ejemplo sembradas con DEMO_USERS=1
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_acceso TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_usuario ON usuarios (usuario);
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_correo ON usuarios (correo) WHERE correo IS NOT NULL;

-- Sesiones opacas: el cliente guarda un token aleatorio; aquí solo vive su SHA-256 (si se filtra la BD, los tokens no sirven).
CREATE TABLE IF NOT EXISTS sesiones (
  token_hash TEXT PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_en TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones (usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_expira ON sesiones (expira_en);
