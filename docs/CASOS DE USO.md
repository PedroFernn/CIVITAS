# CIVITAS — Catálogo Definitorio de Casos de Uso (UML) y Especificación Técnica Completa

**Versión:** 3.1 (Actualizada — Desarrollador e Integrador separados)  
**Proyecto:** CIVITAS — Observatorio Urbano, Asequibilidad Inmobiliaria y Verificación Criptográfica  
**Alcance:** Fases I, II, III y IV (Fase I/II Scrum Sprints 1–16 + Fase III/IV Desarrollo en Espiral)  

---

## 0. Resumen Arquitectónico y Mapa General de Actores

El sistema CIVITAS estructura sus interacciones mediante **12 actores definidos**, divididos en actores primarios (humanos) y actores secundarios (sistemas externos/servicios). 

### Convenciones UML
* **Asociación Directa:** Actor ↔ Caso de Uso Principal.
* **«include»:** Relación de inclusión obligatoria (el caso base siempre ejecuta el caso incluido).
* **«extend»:** Relación de extensión condicional (se ejecuta solo bajo condiciones específicas).
* **«generaliza»:** Relación de herencia entre actores (única relación actor-actor válida en UML).

---

### Diagrama 0: Mapa General de Actores y Herencia

```mermaid
flowchart TB
    classDef actor fill:#ffffff,stroke:#333,stroke-width:1px,color:#000;
    classDef abstracto fill:#f0f0f0,stroke:#666,stroke-width:1px,stroke-dasharray:3 3,color:#000;

    Visitante(["🧑 Visitante no autenticado"]):::actor
    Inquilino(["🧑 Inquilino"]):::actor
    Comprador(["🧑 Comprador"]):::actor
    Ciudadano(["🧑 Ciudadano Aportador de Datos"]):::actor
    Validador(["🧑 Validador DAO"]):::actor
    Inversionista(["🧑 Inversionista"]):::actor
    Urbanista(["🧑 Urbanista"]):::actor
    Administradora(["🏢 Administradora de Propiedades"]):::actor
    PropTech(["🏢 Cliente PropTech"]):::actor
    Admin(["🛡️ Administrador de la plataforma"]):::actor
    Dev(["👨‍💻 Desarrollador"]):::actor
    Integrador(["🔧 Integrador"]):::actor
    ActorInstitucional(["Actor Institucional<br/>(abstracto, opcional)"]):::abstracto

    Validador -.->|"«generaliza» de"| Ciudadano
    Inversionista -.->|"«generaliza» de (opcional)"| ActorInstitucional
    Administradora -.->|"«generaliza» de (opcional)"| ActorInstitucional
    PropTech -.->|"«generaliza» de (opcional)"| ActorInstitucional
```

---

## 1. Visitante no Autenticado

### Diagrama 1: Visitante no Autenticado

```mermaid
flowchart LR
    classDef actor fill:#fff,stroke:#333,stroke-width:1px;
    classDef uc fill:#f7f7f7,stroke:#333,stroke-width:1px;

    Visitante(["🧑 Visitante no autenticado"]):::actor

    subgraph SYS_V["CIVITAS — Visitante no autenticado"]
        direction TB
        UCV1(["UC-V1<br/>Explorar catálogo público de colonias"]):::uc
        UCV1_1(["UC-V1.1<br/>Consultar índices agregados<br/>(asequibilidad, mapa de calor)"]):::uc
        UCV2(["UC-V2<br/>Buscar y filtrar zonas"]):::uc
        UCV3(["UC-V3<br/>Consultar Aviso de Privacidad"]):::uc
        UCV4(["UC-V4<br/>Registrarse / iniciar sesión"]):::uc
        UCV4_1(["UC-V4.1<br/>Verificación de identidad ligera (KYC)"]):::uc
    end

    Visitante --- UCV1
    Visitante --- UCV2
    Visitante --- UCV3
    Visitante --- UCV4

    UCV1 -.->|"«include»"| UCV1_1
    UCV4_1 -.->|"«extend»"| UCV4
```

### Tabla de Casos de Uso — Visitante
| Código | Nombre | Relación / Tipo | Descripción Breve |
|---|---|---|---|
| **UC-V1** | Explorar catálogo público de colonias | Base | Navegación libre por fichas agregadas de colonias sin requerir credenciales. |
| **UC-V1.1** | Consultar índices agregados | `«include»` de UC-V1 | Muestra métricas promediadas por polígono (renta mediana, asequibilidad, servicios). |
| **UC-V2** | Buscar y filtrar zonas | Base | Búsqueda geolocalizada por rango de precio, transporte, equipamiento y seguridad. |
| **UC-V3** | Consultar Aviso de Privacidad | Base | Acceso público y directo a términos normativos y tratamiento de datos (OE4). |
| **UC-V4** | Registrarse / iniciar sesión | Base | Creación de cuenta con correo/contraseña y confirmación mail. |
| **UC-V4.1** | Verificación de identidad ligera (KYC) | `«extend»` de UC-V4 | Verificación de documento + selfie (Proof of Humanity). Opcional al registro. |

