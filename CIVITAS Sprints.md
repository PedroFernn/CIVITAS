# CIVITAS — Calendario de Actividades y Sprints Scrum

Según el marco metodológico ya definido en el documento de Fase 0, Scrum
aplica específicamente a **Fase I y Fase II (Web 1.0 / 2.0)** — el resto del
proyecto usa KDD/CRISP-DM (motor de anomalías), espiral (Web 3.0/ZK) y XP
(auditoría de circuitos). Este plan cubre esas dos fases: **16 sprints de 15
días ≈ 8 meses**, coincidiendo con el rango "0–8 meses" ya declarado en el
roadmap.

Roles Scrum sugeridos: **Product Owner** (prioriza backlog contra los KPIs de
OE1), **Scrum Master** (facilita ceremonias), **Equipo de desarrollo**
(full-stack + 1 perfil de datos desde Sprint 9).

---

## 1. Calendario de actividades — sprint promedio (15 días)

Plantilla reutilizable para cualquiera de los 16 sprints. Daily Scrum ocurre
todos los días hábiles (15 min); solo se listan aparte los días con
ceremonia adicional.

| Día | Actividad principal                                                                                                  | Ceremonia / hito                   |
| --- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | Sprint Planning: revisión de backlog priorizado, estimación (story points), compromiso del sprint backlog            | Sprint Planning (2–3 h)            |
| 2   | Desarrollo — diseño técnico de las historias comprometidas (modelos de datos, contratos de API)                      | Daily Scrum                        |
| 3   | Desarrollo — implementación backend/core                                                                             | Daily Scrum                        |
| 4   | Desarrollo — implementación backend/core                                                                             | Daily Scrum                        |
| 5   | Desarrollo — implementación frontend/integración                                                                     | Daily Scrum                        |
| 6   | Desarrollo — implementación frontend/integración                                                                     | Daily Scrum                        |
| 7   | Desarrollo + pruebas unitarias tempranas                                                                             | Daily Scrum                        |
| 8   | **Revisión intermedia**: avance vs. sprint backlog, reestimación si hay bloqueos                                     | Daily Scrum + Mid-sprint check-in  |
| 9   | Desarrollo — cierre de historias pendientes                                                                          | Daily Scrum                        |
| 10  | Desarrollo — cierre de historias pendientes                                                                          | Daily Scrum                        |
| 11  | QA: pruebas de integración, corrección de bugs                                                                       | Daily Scrum                        |
| 12  | QA: pruebas de integración, corrección de bugs                                                                       | Daily Scrum                        |
| 13  | Buffer: bugs críticos, documentación, preparación de demo                                                            | Daily Scrum                        |
| 14  | **Sprint Review**: demo del incremento a stakeholders (Product Owner, y según la fase, Administrador/Cliente piloto) | Sprint Review                      |
| 15  | **Sprint Retrospective** + refinamiento del backlog para el siguiente sprint                                         | Retrospective + Backlog Refinement |

*Los días 13–15 pueden caer en fin de semana según el calendario real; por
eso el sprint se cuenta en 15 días naturales y no en 14 (2 semanas exactas)
— da un día de colchón para que Review/Retro no se muevan por festivos.*

---

## 2. Los 16 sprints — Fase I y Fase II

### Fase I — Fundación (Web 1.0) · Sprints 1–8 · Días 1–120 (~0–4 meses)

| Sprint | Días | Objetivo del sprint | Entregable clave |
|---|---|---|---|
| 1 | 1–15 | Arquitectura base y gate de cumplimiento | Modelo de datos inicial (`Zona`, `Inmueble`); Aviso de Privacidad publicado (requisito OE4 antes de cualquier registro) |
| 2 | 16–30 | Ingesta de datos abiertos | Integración de datos abiertos gubernamentales y de movilidad, ciudad piloto 1 |
| 3 | 31–45 | Catálogo v1 | Catálogo estandarizado de colonias (transporte, equipamiento, seguridad, servicios) |
| 4 | 46–60 | Búsqueda y comparación | Buscador y comparador geolocalizado |
| 5 | 61–75 | Histórico de precios | Histórico de precios de alquiler y servicios por zona |
| 6 | 76–90 | Identidad de usuario | Registro / login, roles base (Visitante → Usuario Verificado) |
| 7 | 91–105 | Segunda ciudad piloto | Expansión de cobertura hacia la meta de 200+ colonias |
| 8 | 106–120 | Cierre de Fase I | Hardening, beta cerrada, ajuste por feedback — **hito: catálogo en producción en zonas piloto** |

### Fase II — Inteligencia algorítmica (Web 2.0) · Sprints 9–16 · Días 121–240 (~4–8 meses)

| Sprint | Días | Objetivo del sprint | Entregable clave |
|---|---|---|---|
| 9 | 121–135 | Diseño del motor | Pipeline KDD/CRISP-DM: selección y limpieza de datos de precio |
| 10 | 136–150 | Motor de anomalías v1 | Detección de anomalías de precio; panel de expertos de control (meta ≥85% precisión) |
| 11 | 151–165 | Asequibilidad | Índice de asequibilidad dinámico por zona |
| 12 | 166–180 | Visualización | Mapas de calor interactivos (anomalías + asequibilidad) |
| 13 | 181–195 | Precio Justo v1 | Módulo de Precio Justo (B2C): generación de reporte y rango de negociación |
| 14 | 196–210 | Precio Justo v2 | Exportar/compartir reporte; encuesta de uso declarado en negociación |
| 15 | 211–225 | Predicción local | Modelo de inflación local proyectada (primera versión) |
| 16 | 226–240 | Cierre de Fase II | Validación de precisión del motor; piloto controlado de efecto de negociación (meta ≥5% menor precio de cierre) — **hito: motor de anomalías y mapas de calor validados** |

---

## Nota

A partir de Fase III (Web 3.0 / DAO) el proyecto cambia a desarrollo en
espiral y ya no aplica este ritmo de sprints de 15 días — si necesitas
también el desglose de esa fase dime y lo armo por iteraciones de espiral
en vez de sprints.

[[CIVITAS]][[CIVITAS - SECUENCIA]]