# Documento de Definición Estratégica — Fase 0
## Plataforma de Inteligencia Urbana e Inmobiliaria "CIVITAS"

**Elaborado por:** Oficina de Producto y Arquitectura de Soluciones  
**Naturaleza del documento:** Definición conceptual y estratégica de negocio. No incluye especificaciones técnicas de implementación, código, esquemas de base de datos ni archivos de configuración.  
**Propósito:** Establecer el marco de negocio, los objetivos medibles, los casos de uso, los requerimientos de alto nivel, la hoja de ruta y la metodología de trabajo que guiarán las fases posteriores de diseño y construcción de la plataforma.

---

## 1. Declaración del Problema

El mercado inmobiliario urbano —particularmente en economías emergentes con alta informalidad y baja regulación de datos— opera hoy bajo cuatro fallas estructurales que la tecnología actual no ha resuelto de forma integral.

### 1.1 Opacidad estructural de la información

Los datos que determinan el valor real de una vivienda o una colonia (precios efectivamente pagados, rotación de inquilinos, calidad de infraestructura, percepción de seguridad, cobertura de transporte) están fragmentados entre portales inmobiliarios con incentivos comerciales propios, dependencias de gobierno con actualización lenta y conocimiento informal que solo circula "de boca en boca" entre vecinos y corredores. El resultado es una asimetría de información sistemática: intermediarios y propietarios conocen el mercado real, mientras que inquilinos, compradores primerizos y pequeños inversionistas negocian con información incompleta o directamente distorsionada (precios de "lista" que no reflejan precios de cierre).

### 1.2 Invasión sistemática de la privacidad financiera

El proceso estándar para validar la solvencia de un inquilino exige la entrega de estados de cuenta bancarios completos, comprobantes de nómina y, en muchos casos, historial crediticio íntegro. Esto obliga al solicitante a revelar información financiera muy superior a la que el arrendador necesita (que es, en esencia, una sola pregunta binaria: *¿puede o no pagar la renta de forma sostenida?*). Esta sobre-exposición de datos sensibles crea riesgo de uso indebido, discriminación indirecta por patrones de gasto, y fricción que excluye a personas con ingresos informales o mixtos aunque sean, en la práctica, solventes.

### 1.3 Especulación no regulada y asimetría de poder de negociación

Sin mecanismos públicos de detección de anomalías, los precios pueden inflarse de forma artificial —por prácticas de anclaje, colusión tácita entre arrendadores de una misma zona, o efectos de "rumor" sobre la revalorización de una colonia— sin que exista un contraste objetivo. Esto favorece a actores con capital y con acceso a información privilegiada (grandes tenedores, fondos inmobiliarios) frente a hogares individuales, perpetuando ciclos de especulación que expulsan a los residentes originales de sus propias zonas.

### 1.4 Ausencia de previsión urbana y desconexión ciudadana

Los procesos de gentrificación y transformación urbana suelen identificarse solo cuando ya son irreversibles: cuando el comercio local ha cambiado, los precios ya subieron y los residentes históricos ya fueron desplazados. Los urbanistas y autoridades locales toman decisiones de planeación con datos rezagados (censos que se actualizan cada varios años) y sin un canal estructurado para que el ciudadano de a pie aporte señales tempranas sobre lo que está cambiando en su propia calle.

**Síntesis del problema:** estas cuatro fallas no son independientes: la opacidad de datos habilita la especulación, la especulación acelera la gentrificación no anticipada, y la falta de mecanismos de privacidad obliga a los ciudadanos a elegir entre exponerse financieramente o quedar excluidos del mercado formal. Ninguna solución de una sola capa tecnológica resuelve el problema completo: se requiere una arquitectura evolutiva que primero democratice la información (Web 1.0), después la haga inteligible y predictiva (Web 2.0), y finalmente la haga verificable y gobernada por sus propios usuarios sin sacrificar privacidad (Web 3.0 + IA).

---

## 2. Objetivos del Proyecto

### Objetivo General

Construir una plataforma de inteligencia urbana e inmobiliaria que democratice el acceso a información de vivienda veraz y actualizada, proteja la privacidad financiera de los usuarios mediante mecanismos de verificación criptográfica, y anticipe dinámicas de transformación urbana —con especial atención a la gentrificación—, habilitando decisiones más informadas y equitativas para inquilinos, ciudadanos e inversionistas por igual.

### Objetivos Específicos y KPIs de Éxito

