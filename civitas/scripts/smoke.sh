#!/usr/bin/env bash
# Criterios "PARA PASAR" de MVP-1 y MVP-2 (requiere el ETL ya corrido). Uso:
#   WEB_URL=https://tu-dominio.mx scripts/smoke.sh
#   WEB_URL=http://localhost scripts/smoke.sh   (stack local con Docker Compose)
set -euo pipefail
WEB_URL="${WEB_URL:?Falta WEB_URL}"; WEB_URL="${WEB_URL%/}"
API_URL="${API_URL:-$WEB_URL/api}"; API_URL="${API_URL%/}"
fail() { echo "✘ $*"; exit 1; }
ok()   { echo "✔ $*"; }

if [ "${REQUIRE_HTTPS:-0}" = "1" ]; then
  [[ "$WEB_URL" == https://* ]] || fail "WEB_URL debe ser https://"
  ok "WEB_URL usa HTTPS"
fi

code() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$1"; }

[ "$(code "$WEB_URL/")" = "200" ] && ok "GET / → 200" || fail "GET / no responde 200"

# Aviso visible en el pie de todas las páginas (incluida la 404)
for p in / /aviso-privacidad /ruta-que-no-existe; do
  html="$(curl -s --max-time 15 "$WEB_URL$p")"
  echo "$html" | grep -q '<footer' && echo "$html" | grep -q 'href="/aviso-privacidad"' \
    && ok "pie con enlace al Aviso de Privacidad en $p" || fail "falta el pie con aviso en $p"
done
[ "$(code "$WEB_URL/aviso-privacidad")" = "200" ] && ok "GET /aviso-privacidad → 200" || fail "aviso no responde 200"

# API operativa
[ "$(code "$API_URL/health")" = "200" ] && ok "GET /health → 200" || fail "GET /health falló"
[ "$(code "$API_URL/docs-json")" = "200" ] && ok "contrato OpenAPI publicado" || fail "falta /docs-json"

# Datos de MVP-2 (requiere el ETL: `docker compose run --rm etl mvp2`). SMOKE_DATA=0 los omite (p. ej. un servidor sin cargar).
if [ "${SMOKE_DATA:-1}" = "1" ]; then
  body="$(curl -s --max-time 15 -w '\n%{http_code}' "$API_URL/colonias?limit=200")"
  [ "${body##*$'\n'}" = "200" ] && echo "$body" | grep -q '"nombre"' \
    && ok "GET /colonias → 200 con datos" || fail "GET /colonias falló o no hay datos (¿corriste el ETL?)"
  curl -s --max-time 15 "$API_URL/datos-abiertos/validacion" | grep -q '"aprobada":true' \
    && ok "checklist de MVP-2 aprobado" || fail "el checklist de MVP-2 no está aprobado"
  curl -s --max-time 15 "$WEB_URL/zonas" | grep -q 'zonas piloto' \
    && ok "GET /zonas (web) muestra las zonas piloto" || fail "la página /zonas no muestra datos"
fi

echo "Smoke OK"
