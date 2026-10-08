-- Solo desarrollo/CI (no es migración). Nombres de colonias sin métricas ni geometría inventadas.
INSERT INTO zonas (nombre, ciudad, estado) VALUES
  ('Centro Histórico',         'Puebla', 'publicada'),
  ('La Paz',                   'Puebla', 'publicada'),
  ('San Baltazar Campeche',    'Puebla', 'publicada'),
  ('Cholula',                  'Puebla', 'publicada'),
  ('Colonia en revisión (demo)', 'Puebla', 'borrador')
ON CONFLICT (ciudad, nombre) DO NOTHING;
