# Diccionario de datos · MVP-2
Esquema en `db/migrations/002_mvp2_datos_abiertos.sql`.

| Tabla | Propósito | Llave de negocio | Notas |
|---|---|---|---|
| `colonias` | Catálogo de zonas (AGEB urbanas) | `(tipo_unidad, clave_geo)` | `geom` MULTIPOLYGON 4326 con CHECK de validez; `es_piloto`; `carga_id` |
| `unidades_economicas` | Establecimientos DENUE | `id_denue` | `es_comercio` generado (SCIAN 43/46); `zona_id` por `ST_Covers` |
| `paradas_transporte` | Paradas de transporte público | `(sistema, referencia)` | `modo` por defecto `bus` |
| `zona_atributos` | RF-1.1: conteos y densidades por zona | `zona_id` | Recalculado en cada corrida |
| `fuentes_datos` | Catálogo de fuentes | `clave` | `estado`, `ultima_ingesta` |
| `cargas_datos` | **Trazabilidad**: una fila por importación | `id` | `sha256`, `archivo_origen`, `modo`, conteos |
| `cargas_descartes` | Registros rechazados y motivo | — | máx. 1 000 por carga; el total está en `cargas_datos.registros_descartados` |
| `mvp2_validaciones` | Resultado histórico del checklist | — | `resultados` JSONB |
| `v_zonas_piloto` (vista) | Zonas piloto con atributos y origen | — | La consume la API |

**Descartes registrados:** sin id/CVEGEO, sin geometría o geometría irreparable, SCIAN inválido, coordenadas ausentes / no numéricas /
fuera de México, identificadores duplicados en el archivo. Los registros de otro municipio no son "malos": se omiten por alcance y no cuentan como descartes.
