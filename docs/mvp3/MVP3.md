# MVP-3 · Ingesta de precios de renta (15–21 oct)

**Hito:** H3 · 300 listados normalizados.

## Alcance

| Requisito | Cómo se cumple | Dónde |
|---|---|---|
| **RF-1.2** Ingesta de listados de renta de 1 fuente | Parser de la plantilla de captura manual → carga idempotente (upsert por `fuente + id_anuncio`) | `api/src/etl/renta/fuentes/captura-manual.ts`, `loader.ts` |
| Normalizar precio, m², recámaras y coordenadas | Funciones puras con motivos de rechazo | `etl/renta/normalizar.ts` (+ `coord()` de MVP-2) |
| Asignar cada listado a una zona | `ST_Covers` contra las AGEB de MVP-2 (mismo criterio que comercios y paradas) | `loader.ts → asignarZonaListados` |
| Deduplicar | Por `id_anuncio` y por **huella de la oferta** (tipo, precio, m², recámaras, ubicación a ~11 m); índices únicos en BD | `normalizar.ts → huella`, migración 003 |
| **RNF Interoperabilidad:** un parser aislado por fuente | Contrato `ParserRenta` + registro; el resto del ETL no conoce el formato de la fuente | `etl/renta/tipos.ts`, `registro.ts` |
| **RNF Privacidad:** no guardar teléfono ni nombre del anunciante | El contrato del parser **no tiene** esos campos; la tabla no tiene esas columnas; las columnas de contacto/texto libre del archivo se ignoran y se avisan; URLs sin query string | `tipos.ts`, `captura-manual.ts`, migración 003 |
| **RNF Legalidad:** términos de uso revisados | Registro en el ADR-002; el validador exige la revisión con datos reales | `docs/mvp3/ADR-002-fuente-renta.md`, `etl/renta/adr.ts` |

## "Para pasar" → checklist ejecutable

`etl mvp3` termina con exit code 0 solo si todos los checks están en `ok` o `warn`. Se guarda en `mvp3_validaciones` y se publica en
`GET /listados-renta/validacion` y en la web (`/rentas`).

| Criterio | Check | Condición |
|---|---|---|
| ≥300 listados con zona asignada | `listados_con_zona` | `count(zona_id) ≥ 300` (`--min-listados`) |
| <10 % con campos clave nulos (umbral propuesto) | `campos_clave_nulos` | filas leídas con precio, m², recámaras **o** coordenadas nulos/inválidos, entre filas leídas, **< 10 %** (`--umbral-nulos`) |
| Reporte de calidad generado | `reporte_calidad` | fila en `reportes_calidad` con todas sus secciones |
| Decisión scraping o captura manual, por escrito | `decision_fuente` | ADR-002 con `decision` válida (con datos reales, además `estado: aceptada`) |
| Legalidad | `legalidad_terminos` | revisión de términos registrada y que permite el uso (sintético: aviso; real: fallo) |
| Privacidad | `privacidad` | sin columnas personales, sin enlaces de contacto (aviso si el archivo de origen trae datos personales) |
| Interoperabilidad | `parser_por_fuente` | 1 fuente con listados, con parser registrado y fila en `fuentes_datos` |
| Deduplicación | `deduplicacion` | 0 ids o huellas repetidos e índice único presente |
| Origen | `origen_unico` | listados de un solo modo y del mismo modo que las zonas |

**Sobre el umbral del 10 %:** el porcentaje se mide sobre **todas las filas leídas**, no solo las cargadas. Si solo contara las cargadas,
descartar las filas malas lo haría pasar siempre. Las filas descartadas por precio o coordenadas inválidos cuentan como "con campo nulo".
Es un umbral *propuesto*: si el equipo lo cambia, se ajusta con `--umbral-nulos` y debe quedar escrito aquí.

## Cómo correrlo

```bash
docker compose run --rm etl mvp2        # una vez: zonas, DENUE y paradas (MVP-3 asigna a esas AGEB)
docker compose run --rm etl mvp3        # listados SINTÉTICOS (data/fixtures/renta_fixture.csv)
curl http://localhost/api/listados-renta/calidad      # reporte de calidad (JSON)
```

Con datos reales: capturar en `data/plantillas/renta_captura_manual.csv`, dejar el archivo en `data/raw/rentas/` (o `CIVITAS_RENTAS_PATH` /
`--listados`) y correr `etl mvp3 --fuente real`. **Antes**, completar y aceptar el ADR-002; sin eso el checklist no aprueba datos reales.
Las zonas deben ser las reales de MVP-2 (`etl mvp2 --fuente real`): el validador falla si los listados y las zonas son de distinto origen.

Una segunda corrida con el mismo archivo no duplica nada; con archivos nuevos acumula. Cada corrida deja su rastro en `cargas_datos`,
`cargas_descartes` y `reportes_calidad`.

## Reglas de normalización

- **Precio:** renta mensual en MXN. Acepta `8500`, `8,500`, `$8,500`, `$ 8,500.00 MXN`, `8500 mensuales`. USD u otra moneda → descarte (no se convierte). Fuera de 1 000–250 000 → descarte (típico error de captura). `12.500` se lee como 12.5 (el punto es decimal en México) y cae fuera de rango.
- **Superficie:** 8–1 500 m². `65`, `65 m2`, `65m²`, `65,5`. Inválida → queda nula (no descarta).
- **Recámaras:** 0–10; `estudio`/`loft` = 0. Inválida → nula (no descarta).
- **Coordenadas:** las de MVP-2 (`coord()`): numéricas, finitas y dentro de México; si no, el listado se descarta.
- **Tipo:** departamento, casa, cuarto u otro. **Fecha:** `AAAA-MM-DD`, `AAAA-MM` o `DD/MM/AAAA`; las imposibles o futuras quedan nulas.
- **Zona:** un listado fuera de toda AGEB cargada **se conserva sin zona** y el reporte lo cuenta.

## Límites conocidos (a propósito, no olvidos)

- **Fuente sin elegir:** el repo no fija ningún portal. La decisión escrita es *captura manual* (ADR-002, estado *propuesta*).
- **Deduplicación heurística:** dos unidades idénticas en el mismo edificio y con el mismo precio se verían como una; sin superficie no se aplica la huella (solo el id). El reporte cuenta las republicaciones descartadas para poder afinar la regla.
- **Coordenadas de portal aproximadas:** un listado junto al borde de una AGEB puede caer en la vecina.
- **Estadísticas por zona:** con menos de 5 listados la API/web no publican mediana ni cuartiles.
- **`colonias.renta_mediana` no se actualiza** con estos datos: queda para el hito que calcule asequibilidad, cuando haya datos reales y el ADR-002 esté aceptado.
- **Archivos de `data/reports/`** (`mvp3_calidad.json|md`) se escriben dentro del contenedor y se pierden con `--rm`; la fuente de verdad es la BD (`GET /listados-renta/calidad`).

## Pendiente (lo hace una persona)

1. Elegir el portal y revisar sus términos de uso vigentes; completar el ADR-002 (`portal`, `terminos_*`) y pasarlo a `aceptada`.
2. Validación legal de la captura y del tratamiento.
3. Capturar ≥300 listados reales y correr `etl mvp3 --fuente real`.
4. Confirmar o cambiar el umbral de 10 %.
5. CI: agregar `docker compose run --rm etl mvp3` después de `etl mvp2` y antes del smoke (el smoke ahora verifica MVP-3; `SMOKE_MVP3=0` lo omite).