**OE1 — Democratizar la transparencia informativa del mercado inmobiliario (Capa Web 1.0 / 2.0)**  
Consolidar en un solo lugar información estandarizada y comparable sobre colonias, precios y servicios, y convertirla en indicadores accionables (asequibilidad, anomalías de precio).  
*KPIs de referencia (a validar con investigación de mercado durante la Fase I):*
- Cobertura de al menos 200 colonias/zonas en las 2 ciudades piloto dentro de los primeros 6 meses de operación.
- Frecuencia de actualización de precios promedio no mayor a 30 días por zona.
- Precisión del motor de detección de anomalías ≥ 85% (medida contra un panel de expertos inmobiliarios de control).
- Tasa de adopción: 10,000 usuarios activos mensuales consultando el catálogo e índices en los primeros 12 meses.

**OE2 — Habilitar verificación de solvencia sin exposición de datos financieros crudos (Capa Web 3.0 — ZK)**  
Sustituir la entrega de estados de cuenta completos por comprobaciones criptográficas de umbrales financieros (por ejemplo, "ingreso ≥ 3x renta" o "sin atrasos de pago en los últimos 12 meses") sin revelar montos ni movimientos.  
*KPIs de referencia:*
- Reducción del tiempo de validación de un inquilino de ~72 horas (proceso tradicional con documentación completa) a menos de 10 minutos mediante prueba ZK, medida en los procesos piloto.
- Al menos 3 administradoras de propiedades o PropTechs institucionales integradas como clientes B2B del módulo ZK al cierre de la Fase IV (el arrendador individual del mercado informal no es el cliente objetivo inicial: carece de incentivo y presupuesto para pagar por verificación).
- Tiempo de generación y verificación de una prueba ZK inferior a 10 segundos en el 95% de los casos.
- Cero incidentes reportados de exposición de datos financieros crudos durante el proceso de verificación.

**OE3 — Anticipar dinámicas de especulación y gentrificación antes de que sean irreversibles (Capa Web 3.0 — IA predictiva)**  
Entregar a urbanistas, autoridades locales e inversionistas señales tempranas de cambio estructural en una zona, con suficiente antelación para intervenir o decidir con criterio.  
*KPIs de referencia:*
- Capacidad de anticipar, con al menos 6 meses de antelación y un margen de error no mayor a ±5 puntos porcentuales, inflexiones de precio superiores al 15% en una zona, validado retrospectivamente contra datos históricos.
- Al menos 3 alianzas institucionales (universidades, oficinas de planeación urbana u organizaciones civiles) usando los reportes predictivos como insumo de política pública hacia el final de la Fase V.
- Nivel de participación ciudadana en la red DAO: al menos 500 aportantes de datos activos y verificados por ciudad piloto.

---

## 3. Casos de Uso Principales

### 3.1 Inquilino / Comprador — "Busca dónde vivir sin exponerse ni ser engañado"

**Objetivo del actor:** encontrar una vivienda a un precio justo y demostrar su solvencia sin entregar su vida financiera completa.

La interacción comienza en la capa informativa: el usuario explora el catálogo de colonias, compara precios promedio de renta, cobertura de transporte y métricas cívicas (seguridad percibida, equipamiento urbano) para acotar su búsqueda a dos o tres zonas candidatas. Al entrar a la capa algorítmica, cada inmueble o zona muestra un índice de asequibilidad calculated en tiempo real (relación entre el precio pedido y el ingreso mediano de la zona) y una señal de anomalía de precio que le indica si una oferta específica está por encima del rango esperado para ese tipo de inmueble y ubicación —una defensa directa contra el "precio inflado por desconocimiento". Finalmente, al encontrar una propiedad de interés, en lugar de enviar estados de cuenta bancarios al arrendador, el usuario genera desde la plataforma una prueba de conocimiento cero que certifica criptográficamente que cumple con el umbral de solvencia requerido (por ejemplo, ingreso recurrente igual o mayor a tres veces la renta), sin revelar montos, movimientos ni el nombre de su empleador. El arrendador o la administradora del inmueble recibe una verificación válida, verificable y no falsificable, y el proceso de aplicación se resuelve en minutos en lugar de días, sin que el inquilino haya cedido el control de su información financiera.

### 3.2 Ciudadano Aportador de Datos — "Valida y enriquece el conocimiento de su propia colonia"

**Objetivo del actor:** contribuir con información que solo un residente local puede conocer, y ser reconocido y potencialmente recompensado por ello.

Un residente identifica que el precio de renta que ve publicado en su edificio no coincide con lo que realmente se está pagando, o que ha abierto un nuevo comercio, o que una ruta de transporte cambió de frecuencia. En lugar de que este conocimiento se pierda en una conversación informal, el ciudadano lo reporta a través de la plataforma. Este aporte no se acepta de forma ciega: entra a un mecanismo de validación distribuida propio de la red DAO, donde otros aportantes con reputación acumulada en esa misma zona confirman o refutan el dato, y solo tras alcanzar un umbral de consenso se incorpora al catálogo y a los modelos algorítmicos. A cambio, el aportante acumula reputación verificable dentro de la red —y, en etapas posteriores, incentivos económicos o de gobernanza—, lo que le da, además, voz para proponer o votar ajustes en las reglas de validación de datos de su propia comunidad. Este actor es, en esencia, quien resuelve el problema de "quién verifica la verdad" sin depender de una autoridad centralizada.

