# MVP-4 · Catálogo v1 (22–28 oct)

**Hito:** H4 · Catálogo navegable: mapa, lista y ficha con precio mediano por m².
Incluye la **barra de búsqueda de zonas en la navbar** (pedida aparte; el plan la ubicaba en MVP-5, RF-1.4).

## Alcance

| Requisito | Cómo se cumple | Dónde |
|---|---|---|
| **RF-1.1** Mapa, lista y ficha de zona con mediana de precio por m² | Explorador `/colonias` (filtros, lista paginada y mapa Leaflet sincronizados) y ficha `/colonias/[id]` (mediana de renta y por m², cuartiles, comparación con la ciudad, posición, minimapa, listados recientes anónimos, trazabilidad) | `web/app/colonias/`, `web/components/{Explorador,MapaLeaflet,MiniMapa}.tsx`, `api/src/zonas/` |
| **RF-1.3 (parcial)** Recaptura semanal automática de precios | `etl recaptura` y servicio `recaptura` del compose (cada 7 días): re-ingesta idempotente de los archivos de `data/raw/rentas` | `api/src/etl/mvp4/recaptura.ts`, `docker-compose.yml` |
| Búsqueda por zona en la navbar | Combobox accesible con autocompletado (`GET /zonas/buscar`) | `web/components/BuscadorZonas.tsx`, `api/src/zonas/busqueda.ts` |
| **RNF Latencia:** lista y ficha en <3 s | Se mide en el servidor (p95) en el checklist | `etl/mvp4/validacion.ts → latencia` |
| **RNF Usabilidad:** se ve bien en móvil (360 px de ancho) | CSS adaptable; verificado sin desbordes a 360 y 390 px (capturas en el reporte) | `web/app/globals.css` (bloque «Adaptable») |
| **RNF Disponibilidad:** el cron registra sus fallos | Cada ejecución y cada fallo quedan en `cargas_datos` (comando «recaptura») y la fuente pasa a `error` | `recaptura.ts → registrarFallo` |

## "Para pasar" → checklist ejecutable

`etl mvp4` termina con exit code 0 solo si todos los checks están en `ok` o `warn`. Se guarda en `mvp4_validaciones` y se publica en `GET /zonas/validacion`.

| Criterio | Check | Condición |
|---|---|---|
| Demo: mapa + ficha en las 30 zonas | `mapa_y_ficha_30_zonas` | las 30 zonas piloto tienen ficha con polígono y aparecen en el mapa |
| La mediana por m² coincide con un cálculo manual en 3 zonas | `mediana_m2_manual` | para las 3 zonas con más datos, la mediana de la API (renta y por m²) = la mediana recalculada en JavaScript desde los listados, con 0.01 de tolerancia |
| Primera recaptura automática ejecutada | `recaptura_ejecutada` | `ok` con una recaptura **programada** (`[programada]`); `warn` si solo hay manuales; `fail` si no hay ninguna |
| RNF Disponibilidad | `cron_registra_fallos` | `ok` si hay fallos registrados; `warn` si nunca ha fallado (el registro lo prueba la suite) |
| RNF Latencia | `latencia` | p95 de lista y de ficha < 3 000 ms (`warn` con datos sintéticos: el criterio habla de datos reales) |

## Convención de nombres (hay dos «zonas»)

| Capa | Ruta | Qué es |
|---|---|---|
| Web | `/colonias`, `/colonias/[id]` | **Catálogo** (P-02 explorador, P-03 ficha). Navbar: «Catálogo» |
| Web | `/zonas` | Datos y checklist de **MVP-2** (zonas piloto, trazabilidad). Navbar: «Zonas piloto» |
| Web | `/rentas` | Datos y calidad de **MVP-3**. Navbar: «Rentas» |
| API | `/zonas`, `/zonas/buscar`, `/zonas/geojson`, `/zonas/:id`, `/zonas/validacion` | Catálogo (MVP-4), con precios |
| API | `/colonias…`, `/datos-abiertos/*`, `/tiles/*` | Datos abiertos de MVP-2, sin precios |

La web usa `/colonias` porque así lo nombran los mockups (P-02/P-03); la API usa `/zonas` porque así lo nombra el plan de sprints. Las tablas de `/zonas` y `/rentas` enlazan cada zona a su ficha.

