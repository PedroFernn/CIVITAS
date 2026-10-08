# CIVITAS — MVP-1 · Fundación y cumplimiento (1–7 oct)

Stack: Next.js (web) · NestJS (api) · Postgres+PostGIS · Caddy (HTTPS) · Docker Compose.

## Local
```bash
docker run -d --name civitas-db -p 5432:5432 -e POSTGRES_USER=civitas -e POSTGRES_PASSWORD=civitas -e POSTGRES_DB=civitas postgis/postgis:16-3.4
export DATABASE_URL=postgres://civitas:civitas@localhost:5432/civitas
npm ci --prefix api && npm ci --prefix web
node scripts/migrate.mjs --seed          # migraciones desde cero + datos demo
npm run build --prefix api && npm test --prefix api
PORT=4000 node api/dist/main.js &        # GET http://localhost:4000/zonas
npm run build --prefix web && npm start --prefix web
WEB_URL=http://localhost:3000 API_URL=http://localhost:4000 scripts/smoke.sh
```

## Local con Docker Compose (sin dominio)
```bash
cp .env.example .env     # DOMAIN=http://localhost → HTTP plano; cambia POSTGRES_PASSWORD
docker compose up -d --build
docker compose run --rm migrate node /app/scripts/migrate.mjs --seed   # datos demo (el smoke exige /zonas con datos)
WEB_URL=http://localhost scripts/smoke.sh
```
La app queda en http://localhost y la API en http://localhost/api. Si el puerto 80 está ocupado, libéralo o edita el mapeo en `docker-compose.yml`.

## Despliegue (VPS barato con Docker)
1. En el servidor: `git clone <repo> /opt/civitas && cd /opt/civitas && cp .env.example .env` y edita `.env` (DOMAIN, POSTGRES_PASSWORD). El DNS del dominio debe apuntar al servidor (puertos 80/443 abiertos).
2. En GitHub → Settings: secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `PUBLIC_URL` (https://tu-dominio) y variable `DEPLOY_ENABLED=true`.
3. Cada push a `main` con CI en verde despliega y corre el smoke contra la URL pública.

## Pendiente antes de capturar datos personales
- Completar y validar legalmente `web/app/aviso-privacidad/page.tsx` (responsable, domicilio, correo ARCO).
