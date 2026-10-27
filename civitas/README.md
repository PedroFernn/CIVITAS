# CIVITAS · Observatorio urbano

Asequibilidad inmobiliaria con datos abiertos. Stack único en **TypeScript**, gestionado con **pnpm** (workspace) y empaquetado con **un solo Dockerfile**:

```
civitas/
├─ api/            NestJS · API de solo lectura (Swagger en /docs) + ETL de datos abiertos (src/etl, CLI: src/cli.ts)
├─ web/            Next.js · incluye /zonas (checklist, mapa, tablas, trazabilidad) y /rentas (calidad de listados, renta por zona)
├─ db/migrations/  SQL versionado (PostGIS), aplicado por el ETL (`migrar`) con checksum
├─ data/fixtures/  Datos SINTÉTICOS (no son de INEGI ni de ningún portal) · data/raw/ = archivos reales (no versionados) · data/plantillas/ = plantilla de captura de rentas
├─ Dockerfile      Un solo archivo: targets api · web · test
├─ Caddyfile       Proxy: /api/* → API, el resto → web (HTTPS automático si DOMAIN es un dominio real)
└─ docker-compose.yml
```
La documentación del proyecto está en [`../docs`](../docs) (arquitectura, casos de uso, MVP-2, MVP-3).

## Levantarlo (local, sin dominio)
```bash
cp .env.example .env                       # pon una POSTGRES_PASSWORD (DOMAIN=http://localhost ya viene)
docker compose up -d --build               # db → migraciones → api → web → caddy
docker compose run --rm etl mvp2           # carga datos sintéticos, calcula atributos y valida
docker compose run --rm etl mvp3           # MVP-3: listados de renta sintéticos → normaliza, deduplica, asigna zona y valida
```
- Web: http://localhost · zonas piloto: http://localhost/zonas · rentas: http://localhost/rentas · cuentas: http://localhost/iniciar-sesion
- API: http://localhost/api · Swagger: http://localhost/api/docs · contrato: http://localhost/api/docs-json
- Si el puerto 80 está ocupado: `HTTP_PORT=8080` y `DOMAIN=http://localhost:8080` en `.env`.

No hay pasos de build manuales: el `Dockerfile` instala (`pnpm install --frozen-lockfile`), compila y empaqueta api y web.

## Comandos
| Qué | Comando |
|---|---|
| Pruebas (api + ETL, contra PostGIS en Docker) | `docker compose --profile test run --rm test` |
| ETL con datos reales (`data/raw/`) | `docker compose run --rm etl mvp2 --fuente real --desde-cero` |
| Solo validar lo cargado | `docker compose run --rm etl validar` · `docker compose run --rm etl validar-mvp3` |
| Listados de renta reales (`data/raw/rentas/`) | `docker compose run --rm etl mvp3 --fuente real` (antes: zonas reales de MVP-2 y ADR-002 aceptado) |
| Reporte de calidad de rentas | `curl http://localhost/api/listados-renta/calidad` |
| Smoke del stack | `WEB_URL=http://localhost scripts/smoke.sh` |
| Desarrollo en el host | `pnpm install` · `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db` · `pnpm dev:api` · `pnpm dev:web` · `pnpm test` |

Por defecto el ETL usa **datos sintéticos** para poder demostrar y probar el pipeline sin descargas. Detalle, criterios de aceptación y
pendientes: [`../docs/mvp2/MVP2.md`](../docs/mvp2/MVP2.md). Decisión de unidad de zona (AGEB): [`../docs/mvp2/ADR-001-unidad-de-zona.md`](../docs/mvp2/ADR-001-unidad-de-zona.md).

MVP-3 (precios de renta): [`../docs/mvp3/MVP3.md`](../docs/mvp3/MVP3.md) · decisión de fuente y términos de uso: [`../docs/mvp3/ADR-002-fuente-renta.md`](../docs/mvp3/ADR-002-fuente-renta.md).

## Despliegue (VPS con Docker)
1. En el servidor: `git clone <repo> /opt/civitas && cd /opt/civitas/civitas && cp .env.example .env` y edita `.env` (`DOMAIN`, `POSTGRES_PASSWORD`). El DNS debe apuntar al servidor (puertos 80/443 abiertos).
2. En GitHub → Settings: secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `PUBLIC_URL` y la variable `DEPLOY_ENABLED=true`.
3. Cada push a `main` con CI en verde (pruebas + stack completo con smoke) despliega y corre el smoke público. El workflow vive en `.github/workflows/ci.yml` (raíz del repo: GitHub no ejecuta workflows anidados).

## Cuentas y roles
Registro (`/crear-cuenta`), inicio de sesión (`/iniciar-sesion`), `/mi-cuenta` y panel `/admin` (solo administrador). Detalle en [`../docs/auth/AUTH.md`](../docs/auth/AUTH.md).

**Cuentas de ejemplo (solo local):** `usr1` / `123` (usuario) · `adm` / `456` (administrador). Se crean solas con `docker compose up` en local; con un `DOMAIN` real **no** se crean salvo `DEMO_USERS=1`. En un servidor público pon `DEMO_USERS=0` y reinicia la API: **elimina** las cuentas de ejemplo que ya existan. `SMOKE_PROD=1 scripts/smoke.sh` falla si siguen activas.

## Pendiente antes de cargar rentas reales
- Elegir el portal, revisar sus términos de uso y completar/aceptar `docs/mvp3/ADR-002-fuente-renta.md`. Con datos reales el validador no aprueba sin eso.

## Pendiente antes de capturar datos personales
- **El registro ya guarda correo electrónico:** el aviso de privacidad debe estar completo antes de abrir el registro al público.
- Completar y validar legalmente `web/app/aviso-privacidad/page.tsx` (responsable, domicilio, correo ARCO).
