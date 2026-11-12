# MVP-6 · Motor de anomalías, INEGI de todo el estado y cuentas (5–11 nov)

**Hito:** H6 · Motor de anomalías v1 corriendo sobre los listados (Justo / Inflado / Subprecio), más tres correcciones pedidas al cerrar el MVP-5:
usuarios, datos de INEGI consistentes para todo el estado y una interfaz más cuidada.

## Alcance

| Requisito | Cómo se cumple | Dónde |
|---|---|---|
| **H6** Motor de anomalías v1 | Mediana y MAD del precio por m² por grupo comparable; z robusto con umbral calibrado contra una muestra etiquetada | `api/src/anomalias/motor.ts`, `etl/mvp6/calcular.ts` |
| Etiqueta visible | Cada anuncio muestra Justo / Inflado / Subprecio en la ficha de zona y en `/rentas`; la lista se puede filtrar por etiqueta | `web/components/Etiqueta.tsx` |
| **Usuarios** | Se integra el panel de cuenta de `/mi-cuenta` (accesos según el uso previsto, datos y sesión) y se verifican cuentas, roles y sesiones | `web/app/mi-cuenta`, `etl/mvp6/validacion.ts → cuentas_seguras` |
| **INEGI de todo el estado** | 2,503 AGEB urbanas de 217 municipios con población y viviendas del Censo 2020, nombre oficial de municipio y localidad, polígonos municipales | `scripts/preparar-datos-reales.py`, migración 011 |
| **Interfaz** | Menú que se pliega en móvil, filtro por municipio, población y comercios por cada 1,000 habitantes en la ficha, héroe con la forma del estado | `web/` |

## Método

El motor etiqueta cada listado con superficie comparando su precio por m² con el de listados comparables.

1. **Grupo comparable.** Se usa el más local que tenga datos suficientes: la **zona** y el número de recámaras (mínimo 5 listados); si no alcanza, el **municipio** con el mismo tipo de inmueble y recámaras (mínimo 8); y si tampoco, el **estado** (mínimo 8). Un listado sin grupo suficiente no se etiqueta: es mejor callar que adivinar.
2. **Z robusto.** `z = (x − mediana) / σ`, con `σ = 1.4826 · MAD` (MAD = mediana de las desviaciones absolutas). La mediana y el MAD resisten valores extremos, que es justo lo que se quiere detectar. Para que un grupo casi idéntico no dispare falsos positivos, σ tiene un piso de 5 % de la mediana.
3. **Etiqueta.** `z > umbral` → **Inflado**; `z < −umbral` → **Subprecio**; en medio → **Justo**.
4. **Umbral calibrado.** El umbral se elige entre 1.5, 2, 2.5, 3 y 3.5 como el que maximiza F1 contra la muestra etiquetada (en empate, el más alto, que da menos falsos positivos). Sin muestra se usa 2.5 y el checklist lo avisa.
5. **Métricas.** Precisión = anomalías detectadas con la etiqueta correcta / anomalías detectadas; recall = las mismas / anomalías reales; intervalo de Wilson al 95 % para la precisión.

**Muestra de validación.** El plan prevé etiquetar a mano 60 listados. Con precios de demostración no hay humano que los etiquete: el generador (`scripts/generar-rentas-demo.py`) **siembra** anomalías conocidas y las declara en `renta_demo_etiquetas.csv` con la línea `# origen=sembrado`. El checklist da `warn` mientras el origen no sea `humano`, porque medir un método contra datos sembrados por el mismo equipo es una validación débil (riesgo ya señalado en el plan, sección A.5).

## "Para pasar" → checklist ejecutable

`etl mvp6` aplica las migraciones, calcula las anomalías, evalúa los criterios y termina con exit code 0 solo si ninguno está en `fail`. El resultado se guarda en `mvp6_validaciones`.

| Criterio | Check | Condición |
|---|---|---|
| Método documentado | `metodo_documentado` | este documento tiene la sección «Método» |
| Cobertura | `motor_cobertura` | ≥ 95 % de los listados con superficie reciben etiqueta |
| Muestra de validación | `muestra_validacion` | ≥ 60 etiquetas; `warn` si son sembradas, no humanas |
| Precisión | `precision_medida` | ≥ 85 % con su intervalo de confianza; `warn` si es contra etiquetas sembradas |
| Umbral | `umbral_calibrado` | calibrado con la muestra; `warn` si se usó el valor por defecto |
| Claves de INEGI | `inegi_claves` | toda zona tiene CVEGEO de 13 caracteres con prefijo igual a su entidad y municipio |
| Municipios de INEGI | `inegi_municipios` | toda zona tiene municipio cargado, con el mismo nombre oficial, y ningún municipio tiene más población en sus AGEB que en total |
| Censo | `inegi_censo` | ≥ 95 % de las zonas con población (INEGI reserva el resto por confidencialidad) |
| Cobertura de INEGI | `inegi_cobertura` | informa zonas, municipios y pilotos |
| Cuentas | `cuentas_seguras` | contraseñas solo con hash scrypt, sesiones solo con SHA-256 y al menos un administrador |
| Datos reales | `datos_reales` | `warn` mientras los precios sean de demostración |

## Datos de INEGI de todo el estado

- **Unidad de zona:** sigue siendo la AGEB urbana (ADR-001). Lo que cambia es el alcance: de un municipio a los 217 del estado. `--cve-mun 114` ahora solo fija el municipio de los **pilotos** (ADR-001); `--estado-completo` carga todos los demás.
- **Qué trae cada zona:** población y viviendas del Censo 2020 (`pobtot`, `tvivhab`), nombre oficial del municipio y de la localidad. Cuando INEGI reserva una cifra por confidencialidad se guarda como nulo, no como cero.
- **Nombre de la zona:** la colonia más frecuente entre los comercios del DENUE de esa AGEB. La llave es **municipio + localidad + AGEB**, porque la clave de AGEB se repite entre municipios.
- **Municipios:** 217 polígonos con población y viviendas; sirven para la forma del estado y el filtro por municipio.
- **Referencia de precio:** «frente al promedio» compara con el municipio; si tiene menos de 5 zonas con precios, con todo el estado.
- **Indicadores nuevos:** habitantes por km² y comercios por cada 1,000 habitantes, calculados en la API a partir de las cifras del Censo.

## Cómo correrlo

```bash
python3 scripts/preparar-datos-reales.py                       # descarga INEGI (estado completo) y paradas de OSM
python3 scripts/generar-rentas-demo.py                         # rentas de DEMOSTRACIÓN y su muestra etiquetada
docker compose up -d --build
docker compose run --rm etl mvp2 --fuente real --estado-completo --desde-cero
docker compose run --rm etl mvp3 --fuente fixture --listados /app/data/raw/rentas-demo/renta_demo_puebla.csv
docker compose run --rm etl mvp6                               # anomalías y checklist de MVP-6
```

## Limitaciones declaradas

- Los precios de renta son de demostración: las anomalías demuestran el método, no el mercado de Puebla.
- La precisión se mide contra anomalías sembradas por el mismo equipo (no contra etiquetas humanas).
- Los municipios pequeños tienen pocas zonas y pocos listados: sus comparaciones caen al nivel del estado.
- Las paradas de OpenStreetMap son incompletas (no hay rutas ni frecuencias).