---

## 2. Inquilino

### Diagrama 2: Inquilino

```mermaid
flowchart LR
    classDef actor fill:#fff,stroke:#333,stroke-width:1px;
    classDef uc fill:#f7f7f7,stroke:#333,stroke-width:1px;
    classDef sysActor fill:#eaeaea,stroke:#666,stroke-width:1px,stroke-dasharray:3 3;

    Inquilino(["🧑 Inquilino"]):::actor

    subgraph SYS_I["CIVITAS — Inquilino"]
        direction TB
        UCI1(["UC-I1<br/>Consultar índice de asequibilidad<br/>y anomalía por inmueble"]):::uc
        UCI2(["UC-I2<br/>Generar Reporte de Precio Justo"]):::uc
        UCI2_1(["UC-I2.1<br/>Contrastar precio pedido<br/>vs. rango esperado"]):::uc
        UCI2_2(["UC-I2.2<br/>Recomendar rango<br/>de negociación"]):::uc
        UCI2_3(["UC-I2.3<br/>Exportar / compartir reporte"]):::uc
        UCI2_4(["UC-I2.4<br/>Responder encuesta de uso<br/>post-negociación"]):::uc
        UCI3(["UC-I3<br/>Certificar solvencia vía ZK"]):::uc
        UCI3_1(["UC-I3.1<br/>Conectar cuenta bancaria<br/>(puente Open Banking)"]):::uc
        UCI3_2(["UC-I3.2<br/>Generar prueba ZK de umbral"]):::uc
        UCI3_3(["UC-I3.3<br/>Compartir prueba con arrendador<br/>/ administradora"]):::uc
        UCI3_4(["UC-I3.4<br/>Revocar prueba compartida"]):::uc
        UCI4(["UC-I4<br/>Guardar zonas / inmuebles favoritos"]):::uc
        UCI5(["UC-I5<br/>Recibir alertas de anomalías<br/>en zonas de interés"]):::uc
        UCI6(["UC-I6<br/>Comparar inmuebles o zonas<br/>lado a lado"]):::uc
        UCI6_1(["UC-I6.1<br/>Generar tabla comparativa<br/>de índices"]):::uc
    end

    OpenBanking(["🖥️ Proveedor de Open Banking"]):::sysActor
    OraculoZK_I(["🖥️ Oráculo de Privacidad ZK<br/>(zkPass/Reclaim)"]):::sysActor
    DatosAbiertos_I(["🖥️ Proveedor de Datos Abiertos<br/>(INEGI, gobierno municipal)"]):::sysActor

    Inquilino --- UCI1
    Inquilino --- UCI2
    Inquilino --- UCI3
    Inquilino --- UCI4
    Inquilino --- UCI5
    Inquilino --- UCI6

    UCI2 -.->|"«include»"| UCI2_1
    UCI2 -.->|"«include»"| UCI2_2
    UCI2_3 -.->|"«extend»"| UCI2
    UCI2_4 -.->|"«extend»"| UCI2

    UCI3 -.->|"«include»"| UCI3_1
    UCI3 -.->|"«include»"| UCI3_2
    UCI3 -.->|"«include»"| UCI3_3
    UCI3_4 -.->|"«extend»"| UCI3

    UCI6 -.->|"«include»"| UCI6_1

    UCI3_1 --- OpenBanking
    UCI3_2 --- OraculoZK_I
    UCI1 --- DatosAbiertos_I
```

### Tabla de Casos de Uso — Inquilino
| Código | Nombre | Relación / Tipo | Descripción Breve |
|---|---|---|---|
| **UC-I1** | Consultar índice y anomalía por inmueble | Base | Muestra el desglose de sobreprecio/subprecio de una propiedad específica. Requiere cuenta. |
| **UC-I2** | Generar Reporte de Precio Justo | Base | Emisión de documento con sustento técnico de valoración justa para arrendamiento. |
| **UC-I2.1** | Contrastar precio vs. rango esperado | `«include»` de UC-I2 | Comparación algorítmica del precio ofertado contra el modelo econométrico local. |
| **UC-I2.2** | Recomendar rango de negociación | `«include»` de UC-I2 | Cálculo de montos objetivo, aceptable y límite para postura de oferta. |
| **UC-I2.3** | Exportar / compartir reporte | `«extend»` de UC-I2 | Generación de archivo PDF o enlace público temporal. |
| **UC-I2.4** | Responder encuesta post-negociación | `«extend»` de UC-I2 | Captura del precio final acordado para retroalimentar el KPI de impacto. |
| **UC-I3** | Certificar solvencia vía ZK | Base | Generación de credencial de solvencia económica sin revelar saldo bancario. |
| **UC-I3.1** | Conectar cuenta bancaria | `«include»` de UC-I3 | Enlace seguro mediante Open Banking API para lectura criptográfica. |
| **UC-I3.2** | Generar prueba ZK de umbral | `«include»` de UC-I3 | Ejecución del circuito ZK (zkPass/Reclaim) que valida: `ingreso >= 3x renta`. |
| **UC-I3.3** | Compartir prueba con arrendador | `«include»` de UC-I3 | Envío de token de verificación a la administradora o propietario. |
| **UC-I3.4** | Revocar prueba compartida | `«extend»` de UC-I3 | Cancelación inmediata del acceso del tercero a la verificación de la prueba. |
| **UC-I4** | Guardar favoritos | Base | Almacenamiento de colonias e inmuebles en el perfil de usuario. |
| **UC-I5** | Recibir alertas de anomalías | Base | Notificaciones automáticas ante variaciones críticas de precios en zonas guardadas. |
| **UC-I6** | Comparar inmuebles/zonas | Base | Matriz comparativa lado a lado (hasta 4 elementos simultáneos). |
| **UC-I6.1** | Generar tabla comparativa | `«include»` de UC-I6 | Mapeo de indicadores normativos, precios e infraestructura en tabla resumida. |

