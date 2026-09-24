# CIVITAS — Cosas Faltantes: Brechas de Datos, Fuentes e Interfaces Web

> Documento de brechas de ingesta de datos y especificación de módulos de interfaz web
> (UI/UX) pendientes de integración. Alineado con la Fase I y II del Roadmap y los Sprints
> 2–6 y 10–14 de la plataforma CIVITAS.

---

## 1. Estrategia de Ingesta, Captura y Fusión de Datos (Puebla y Nacional)

Para resolver la opacidad del mercado inmobiliario (Sección 1.1 del Documento
Estratégico), el pipeline de datos no puede depender de una sola fuente. Se define una
arquitectura de ingesta dividida en tres capas de datos:

### 1.1 Fuentes Oficiales y Gubernamentales (Estructuradas)

- **Catastro Municipal de Puebla (SIGMUN) / Tesorería Municipal:** ingesta de valor
  catastral, uso de suelo, zonificación y delimitación de predios. (Requiere gestión de
  convenio de datos abiertos o consumo vía servicios WFS/WMS del Ayuntamiento de Puebla).
- **INEGI (DENUE y Censo de Población y Vivienda):** densidad poblacional, nivel
  socioeconómico por AGEB (Área Geoestadística Básica) y densidad de comercios/servicios
  locales.
- **SEDATU / Registro Público de la Propiedad (RPP Puebla):** histórico de inscripciones
  de compraventa y derechos de propiedad para validación macro.
- **GTFS / Movilidad Puebla (RUTA y transporte público):** trazado de rutas, paradas de
  RUTA (Líneas 1, 2, 3 y 4) y cobertura de transporte para el cálculo del índice de
  equipamiento.

### 1.2 Fuentes Comerciales y Portales Inmobiliarios (Semi-estructuradas)

- **Portales de Venta y Renta** (Inmuebles24, Lamudi, Propiedades.com, Vivanuncios):
  scraping ético/APIs B2B para extraer precios de lista, superficie (m²), número de
  recámaras y coordenadas.
- **Plataformas de Terrenos y Desarrollos** (Mercado Libre Inmuebles, portales de
  FIBRAs/Desarrolladores locales): monitoreo de precios por m² en zonas de expansión
  periurbana en Puebla (ej. Angelópolis, Lomas de Angelópolis, Cholula, Cuautlancingo).

### 1.3 Fuentes Informales y Territoriales (No estructuradas)

- **Redes Sociales y Portales Informales** (Facebook Marketplace, Grupos de Renta
  BUAP/UDLAP/Puebla): extracción de precios reales ofertados en el mercado informal de
  renta sin intermediación inmobiliaria.
- **Aportaciones Ciudadanas Directas** (Lonas / Rótulos "Se Renta"): ingesta geolocalizada
  mediante fotos y reportes del módulo UC-C1 de la Red DAO.

### 1.4 Pipeline de Fusión y Estandarización de Datos

```
[ Fuentes Oficiales (Catastro/INEGI) ] ──┐
[ Portales Comerciales (Scraping/APIs)] ──┼──> [ ETL / Normalización ] ──> [ Indexación H3 / Uber ] ──> [ DB OLAP / Engine ]
[ Fuentes Informales + Red DAO ] ────────┘      (Geocodificación + Deduplicación)
```

- **Geocodificación y Mapeo H3:** normalización de direcciones de Puebla a coordenadas y
  agrupación por hexágonos del sistema H3 de Uber (resolución 8–9) para analítica
  espacial.
- **Deduplicación:** algoritmo de resolución de entidades para evitar duplicar el mismo
  inmueble publicado en múltiples portales con precios ligeramente distintos.
- **Filtrado de Sesgo (Precio de Lista vs. Precio Real):** aplicación del descuento
  estimado de negociación antes de pasarlo al Motor de Anomalías.

---

## 2. Definición de Módulos de Interfaz Web (UI/UX) y Pantallas

Para materializar los casos de uso UML de negocio (UC-V1 a UC-A7), se definen las
pantallas y flujos web necesarios más allá del flujo de autenticación (UC-AUTH-01 a 09):

### 2.1 Módulo B2C — Explorador Público y Panel del Inquilino

- **Pantalla de Exploración de Catálogo y Mapa de Calor** (UC-V1, UC-V2):
  - Mapa interactivo (Mapbox/Leaflet) con capas conmutables: Precios por m², Índice de
    Asequibilidad, Anomalías de Precio y Cobertura de Transporte.
  - Barra de búsqueda con auto-completado de colonias de Puebla (ej. Centro Histórico, La
    Paz, San Baltazar Campeche, Cholula).
- **Ficha Detallada del Inmueble / Zona** (UC-I1):
  - Métrica de precio pedido vs. rango esperado para la zona.
  - Indicador visual de Anomalía de Precio (Etiqueta: Precio Justo, Sobrepuesto/Inflado,
    Subprecio).