### 3.3 Inversionista / Urbanista — "Decide con anticipación, no con nostalgia post-hecho"

**Objetivo del actor:** identificar tendencias emergentes antes de que se consoliden, para invertir con criterio o para diseñar política pública preventiva.

Un fondo de inversión inmobiliaria o una oficina municipal de planeación urbana accede al mapa de calor dinámico de la plataforma para visualizar, capa por capa, la evolución de precios, la densidad de aportes ciudadanos y el comportamiento de los modelos de inflación local en distintas zonas de la ciudad. Sobre esta base, el agente de IA predictivo señala corredores con probabilidad creciente de gentrificación acelerada —cruzando señales como apertura de nuevos comercios de mayor gama, incremento sostenido de anomalías de precio al alza, y cambios en la composición de aportantes ciudadanos de la zona—. Con esta alerta temprana, el inversionista puede decidir si entra o evita una zona sobrecalentada, y el urbanista puede diseñar mecanismos de mitigación (por ejemplo, políticas de vivienda asequible focalizadas) antes de que el desplazamiento de residentes sea un hecho consumado. Adicionalmente, como participante institucional de la red, este actor puede intervenir en la gobernanza DAO para proponer nuevos indicadores cívicos a monitorear, alineando el desarrollo del producto con necesidades reales de política urbana. Conviene distinguir comercialmente a estos dos sub-actores: un fondo de inversión inmobiliaria (FIBRA/REIT) puede decidir y pagar en cuestión de semanas porque su necesidad de anticipar tendencias es inmediata, mientras que una oficina de gobierno u organismo urbanista sigue un ciclo de adquisición típico de 12 a 24 meses y se cultiva, en las primeras fases, como alianza de legitimidad más que como fuente de ingreso temprano.

---

## 4. Matriz de Requerimientos

### 4.1 Requerimientos Funcionales (por etapa Web)

| ID | Capa | Requerimiento funcional |
|---|---|---|
| RF-1.1 | Web 1.0 | Catálogo estructurado y comparable de colonias con atributos estandarizados (transporte, equipamiento, seguridad percibida, servicios). |
| RF-1.2 | Web 1.0 | Integración de fuentes de datos abiertos gubernamentales y de movilidad pública. |
| RF-1.3 | Web 1.0 | Histórico consultable de precios promedio de alquiler y servicios por zona. |
| RF-1.4 | Web 1.0 | Buscador y comparador geolocalizado de zonas e inmuebles. |
| RF-2.1 | Web 2.0 | Motor de detección de anomalías de precio (identificación de valores atípicos respecto al comportamiento esperado de la zona). |
| RF-2.2 | Web 2.0 | Cálculo de un índice de asequibilidad dinámico, actualizado con nueva información de mercado. |
| RF-2.3 | Web 2.0 | Mapas de calor interactivos que reflejen variación de precios, densidad de oferta y señales cívicas. |
| RF-2.4 | Web 2.0 | Modelo de inflación local que proyecte tendencia de variación de precios por zona. |
| RF-3.1 | Web 3.0 / IA | Red DAO de aportación ciudadana con mecanismo de validación por consenso, sistema de reputación y verificación de identidad única por aportante (Proof of Humanity) como condición previa para obtener poder de voto o validación, mitigando ataques Sybil. |
| RF-3.2 | Web 3.0 / IA | Módulo de verificación por Zero-Knowledge Proofs para certificar solvencia o historial de pago sin exponer datos financieros crudos, apoyado en un puente Web2–Web3 (APIs de Open Banking existentes conectadas a protocolos oráculo de privacidad, p. ej. zkPass o Reclaim Protocol) que no requiere que la institución financiera emita infraestructura nueva. |
| RF-3.3 | Web 3.0 / IA | Agente de inteligencia artificial predictivo de tendencias de gentrificación y transformación urbana. |
| RF-3.4 | Web 3.0 / IA | Mecanismo de gobernanza descentralizada para la evolución de reglas de validación de datos e indicadores cívicos. |

### 4.2 Requerimientos No Funcionales

