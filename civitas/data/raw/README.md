# Datos reales para `docker compose run --rm etl mvp2 --fuente real`

Coloca aquí los archivos descargados (no se versionan). Estructura esperada:

```
data/raw/
├─ mgn/        Marco Geoestadístico de INEGI, capa de AGEB urbanas de Puebla (p. ej. 21a.shp con .dbf/.prj; también .geojson. Un .gpkg se convierte antes: `ogr2ogr -f GeoJSON -t_srs EPSG:4326 21a.geojson entrada.gpkg`)
├─ denue/      DENUE de Puebla en CSV (o el .zip tal cual lo entrega INEGI)
└─ transporte/ Paradas: GTFS stops.txt (o .zip de GTFS), CSV con lat/lon, o GeoJSON de puntos
   rentas/     MVP-3: listados de renta capturados con la plantilla data/plantillas/renta_captura_manual.csv (CSV o .zip)
```
O indica las rutas con `CIVITAS_MGN_PATH`, `CIVITAS_DENUE_PATH`, `CIVITAS_TRANSPORTE_PATH`, `CIVITAS_RENTAS_PATH` (ver `.env.example`) o con
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

## Listados de renta (MVP-3: `etl mvp3 --fuente real`)
Captura manual en la plantilla `data/plantillas/renta_captura_manual.csv` (ver `docs/mvp3/ADR-002-fuente-renta.md`). **No agregues columnas de
teléfono, correo, nombre del anunciante ni descripciones**: el importador no las lee ni las guarda, pero el archivo seguiría en disco con esos
datos; si las detecta lo avisa en el reporte de calidad.

| Columna | Qué poner |
|---|---|
| `id_anuncio` | Identificador del anuncio en el portal (obligatorio; evita duplicados) |
| `url` | Enlace al anuncio (se guarda sin parámetros) |
| `tipo` | departamento, casa o cuarto |
| `precio` | Renta mensual en pesos (`8500`, `$8,500`…). Anuncios en USD se descartan |
| `moneda` | Opcional: `MXN` |
| `superficie_m2` | Metros cuadrados (`65`, `65 m2`) |
| `recamaras` | Número, o `estudio` (= 0) |
| `latitud`, `longitud` | Coordenadas WGS84 (clic derecho en el mapa → copiar coordenadas). Los portales suelen aproximar el pin |
| `fecha_publicacion` | `AAAA-MM-DD` |

Precio y coordenadas son obligatorios (sin ellos el listado se descarta con su motivo). Superficie y recámaras pueden quedar vacías, pero cuentan
para el umbral de campos clave nulos (<10 %).
