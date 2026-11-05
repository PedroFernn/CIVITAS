# MVP-5 · Búsqueda, comparador y entrevistas (29 oct–4 nov)

**Hito:** H5 · Comparador y 5 entrevistas.

## Alcance

| Requisito | Cómo se cumple | Dónde |
|---|---|---|
| **RF-1.4** Búsqueda por nombre y filtros (renta, transporte) | `GET /zonas?q=&min_renta=&max_renta=&min_paradas=` (todo combinable) y los mismos filtros en el catálogo `/colonias`; el buscador de la navbar usa `GET /zonas/buscar` | `api/src/zonas/`, `web/app/colonias/page.tsx`, `web/components/BuscadorZonas.tsx` |
| **RF-1.4** Comparador de hasta 3 zonas | `GET /zonas/comparar?items=id1,id2,id3` (de 1 a 3 UUID, orden conservado, más de 3 → 400) y la página `/comparar`, cuyo estado vive en la URL (`?items=…`): se puede compartir y funciona sin JavaScript. En el catálogo, cada tarjeta tiene la casilla «Comparar» | `api/src/zonas/comparar.ts`, `web/app/comparar/page.tsx`, `web/components/Explorador.tsx` |
| **Negocio:** 5 entrevistas de precio (3 inquilinos o estudiantes, 2 inmobiliarias o administradoras) | Captura y avance en `/admin/entrevistas` (solo administrador); la tabla guarda un **alias**, nunca nombre, correo ni teléfono | `api/src/entrevistas/`, `web/app/admin/entrevistas/`, migración `010_mvp5_entrevistas.sql` |
| **RNF Latencia:** búsqueda en <2 s | El checklist mide el p95 del autocompletado, la búsqueda con filtros y la comparación | `api/src/etl/mvp5/validacion.ts → latencia_busqueda` |
| **RNF Rendimiento:** prueba con 50 usuarios simulados | 50 sesiones concurrentes sobre un pool de conexiones como el de la API (la meta de Fase 0, miles de usuarios, no se verifica en el MVP) | `api/src/etl/mvp5/carga.ts`, `validacion.ts → carga_50_usuarios` |
| Tablas grandes manejables | `/zonas` y `/rentas` usan `TablaDatos`: buscador, orden y paginación en el navegador | `web/components/TablaDatos.tsx` |

## "Para pasar" → checklist ejecutable

`etl mvp5` aplica las migraciones, evalúa los criterios y termina con exit code 0 solo si ninguno está en `fail`. El resultado se guarda en `mvp5_validaciones` y lo publica `GET /entrevistas/validacion` (solo administrador).

| Criterio | Check | Condición |
|---|---|---|
| Búsqueda y filtros | `busqueda_y_filtros` | buscar una zona sin acentos ni mayúsculas la encuentra; `min_renta` y `min_paradas` devuelven solo zonas del rango y coinciden con un conteo manual; combinar texto y transporte no devuelve más que el transporte solo |
| Comparador de 3 zonas | `comparador_3_zonas` | 3 zonas en el orden pedido, con polígono, con las mismas cifras que su ficha, y la cuarta se rechaza |
| Comparador en producción | `comparador_en_produccion` | `ok` si la API y la página `/comparar` de `CIVITAS_URL` responden con las 3 zonas; `warn` si `CIVITAS_URL` no está definida (solo se comprobó contra la base local) |
| Latencia de búsqueda | `latencia_busqueda` | p95 < 2 000 ms (`warn` con datos sintéticos: el criterio habla de datos reales) |
| 50 usuarios simulados | `carga_50_usuarios` | 0 errores y p95 < 2 000 ms con 50 usuarios a la vez (`warn` con datos sintéticos) |
| 5 entrevistas con notas | `entrevistas_5` | 3 a inquilinos o estudiantes y 2 a inmobiliarias o administradoras, todas con notas de al menos 20 caracteres; `fail` si faltan |
| Plan B del lunes 2 de noviembre | `plan_b` | `ok` si este documento tiene la sección de Plan B; `warn` si no se encuentra el documento; `fail` si falta la sección |

## Cómo correrlo

```bash
docker compose up -d --build
docker compose run --rm etl mvp2        # zonas, DENUE y paradas
docker compose run --rm etl mvp3        # listados de renta (sintéticos)
docker compose run --rm etl mvp4        # recaptura (si no hay) + checklist del catálogo
docker compose run --rm etl mvp5        # checklist de MVP-5
CIVITAS_URL=https://tu-dominio.mx docker compose run --rm etl mvp5   # además verifica el comparador en producción
```

- Comparador: http://localhost/comparar · entrevistas: http://localhost/admin/entrevistas (requiere iniciar sesión como administrador).
- `scripts/smoke.sh` comprueba el comparador, los filtros y la protección de las entrevistas (`SMOKE_MVP5=0` los omite). Las entrevistas no se miden ahí: las comprueba `etl mvp5`.

## Privacidad de las entrevistas

- Solo el rol administrador lee o escribe (`@UseGuards(SesionGuard)` + `@Roles('administrador')` en todo el controlador).
- La tabla no tiene columnas de nombre, correo ni teléfono; el alias y las notas rechazan correos y teléfonos con una validación en la API.
- Un monto dispuesto a pagar solo se admite si la persona aceptaría pagar (restricción `CHECK` en la base).
- El criterio go/no-go de Fase 0 (al menos 2 de las 5 personas B2B pagarían por un reporte de zona) se calcula en el avance.

## Límites conocidos

- **Datos sintéticos:** la búsqueda, el comparador y las mediciones usan zonas y listados de prueba.
- **Comparador en producción:** sin `CIVITAS_URL` solo se verifica contra la base local.
- **Prueba de carga:** simula 50 usuarios sobre las consultas del servicio, no sobre la red ni el navegador, y no verifica la meta de Fase 0 (miles de usuarios).
- **Recaptura (MVP-4):** en modo real solo lee el primer archivo de `data/raw/rentas/`; si hay varios, entra solo uno.

## Pendiente (lo hace una persona)

1. **Las 5 entrevistas** (3 inquilinos o estudiantes y 2 inmobiliarias o administradoras) con sus notas, capturadas en `/admin/entrevistas`. Mientras no estén, `entrevistas_5` falla y `etl mvp5` no aprueba.
2. **El plan B** para el caso de perder el lunes 2 de noviembre (Día de Muertos): redactarlo y añadirlo a este documento como sección propia. Hasta entonces `plan_b` queda en `fail`, porque el documento existe pero no trae esa sección.
3. **Verificar el comparador en producción** con `CIVITAS_URL` cuando haya un despliegue público.
4. **Datos reales** de INEGI, de transporte y de renta (ver MVP-2, MVP-3 y MVP-4) y repetir las mediciones.
