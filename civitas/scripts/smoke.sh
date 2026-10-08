#!/usr/bin/env bash
# Criterios "PARA PASAR" del MVP-1. Uso:
#   WEB_URL=https://tu-dominio.mx scripts/smoke.sh
#   WEB_URL=http://localhost:3000 API_URL=http://localhost:4000 scripts/smoke.sh   (local/CI)
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

# RF-1.1: endpoint /zonas operativo
body="$(curl -s --max-time 15 -w '\n%{http_code}' "$API_URL/zonas")"
[ "${body##*$'\n'}" = "200" ] && echo "$body" | grep -q '"nombre"' \
  && ok "GET /zonas → 200 con datos" || fail "GET /zonas falló"

echo "Smoke OK"
