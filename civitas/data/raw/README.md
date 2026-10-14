# Datos reales para `docker compose run --rm etl mvp2 --fuente real`

Coloca aquí los archivos descargados (no se versionan). Estructura esperada:

```
data/raw/
├─ mgn/        Marco Geoestadístico de INEGI, capa de AGEB urbanas de Puebla (p. ej. 21a.shp con .dbf/.prj; también .geojson. Un .gpkg se convierte antes: `ogr2ogr -f GeoJSON -t_srs EPSG:4326 21a.geojson entrada.gpkg`)
├─ denue/      DENUE de Puebla en CSV (o el .zip tal cual lo entrega INEGI)
└─ transporte/ Paradas: GTFS stops.txt (o .zip de GTFS), CSV con lat/lon, o GeoJSON de puntos
```
O indica las rutas con `CIVITAS_MGN_PATH`, `CIVITAS_DENUE_PATH`, `CIVITAS_TRANSPORTE_PATH` (ver `.env.example`) o con
`--zonas / --denue / --transporte`.

## De dónde bajarlos
- **MGN y DENUE:** portal de INEGI (https://www.inegi.org.mx → Marco Geoestadístico y DENUE, "Descarga masiva"). Verifica en el portal
  la versión vigente y el nombre exacto de la capa de AGEB urbanas: este repo no la fija.
- **Transporte:** **pendiente de decidir** qué proveedor/conjunto de datos de Puebla se usará y bajo qué licencia.

## Qué lee el importador
| Fuente | Campos esperados (sin distinguir mayúsculas) |
|---|---|
| MGN | `CVEGEO` (o `CVE_ENT`+`CVE_MUN`+`CVE_LOC`+`CVE_AGEB`), `CVE_ENT`, `CVE_MUN`; el CRS se toma del `.prj` y se reproyecta a 4326 en PostGIS |
| DENUE | `id`, `nom_estab`, `codigo_act`, `nombre_act`, `per_ocu`, `cve_ent`, `cve_mun`, `latitud`, `longitud` |
| Paradas | `stop_id`, `stop_name`, `stop_lat`, `stop_lon` (o alias `lat`/`lon`/`latitud`/`longitud`) |

Si algún nombre difiere en tu descarga, ajusta los alias en `civitas/api/src/etl/readers.ts`. Se filtra al municipio
`--cve-ent 21 --cve-mun 114` (Puebla); cambia los flags para otro municipio.