- **Wizard "Generar Reporte de Precio Justo"** (UC-I2):
  - Generador interactivo que evalúa el inmueble, da un rango recomendado de negociación y
    permite descargar/exportar un PDF firmado para presentar al arrendador.
- **Comparador Lado a Lado** (UC-I6):
  - Tabla comparativa de hasta 3 inmuebles o zonas mostrando índices de asequibilidad,
    servicios cercanos y movilidad.
- **Panel de Favoritos y Alertas** (UC-I4, UC-I5):
  - Gestión de zonas guardadas con configuración de alertas web/email ante variaciones
    atípicas de precio.

### 2.2 Módulo B2C — Solvencia y Privacidad ZK

- **Wizard de Certificación ZK** (UC-I3, UC-ZK-01 a 03):
  - Modal paso a paso:
    - Selección de umbral requerido (ej. "Ingreso ≥ 3x Renta").
    - Conexión segura con el widget de Open Banking (sin almacenar credenciales).
    - Generación local/worker de la prueba ZK (`proof_id`).
    - Selector para compartir la prueba con arrendadores o clientes B2B (UC-ZK-05).
- **Panel de Control de Privacidad y Pruebas** (UC-I3.4, UC-ZK-06, UC-ZK-09):
  - Tabla de pruebas ZK activas, receptores con acceso y botón de revocación inmediata con
    un solo clic.

### 2.3 Módulo Crowdsourcing y Gobernanza DAO

- **Formulario de Aporte Ciudadano** (UC-C1):
  - Interfaz móvil/responsive para captura de datos locales: tipo de dato (precio real
    pagado, nuevo comercio, cambio en transporte), carga de evidencia fotográfica y
    geolocalización automática.
- **Consola del Validador DAO** (UC-D1 a UC-D4):
  - Dashboard exclusivo para usuarios con reputación elevada:
    - Cola de revisiones pendientes en su zona de influencia.
    - Visor de evidencia fotográfica/mapa para emisión de voto de consenso.
    - Módulo de arbitraje y disputas escaladas.
    - Ranking de desempeño y tasa de aciertos del validador.

### 2.4 Módulo B2B / Analytics (Inversionistas, PropTechs y Urbanistas)

- **Mapa de Riesgo de Gentrificación y Predicción** (UC-U1, UC-U3):
  - Visualización de corredores urbanos con señales tempranas de sobrecalentamiento o
    inflexión de precio a 6–24 meses.
- **Verificador B2B de Solvencia ZK** (UC-B2, UC-ZK-04):
  - Panel para administradoras donde ingresan o reciben un `proof_id` de un candidato y
    obtienen la respuesta binaria inmutable ("CUMPLE UMBRAL" / "NO CUMPLE") sin acceso a
    PII o estados de cuenta crudos.
- **Generador de Informes Predictivos y Exportación** (UC-U5):
  - Exportación de reportes institucionales para soporte de políticas públicas o
    decisiones de inversión inmobiliaria.

### 2.5 Módulo de Operaciones (Administrador de Plataforma)

- **Consola de Administración de Catálogo y Fuentes** (UC-A1):
  - Auditoría de ingesta de datos abiertos e importaciones automáticas.
- **Panel de Moderación y Cumplimiento** (UC-A2, UC-A4, UC-A6):
  - Resolución de disputas escaladas por la DAO, gestión del gate económico y registro de
    dictámenes normativos/DPIA.
- **Monitor de Salud Operativa** (UC-A7):
  - Métricas en tiempo real de uptime, latencia de APIs, tiempo de generación de pruebas
    ZK y llamadas de Rate Limiting.

---

## 3. Asignación al Plan de Trabajo (Roadmap / Sprints)

| Elemento faltante                                     | Módulo / Componente        | Sprint de destino (`CIVITAS Sprints.md`)                          |
| ------------------------------------------------------ | --------------------------- | -------------------------------------------------------------------- |
| Ingesta Catastro Puebla / INEGI / GTFS                | Pipeline de Datos (1.1)    | Sprint 2 (Ingesta de datos abiertos)                              |
| Portales Inmobiliarios y Scraping                     | Pipeline de Datos (1.2)    | Sprint 3 y 5 (Catálogo v1 e Histórico de precios)                 |
| Pantalla de Catálogo, Filtros y Mapas                 | Módulo UI B2C (2.1)        | Sprint 3 y 4 (Catálogo v1, Búsqueda y Comparador)                 |
| UI de Detección de Anomalías / Reporte Precio Justo   | Módulo UI B2C (2.1)        | Sprint 10, 12 y 13 (Motor anomalías, Mapas de calor, Precio Justo) |
| Forms Aporte Ciudadano y Panel Validador DAO          | Módulo UI DAO (2.3)        | Fase III (Sprints 17+ / Iteración Espiral 1)                      |
| Modales y Dashboard ZK Open Banking                   | Módulo UI ZK (2.2)         | Fase IV (Iteración Espiral ZK)                                    |

[[CIVITAS]]
