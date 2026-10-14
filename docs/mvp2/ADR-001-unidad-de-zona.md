# ADR-001 · Unidad de zona de CIVITAS: AGEB urbana

- **Estado:** Aceptada (MVP-2, 8–14 oct 2026)
- **Decide:** equipo CIVITAS · **Requisito que lo exige:** MVP-2, criterio "Unidad de zona decidida y documentada (colonia, AGEB o H3)"

## Contexto
`ARQUITECTURA_TECNICA.md` modela el catálogo como `colonias` (polígonos con renta, ingreso, índice de asequibilidad…).
Para MVP-2 hay que elegir **qué es una zona** antes de cargar datos abiertos, porque de eso depende cómo se une cada
comercio (DENUE) y cada parada de transporte a un polígono, y cómo se cruzará después con ingreso/renta.

## Opciones evaluadas
| Criterio | Colonia | **AGEB urbana (INEGI)** | Hexágono H3 |
|---|---|---|---|
| Polígonos oficiales y abiertos | No hay fuente nacional única; hay que digitalizar o usar catálogos municipales/SEPOMEX (que son códigos postales, no límites) | **Sí: Marco Geoestadístico (MGN) de INEGI** | Los genera el propio sistema |
| Cruce con DENUE | Solo espacial | **Espacial y por clave**: DENUE trae la clave de AGEB | Solo espacial |
| Cruce con ingreso/población (Censo) | Imposible sin reasignar | **Directo**: el Censo publica resultados por AGEB | Requiere reasignar (areal weighting) |
| Reconocible para el usuario final | **Alto** | Medio-bajo (clave numérica) | Bajo |
| Tamaño homogéneo | No | No | **Sí** |
| Estabilidad en el tiempo | Baja (límites informales) | Alta (versionada por INEGI) | Total |

## Decisión
La unidad de zona es la **AGEB urbana** del MGN de INEGI, identificada por su **CVEGEO** (`clave_geo`, 13 caracteres:
entidad 2 + municipio 3 + localidad 4 + AGEB 4).

Se **conserva la tabla `colonias`** de la arquitectura como catálogo de zonas (no se renombra, para no romper P-01…P-03 ni la
API planeada) y se añade `tipo_unidad` (`'colonia' | 'ageb' | 'h3'`) y `clave_geo`. Hoy todas las filas son `'ageb'`.
El nombre de colonia que ve el usuario será un atributo de presentación a resolver en un MVP posterior (p. ej. por
intersección con un catálogo de colonias), no la llave del modelo.

### Consecuencias
- `colonias.geom` pasa de `POLYGON` a `MULTIPOLYGON`: el MGN trae AGEB con varias partes y `ST_Multi` evita rechazarlas.
- Restricción de calidad en BD: `CHECK (ST_IsValid(geom) AND NOT ST_IsEmpty(geom))`. El importador repara con `ST_MakeValid`
  y descarta (registrando el motivo) lo irreparable.
- Unicidad `(tipo_unidad, clave_geo)` → la importación es **idempotente** (upsert).
- Si más adelante se quiere mostrar "colonias", se añade una capa/relación de colonias sin cambiar el modelo de zonas.
- Cambiar a H3 o colonia sería una migración de datos, no de esquema (`tipo_unidad` ya lo admite).

## Selección de las zonas piloto (≥ 30)
Regla **reproducible y sin pasos manuales**: de las AGEB del municipio de Puebla (`21114`) con al menos
`--min-comercios` (1) comercios, ordenadas por CVEGEO, se toman **N = 30 espaciadas uniformemente** (muestreo sistemático).
Distribuye el piloto por la ciudad en lugar de concentrarlo en el centro y evita elegir a mano. Se puede forzar una lista con
`--lista-piloto archivo.txt`. Quién valide el piloto con datos reales debería revisar que la muestra sea representativa.

## Definición de "comercio"
Unidad económica de DENUE con código SCIAN de sector **43** (comercio al por mayor) o **46** (al por menor).
El resto de unidades económicas se conserva y se cuenta aparte (`num_unidades_economicas`).