---

## 3. Comprador

### Diagrama 3: Comprador

```mermaid
flowchart LR
    classDef actor fill:#fff,stroke:#333,stroke-width:1px;
    classDef uc fill:#f7f7f7,stroke:#333,stroke-width:1px;
    classDef sysActor fill:#eaeaea,stroke:#666,stroke-width:1px,stroke-dasharray:3 3;

    Comprador(["🧑 Comprador"]):::actor

    subgraph SYS_K["CIVITAS — Comprador"]
        direction TB
        UCI1(["UC-I1<br/>Consultar índice de asequibilidad<br/>y anomalía por inmueble"]):::uc
        UCI2(["UC-I2<br/>Generar Reporte de Precio Justo"]):::uc
        UCI2_1(["UC-I2.1<br/>Contrastar precio pedido<br/>vs. rango esperado"]):::uc
        UCI2_2(["UC-I2.2<br/>Recomendar rango<br/>de negociación"]):::uc
        UCI2_3(["UC-I2.3<br/>Exportar / compartir reporte"]):::uc
        UCI2_4(["UC-I2.4<br/>Responder encuesta de uso<br/>post-negociación"]):::uc
        UCI4(["UC-I4<br/>Guardar zonas / inmuebles favoritos"]):::uc
        UCI5(["UC-I5<br/>Recibir alertas de anomalías<br/>en zonas de interés"]):::uc
        UCI6(["UC-I6<br/>Comparar inmuebles o zonas<br/>lado a lado"]):::uc
        UCI6_1(["UC-I6.1<br/>Generar tabla comparativa<br/>de índices"]):::uc
    end

    DatosAbiertos_K(["🖥️ Proveedor de Datos Abiertos<br/>(INEGI, gobierno municipal)"]):::sysActor

    Comprador --- UCI1
    Comprador --- UCI2
    Comprador --- UCI4
    Comprador --- UCI5
    Comprador --- UCI6

    UCI2 -.->|"«include»"| UCI2_1
    UCI2 -.->|"«include»"| UCI2_2
    UCI2_3 -.->|"«extend»"| UCI2
    UCI2_4 -.->|"«extend»"| UCI2

    UCI6 -.->|"«include»"| UCI6_1

    UCI1 --- DatosAbiertos_K
```

### Tabla de Casos de Uso — Comprador
*(Nota: Comparte la lógica analítica de precios del Inquilino, omitiendo los flujos de solvencia para arrendamiento).*

---

## 4. Ciudadano Aportador de Datos

### Diagrama 4: Ciudadano Aportador de Datos

```mermaid
flowchart LR
    classDef actor fill:#fff,stroke:#333,stroke-width:1px;
    classDef uc fill:#f7f7f7,stroke:#333,stroke-width:1px;

    Ciudadano(["🧑 Ciudadano Aportador de Datos"]):::actor

    subgraph SYS_C["CIVITAS — Ciudadano Aportador de Datos"]
        direction TB
        UCC1(["UC-C1<br/>Reportar dato local<br/>(precio, comercio, desplazamiento)"]):::uc
        UCC1_1(["UC-C1.1<br/>Adjuntar evidencia<br/>(foto / geolocalización)"]):::uc
        UCC2(["UC-C2<br/>Consultar reputación<br/>y estado de aportes"]):::uc
        UCC2_1(["UC-C2.1<br/>Disputar rechazo de un aporte"]):::uc
        UCC4(["UC-C4<br/>Consultar historial detallado<br/>de aportes propios"]):::uc
    end

    Ciudadano --- UCC1
    Ciudadano --- UCC2
    Ciudadano --- UCC4

    UCC1 -.->|"«include»"| UCC1_1
    UCC2_1 -.->|"«extend»"| UCC2
```