| Categoría | Requerimiento | Justificación |
|---|---|---|
| Rendimiento | Los mapas de calor y catálogos deben soportar consultas concurrentes de miles de usuarios sin degradación perceptible. | La capa Web 1.0/2.0 es de alto tráfico y de uso frecuente; es la puerta de entrada del producto. |
| Privacidad | Ningún dato financiero crudo (montos, movimientos, estados de cuenta) debe almacenarse en servidores centrales de la plataforma. | Es la premisa fundacional de la capa ZK; su incumplimiento anula el valor diferencial del producto. |
| Privacidad | Minimización de datos por diseño ("privacy by design"): solo se procesa y conserva la información estrictamente necesaria para cada funcionalidad. | Reduce superficie de riesgo y facilita cumplimiento regulatorio. |
| Latencia | Las consultas de catálogo, precios e índices deben resolverse en segundos (experiencia "web" convencional). | Es el punto de contacto más frecuente; la tolerancia a espera del usuario es baja. |
| Latencia | La generación y verificación de una prueba ZK debe completarse en un tiempo que no genere fricción perceptible en el flujo de aplicación a una renta (idealmente segundos, no minutos). | La fricción en este paso es la principal barrera de adopción de la capa Web3. |
| Latencia | Los procesos de consenso de la red DAO y de sincronización on-chain pueden tolerar confirmación asíncrona (minutos), dado que no son de uso instantáneo. | No todo el sistema requiere la misma exigencia de tiempo real; sobre-diseñar esta capa encarece innecesariamente la arquitectura. |
| Seguridad | Auditabilidad de las pruebas criptográficas y de las reglas de validación de datos por terceros independientes. | La confianza del sistema depende de que sus reglas sean verificables, no solo declaradas. |
| Interoperabilidad | Capacidad de integrar fuentes externas (portales inmobiliarios, datos abiertos, proveedores de credenciales verificables) sin reescritura estructural. | El valor del producto crece con la cantidad y calidad de fuentes que puede absorber. |
| Disponibilidad | Continuidad de servicio de la capa informativa y algorítmica como prioridad operativa sobre la capa descentralizada en etapas tempranas. | El usuario promedio percibe el valor del producto principalmente en las capas 1.0 y 2.0 durante el arranque. |

### 4.3 Requerimientos de Negocio

- **Modelo de monetización — capa ZK:** el cliente pagador inicial no es el arrendador individual del mercado informal, que carece de incentivo y de presupuesto para pagar por verificación. El foco B2B debe ser actores institucionales que ya destinan presupuesto a validaciones de antecedentes (background checks): administradoras de propiedades, portales inmobiliarios profesionales y PropTechs establecidas. La propuesta se posiciona como una mejora de costo y velocidad sobre un gasto que ya existe, no como un gasto nuevo.
- **Modelo de monetización — agente de IA predictivo:** priorizar como primer segmento de ingreso a fondos de inversión inmobiliaria (FIBRAs/REITs), con ciclo de decisión corto y necesidad inmediata de anticipar tendencias de mercado. Las oficinas de planeación urbana y gobiernos locales son un segundo canal, de valor estratégico e institucional, pero con ciclos de compra de 12 a 24 meses; se cultivan en paralelo como alianzas de legitimidad (ver abajo) sin depender de ellas para el flujo de caja temprano.
- **Alianzas estratégicas prioritarias:** dependencias de datos abiertos municipales, universidades para validación metodológica de los modelos, y proveedores de Open Banking / protocolos oráculo de privacidad que permitan construir la verificación ZK sin depender de que un banco emita infraestructura nueva (ver sección 5.1).
- **Cumplimiento regulatorio:** alineación con la normativa de protección de datos personales aplicable en México (y equivalentes internacionales si la expansión lo requiere). De forma explícita, el módulo de verificación de solvencia debe evaluarse contra la regulación de Sociedades de Información Crediticia y la Ley para Regular las Instituciones de Tecnología Financiera, dado que evaluar la capacidad de pago de una persona —incluso sin almacenar sus datos crudos— puede rozar el perímetro regulatorio de un buró de crédito o de una entidad fintech. También requiere evaluación legal temprana el marco aplicable a mecanismos de incentivos tipo DAO, antes de introducir cualquier componente con valor económico transferible.
- **Estrategia de adquisición temprana:** priorizar la legitimidad institucional (alianzas con gobiernos locales o universidades) como palanca de confianza inicial y como canal de captación de datos, sin que sea el motor principal de ingresos en las primeras fases; el ingreso temprano se concentra en clientes B2B con ciclos de venta cortos (administradoras/PropTechs y FIBRAs/REITs).

---

## 5. Análisis de Viabilidad y Riesgos

### 5.1 Viabilidad Técnica

