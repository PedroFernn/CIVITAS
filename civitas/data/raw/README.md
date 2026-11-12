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
- **Transporte:** paradas de bus de **OpenStreetMap** (© colaboradores de OpenStreetMap, licencia ODbL: hay que citar la fuente; la UI y el pie lo hacen),
  consultadas con Overpass. Puebla no publica un GTFS abierto de sus rutas que se haya podido verificar. Son paradas, no rutas ni frecuencias, y muchas no tienen nombre en OSM.

## Datos reales de todo el estado de Puebla (ya versionados)
Estos archivos SÍ están en el repo, para que cualquiera corra el ETL real sin descargar nada:

| Archivo | Qué es | Tamaño |
|---|---|---|
| `mgn/agebu_21.geojson` | 2,503 AGEB urbanas de los 217 municipios (INEGI, MGN dic. 2025) con población y viviendas del Censo 2020, municipio y localidad oficiales y nombre de colonia | ~9 MB |
| `municipios/mgem_21.geojson` | Contorno, población y viviendas de los 217 municipios (INEGI) | ~10 MB |
| `denue/denue_21_recortado.zip` | 410,693 unidades económicas del DENUE de Puebla, **sin teléfono, correo, sitio web ni razón social** | ~13 MB |
| `transporte/paradas_osm_21.geojson` | 1,211 paradas y estaciones de bus y tren de OpenStreetMap (ODbL) | ~0.2 MB |

`python3 scripts/preparar-datos-reales.py` los vuelve a descargar o regenerar (idempotente; `--renombrar` recalcula los nombres de zona):
consulta el servicio wscatgeo de INEGI una vez por municipio, descarga el DENUE completo y lo recorta, y consulta Overpass para las paradas.
Luego: `docker compose run --rm etl mvp2 --fuente real --estado-completo --desde-cero`. `--cve-mun 114` solo fija el municipio de los 30 pilotos (ADR-001).

El DENUE original sí trae teléfono y correo de cada negocio; el recorte los quita antes de guardarlo porque el ETL no los lee y no hay motivo para
conservarlos ni publicarlos. Los nombres de negocio pueden incluir usuarios de redes sociales (p. ej. `@ELCARRITO.PUEBLA`): son el nombre que INEGI publica.

## Rentas de DEMOSTRACIÓN sobre zonas reales
No existe una fuente abierta de rentas por zona. Por decisión explícita del equipo, `python3 scripts/generar-rentas-demo.py` genera ~29,000 listados **inventados**
dentro de las AGEB reales (`data/raw/rentas-demo/`, fuera del repo), con su archivo de etiquetas sembradas, que se cargan siempre como `fixture`:
`docker compose run --rm etl mvp3 --fuente fixture --listados /app/data/raw/rentas-demo/renta_demo_estado.csv` (y lo mismo con `mvp4`/`mvp5`; luego `mvp6`).
La validación de origen del MVP-3 pasa de `fail` a `warn` **solo** en el caso «zonas reales + precios fixture»; el caso inverso sigue fallando.
La UI avisa por separado del origen de zonas y de precios (`web/components/AvisoDatos.tsx`). Para precios reales: captura manual (ADR-002) y `--fuente real`.

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