### Tabla de Casos de Uso — Ciudadano Aportador
| Código | Nombre | Relación / Tipo | Descripción Breve |
|---|---|---|---|
| **UC-C1** | Reportar dato local | Base | Envío de observación territorial (precios, comercios, transporte, seguridad). |
| **UC-C1.1** | Adjuntar evidencia | `«include»` de UC-C1 | Carga obligatoria de prueba (fotografía georreferenciada o coordenadas GPS). |
| **UC-C2** | Consultar reputación y estado | Base | Visualización del puntaje acumulado y estado de aportes en cola. |
| **UC-C2.1** | Disputar rechazo de aporte | `«extend»` de UC-C2 | Apertura de apelación ante la comunidad DAO tras voto negativo. |
| **UC-C4** | Consultar historial de aportes | Base | Bitácora de contribuciones validadas, rechazadas o pendientes. |

---

## 5. Validador DAO

### Diagrama 5: Validador DAO

```mermaid
flowchart LR
    classDef actor fill:#fff,stroke:#333,stroke-width:1px;
    classDef uc fill:#f7f7f7,stroke:#333,stroke-width:1px;
    classDef nota fill:#fffbe6,stroke:#999,stroke-width:1px,stroke-dasharray:2 2;

    Validador(["🧑 Validador DAO"]):::actor
    Ciudadano(["🧑 Ciudadano Aportador de Datos"]):::actor
    NotaD["📝 Hereda también todos los<br/>casos de uso de Ciudadano<br/>Aportador (UC-C1 – UC-C4)"]:::nota

    subgraph SYS_D["CIVITAS — Validador DAO"]
        direction TB
        UCD1(["UC-D1<br/>Revisar aportes pendientes<br/>de validación"]):::uc
        UCD1_1(["UC-D1.1<br/>Consultar evidencia<br/>y contexto del aporte"]):::uc
        UCD2(["UC-D2<br/>Votar validez del dato<br/>(consenso distribuido)"]):::uc
        UCD3(["UC-D3<br/>Participar en arbitraje<br/>de disputas"]):::uc
        UCD3_1(["UC-D3.1<br/>Escalar a Administrador<br/>cuando no hay consenso"]):::uc
        UCD4(["UC-D4<br/>Consultar tablero de desempeño<br/>y ranking de validadores"]):::uc
    end

    Validador -.->|"«generaliza» de"| Ciudadano
    Validador -.- NotaD
    Validador --- UCD1
    Validador --- UCD2
    Validador --- UCD3
    Validador --- UCD4

    UCD1 -.->|"«include»"| UCD1_1
    UCD3_1 -.->|"«extend»"| UCD3
```

### Tabla de Casos de Uso — Validador DAO
| Código | Nombre | Relación / Tipo | Descripción Breve |
|---|---|---|---|
| **UC-D1** | Revisar aportes pendientes | Base | Acceso a la cola de validación asignada según geolocalización y reputación. |
| **UC-D1.1** | Consultar evidencia y contexto | `«include»` de UC-D1 | Análisis detallado del dato enviado por el ciudadano contra fuentes históricas. |
| **UC-D2** | Votar validez del dato | Base | Emisión de voto (Aprobar / Rechazar) en el mecanismo de consenso distribuido. |
| **UC-D3** | Participar en arbitraje | Base | Resolución colectiva de disputas o aportes impugnados. |
| **UC-D3.1** | Escalar a Administrador | `«extend»` de UC-D3 | Remisión de caso sin consenso alcanzado a la moderación central. |
| **UC-D4** | Consultar tablero de desempeño | Base | Indicadores de precisión de voto, slashing y recompensas recibidas. |

---

## 6. Inversionista

### Diagrama 6: Inversionista

```mermaid
flowchart LR
    classDef actor fill:#fff,stroke:#333,stroke-width:1px;
    classDef uc fill:#f7f7f7,stroke:#333,stroke-width:1px;
    classDef sysActor fill:#eaeaea,stroke:#666,stroke-width:1px,stroke-dasharray:3 3;

    Inversionista(["🧑 Inversionista"]):::actor

    subgraph SYS_INV["CIVITAS — Inversionista"]
        direction TB
        UCU1(["UC-U1<br/>Consultar mapa de riesgo<br/>de gentrificación"]):::uc
        UCU2(["UC-U2<br/>Suscribirse a alertas tempranas<br/>de inflexión de precio"]):::uc
        UCU2_1(["UC-U2.1<br/>Configurar umbral / zona<br/>de interés"]):::uc
        UCU3(["UC-U3<br/>Solicitar reporte predictivo<br/>institucional"]):::uc
        UCU3_1(["UC-U3.1<br/>Solicitar reporte a medida<br/>(custom)"]):::uc
        UCU5(["UC-U5<br/>Comparar corredores<br/>o zonas en paralelo"]):::uc
        UCU5_1(["UC-U5.1<br/>Exportar comparación<br/>a informe"]):::uc
    end

    DatosAbiertos_INV(["🖥️ Proveedor de Datos Abiertos<br/>(INEGI, gobierno municipal)"]):::sysActor

    Inversionista --- UCU1
    Inversionista --- UCU2
    Inversionista --- UCU3
    Inversionista --- UCU5

    UCU2 -.->|"«include»"| UCU2_1
    UCU3_1 -.->|"«extend»"| UCU3
    UCU5 -.->|"«include»"| UCU5_1

    UCU3 --- DatosAbiertos_INV
```