La capa Web 1.0/2.0 se apoya en tecnología madura (catálogos estructurados, motores de detección de anomalías, modelos estadísticos de indexación de precios) y presenta un riesgo técnico bajo. El riesgo se concentra en la capa Web 3.0: las pruebas de conocimiento cero para verificación de solvencia requieren una fuente confiable de la que derivar el dato de que efectivamente hay un ingreso recurrente. Si esa fuente depende de que la banca tradicional emita credenciales verificables nativas de Web3, el riesgo es alto: es una adopción externa fuera del control del producto y con plazos inciertos. De forma similar, los agentes de IA predictivos requieren volumen y calidad de datos históricos y geoespaciales que, en las primeras etapas del producto, simplemente no existirán en cantidad suficiente.  
*Mitigación:* no apostar la viabilidad del producto a que la banca tradicional adopte infraestructura Web3 de forma nativa —depender de esa adopción es un riesgo de ejecución demasiado alto para una fase temprana—. En su lugar, construir un puente Web2–Web3: consumir datos de ingresos y comportamiento de pago a través de APIs de Open Banking ya existentes y estandarizadas, y conectar esa información a protocolos oráculo de privacidad (por ejemplo, zkPass o Reclaim Protocol) que generan la prueba de conocimiento cero sin que el banco tenga que emitir ni operar nada nuevo. Esto traslada la complejidad de integración a un componente que la plataforma controla directamente, en lugar de depender de la voluntad de un tercero. En paralelo, entrenar los primeros modelos predictivos sobre datos públicos históricos disponibles (censales, de valor catastral) mientras se acumula el dato propietario de la plataforma.

### 5.2 Viabilidad de Adopción (UX Web3 sin fricción)

El usuario promedio de vivienda —inquilino, arrendador o ciudadano— no tiene ni tiene por qué tener experiencia previa gestionando billeteras digitales, llaves privadas o conceptos de blockchain. Si la plataforma expone esa complejidad de forma directa, la adopción se verá severamente limitada, sin importar cuán sólida sea la propuesta de valor subyacente.  
*Mitigación:* diseñar la experiencia bajo el principio de "blockchain invisible": el usuario interactúa con conceptos familiares (verificar mi solvencia, reportar un dato de mi colonia) y la infraestructura descentralizada opera por debajo, gestionada de forma custodiada o semi-custodiada por defecto, con opción de autocustodia solo para usuarios avanzados que la busquen explícitamente. La complejidad técnica debe ser opcional, nunca obligatoria, para participar en el producto.

### 5.3 Viabilidad de Adquisición de Datos (el problema del huevo y la gallina)

Una red de aportación ciudadana no tiene valor sin una masa crítica de contribuciones, pero nadie tiene incentivo para contribuir a una plataforma vacía. De forma equivalente, un modelo predictivo de gentrificación no puede entrenarse de forma confiable sin datos históricos suficientes, y esos datos históricos solo se generan con el tiempo de operación de la propia plataforma.  
*Mitigación:* la capa Web 1.0 debe poder lanzarse sin depender de datos crowdsourced —alimentándose primero de fuentes abiertas, alianzas institucionales y agregación de fuentes existentes públicamente disponibles—, de modo que el producto entregue valor desde el primer día sin necesidad de una comunidad ya formada. La red DAO se introduce después, sobre una base de usuarios que ya encuentra valor informativo en la plataforma, y se lanza en un número reducido de zonas piloto (concentración geográfica) en lugar de una cobertura nacional dispersa, para alcanzar densidad de datos suficiente en cada zona antes de expandir. Los primeros aportantes se incentivan con reconocimiento y reputación visible antes de introducir cualquier mecanismo económico, reduciendo el riesgo regulatorio y de manipulación temprana del sistema de incentivos.

### 5.4 Matriz Resumen de Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación clave |
|---|---|---|---|
| Dependencia de que la banca emita credenciales verificables nativas de Web3 | Alta en etapa temprana | Alto | Puente Open Banking + protocolo oráculo de privacidad (zkPass, Reclaim Protocol); no depende de que el banco adopte infraestructura nueva. |
| Fricción de UX en la capa Web3 | Alta si se expone la complejidad | Alto | Abstracción total de blockchain para el usuario final ("invisible by default"). |
| Insuficiencia de datos para entrenar el agente predictivo | Alta en etapa temprana | Medio-alto | Entrenamiento inicial sobre datos públicos históricos; expansión progresiva con dato propietario. |
| Comunidad DAO vacía o sin masa crítica | Alta si se lanza sin base de usuarios previa | Alto | Secuenciación: Web1/2 primero, DAO después, con foco geográfico concentrado. |
| Manipulación de datos crowdsourced (reportes falsos) | Media | Medio | Consenso distribuido y sistema de reputación antes de introducir incentivos económicos. |
| Ataques Sybil en la red DAO (cuentas falsas creadas, por ejemplo, para inflar el precio reportado de la propiedad propia) | Media-alta | Alto | Verificación de identidad única por aportante (Proof of Humanity) como condición previa para obtener poder de voto o de validación. |
| Traslape regulatorio del módulo de solvencia con la regulación de Sociedades de Información Crediticia o la Ley Fintech | Media | Alto | Diseñar el flujo como una atestación binaria (cumple/no cumple un umbral), no como un score crediticio; validación jurídica previa a operar con instituciones financieras. |
| Incertidumbre regulatoria sobre mecanismos tipo DAO/token | Media | Alto | Evaluación legal temprana; retraso deliberado de cualquier componente con valor económico transferible hasta tener claridad normativa. |

