# MVP-2 · Datos abiertos y zonas piloto

**Ventana:** 8–14 oct · **Hito H2:** 30 zonas cargadas · Tarjeta original: [`mvp2_tarjeta_requisitos.png`](../mvp2_tarjeta_requisitos.png)

## 1. Requisitos

### Funcionales
| ID | Requisito | Implementación | Verificación |
|---|---|---|---|
| **RF-1.2** | Integrar INEGI (marco geoestadístico, DENUE) y transporte | `civitas/api/src/etl/readers.ts` + `loaders.ts`: MGN (Shapefile/GeoJSON), DENUE (CSV/ZIP), paradas (GTFS `stops.txt`/CSV/GeoJSON) → tablas `colonias`, `unidades_economicas`, `paradas_transporte` | check `zonas_piloto`; `civitas/api/test/etl/pipeline.spec.ts` |
| **RF-1.1** | Atributos por zona: comercios y paradas | `zona_atributos` (conteos, mayoreo/menudeo, densidades por km²) vía `asignarYCalcularAtributos`; API `GET /colonias`, vista `v_zonas_piloto` | check `atributos_por_zona` |
| **RF-1.2 (piloto)** | ≥ 30 zonas piloto de Puebla con polígono | `seleccionarPilotos` (regla en ADR-001) | check `zonas_piloto` |

### No funcionales
| ID | Requisito | Implementación | Verificación |
|---|---|---|---|
| **RNF-INT** Interoperabilidad | Importación reproducible con un solo comando | `docker compose run --rm etl mvp2` (mismo código y dependencias que la API, en TypeScript); migraciones SQL versionadas con checksum; upserts idempotentes; formatos estándar de entrada | `etl mvp2 --desde-cero`; test de idempotencia |
| **RNF-CAL** Calidad de datos | Sin geometrías inválidas | `ST_MakeValid` al cargar + `CHECK colonias_geom_valida` en BD + descartes con motivo (`cargas_descartes`) + validación de coordenadas y SCIAN | check `sin_geometrias_invalidas`; tests de calidad |
| **RNF-TRZ** Trazabilidad | Fuente y fecha de cada carga | `cargas_datos` (fuente, archivo, SHA-256, modo, comando, inicio/fin, leídos/cargados/descartados) y `carga_id` en cada fila; `fuentes_datos.ultima_ingesta` | check `trazabilidad`; API `GET /datos-abiertos/cargas` |

## 2. "Para pasar" (criterios de aceptación)
| Criterio de la tarjeta | Cómo se comprueba |
|---|---|
| ≥ 30 zonas con polígono, conteo de comercios y de paradas | `zonas_piloto` + `atributos_por_zona` |
| El script corre desde cero sin pasos manuales | `docker compose run --rm etl mvp2 --desde-cero` (recrea el esquema, migra, importa, valida; código de salida ≠ 0 si falla) |
| Unidad de zona decidida y documentada | [ADR-001](ADR-001-unidad-de-zona.md) + check `unidad_de_zona` |

El resultado de cada corrida se guarda en `mvp2_validaciones`, en `data/reports/mvp2_validacion.json` (dentro del contenedor), se imprime en consola
y se muestra en la web (`/zonas`).

## 3. Cómo ejecutarlo
```bash
cd civitas && cp .env.example .env        # y pon una POSTGRES_PASSWORD
docker compose up -d --build              # db + migraciones + api + web + caddy → http://localhost
docker compose run --rm etl mvp2          # importa (datos sintéticos incluidos), calcula y valida
docker compose run --rm etl mvp2 --desde-cero                 # igual, recreando el esquema
docker compose run --rm etl mvp2 --fuente real --desde-cero   # con archivos reales en data/raw/
docker compose --profile test run --rm test                   # pruebas (api + ETL) contra PostGIS
```
Web en http://localhost/zonas · API y Swagger en http://localhost/api/docs. Sin Docker (desarrollo en el host): `pnpm install`,
`docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db` y `pnpm etl mvp2`, `pnpm dev:api`, `pnpm dev:web`.

## 4. Modos de datos
| Modo | Qué es | Para qué |
|---|---|---|
| `fixture` (por defecto) | **Datos sintéticos** deterministas (`civitas/data/fixtures/`): 36 AGEB falsas sobre el centro de Puebla, ~3 600 comercios, ~60 paradas, con defectos introducidos a propósito | Desarrollo, CI y demostración del pipeline. **No son datos de INEGI.** El validador lo marca con `warn` |
| `real` | Archivos descargados de INEGI y del proveedor de transporte | Cumplir H2 con datos verdaderos |

Los modos no se mezclan: al correr uno se borra lo cargado por el otro.

## 5. Pendientes y supuestos (leer antes de dar H2 por cerrado)
0. **Migración de stack (Python → TypeScript).** El ETL se portó a TypeScript dentro del paquete `civitas/api` (un solo stack: NestJS + Next.js,
   gestor pnpm). Se verificó contra la salida del ETL original sobre los mismos datos sintéticos. Cambios de alcance:
   los **GeoPackage (`.gpkg`) ya no se leen directamente** (se convierten con `ogr2ogr -f GeoJSON -t_srs EPSG:4326`; el error lo indica) y
   los Shapefile se reproyectan con `proj4` en vez de GDAL. El generador de datos sintéticos en Python se retiró: los fixtures quedan
   congelados en `civitas/data/fixtures/` (el script sigue en el historial de git).
1. **Prueba con datos reales pendiente.** Los lectores de MGN y DENUE están escritos contra el esquema de columnas esperado
   (`CVEGEO, CVE_ENT, CVE_MUN…` y `id, nom_estab, codigo_act, latitud, longitud…`) y aceptan alias, pero no se ejecutaron contra
   los archivos oficiales. La primera corrida en modo real puede requerir ajustar nombres de columna en `readers.ts`.
2. **Fuente de transporte sin definir.** Se aceptan paradas en GTFS/CSV/GeoJSON, pero falta decidir y obtener el conjunto
   concreto para Puebla (y su licencia).
3. Unidad de zona = AGEB (ADR-001). El **nombre de colonia** para el usuario final queda fuera de MVP-2.
4. `cobertura_transporte` y `equipamiento_urbano` de `colonias` siguen vacíos: su fórmula se define en un MVP posterior; MVP-2 solo entrega los conteos base.
5. La API de datos abiertos es de solo lectura y **sin autenticación** (la auth llega en el Sprint 3 de la arquitectura); no expone datos personales.

## 6. Trazabilidad con casos de uso
- **UC-V1 / UC-V1.1 / UC-V2** (catálogo público, índices agregados, filtros): consumen `GET /colonias` con conteos por zona.
- **UC-A1 / UC-A1.1** (catálogo de colonias, revisión de fuentes abiertas importadas): `GET /datos-abiertos/fuentes` y `/cargas`.
- Actor secundario **Proveedor de Datos Abiertos (INEGI, municipio)**: fuentes `inegi_mgn`, `inegi_denue`, `transporte_paradas`.