### Tabla de Casos de Uso — Inversionista
| Código | Nombre | Relación / Tipo | Descripción Breve |
|---|---|---|---|
| **UC-U1** | Consultar mapa de riesgo de gentrificación | Base | Visualización de capas térmicas con proyección de plusvalía y desplazamiento. |
| **UC-U2** | Suscribirse a alertas tempranas | Base | Configuración de notificaciones por cambios acelerados en métricas urbanas. |
| **UC-U2.1** | Configurar umbral / zona | `«include»` de UC-U2 | Ajuste de parámetros de tolerancia y polígonos de interés financiero. |
| **UC-U3** | Solicitar reporte predictivo | Base | Generación de análisis prospectivo con modelos econométricos institucionales. |
| **UC-U3.1** | Solicitar reporte a medida | `«extend»` de UC-U3 | Parametrización personalizada del estudio predictivo. |
| **UC-U5** | Comparar corredores o zonas | Base | Evaluación comparativa multivariable de rendimiento inmobiliario regional. |
| **UC-U5.1** | Exportar comparación a informe | `«include»` de UC-U5 | Descarga de dossier en PDF/Excel para comités de inversión. |

---

## 7. Urbanista

### Diagrama 7: Urbanista

```mermaid
flowchart LR
    classDef actor fill:#fff,stroke:#333,stroke-width:1px;
    classDef uc fill:#f7f7f7,stroke:#333,stroke-width:1px;
    classDef sysActor fill:#eaeaea,stroke:#666,stroke-width:1px,stroke-dasharray:3 3;

    Urbanista(["🧑 Urbanista"]):::actor

    subgraph SYS_URB["CIVITAS — Urbanista"]
        direction TB
        UCU1(["UC-U1<br/>Consultar mapa de riesgo<br/>de gentrificación"]):::uc
        UCU3(["UC-U3<br/>Solicitar reporte predictivo<br/>institucional"]):::uc
        UCU3_1(["UC-U3.1<br/>Solicitar reporte a medida<br/>(custom)"]):::uc
        UCU4(["UC-U4<br/>Registrar uso del reporte<br/>en política pública"]):::uc
        UCU4_1(["UC-U4.1<br/>Adjuntar evidencia documental<br/>(oficio, minuta, publicación)"]):::uc
        UCU5(["UC-U5<br/>Comparar corredores<br/>o zonas en paralelo"]):::uc
        UCU5_1(["UC-U5.1<br/>Exportar comparación<br/>a informe"]):::uc
    end

    DatosAbiertos_URB(["🖥️ Proveedor de Datos Abiertos<br/>(INEGI, gobierno municipal)"]):::sysActor

    Urbanista --- UCU1
    Urbanista --- UCU3
    Urbanista --- UCU4
    Urbanista --- UCU5

    UCU3_1 -.->|"«extend»"| UCU3
    UCU4 -.->|"«include»"| UCU4_1
    UCU5 -.->|"«include»"| UCU5_1

    UCU3 --- DatosAbiertos_URB
```

### Tabla de Casos de Uso — Urbanista
| Código | Nombre | Relación / Tipo | Descripción Breve |
|---|---|---|---|
| **UC-U4** | Registrar uso en política pública | Base | Vinculación formal de los reportes CIVITAS con planes directores o regulaciones. |
| **UC-U4.1** | Adjuntar evidencia documental | `«include»` de UC-U4 | Carga de folios, gacetas oficiales o minutas de cabildo que acrediten el impacto. |

---

## 8. Administradora de Propiedades

### Diagrama 8: Administradora de Propiedades

```mermaid
flowchart LR
    classDef actor fill:#fff,stroke:#333,stroke-width:1px;
    classDef uc fill:#f7f7f7,stroke:#333,stroke-width:1px;
    classDef sysActor fill:#eaeaea,stroke:#666,stroke-width:1px,stroke-dasharray:3 3;

    Administradora(["🏢 Administradora de Propiedades"]):::actor

    subgraph SYS_ADM["CIVITAS — Administradora"]
        direction TB
        UCB1(["UC-B1<br/>Integrarse al módulo ZK<br/>(onboarding B2B)"]):::uc
        UCB1_1(["UC-B1.1<br/>Firmar contrato / KYB"]):::uc
        UCB1_2(["UC-B1.2<br/>Obtener credenciales API"]):::uc
        UCB2(["UC-B2<br/>Verificar solvencia<br/>de un solicitante"]):::uc
        UCB2_1(["UC-B2.1<br/>Validar prueba ZK recibida"]):::uc
        UCB2_2(["UC-B2.2<br/>Rechazar prueba<br/>inválida / expirada"]):::uc
        UCB3(["UC-B3<br/>Consultar panel de verificaciones<br/>(dashboard institucional)"]):::uc
        UCB4(["UC-B4<br/>Gestionar suscripción<br/>y facturación del servicio ZK"]):::uc
        UCB5(["UC-B5<br/>Consultar bitácora de verificaciones<br/>para auditoría regulatoria"]):::uc
        UCB5_1(["UC-B5.1<br/>Exportar bitácora firmada<br/>criptográficamente"]):::uc
    end

    OraculoZK_ADM(["🖥️ Oráculo de Privacidad ZK<br/>(zkPass/Reclaim)"]):::sysActor

    Administradora --- UCB1
    Administradora --- UCB2
    Administradora --- UCB3
    Administradora --- UCB4
    Administradora --- UCB5

    UCB1 -.->|"«include»"| UCB1_1
    UCB1 -.->|"«include»"| UCB1_2
    UCB2 -.->|"«include»"| UCB2_1
    UCB2_2 -.->|"«extend»"| UCB2
    UCB5 -.->|"«include»"| UCB5_1

    UCB2_1 --- OraculoZK_ADM
```