---

## 6. Planeación Estratégica (Roadmap)

La lógica de ejecución sigue un principio de **construcción incremental de confianza**: cada fase entrega valor de forma independiente y financia, con su propia tracción, la viabilidad de la siguiente. No se introduce complejidad de Web3 hasta que existe una base de datos y de usuarios que la justifique.

### Fase I — Fundación (Web 1.0 + cimientos de Web 2.0)
**Duración estimada:** 0–4 meses  
**Enfoque:** lanzar el catálogo informativo y comenzar a capturar datos de precios en 1–2 zonas piloto.  
**Hito de salida:** catálogo funcional con cobertura inicial de colonias, integración de al menos una fuente de datos abiertos de transporte/movilidad, y primeros históricos de precios cargados.

### Fase II — Inteligencia Algorítmica (Web 2.0 completa)
**Duración estimada:** 4–8 meses  
**Enfoque:** activar el motor de detección de anomalías, el índice de asequibilidad y los mapas de calor dinámicos sobre la base de datos ya recolectada en la Fase I.  
**Hito de salida:** motor de anomalías validado contra un panel de expertos, mapas de calor en producción, primeros usuarios recurrentes (inquilinos e inversionistas) usando los índices para decisiones reales.

### Fase III — Descentralización Ciudadana (red DAO, sin componente económico aún)
**Duración estimada:** 8–12 meses  
**Enfoque:** introducir el canal de aportación ciudadana y el mecanismo de validación por consenso, con incentivos basados en reputación (no económicos todavía), concentrado en las mismas zonas piloto para alcanzar densidad de datos.  
**Hito de salida:** un número mínimo viable de aportantes activos y verificados por zona piloto, con un porcentaje objetivo de datos aportados que pasan el umbral de consenso comunitario.

### Fase IV — Privacidad Verificable (capa ZK)
**Duración estimada:** 12–16 meses  
**Enfoque:** construir el puente Open Banking → protocolo oráculo de privacidad (zkPass o Reclaim Protocol) para generar la prueba ZK sin depender de que una institución financiera emita infraestructura nueva, y lanzar el flujo de verificación de solvencia con un grupo acotado de administradoras de propiedades o PropTechs institucionales como clientes piloto B2B — no con arrendadores individuales, dado el perfil conservador y sin presupuesto de ese segmento.  
**Hito de salida:** flujo de verificación ZK operando de extremo a extremo con tiempos de respuesta dentro del objetivo definido; al menos 3 administradoras o PropTechs institucionales integradas como clientes piloto; reducción demostrada del tiempo de validación de un inquilino de ~72 horas a menos de 10 minutos.

### Fase V — Inteligencia Predictiva y Gobernanza Plena
**Duración estimada:** 16–24 meses  
**Enfoque:** desplegar el agente de IA predictivo de gentrificación sobre la base de datos ya madura (propia + histórica), y abrir la gobernanza de la red DAO a votación de la comunidad de aportantes e instituciones aliadas sobre reglas y prioridades futuras del producto.  
**Hito de salida:** modelo predictivo desplegado en todas las zonas piloto con métricas de precisión validadas retrospectivamente, y primer ciclo de gobernanza descentralizada completado con participación institucional.

### Resumen del Roadmap

| Fase | Foco principal | Duración aproximada | Hito de salida |
|---|---|---|---|
| I | Fundación informativa (Web 1.0) | 0–4 meses | Catálogo en producción en zonas piloto |
| II | Inteligencia algorítmica (Web 2.0) | 4–8 meses | Motor de anomalías y mapas de calor validados |
| III | Descentralización ciudadana (DAO social) | 8–12 meses | Red de aportantes activa y validada por consenso |
| IV | Privacidad verificable (ZK) | 12–16 meses | Puente Open Banking + ZK operando con administradoras/PropTechs piloto |
| V | Inteligencia predictiva y gobernanza | 16–24 meses | Agente predictivo desplegado y primer ciclo de gobernanza DAO |

---

## 7. Marco Metodológico de Desarrollo