## Cómo correrlo

```bash
docker compose up -d --build
docker compose run --rm etl mvp2        # zonas, DENUE y paradas
docker compose run --rm etl mvp3        # listados de renta (sintéticos)
docker compose run --rm etl mvp4        # una recaptura (si no hay) + checklist de MVP-4
docker compose --profile cron up -d recaptura    # recaptura cada 7 días (corre al arrancar)
```

- Catálogo: http://localhost/colonias · ficha: desde la lista o la búsqueda · API: http://localhost/api/zonas
- La búsqueda se enfoca con **`/`** o **Ctrl/Cmd + K**; flechas + Enter para elegir, Esc para cerrar.
- Con datos reales, el servicio usa `RECAPTURA_FUENTE=real` (y los archivos de `data/raw/rentas/`).

## Búsqueda de zonas

- Sin acentos ni mayúsculas, sobre nombre + CVEGEO + ciudad; **todos** los términos deben coincidir.
- Un número de 1–3 dígitos («4», «04») es un **número de zona** y solo se busca en el nombre: todos los CVEGEO de un municipio comparten dígitos y traerían todas las zonas. Con 4 o más dígitos o letras es una clave parcial.
- Orden: coincidencia exacta de número o clave > prefijo de clave > prefijo de nombre/palabra > contiene; a igualdad, más listados.
- Los comodines de `LIKE` (`%`, `_`) se escapan; todo va parametrizado; `q` admite 60 caracteres y 6 términos.
- Sin texto muestra **zonas sugeridas** (las de más listados) y las búsquedas recientes (solo en el navegador, `localStorage`).
- Sin JavaScript, el formulario envía `GET /colonias?q=…`.

## Regla de supresión (misma de MVP-3)

Una zona con menos de **5 listados** aparece, pero sin mediana ni cuartiles; la mediana por m² exige además **5 datos de superficie** (los listados sin m² no la tienen). Se aplica igual en la lista, el mapa, la ficha (incluido el desglose por tipo) y la búsqueda. Ordenar o filtrar por renta nunca deja entrar a una zona suprimida. La vista `v_zona_precios` (migración 005) cuenta por separado los listados con m².

## Recaptura: qué es y qué no es

Con captura manual (ADR-002) **no hay nada que «recapturar» automáticamente**: una persona sigue transcribiendo anuncios. La recaptura semanal re-ingiere de forma idempotente los archivos que haya en `data/raw/rentas/` (si hay archivos nuevos, entran; si no, no cambia nada, y en modo sintético tampoco). Automatiza la ingesta, no la captura. Un fallo (archivo ausente, zonas sin cargar, error de lectura) se registra, no detiene el servicio y se reintenta en el siguiente ciclo.

## Límites conocidos (a propósito, no olvidos)

- **Datos sintéticos:** zonas en cuadrícula y precios de prueba. El mapa **no lleva mapa base** para no sugerir que son límites reales de Puebla; con las AGEB reales se puede añadir una capa base (decisión de privacidad: pediría teselas a un tercero).
- **«Integración con datos reales» (plan, mar 27 oct): pendiente.** Depende de cargar MGN/DENUE reales (MVP-2) y ≥300 listados reales con el ADR-002 aceptado (MVP-3).
- **Latencia con datos reales sin medir:** el check mide en el servidor con 30 zonas sintéticas; con miles de listados habrá que repetir la medición, desde el navegador.
- **Comparador y filtros de transporte/seguridad** (MVP-5, P-02/P-07) no están: el explorador filtra por texto y rango de renta.
- **Ficha sin gráfica histórica** (P-03 punto 2, Sprint 5) ni índice de asequibilidad (Sprint 11): requiere ingreso por zona y series de precios.
- **Cada 7 días con `restart: unless-stopped`:** si el contenedor se reinicia, recaptura de inmediato (idempotente, sin daño).

## Pendiente (lo hace una persona)

1. Datos reales de MVP-2 y MVP-3 (ver MVP3.md) y, con ellos, repetir el checklist (la latencia pasa de `warn` a `ok`/`fail` real).
2. Elegir si el mapa lleva capa base (teselas de terceros) cuando las zonas sean reales.
3. Decidir si el catálogo se vuelve la portada (P-01) y si en móvil el mapa o la lista va primero (hoy: mapa primero).