### Tabla de Casos de Uso — Administradora
| Código | Nombre | Relación / Tipo | Descripción Breve |
|---|---|---|---|
| **UC-B1** | Integrarse al módulo ZK | Base | Proceso de vinculación B2B institucional. |
| **UC-B1.1** | Firmar contrato / KYB | `«include»` de UC-B1 | Validación legal de la empresa arrendadora (Know Your Business). |
| **UC-B1.2** | Obtener credenciales API | `«include»` de UC-B1 | Generación de llaves públicas/privadas para integración de software. |
| **UC-B2** | Verificar solvencia de solicitante | Base | Evaluación de prueba ZK remitida por candidatos a arrendamiento. |
| **UC-B2.1** | Validar prueba ZK recibida | `«include»` de UC-B2 | Verificación matemática de la firma del oráculo sin ver cuentas de origen. |
| **UC-B2.2** | Rechazar prueba inválida/expirada | `«extend»` de UC-B2 | Descarte automático de tokens modificados o fuera del marco temporal. |
| **UC-B3** | Consultar panel institucional | Base | Dashboard corporativo de expedientes procesados y aprobaciones. |
| **UC-B4** | Gestionar suscripción B2B | Base | Administración de planes de consulta y facturación por volumen. |
| **UC-B5** | Consultar bitácora de verificaciones | Base | Registro inmutable de validaciones para auditorías de no-discriminación. |
| **UC-B5.1** | Exportar bitácora firmada | `«include»` de UC-B5 | Emisión de reporte criptográfico sellado. |

---

## 9. Cliente PropTech

### Diagrama 9: Cliente PropTech

```mermaid
flowchart LR
    classDef actor fill:#fff,stroke:#333,stroke-width:1px;
    classDef uc fill:#f7f7f7,stroke:#333,stroke-width:1px;
    classDef sysActor fill:#eaeaea,stroke:#666,stroke-width:1px,stroke-dasharray:3 3;

    PropTech(["🏢 Cliente PropTech"]):::actor

    subgraph SYS_PT["CIVITAS — PropTech"]
        direction TB
        UCB1(["UC-B1<br/>Integrarse al módulo ZK<br/>(onboarding B2B)"]):::uc
        UCB1_1(["UC-B1.1<br/>Firmar contrato / KYB"]):::uc
        UCB1_2(["UC-B1.2<br/>Obtener credenciales API"]):::uc
        UCB2(["UC-B2<br/>Verificar solvencia<br/>de un solicitante"]):::uc
        UCB2_1(["UC-B2.1<br/>Validar prueba ZK recibida"]):::uc
        UCB2_2(["UC-B2.2<br/>Rechazar prueba<br/>inválida / expirada"]):::uc
        UCB3(["UC-B3<br/>Consultar panel de verificaciones<br/>(dashboard institucional)"]):::uc
        UCB4(["UC-B4<br/>Gestionar suscripción<br/>y facturación del servicio ZK"]):::uc
    end

    OraculoZK_PT(["🖥️ Oráculo de Privacidad ZK<br/>(zkPass/Reclaim)"]):::sysActor

    PropTech --- UCB1
    PropTech --- UCB2
    PropTech --- UCB3
    PropTech --- UCB4

    UCB1 -.->|"«include»"| UCB1_1
    UCB1 -.->|"«include»"| UCB1_2
    UCB2 -.->|"«include»"| UCB2_1
    UCB2_2 -.->|"«extend»"| UCB2

    UCB2_1 --- OraculoZK_PT
```

### Tabla de Casos de Uso — PropTech
*(Utiliza la API B2B ZK de CIVITAS embebida dentro de plataformas externas de inmobiliarias).*

---

## 10. Administrador de la Plataforma

### Diagrama 10: Administrador de la Plataforma