Para gestionar la heterogeneidad tecnológica de CIVITAS, se descarta el uso de una sola metodología rígida (como Cascada/Waterfall) en favor de un **modelo de gestión híbrido por capas**. La velocidad requerida en el desarrollo web contrasta con la rigurosidad necesaria en ciencia de datos y con el I+D en criptografía, lo cual exige marcos de trabajo adaptados a cada naturaleza funcional.

### 7.1 Esquema Metodológico por Módulo

| Capa / Módulo de CIVITAS | Metodología Principal | Justificación Operativa |
|---|---|---|
| **Fases I y II (Web 1.0 / 2.0)** <br> *Catálogo, Interfaces B2B y Mapas de Calor* | **Scrum / Kanban (Agile)** | Desarrollo iterativo en sprints de 2 semanas para la construcción acelerada de producto, gestión de backlog y ajuste continuo según retroalimentación de usuarios y administradoras piloto. |
| **Motor de Anomalías e IA Predictiva** <br> *Pipelines de Data & Modelos ML* | **KDD / CRISP-DM** | Ciclo metodológico especializado en ingeniería de datos: Selección, Limpieza, Transformación, Minería (ML) e Interpretación/Evaluación de datos geoespaciales y de mercado. |
| **Fases III y IV (Web 3.0 / ZK)** <br> *Puente Open Banking + Oráculos y DAO* | **Desarrollo en Espiral (Spiral Model)** | Metodología guiada por evaluación continua de riesgos para I+D criptográfico. Permite construir prototipos de validación (PoC) del puente Open Banking/ZK antes de congelar arquitectura. |
| **Garantía de Calidad y Seguridad** <br> *Auditorías y Contratos / Circuitos ZK* | **Prácticas XP (eXtreme Programming)** | Incorporación de programación en pareja (*pair programming*), desarrollo guiado por pruebas (TDD) y revisiones estrictas de código para garantizar auditabilidad en circuitos ZK y reglas de consenso. |

### 7.2 Justificación de la Arquitectura de Gestión

1. **Gestión Adaptativa de Producto (Scrum/Kanban):** Permite priorizar la entrega rápida de valor comercial en las capas transaccionales e informativas (Web 1.0 y 2.0) sin atascar el desarrollo de interfaz a la espera de los componentes criptográficos de fases avanzadas.
2. **Mitigación de Riesgos Criptográficos (Espiral):** La integración de ZK-Proofs vía oráculos de privacidad implica alta complejidad técnica. El modelo en espiral garantiza bucles cortos de prototipado y evaluación de riesgo antes de escribir arquitectura definitiva.
3. **Calidad de Datos e Inteligencia Artificial (KDD/CRISP-DM):** La predicción de gentrificación y la detección de anomalías requieren un ciclo de vida especializado en ciencia de datos, independiente de las entregas de software tradicional.
4. **Descarte de Metodologías Lineales (Cascada):** Inviable. Definir requisitos rígidos desde el día cero en un proyecto que evoluciona hacia modelos predictivos y Web3 generaría un riesgo inaceptable de obsolescencia técnica antes del lanzamiento.

## 8. Matriz de Roles, Permisos y Límites de Acción

Para garantizar la integridad de los datos, la privacidad financiera (ZK) y la viabilidad de la gobernanza descentralizada (DAO), la plataforma CIVITAS implementa un modelo híbrido de control de acceso. Combina un **RBAC (Role-Based Access Control)** clásico para las capas Web 1.0/2.0 y un **Control de Acceso Basado en Reputación y Consenso** para la capa Web 3.0.

A continuación, se definen los actores estructurales del sistema, sus capacidades explícitas y los límites estrictos o "líneas rojas" técnicos de su actuación.

### 8.1 Usuarios de Frontera (B2C y Comunidad)

**1. Visitante No Autenticado (Guest)**
*   **Perfil:** Usuario casual que llega por motores de búsqueda o enlaces compartidos.
*   **Permisos:** Navegación en la capa Web 1.0. Puede visualizar el catálogo de colonias, precios promedio a nivel macro y métricas cívicas públicas.
*   **Límites y Restricciones:** No puede visualizar el "Índice de Asequibilidad" a nivel de calle (Web 2.0), no puede generar pruebas ZK, ni reportar datos. Se le aplica un *rate-limiting* estricto para evitar scraping automatizado de la base de datos pública.

**2. Usuario Verificado (Inquilino / Ciudadano)**
*   **Perfil:** Usuario registrado con verificación de identidad básica (Proof of Humanity / KYC ligero) para mitigar ataques Sybil.
*   **Permisos:** 
    *   Generar pruebas de conocimiento cero (ZK-Proofs) sobre su propia solvencia conectando su banca vía Open Banking.
    *   Revocar el acceso a su prueba ZK a cualquier arrendador en cualquier momento.
    *   Aportar datos de precios o cambios urbanos a la red DAO.
    *   Consultar mapas de calor e índices de anomalías (Web 2.0).
