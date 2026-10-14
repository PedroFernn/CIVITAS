# CIVITAS · Observatorio urbano

Asequibilidad inmobiliaria con datos abiertos. Stack único en **TypeScript**, gestionado con **pnpm** (workspace) y empaquetado con **un solo Dockerfile**:

```
civitas/
├─ api/            NestJS · API de solo lectura (Swagger en /docs) + ETL de datos abiertos (src/etl, CLI: src/cli.ts)
├─ web/            Next.js · incluye /zonas (checklist, mapa, tablas, trazabilidad)
├─ db/migrations/  SQL versionado (PostGIS), aplicado por el ETL (`migrar`) con checksum
├─ data/fixtures/  Datos SINTÉTICOS (no son de INEGI) · data/raw/ = archivos reales (no versionados)
├─ Dockerfile      Un solo archivo: targets api · web · test
├─ Caddyfile       Proxy: /api/* → API, el resto → web (HTTPS automático si DOMAIN es un dominio real)
└─ docker-compose.yml
```
La documentación del proyecto está en [`../docs`](../docs) (arquitectura, casos de uso, MVP-2).

## Levantarlo (local, sin dominio)
```bash
cp .env.example .env                       # pon una POSTGRES_PASSWORD (DOMAIN=http://localhost ya viene)
docker compose up -d --build               # db → migraciones → api → web → caddy
docker compose run --rm etl mvp2           # carga datos sintéticos, calcula atributos y valida
```
- Web: http://localhost · zonas piloto: http://localhost/zonas
- API: http://localhost/api · Swagger: http://localhost/api/docs · contrato: http://localhost/api/docs-json
- Si el puerto 80 está ocupado: `HTTP_PORT=8080` y `DOMAIN=http://localhost:8080` en `.env`.

No hay pasos de build manuales: el `Dockerfile` instala (`pnpm install --frozen-lockfile`), compila y empaqueta api y web.

## Comandos
| Qué | Comando |
|---|---|
| Pruebas (api + ETL, contra PostGIS en Docker) | `docker compose --profile test run --rm test` |
| ETL con datos reales (`data/raw/`) | `docker compose run --rm etl mvp2 --fuente real --desde-cero` |
| Solo validar lo cargado | `docker compose run --rm etl validar` |
| Smoke del stack | `WEB_URL=http://localhost scripts/smoke.sh` |
| Desarrollo en el host | `pnpm install` · `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db` · `pnpm dev:api` · `pnpm dev:web` · `pnpm test` |

Por defecto el ETL usa **datos sintéticos** para poder demostrar y probar el pipeline sin descargas. Detalle, criterios de aceptación y
pendientes: [`../docs/mvp2/MVP2.md`](../docs/mvp2/MVP2.md). Decisión de unidad de zona (AGEB): [`../docs/mvp2/ADR-001-unidad-de-zona.md`](../docs/mvp2/ADR-001-unidad-de-zona.md).

## Despliegue (VPS con Docker)
1. En el servidor: `git clone <repo> /opt/civitas && cd /opt/civitas/civitas && cp .env.example .env` y edita `.env` (`DOMAIN`, `POSTGRES_PASSWORD`). El DNS debe apuntar al servidor (puertos 80/443 abiertos).
2. En GitHub → Settings: secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `PUBLIC_URL` y la variable `DEPLOY_ENABLED=true`.
3. Cada push a `main` con CI en verde (pruebas + stack completo con smoke) despliega y corre el smoke público. El workflow vive en `.github/workflows/ci.yml` (raíz del repo: GitHub no ejecuta workflows anidados).

## Pendiente antes de capturar datos personales
- Completar y validar legalmente `web/app/aviso-privacidad/page.tsx` (responsable, domicilio, correo ARCO).
