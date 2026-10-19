---
id: ADR-002
titulo: Fuente de precios de renta y método de captura
estado: propuesta            # propuesta | aceptada  (con datos reales el validador exige "aceptada")
decision: captura_manual     # captura_manual | scraping
fuente: renta_captura_manual # clave en fuentes_datos y en el registro de parsers
portal:                      # portal de anuncios del que se captura (obligatorio con datos reales)
terminos_url:                # URL de los términos de uso revisados (https://…)
terminos_revisados_en:       # AAAA-MM-DD
terminos_revisados_por:      # nombre de quien los revisó
terminos_permiten_uso:       # si | no  (¿permiten reutilizar los datos del anuncio para este fin?)
---

# ADR-002 · Fuente de precios de renta: captura manual (no scraping)

- **Estado:** propuesta, pendiente de que una persona la acepte (cambiar `estado` a `aceptada`).
- **Fecha:** 2026-10-17
- **Hito:** MVP-3 · Ingesta de precios de renta (15–21 oct)

## Contexto

MVP-3 necesita ≥300 listados de renta de **una** fuente, normalizados y asignados a una zona (AGEB, ver ADR-001).
Criterio "Para pasar": *decisión scraping o captura manual, por escrito*. Restricciones del hito:

- **Privacidad:** no se guarda teléfono ni nombre del anunciante.
- **Legalidad:** los términos de uso de la fuente deben estar revisados.
- **Interoperabilidad:** un parser aislado por fuente, para poder cambiar de fuente sin tocar el resto del ETL.

## Decisión

**Captura manual** de anuncios públicos en una plantilla CSV (`data/plantillas/renta_captura_manual.csv`), que el parser
`renta_captura_manual` lee y normaliza. **No** se implementa scraping en este hito.

## Por qué

1. **Legalidad.** Los portales de anuncios suelen restringir en sus términos la extracción automatizada y la reutilización de
   sus bases. Esa revisión es obligatoria *para la fuente concreta* y no está hecha (ver "Pendiente"). Capturar a mano a un
   ritmo humano no elimina la necesidad de revisar los términos, pero no añade riesgo técnico ni de carga sobre el portal.
2. **Privacidad por diseño.** Quien captura transcribe solo los campos de la plantilla; el teléfono y el nombre del anunciante
   nunca entran al archivo. Con scraping habría que filtrarlos después de haberlos descargado.
3. **Costo de mantenimiento.** Un scraper depende del HTML del portal y se rompe sin aviso; la plantilla es un contrato estable.
4. **Alcance del hito.** 300 anuncios son una carga manual razonable para una semana (orden de 2–3 min por anuncio, ~10–15 h en
   total, repartibles entre varias personas).

## Alternativas descartadas por ahora

| Alternativa | Motivo |
|---|---|
| Scraping del portal | Riesgo contractual/legal sin revisar; datos personales descargados antes de filtrarse; frágil. |
| API o convenio con el portal | Es la mejor opción a escala, pero requiere negociación que no cabe en el hito. Revisar si se necesitan >2 000 listados/mes. |
| Datos abiertos oficiales de renta | No se identificó un conjunto con cobertura por zona en Puebla; reabrir si aparece. |

## Consecuencias y límites conocidos

- **Muestra no probabilística:** lo que se capture depende de quién capture y de lo que el portal muestre; no es el mercado completo.
- **Coordenadas aproximadas:** los portales suelen desplazar o redondear el pin del anuncio. Un listado cercano al borde de una
  AGEB puede caer en la vecina. El reporte de calidad cuenta los listados sin zona; la asignación no se corrige a mano.
- **Moneda:** solo se aceptan pesos mexicanos; un anuncio en USD se descarta con su motivo (no se convierte).
- **Deduplicación heurística:** misma fuente, mismo tipo, precio, superficie, recámaras y ubicación (a ~11 m) se considera la
  misma oferta republicada. Sin superficie no se aplica la heurística (solo el `id_anuncio`).
- **Cambiar a scraping u otra fuente** implica un parser nuevo bajo `api/src/etl/renta/fuentes/`, su fila en `fuentes_datos`
  (nueva migración) y actualizar este ADR. El resto del pipeline no cambia.

## Pendiente (lo hace una persona, no el código)

- [ ] Elegir el portal y registrar `portal`.
- [ ] Leer sus términos de uso vigentes y completar `terminos_url`, `terminos_revisados_en`, `terminos_revisados_por` y
      `terminos_permiten_uso`. Si no permiten el uso, no cargar datos reales de ese portal.
- [ ] Validación legal de la captura y del tratamiento (incluida la normativa de protección de datos personales aplicable).
- [ ] Pasar `estado` a `aceptada`.

Mientras eso no esté completo, el validador deja **`legalidad_terminos` en aviso** con datos sintéticos y en **fallo** con datos
reales: el sistema no aprueba la carga de datos reales sin esa revisión.