*   **Límites y Restricciones:** Solo tiene jurisdicción sobre su propia data. No puede ver quién más está aplicando a un inmueble. Su voto en la DAO tiene un peso inicial de "1" (reputación base), por lo que no puede alterar el catálogo de precios unilateralmente.

**3. Validador DAO (Aportante de Alta Reputación)**
*   **Perfil:** Usuario verificado que, a través de aportaciones históricas validadas por la comunidad, ha superado un umbral de confianza en el sistema inteligente de contratos (Smart Contracts).
*   **Permisos:** Obtiene poder de voto ponderado para aprobar o rechazar datos reportados por otros usuarios en su zona geográfica de influencia. Puede proponer cambios en los indicadores cívicos.
*   **Límites y Restricciones:** Su poder de validación está acotado geográficamente (un experto en la Zona Norte no puede validar datos de la Zona Sur). Si aprueba datos que posteriormente la red identifica como fraudulentos (slashing), pierde su estatus de validador automáticamente.

### 8.2 Usuarios Institucionales y Comerciales (B2B)

**4. Cliente Institucional B2B (FIBRAs, PropTechs, Urbanistas)**
*   **Perfil:** Actor corporativo o gubernamental bajo un esquema de suscripción (SaaS/Enterprise).
*   **Permisos:** 
    *   Acceso a la capa de IA Predictiva (Web 3.0): modelos de gentrificación a 6-24 meses, exportación de reportes agregados y conexión a la API B2B de CIVITAS.
    *   Solicitar y recibir verificaciones ZK de inquilinos directamente en su panel de administración.
*   **Límites y Restricciones:** **Cero acceso a PII (Personal Identifiable Information)** cruda. Al recibir una prueba ZK, solo ven un check verde ("Cumple el umbral"), pero el sistema les bloquea por diseño cualquier intento de acceder a los estados de cuenta, ingresos exactos o RFC del inquilino. Tampoco pueden inyectar datos de precios al catálogo sin pasar por el mismo escrutinio de consenso de la DAO.

### 8.3 Usuarios Internos (Operaciones y Mantenimiento)

**5. Administrador de Plataforma (Admin de Negocio)**
*   **Perfil:** Equipo interno de CIVITAS encargado de operaciones, soporte y *customer success*.
*   **Permisos:** Gestión de cuentas B2B, facturación, suspensión de cuentas por violación de Términos de Servicio, y configuración de parámetros globales (ej. umbrales de rate-limiting o *tiers* de precios).
*   **Límites y Restricciones (El "Blindaje ZK"):** El administrador tiene un bloqueo a nivel de arquitectura. **No posee llaves de descifrado** para ver los datos financieros en tránsito entre el puente Open Banking y el oráculo ZK. Un administrador no puede, bajo ninguna circunstancia, generar una prueba ZK en nombre de un usuario ni acceder a su historial de validaciones pasadas.

**6. Desarrollador / Data Scientist (Sistemas)**
*   **Perfil:** Equipo técnico responsable de los pipelines ML, mantenimiento del catálogo geoespacial y despliegue de contratos inteligentes.
*   **Permisos:** Acceso a bases de datos vectoriales y analíticas (ClickHouse/OLAP), reentrenamiento de agentes de IA y despliegue de infraestructura.
*   **Límites y Restricciones:** Todo el acceso a datos ocurre en ambientes de *Data Lake* anonimizados (Data Masking). Los desarrolladores operan bajo el principio de menor privilegio; no tienen permisos de escritura directa sobre la base de datos transaccional (OLTP) en producción para evitar manipulaciones de mercado internas. 

**7. Auditor de Contratos y Cumplimiento (Solo Lectura Avanzada)**
*   **Perfil:** Entidad interna o externa (firma auditora) encargada de certificar la transparencia algorítmica y la seguridad criptográfica.
*   **Permisos:** Acceso de lectura al código fuente de los circuitos ZK, a la lógica de los contratos de gobernanza DAO y a los logs de inmutabilidad del sistema.
*   **Límites y Restricciones:** Capacidad estricta de *Read-Only*. No pueden modificar código, alterar estados de cuentas de usuarios, ni pausar la red, garantizando que su rol se limite exclusivamente a la observancia y certificación de confianza.
---

*Este documento constituye la Fase 0 del proyecto y sienta las bases de negocio, producto y metodología sobre las cuales deberán desarrollarse, en fases subsecuentes, la arquitectura técnica detallada, el diseño de experiencia de usuario y los planes de adquisición de datos y usuarios específicos por mercado.*