```mermaid
flowchart LR
    classDef actor fill:#fff,stroke:#333,stroke-width:1px;
    classDef uc fill:#f7f7f7,stroke:#333,stroke-width:1px;
    classDef sysActor fill:#eaeaea,stroke:#666,stroke-width:1px,stroke-dasharray:3 3;

    Admin(["🛡️ Administrador de la plataforma"]):::actor

    subgraph SYS_A["CIVITAS — Administrador de la plataforma"]
        direction TB
        UCA1(["UC-A1<br/>Gestionar catálogo de colonias"]):::uc
        UCA1_1(["UC-A1.1<br/>Revisar fuentes de datos abiertas<br/>importadas"]):::uc
        UCA2(["UC-A2<br/>Moderar disputas DAO escaladas"]):::uc
        UCA3(["UC-A3<br/>Gestionar cuentas y contratos<br/>de clientes B2B"]):::uc
        UCA3_1(["UC-A3.1<br/>Emitir / revocar<br/>credenciales API"]):::uc
        UCA4(["UC-A4<br/>Administrar cumplimiento<br/>normativo"]):::uc
        UCA4_1(["UC-A4.1<br/>Publicar Aviso de Privacidad"]):::uc
        UCA4_2(["UC-A4.2<br/>Registrar evaluación de impacto<br/>(PIA/DPIA)"]):::uc
        UCA4_3(["UC-A4.3<br/>Registrar dictámenes legales<br/>y cartas regulatorias"]):::uc
        UCA5(["UC-A5<br/>Supervisar auditoría externa<br/>de circuitos ZK"]):::uc
        UCA6(["UC-A6<br/>Controlar el gate económico<br/>de la DAO"]):::uc
        UCA7(["UC-A7<br/>Monitorear salud y métricas<br/>de uso de la plataforma"]):::uc
        UCA7_1(["UC-A7.1<br/>Configurar alertas operativas<br/>(uptime, latencia)"]):::uc
    end

    DatosAbiertos(["🖥️ Proveedor de Datos Abiertos<br/>(INEGI, gobierno municipal)"]):::sysActor
    AutoridadReg(["⚖️ Autoridad Reguladora"]):::sysActor

    Admin --- UCA1
    Admin --- UCA2
    Admin --- UCA3
    Admin --- UCA4
    Admin --- UCA5
    Admin --- UCA6
    Admin --- UCA7

    UCA1 -.->|"«include»"| UCA1_1
    UCA3 -.->|"«include»"| UCA3_1
    UCA4 -.->|"«include»"| UCA4_1
    UCA4 -.->|"«include»"| UCA4_2
    UCA4 -.->|"«include»"| UCA4_3
    UCA7 -.->|"«include»"| UCA7_1

    UCA1_1 --- DatosAbiertos
    UCA4_1 --- AutoridadReg
    UCA4_3 --- AutoridadReg
```

### Tabla de Casos de Uso — Administrador
| Código | Nombre | Relación / Tipo | Descripción Breve |
|---|---|---|---|
| **UC-A1** | Gestionar catálogo de colonias | Base | Alta, baja, modificación y control de completitud de zonas. |
| **UC-A1.1** | Revisar fuentes de datos abiertas | `«include»` de UC-A1 | Inspección de conectores automáticos con INEGI, mapas y catastro. |
| **UC-A2** | Moderar disputas DAO escaladas | Base | Intervención final en empates o impugnaciones del sistema DAO. |
| **UC-A3** | Gestionar cuentas B2B | Base | Alta de empresas, acuerdos comerciales y límites de consumo. |
| **UC-A3.1** | Emitir/revocar credenciales API | `«include»` de UC-A3 | Gestión del ciclo de vida de tokens institucionales. |
| **UC-A4** | Administrar cumplimiento normativo | Base | Monitoreo del compliance normativo (ARCO, LFPDPPP). |
| **UC-A4.1** | Publicar Aviso de Privacidad | `«include»` de UC-A4 | Actualización legal obligatoria antes del despliegue de fases. |
| **UC-A4.2** | Registrar evaluaciones DPIA | `«include»` de UC-A4 | Carga de dictámenes de impacto en protección de datos personales. |
| **UC-A4.3** | Registrar dictámenes regulatorios | `«include»` de UC-A4 | Repositorio de cartas y autorizaciones del marco legal Fintech/Inmobiliario. |
| **UC-A5** | Supervisar auditoría de circuitos ZK | Base | Verificación de reportes de seguridad en el código de zk-SNARKs. |
| **UC-A6** | Controlar gate económico DAO | Base | Interruptor de activación de incentivos económicos tras autorización legal. |
| **UC-A7** | Monitorear salud y métricas | Base | Consola de rendimiento del sistema, disponibilidad y latencia. |
| **UC-A7.1** | Configurar alertas operativas | `«include»` de UC-A7 | Umbrales de fallos de infraestructura o caídas de APIs externas. |

---

## 11. Desarrollador

*(Rol técnico general: construye software propio consumiendo el catálogo público de CIVITAS. No necesariamente maneja datos financieros/ZK.)*

### Diagrama 11: Desarrollador

