# CIVITAS — API (MVP-1 + MVP-2)

API REST de **solo lectura**, sin autenticación y sin datos personales. NestJS en `civitas/api`. La referencia viva y completa es el contrato
**OpenAPI 3** que la propia API publica; esta página es el resumen.

| Recurso | URL (Docker + Caddy) | Directo (puerto 4000) |
|---|---|---|
| Swagger UI | `http://localhost/api/docs` | `http://localhost:4000/docs` |
| Contrato JSON | `http://localhost/api/docs-json` (copia en [`openapi.json`](openapi.json)) | `…:4000/docs-json` |

Las rutas de abajo van **sin** el prefijo `/api`; con Caddy se llaman como `/api/colonias`. Entra a Swagger por `/api/docs` sin barra final.
Para regenerar la copia estática: `curl http://localhost/api/docs-json -o docs/openapi.json`.

## Endpoints
| Método y ruta | Descripción |
|---|---|
| `GET /health` | Estado de la API y versión de PostGIS (503 si la BD no responde) |
| `GET /colonias` | Zonas piloto con atributos (comercios, paradas, densidades) y origen del dato. Filtros: `ciudad`, `piloto`, `min_comercios`, `min_paradas`, `bbox`, `orden`; paginación `limit`/`offset`. Devuelve `{ total, limit, offset, items[] }` |
| `GET /colonias/geojson` | Las mismas zonas como `FeatureCollection` (polígonos + atributos) |
| `GET /colonias/{id}` | Detalle de una zona con polígono y trazabilidad (`id` UUID) |
| `GET /tiles/colonias/{z}/{x}/{y}.mvt` | Vector tile (MVT, `application/x-protobuf`) de las zonas piloto, generado en PostGIS |
| `GET /datos-abiertos/fuentes` | Catálogo de fuentes y estado de su última carga |
| `GET /datos-abiertos/cargas` | Historial de cargas: fuente, archivo, SHA-256, fecha, conteos. `?fuente=`, `?limit=1..100` |
| `GET /datos-abiertos/validacion` | Último resultado del checklist "para pasar" de MVP-2 (404 si aún no hay corridas) |

Los datos los carga el ETL (`docker compose run --rm etl mvp2`); con los fixtures, `modo_datos` es `fixture` y **no son datos reales de INEGI**.

## Cambios respecto a MVP-1
`GET /zonas` y la tabla `zonas` se reemplazaron por `GET /colonias` y la tabla `colonias` (unidad de zona = AGEB, ADR-001). El esquema vigente es
`civitas/db/migrations/001_base.sql` y `002_mvp2_datos_abiertos.sql`; el diccionario de datos está en [`mvp2/DICCIONARIO_DATOS.md`](mvp2/DICCIONARIO_DATOS.md).
La versión MVP-1 de esta documentación sigue en el historial de git (commit `e7c9c8f`).

## Fuera de alcance por ahora
Autenticación, escritura, límite de peticiones, esquemas de error en el contrato (solo se declaran las respuestas exitosas).