```mermaid
flowchart LR
    classDef actor fill:#fff,stroke:#333,stroke-width:1px;
    classDef uc fill:#f7f7f7,stroke:#333,stroke-width:1px;

    Dev(["👨‍💻 Desarrollador"]):::actor

    subgraph SYS_DV["CIVITAS — Desarrollador"]
        direction TB
        UCDv1(["UC-Dv1<br/>Consultar documentación<br/>de la API pública"]):::uc
        UCDv2(["UC-Dv2<br/>Gestionar credenciales de API<br/>(API key / OAuth)"]):::uc
        UCDv3(["UC-Dv3<br/>Consumir API de catálogo<br/>e índices"]):::uc
        UCDv5(["UC-Dv5<br/>Suscribirse a webhooks<br/>de eventos del catálogo"]):::uc
    end

    Dev --- UCDv1
    Dev --- UCDv2
    Dev --- UCDv3

    UCDv5 -.->|"«extend»"| UCDv3
```

### Tabla de Casos de Uso — Desarrollador
| Código | Nombre | Relación / Tipo | Descripción Breve |
|---|---|---|---|
| **UC-Dv1** | Consultar documentación API | Base | Acceso al portal OpenAPI / Swagger interactivo. |
| **UC-Dv2** | Gestionar credenciales API | Base | Solicitud y rotación de tokens de prueba y producción. |
| **UC-Dv3** | Consumir API de catálogo | Base | Consultas HTTP/REST de índices de asequibilidad y datos agregados. |
| **UC-Dv5** | Suscribirse a webhooks | `«extend»` de UC-Dv3 | Configuración de callbacks para recepción de eventos en tiempo real. |

---

## 12. Integrador

*(Rol técnico especializado: implementa el SDK de verificación de solvencia ZK dentro de sistemas propios o de terceros — distinto del Desarrollador porque opera sobre el módulo financiero/criptográfico sensible, típicamente en nombre de un cliente institucional. Comparte con el Desarrollador el acceso base a documentación y credenciales.)*

### Diagrama 12: Integrador

```mermaid
flowchart LR
    classDef actor fill:#fff,stroke:#333,stroke-width:1px;
    classDef uc fill:#f7f7f7,stroke:#333,stroke-width:1px;

    Integrador(["🔧 Integrador"]):::actor

    subgraph SYS_IN["CIVITAS — Integrador"]
        direction TB
        UCDv1(["UC-Dv1<br/>Consultar documentación<br/>de la API pública"]):::uc
        UCDv2(["UC-Dv2<br/>Gestionar credenciales de API<br/>(API key / OAuth)"]):::uc
        UCDv4(["UC-Dv4<br/>Integrar verificación ZK<br/>en flujo propio"]):::uc
        UCDv4_1(["UC-Dv4.1<br/>Probar generación/verificación<br/>en sandbox"]):::uc
    end

    Integrador --- UCDv1
    Integrador --- UCDv2
    Integrador --- UCDv4

    UCDv4 -.->|"«include»"| UCDv4_1
```

### Tabla de Casos de Uso — Integrador
| Código | Nombre | Relación / Tipo | Descripción Breve |
|---|---|---|---|
| **UC-Dv1** | Consultar documentación API | Base (compartido con Desarrollador) | Acceso al portal OpenAPI / Swagger interactivo. |
| **UC-Dv2** | Gestionar credenciales API | Base (compartido con Desarrollador) | Solicitud y rotación de tokens de prueba y producción. |
| **UC-Dv4** | Integrar verificación ZK | Base | Implementación del SDK de verificación de solvencia en aplicaciones propias/de terceros. |
| **UC-Dv4.1** | Probar en sandbox | `«include»` de UC-Dv4 | Entorno de simulación con datos de prueba sin costo ni riesgo. |

---

## Matriz de Trazabilidad: Actores vs. Fases de Despliegue

| Actor | Tipo de Rol | Fase I / II (Scrum Sprints 1–16) | Fase III / IV (Desarrollo en Espiral) |
|---|---|:---:|:---:|
| **Visitante** | Primario |  SI |  SI |
| **Inquilino** | Primario |  SI |  SI |
| **Comprador** | Primario |  SI |  SI |
| **Ciudadano Aportador** | Primario | ❌ |  SI |
| **Validador DAO** | Primario | ❌ |  SI |
| **Inversionista** | Primario | ❌ |  SI |
| **Urbanista** | Primario | ❌ |  SI |
| **Administradora** | Primario | ❌ |  SI |
| **PropTech** | Primario | ❌ |  SI |
| **Administrador** | Primario |  SI |  SI |
| **Desarrollador** | Primario | ❌ |  SI |
| **Integrador** | Primario | ❌ |  SI |
| **Proveedor Datos Abiertos** | Secundario |  SI |  SI |
| **Oráculo ZK** | Secundario | ❌ |  SI |
| **Open Banking** | Secundario | ❌ |  SI |
| **Autoridad Reguladora** | Secundario |  SI |  SI |
