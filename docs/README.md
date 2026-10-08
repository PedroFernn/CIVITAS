# CIVITAS — Versión Definitiva del Catálogo de Casos de Uso

> Este documento consolida en una sola fuente de verdad las entregas del proyecto: el
> catálogo UML por actor (v1 → v2 → revisión crítica de actores compuestos) y las
> especificaciones atómicas de ingeniería (v1 → v2 corregida → v3 casos de borde). No se
> agrega contenido nuevo: se renumera, se elimina lo superado por versiones posteriores, y
> se traza la relación entre las dos capas (casos de uso de negocio por actor vs. casos de
> uso atómicos de las tres familias técnicas: Auth, ZK y DAO).
>
> **Revisión crítica aplicada:** los tres actores compuestos originales ("Inquilino /
> Comprador", "Inversionista / Urbanista", "Cliente Institucional B2B") se separaron en
> actores independientes con su propio subconjunto de casos de uso (§1.1–1.3); se corrigió
> UC-I2.3 de `«include»` a `«extend»`; se eliminaron UC-C3 y UC-Dv3.1 por no ser objetivos
> iniciados por el actor; y se añadió el Proveedor de Datos Abiertos como actor secundario
> de UC-I1 y UC-U3.

**Totales definitivos:**

| Capa                                    | Contenido                                                               | Total  |
| ---------------------------------------- | ------------------------------------------------------------------------ | ------ |
| Catálogo UML por actor                  | 11 actores primarios (antes 8 combinados) · 38 casos base · 32 anidados | **70** |
| Especificaciones atómicas de ingeniería | 9 Auth + 9 ZK + 7 DAO                                                   | **25** |

---

# PARTE 1 — Catálogo UML de Casos de Uso por Actor

## 1.1 Mapa de actores

> **Corrección de modelado (revisión crítica):** los tres actores compuestos de la versión
> anterior — "Inquilino / Comprador", "Inversionista / Urbanista" y "Cliente Institucional
> B2B" — combinaban dos roles distintos en un solo actor UML, lo que no es válido cuando
> ambos roles no comparten literalmente el mismo conjunto de casos de uso. Se separaron en
> seis actores independientes (tabla debajo); el reparto de casos de uso de cada uno vive en
> §1.3.

| Actor                                                   | Tipo                         | Nivel de acceso                     |
| -------------------------------------------------------- | ---------------------------- | ------------------------------------ |
| Visitante no autenticado                                | Primario                     | Público, solo lectura agregada      |
| Inquilino                                               | Primario                     | Cuenta verificada (KYC ligero)      |
| Comprador                                               | Primario                     | Cuenta verificada (KYC ligero)      |
| Ciudadano Aportador de Datos                            | Primario                     | Cuenta verificada + contribución    |
| Validador DAO                                           | Primario (especialización)   | Cuenta con reputación ≥ umbral      |
| Inversionista                                           | Primario                     | Cliente institucional o profesional |
| Urbanista                                               | Primario                     | Cliente institucional o profesional |
| Administradora de Propiedades                           | Primario                     | Cuenta B2B con contrato/KYB         |
| Cliente PropTech                                        | Primario                     | Cuenta B2B con contrato/KYB         |
| Administrador de la plataforma                          | Primario (interno)           | Privilegios elevados                |
| Desarrollador / Integrador                              | Primario                     | Cuenta dev con credenciales API     |
| Oráculo de Privacidad ZK (zkPass/Reclaim)               | Secundario (sistema)         | —                                   |
| Proveedor de Open Banking                               | Secundario (sistema)         | —                                   |
| Proveedor de Datos Abiertos (INEGI, gobierno municipal) | Secundario (sistema)         | —                                   |
| Autoridad Reguladora                                    | Secundario (receptor pasivo) | —                                   |

**Generalizaciones de actor** (la única relación actor–actor válida en el metamodelo UML;
todo lo demás son dependencias de negocio entre casos de uso, no aristas del diagrama de
actores — ver tabla de dependencias debajo):
- **Validador DAO** generaliza de **Ciudadano Aportador** — mismo actor humano, rol
  adicional una vez alcanza reputación suficiente; hereda todos sus casos de uso.
- **Inversionista**, **Urbanista**, **Administradora de Propiedades** y **Cliente
  PropTech** pueden generalizar de un actor abstracto **Actor Institucional** (pago
  recurrente, KYB, sin interacción humana directa con el ciudadano final) — opcional,
  reduce líneas de asociación en el diagrama pero ninguno de sus casos de uso se comparte
  literalmente entre todos ellos.

**Dependencias de negocio entre actores** (no son aristas UML; se modelan como relaciones
entre casos de uso, cada una dentro de su propio diagrama de actor):

| Relación de negocio                                                    | Dónde se modela                          |
| ------------------------------------------------------------------------ | ------------------------------------------ |
| Visitante se registra → Inquilino o Comprador                          | `«extend»` UC-V4.1 → UC-V4 (§1.3.1)     |
| Inquilino ↔ Administradora / PropTech comparten y validan prueba ZK   | UC-I3.3 (§1.3.2) y UC-B2.1 (§1.3.6)     |
| Validador DAO escala disputas sin consenso → Administrador             | `«extend»` UC-D3.1 → UC-D3 (§1.3.4)     |
| Administradora, PropTech y Dev dependen de Administrador para credenciales | UC-A3.1 (§1.3.7)                       |

## 1.2 Perfiles de actor

Cada perfil liga el rol con una de las cuatro fallas estructurales del documento de
definición del proyecto (opacidad, privacidad financiera, especulación no regulada,
ausencia de previsión urbana).

**Visitante no autenticado** — llega sin cuenta, decidiendo si CIVITAS vale la fricción de
registrarse. Punto de entrada al problema de opacidad estructural. Sin cuenta, solo ve
datos agregados y anonimizados a nivel colonia, nunca por inmueble ni señales de anomalía.

**Inquilino (Usuario Verificado)** — enfrenta directamente opacidad de datos y
sobre-exposición financiera al buscar renta. Cuenta verificada con KYC ligero; único actor
humano que **emite** pruebas ZK de solvencia (Administradora/PropTech solo las
**consumen**) — por eso UC-I3 y sus hijos son exclusivos de este actor y no se comparten
con el Comprador.

**Comprador (Usuario Verificado)** — mismo problema de opacidad de datos que el Inquilino,
pero del lado de compra en vez de renta; comparte con él el motor de índices, el Reporte
de Precio Justo y la comparación de inmuebles (UC-I1, UC-I2, UC-I4, UC-I5, UC-I6), pero no
certifica solvencia vía ZK — ese mecanismo es específico de la relación arrendador–
inquilino, no aplica a una compraventa.

**Ciudadano Aportador de Datos** — detecta discrepancias entre lo publicado y la realidad
de su colonia. Cuenta verificada con rol de contribución activa; acumula reputación
verificable que es la puerta de entrada al rol de Validador DAO.

**Validador DAO** *(generaliza a Ciudadano Aportador)* — mismo actor humano que el
Ciudadano Aportador; al cruzar un umbral de reputación gana autoridad ganada, no
jerárquica, para confirmar o refutar los aportes de otros.

**Inversionista** — ataca la ausencia de previsión urbana, donde la gentrificación se
detecta solo cuando ya es irreversible. Cliente de pago con ciclo de venta corto
(FIBRA/REIT); consume los mismos índices que el Inquilino pero agregados por corredor, no
por inmueble, y se suscribe a alertas tempranas de inflexión de precio (UC-U2) — a
diferencia del Urbanista, no registra el uso del reporte en política pública.

**Urbanista** — comparte con el Inversionista el mismo motor de riesgo de gentrificación y
el reporte predictivo institucional (UC-U1, UC-U3, UC-U5), pero su ciclo de venta es de
oficina de gobierno (12-24 meses) y su objetivo final es distinto: registrar el uso del
reporte en una decisión de política pública (UC-U4), algo que el Inversionista no hace.

**Administradora de Propiedades** — primer segmento de ingreso real del negocio del lado
institucional. Cuenta B2B con contrato/KYB; **consume** pruebas ZK que el Inquilino emite,
nunca genera pruebas, solo las valida — y, a diferencia del Cliente PropTech, mantiene
bitácora de verificaciones exportable para auditoría regulatoria (UC-B5), un requisito
típico de administradoras reguladas que un cliente PropTech puro no necesariamente tiene.

**Cliente PropTech** — mismo mecanismo de verificación de solvencia que la Administradora
de Propiedades (UC-B1–B4: onboarding, verificar, panel, facturación), pero sin la
obligación de bitácora auditable de UC-B5 — el reparto de casos de uso entre ambos es una
inferencia razonable a partir del catálogo original, que no distinguía explícitamente los
dos roles dentro de "Cliente Institucional B2B"; conviene revisarlo con el profesor si el
negocio real exige lo contrario.

**Administrador de la plataforma** — sostiene la confianza estructural completa:
privacidad, cumplimiento regulatorio y auditabilidad de los circuitos ZK. Cuenta interna
con privilegios elevados sobre catálogo, disputas escaladas, cuentas B2B, cumplimiento
normativo y el gate económico de la DAO.

**Desarrollador / Integrador** — consume CIVITAS como infraestructura, no como producto
final. Cuenta dev con credenciales API (key/OAuth), gestionadas bajo la misma autoridad
que el Administrador controla en última instancia.

**Actores secundarios de sistema** (no participan activamente, aparecen en `«include»` o
como asociación directa con un caso de uso): Oráculo de Privacidad ZK (zkPass/Reclaim) en
UC-I3.2/UC-B2.1 · Proveedor de Open Banking en UC-I3.1 · Proveedor de Datos Abiertos
(INEGI, gobierno municipal) en UC-A1.1, **y también en UC-I1 y UC-U3** (mismo proveedor que
alimenta el motor de índices consultado por Inquilino/Comprador e Inversionista/Urbanista —
asociación que faltaba en la versión anterior del catálogo) · Autoridad Reguladora en
UC-A4.1/UC-A4.3.

## 1.3 Catálogo de casos de uso por actor

`«include»` = subpaso obligatorio (el caso base no está completo sin él).
`«extend»` = subpaso condicional, disparado solo bajo la condición declarada.
🆕 marca los casos de uso añadidos en la revisión v2 sobre el catálogo original.

### 1. Visitante no autenticado — 4 base / 2 anidados

- **UC-V1** Explorar catálogo público de colonias
  - `«include»` UC-V1.1 Consultar índices agregados (asequibilidad, mapa de calor)
- **UC-V2** Buscar y filtrar zonas
- **UC-V3** Consultar Aviso de Privacidad
- **UC-V4** Registrarse / iniciar sesión
  - `«extend»` UC-V4.1 Verificación de identidad ligera (KYC) — se activa solo si el
    registro requiere desbloquear funciones que exigen identidad confirmada.

### 2. Inquilino — 6 base / 9 anidados

- **UC-I1** Consultar índice de asequibilidad y anomalía por inmueble
- **UC-I2** Generar Reporte de Precio Justo
  - `«include»` UC-I2.1 Contrastar precio pedido vs. rango esperado
  - `«include»` UC-I2.2 Recomendar rango de negociación
  - `«extend»` UC-I2.3 Exportar / compartir reporte — el reporte se puede generar sin
    exportarlo ni compartirlo nunca; ya no es un subpaso obligatorio.
  - `«extend»` UC-I2.4 Responder encuesta de uso post-negociación
- **UC-I3** Certificar solvencia vía ZK — exclusivo de este actor (§1.2); el Comprador no
  lo hereda.
  - `«include»` UC-I3.1 Conectar cuenta bancaria (puente Open Banking)
  - `«include»` UC-I3.2 Generar prueba ZK de umbral
  - `«include»` UC-I3.3 Compartir prueba con arrendador / administradora
  - `«extend»` UC-I3.4 Revocar prueba compartida
- **UC-I4** Guardar zonas / inmuebles favoritos
- **UC-I5** Recibir alertas de anomalías en zonas de interés
- 🆕 **UC-I6** Comparar inmuebles o zonas lado a lado
  - `«include»` UC-I6.1 Generar tabla comparativa de índices — exportable como insumo de
    UC-I2.3.

### 3. Comprador — 5 base / 5 anidados

- **UC-I1** Consultar índice de asequibilidad y anomalía por inmueble
- **UC-I2** Generar Reporte de Precio Justo
  - `«include»` UC-I2.1 Contrastar precio pedido vs. rango esperado
  - `«include»` UC-I2.2 Recomendar rango de negociación
  - `«extend»` UC-I2.3 Exportar / compartir reporte
  - `«extend»` UC-I2.4 Responder encuesta de uso post-negociación
- **UC-I4** Guardar zonas / inmuebles favoritos
- **UC-I5** Recibir alertas de anomalías en zonas de interés
- 🆕 **UC-I6** Comparar inmuebles o zonas lado a lado
  - `«include»` UC-I6.1 Generar tabla comparativa de índices

*Comparte UC-I1/I2/I4/I5/I6 con el Inquilino (§2); no participa en UC-I3 — certificar
solvencia ZK es específico de la relación con el arrendador, no de una compraventa.*

### 4. Ciudadano Aportador de Datos — 3 base / 2 anidados

- **UC-C1** Reportar dato local (precio, cambio de comercio, desplazamiento)
  - `«include»` UC-C1.1 Adjuntar evidencia (foto / geolocalización)
- **UC-C2** Consultar reputación y estado de aportes
  - `«extend»` UC-C2.1 Disputar rechazo de un aporte — escala hacia UC-D3.
- 🆕 **UC-C4** Consultar historial detallado de aportes propios — insumo necesario para que
  el ciudadano arme el caso al disputar (UC-C2.1).

*UC-C3 (Recibir incentivo reputacional) se eliminó del catálogo: no es un objetivo
iniciado por el actor, sino un efecto colateral automático de UC-C1/UC-D2 sobre su
reputación.*

### 5. Validador DAO *(especializa a Ciudadano Aportador)* — 4 base / 2 anidados

- **UC-D1** Revisar aportes pendientes de validación
  - `«include»` UC-D1.1 Consultar evidencia y contexto del aporte
- **UC-D2** Votar validez del dato (consenso distribuido)
- **UC-D3** Participar en arbitraje de disputas
  - `«extend»` UC-D3.1 Escalar a Administrador cuando no hay consenso
- 🆕 **UC-D4** Consultar tablero de desempeño y ranking de validadores

### 6. Inversionista — 4 base / 3 anidados

- **UC-U1** Consultar mapa de riesgo de gentrificación
- **UC-U2** Suscribirse a alertas tempranas de inflexión de precio
  - `«include»` UC-U2.1 Configurar umbral / zona de interés
- **UC-U3** Solicitar reporte predictivo institucional
  - `«extend»` UC-U3.1 Solicitar reporte a medida (custom)
- 🆕 **UC-U5** Comparar corredores o zonas en paralelo
  - `«include»` UC-U5.1 Exportar comparación a informe

*No participa en UC-U4 (registrar uso en política pública) — ese objetivo es específico
del Urbanista (§7); su ciclo de venta corto (FIBRA/REIT) explica el interés en alertas
tempranas (UC-U2), que el Urbanista no tiene.*

### 7. Urbanista — 4 base / 3 anidados

- **UC-U1** Consultar mapa de riesgo de gentrificación
- **UC-U3** Solicitar reporte predictivo institucional
  - `«extend»` UC-U3.1 Solicitar reporte a medida (custom)
- **UC-U4** Registrar uso del reporte en política pública
  - `«include»` UC-U4.1 Adjuntar evidencia documental (oficio, minuta, publicación)
- 🆕 **UC-U5** Comparar corredores o zonas en paralelo
  - `«include»` UC-U5.1 Exportar comparación a informe

*Comparte UC-U1/U3/U5 con el Inversionista (§6); su ciclo de decisión institucional
(12-24 meses) no depende de inflexiones de precio de corto plazo, por eso no se suscribe a
UC-U2.*

### 8. Administradora de Propiedades — 5 base / 5 anidados

- **UC-B1** Integrarse al módulo ZK (onboarding B2B)
  - `«include»` UC-B1.1 Firmar contrato / KYB
  - `«include»` UC-B1.2 Obtener credenciales API
- **UC-B2** Verificar solvencia de un solicitante
  - `«include»` UC-B2.1 Validar prueba ZK recibida
  - `«extend»` UC-B2.2 Rechazar prueba inválida / expirada
- **UC-B3** Consultar panel de verificaciones (dashboard institucional)
- **UC-B4** Gestionar suscripción y facturación del servicio ZK
- 🆕 **UC-B5** Consultar bitácora de verificaciones para auditoría regulatoria
  - `«include»` UC-B5.1 Exportar bitácora firmada criptográficamente

### 9. Cliente PropTech — 4 base / 4 anidados

- **UC-B1** Integrarse al módulo ZK (onboarding B2B)
  - `«include»` UC-B1.1 Firmar contrato / KYB
  - `«include»` UC-B1.2 Obtener credenciales API
- **UC-B2** Verificar solvencia de un solicitante
  - `«include»` UC-B2.1 Validar prueba ZK recibida
  - `«extend»` UC-B2.2 Rechazar prueba inválida / expirada
- **UC-B3** Consultar panel de verificaciones (dashboard institucional)
- **UC-B4** Gestionar suscripción y facturación del servicio ZK

*No mantiene bitácora auditable (UC-B5) — reparto inferido a partir del catálogo original,
que no distinguía Administradora de PropTech; ver nota en §1.2.*

### 10. Administrador de la plataforma — 7 base / 6 anidados

- **UC-A1** Gestionar catálogo de colonias
  - `«include»` UC-A1.1 Revisar fuentes de datos abiertas importadas
- **UC-A2** Moderar disputas DAO escaladas
- **UC-A3** Gestionar cuentas y contratos de clientes B2B
  - `«include»` UC-A3.1 Emitir / revocar credenciales API
- **UC-A4** Administrar cumplimiento normativo
  - `«include»` UC-A4.1 Publicar Aviso de Privacidad
  - `«include»` UC-A4.2 Registrar evaluación de impacto (PIA/DPIA)
  - `«include»` UC-A4.3 Registrar dictámenes legales y cartas regulatorias
- **UC-A5** Supervisar auditoría externa de circuitos ZK
- **UC-A6** Controlar el gate económico de la DAO (aprobar/bloquear componentes con valor
  transferible)
- 🆕 **UC-A7** Monitorear salud y métricas de uso de la plataforma
  - `«include»` UC-A7.1 Configurar alertas operativas (uptime, latencia)

### 11. Desarrollador / Integrador — 4 base / 2 anidados

- **UC-Dv1** Consultar documentación de la API pública
- **UC-Dv2** Gestionar credenciales de API (API key / OAuth)
- **UC-Dv3** Consumir API de catálogo e índices
  - 🆕 `«extend»` UC-Dv5 Suscribirse a webhooks de eventos del catálogo — modo orientado a
    eventos en vez de polling constante.
- **UC-Dv4** Integrar verificación ZK en flujo propio
  - `«include»` UC-Dv4.1 Probar generación/verificación en sandbox

*UC-Dv3.1 (Manejar límite de tasa) se eliminó del catálogo: el rate limiting es una
respuesta del sistema dentro de UC-Dv3, no un objetivo iniciado por el Dev.*

## 1.4 Mapa de casos de uso anidados

| Anidado                                                                                                                                                     | Vive dentro de | Relación                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------- |
| UC-V1.1, UC-I2.1–2.2, UC-I3.1–3.3, UC-I6.1, UC-C1.1, UC-D1.1, UC-U2.1, UC-U4.1, UC-U5.1, UC-B1.1–1.2, UC-B2.1, UC-B5.1, UC-A1.1, UC-A3.1, UC-A4.1–4.3, UC-A7.1, UC-Dv4.1 | su caso base   | `«include»` — quitarlo deja al caso padre sin razón de negocio                  |
| UC-V4.1, UC-I2.3, UC-I2.4, UC-I3.4, UC-C2.1, UC-D3.1, UC-U3.1, UC-B2.2, UC-Dv5                                                                              | su caso base   | `«extend»` — solo tiene sentido como rama condicional de un flujo que ya existe |

## 1.5 Cómo cambian los casos de uso según el actor

**1. Ver el catálogo — mismo motor, exposición distinta.** UC-V1 (Visitante) y UC-I1
(Inquilino) consultan el mismo motor de índices, pero UC-V1 entrega datos agregados y
anonimizados por colonia, mientras UC-I1 entrega detalle por inmueble y señal de anomalía
individual. La barrera entre ambos es UC-V4 + UC-V4.1.

**2. Verificación de solvencia ZK — un protocolo, dos roles opuestos.** UC-I3 (Inquilino,
exclusivo — el Comprador no lo tiene) y UC-B2 (Administradora/PropTech) son las dos mitades
del mismo intercambio criptográfico: el Inquilino genera y comparte la prueba (UC-I3.2 →
UC-I3.3); el actor B2B receptor la valida y, si falla, la rechaza (UC-B2.1 → UC-B2.2). El
Inquilino nunca valida, ni Administradora ni PropTech nunca generan.

**3. Reporte ciudadano → consenso → arbitraje — una cadena de tres roles.** Ciudadano (C1
reporta) → Validador DAO (D1 revisa, D2 vota) → si se rechaza, Ciudadano (C2.1 disputa) →
Validador DAO (D3 arbitra) → sin consenso, Administrador (A2 modera, vía D3.1). El
Validador DAO en el medio de la cadena es literalmente el mismo humano que el Ciudadano
Aportador (generalización), no un tercer actor externo.

**4. Reporte de precio justo vs. reporte predictivo institucional.** UC-I2 (Inquilino o
Comprador) y UC-U3 (Inversionista o Urbanista) comparten el mismo motor de índices de
asequibilidad y riesgo, pero UC-I2 es individual, gratuito e inmediato; UC-U3 es
institucional, de pago, con extensión a medida (UC-U3.1). Dentro de UC-U3, el Inversionista
opera en ciclo corto (FIBRA/REIT, semanas, con foco en alertas tempranas vía UC-U2) y el
Urbanista en ciclo largo (oficina de gobierno, 12-24 meses, con foco en dejar evidencia de
uso en política pública vía UC-U4) — la misma diferencia de ciclo que separaba antes al
actor compuesto ahora es, explícitamente, la frontera entre los dos actores.

**5. Gestión de credenciales — tres perspectivas sobre el mismo sistema.** UC-B1.2
(Administradora/PropTech obtiene sus credenciales), UC-Dv2 (Dev gestiona las suyas) y
UC-A3.1 (Administrador emite/revoca cualquiera) operan sobre el mismo sistema de
credenciales API desde tres ángulos distintos — el Administrador es el único con autoridad
sobre las credenciales de los otros dos.

## 1.6 Resumen de conteo — catálogo UML

| Actor                          | Base   | Anidados | Total  |
| -------------------------------- | ------ | -------- | ------ |
| Visitante no autenticado       | 4      | 2        | 6      |
| Inquilino                      | 6      | 9        | 15     |
| Comprador                      | 5      | 5        | 10     |
| Ciudadano Aportador            | 3      | 2        | 5      |
| Validador DAO                  | 4      | 2        | 6      |
| Inversionista                  | 4      | 3        | 7      |
| Urbanista                      | 4      | 3        | 7      |
| Administradora de Propiedades  | 5      | 5        | 10     |
| Cliente PropTech                | 4      | 4        | 8      |
| Administrador                  | 7      | 6        | 13     |
| Dev / Integrador                | 4      | 2        | 6      |
| **Total distinto en catálogo** | **38** | **32**   | **70** |

*El "Total" de la última fila es el conteo de casos de uso **distintos** en todo el
catálogo, no la suma de las filas anteriores: Inquilino/Comprador comparten UC-I1, I2, I4,
I5, I6; Inversionista/Urbanista comparten UC-U1, U3, U5; Administradora/PropTech comparten
UC-B1–B4. Sumar las filas cuenta esos casos compartidos dos veces.*

Si el profesor pide exactamente ~50, los candidatos a recortar, en orden, son: los
`«extend»` de flujos alternos menos críticos (UC-V4.1, UC-I2.4, UC-B2.2), y si hace falta
recortar más, los casos nuevos independientes de menor peso narrativo (UC-C4, UC-D4,
UC-A7).

---

# PARTE 2 — Especificaciones Atómicas de Ingeniería

25 casos de uso atómicos, en tres familias técnicas, que descomponen a nivel de
implementación los casos de uso de negocio de la Parte 1 (ver trazabilidad en §3). Cada
caso sigue el patrón: Descripción · Actores · Precondiciones · Poscondiciones · Flujo
Principal · Excepciones · Contrato Técnico.

## FAMILIA A · Autenticación y Sesión — 9 casos

### [UC-AUTH-01] Iniciar Sesión
- **Descripción:** autenticación de un actor humano contra el servicio de identidad; emite
  un par de tokens (access + refresh) que habilitan el resto de las llamadas autenticadas.
- **Actores:** *Primario:* Usuario registrado (Inquilino, Comprador, Ciudadano Aportador,
  Validador DAO, Inversionista, Urbanista, Administradora, PropTech, Administrador, Dev).
  *Secundario:* Auth Service, IdP externo (si login social/OAuth).
- **Precondiciones:** la cuenta existe y está activa (no bloqueada ni suspendida).
- **Poscondiciones:** *Éxito:* `access_token` (JWT, exp 15 min) + `refresh_token` (opaco,
  exp 30 días, almacenado hasheado) emitidos; evento `login_success` registrado en
  auditoría. *Fallo:* ningún token emitido; contador de intentos fallidos incrementado.
- **Flujo Principal:** `POST /auth/login` con credenciales → validar formato → localizar
  cuenta → comparar hash de password (argon2id) → confirmar cuenta activa y no suspendida
  → generar `access_token` (claims: `sub`, `role`, `kyc_level`, `exp`) y `refresh_token` →
  registrar auditoría → `200` con ambos tokens.
- **Excepciones:**
  - E1 Credenciales inválidas → `401`; incrementa contador de intentos fallidos; el mensaje
    nunca revela si falló el email o el password.
  - E2 Cuenta bloqueada por intentos fallidos (≥5 en 15 min) → `423 Locked`; sugiere
    UC-AUTH-04.
  - E3 Cuenta suspendida por Administrador → `403`, mensaje genérico sin exponer la causa.
  - E4 Timeout/caída del Auth Service → `503`; reintento con backoff exponencial; ninguna
    sesión parcial se crea.
- **Contrato Técnico:** `POST /api/v1/auth/login` `{email, password, provider}` → `200
  {access_token, refresh_token, expires_in}`. Componente: Auth Service (stateless, JWT
  RS256) · Password Hashing (argon2id) · Rate Limiter (Redis, ventana deslizante por IP +
  por cuenta).

### [UC-AUTH-02] Cerrar Sesión
- **Descripción:** invalidación explícita de la sesión **propia y actual** antes de su
  expiración natural (se separa de UC-AUTH-05 porque ahí el actor prueba autorización sobre
  una sesión que no es la que usa para llamar).
- **Actores:** *Primario:* Usuario autenticado. *Secundario:* Auth Service, Token
  Blacklist Store (Redis).
- **Precondiciones:** el usuario posee un `access_token`/`refresh_token` válidos.
- **Poscondiciones:** *Éxito:* `refresh_token` revocado (`revoked=true`); `access_token`
  añadido a blacklist con TTL = tiempo restante hasta su expiración natural. *Fallo:* la
  sesión permanece activa hasta su expiración natural.
- **Flujo Principal:** `POST /auth/logout` con `Authorization: Bearer` → validar firma y
  vigencia → extraer `jti` y añadirlo a blacklist (TTL = expiración restante) → marcar el
  `refresh_token` asociado como `revoked` → `204 No Content`.
- **Excepciones:**
  - E1 Token ya expirado al momento del logout → `401`, tratado como éxito lógico.
  - E2 Doble logout (token ya en blacklist) → `204` idempotente.
  - E3 Fallo del store de blacklist (Redis caído) → `503`; fallback: revocar solo el
    `refresh_token` en base persistente y dejar log crítico para reconciliación posterior.
- **Contrato Técnico:** sin body, solo header `Authorization`. Componente: Token Blacklist
  (Redis, TTL) · Refresh Token Store (Postgres, columna `revoked_at`).

### [UC-AUTH-03] Refrescar Token de Sesión
- **Descripción:** renovación del `access_token` usando un `refresh_token` vigente, sin
  pedir credenciales de nuevo.
- **Actores:** *Primario:* Sistema cliente (SPA/mobile) en nombre del usuario. *Secundario:*
  Auth Service.
- **Precondiciones:** `refresh_token` vigente, no revocado, no en blacklist.
- **Poscondiciones:** *Éxito:* nuevo `access_token` emitido; `refresh_token` rotado
  (rotating refresh token, el anterior queda inválido). *Fallo:* ningún token nuevo; si se
  detecta *reuse* de un token ya rotado, se revocan **todas** las sesiones del usuario.
- **Flujo Principal:** `POST /auth/refresh` con `refresh_token` → validar hash y estado →
  verificar que no haya sido usado previamente (detección de reuse) → emitir nuevo par e
  invalidar el anterior → `200` con el nuevo par.
- **Excepciones:**
  - E1 Refresh token expirado → `401`; obliga a repetir UC-AUTH-01 completo.
  - E2 Reuse detectado (token robado) → `403`; se revocan todas las sesiones del usuario y
    se dispara alerta de seguridad.
  - E3 Cuenta suspendida después de emitido el refresh token → `403`.
- **Contrato Técnico:** `{refresh_token}`. Componente: Auth Service · Refresh Token Store
  con columna `used_at` (rotation pattern).

### [UC-AUTH-04] Recuperar Contraseña
- **Descripción:** restablecimiento de contraseña vía correo verificado, sin revelar si el
  email está registrado.
- **Actores:** *Primario:* Usuario (con o sin sesión). *Secundario:* Auth Service, Servicio
  de Correo (SES/SendGrid).
- **Precondiciones:** ninguna.
- **Poscondiciones:** *Éxito:* password actualizado; todos los `refresh_token` existentes
  revocados, forzando re-login en todos los dispositivos. *Fallo:* password sin cambios.
- **Flujo Principal:** `POST /auth/password/forgot {email}` → responde `200` genérico
  exista o no la cuenta → si existe, genera token de un solo uso (TTL 15–30 min), lo
  hashea y almacena → correo con el enlace → `POST /auth/password/reset {token, nueva
  password}` → valida token → actualiza hash, marca token usado, revoca todos los refresh
  tokens activos.
- **Excepciones:**
  - E1 Token expirado o inexistente → `400`; reiniciar el flujo.
  - E2 Token reutilizado → `400` + alerta de seguridad si el patrón es sospechoso.
  - E3 Nueva contraseña no cumple política → `422` con la regla violada.
  - E4 Falla el servicio de correo → `202 Accepted` igualmente; reintento asíncrono vía
    cola.
- **Contrato Técnico:** reset token = HMAC aleatorio 32 bytes, almacenado como
  `sha256(token)`. Componente: Auth Service · Email Queue (SQS) · Password Policy
  Validator.

### [UC-AUTH-05] Revocar Sesión
- **Descripción:** invalidación de una sesión **distinta de la sesión actual del
  solicitante** — el propio usuario cerrando un dispositivo remoto, o un Administrador
  forzando el cierre de la sesión de otra cuenta (sospecha de compromiso). Se separa de
  UC-AUTH-02 porque actor, precondiciones y control de autorización son distintos.
- **Actores:** *Primario:* Usuario dueño de la cuenta (otro dispositivo) o Administrador.
  *Secundario:* Auth Service, Token Blacklist Store, Session Registry (Postgres).
- **Precondiciones:** el `session_id` objetivo existe y está activo; si el actor es el
  propio usuario, le pertenece; si es Administrador, posee scope `sessions:revoke:any`.
- **Poscondiciones:** *Éxito:* `refresh_token` de esa sesión `revoked=true`; su
  `access_token` (si el `jti` es conocido) se añade a blacklist; evento `session_revoked`
  registrado con `actor_id` y `session_id` objetivo. *Fallo:* la sesión objetivo permanece
  activa.
- **Flujo Principal:** `DELETE /auth/sessions/{session_id}` → validar sesión del actor y su
  rol/scope → resolver propiedad (auto-gestión o scope de Administrador) → marcar
  `refresh_token` objetivo como `revoked` → añadir `jti` a blacklist → registrar auditoría
  → `204`.
- **Excepciones:**
  - E1 `session_id` no existe o no pertenece al actor (y no es Admin) → `403`; no revela si
    el `session_id` existe.
  - E2 Sesión ya revocada previamente → `204` idempotente.
  - E3 Race condition: el usuario objetivo ejecuta UC-AUTH-03 en el instante exacto de la
    revocación → gana la escritura confirmada primero; si el refresh se confirmó antes, la
    revocación (por Administrador) debe invalidar también el nuevo `refresh_token`
    resolviendo por `user_id + device_id`, no solo por `session_id` puntual.
  - E4 Fallo del store de blacklist (Redis caído) → `503`; fallback: revocar solo en
    Postgres y encolar la entrada de blacklist para reconciliación asíncrona.
- **Contrato Técnico:** `DELETE /api/v1/auth/sessions/{session_id}`, body opcional
  `{reason}`. Evento: `session_revoked {actor_id, session_id, target_user_id, reason, ts}`.
  Componente: Auth Service · Session Registry (Postgres) · Token Blacklist (Redis, TTL).

### [UC-AUTH-06] Registrar Cuenta
- **Descripción:** creación de una cuenta nueva — ciclo de vida independiente de "Iniciar
  Sesión"; deliberadamente no emite tokens de sesión en este paso.
- **Actores:** *Primario:* Usuario no registrado. *Secundario:* Auth Service, Email Queue.
- **Precondiciones:** el email no está registrado; el password propuesto cumple la
  política.
- **Poscondiciones:** *Éxito:* cuenta creada con `status="pending_verification"`; email de
  verificación encolado; ningún token de sesión emitido. *Fallo:* ninguna cuenta
  persistida.
- **Flujo Principal:** `POST /auth/register {email, password, provider}` → validar formato
  y política de password → verificar unicidad del email → hashear password (argon2id) y
  crear cuenta `pending_verification` → generar y hashear token de verificación (TTL 24h)
  → encolar correo → `201` con `{user_id, status}`.
- **Excepciones:**
  - E1 Email ya registrado → `409 Conflict` (a diferencia de login/forgot, el registro sí
    puede revelar existencia previa; decisión de producto estándar).
  - E2 Password no cumple política → `422` con la regla violada.
  - E3 Falla el envío del correo de verificación → `202 Accepted` igual; reintento
    asíncrono vía cola.
  - E4 Fallo de escritura en base de datos → `503`; ninguna cuenta parcial persiste
    (transacción atómica).
- **Contrato Técnico:** `POST /api/v1/auth/register` → `201 {user_id, status:
  "pending_verification"}`. Componente: Auth Service, Password Policy Validator, Email
  Queue.

### [UC-AUTH-07] Verificar Correo Electrónico
- **Descripción:** confirma la propiedad del email vía el token de UC-AUTH-06, habilitando
  el login (una cuenta `pending_verification` no puede completar UC-AUTH-01).
- **Actores:** *Primario:* Usuario sin sesión. *Secundario:* Auth Service.
- **Precondiciones:** cuenta en `pending_verification`; token vigente y no usado.
- **Poscondiciones:** *Éxito:* `status="active"`; token marcado usado. *Fallo:* la cuenta
  permanece `pending_verification`.
- **Flujo Principal:** `POST /auth/verify-email {token}` → validar hash/vigencia →
  actualizar `status="active"` → marcar token usado → `200`.
- **Excepciones:**
  - E1 Token expirado (>24h) → `400`; se sugiere solicitar uno nuevo (mismo flujo de
    registro, rate-limited).
  - E2 Token ya usado → `200` idempotente si la cuenta ya quedó `active`.
  - E3 La cuenta ya no existe (borrada tras enviarse el token) → `404`.
- **Contrato Técnico:** `POST /api/v1/auth/verify-email {token}` → `200`. Componente: Auth
  Service, columna `verified_at`.

### [UC-AUTH-08] Cambiar Contraseña (Autenticado)
- **Descripción:** distinto de "Recuperar Contraseña": el usuario ya tiene sesión y conoce
  su password actual; no arranca por correo ni token de un solo uso.
- **Actores:** *Primario:* Usuario autenticado. *Secundario:* Auth Service.
- **Precondiciones:** sesión válida; el usuario provee su `current_password`.
- **Poscondiciones:** *Éxito:* hash de password actualizado; se revocan los
  `refresh_token` de otras sesiones (la sesión actual permanece viva). *Fallo:* password
  sin cambios.
- **Flujo Principal:** `PATCH /auth/password {current_password, new_password}` → validar
  token → verificar `current_password` → validar política de `new_password` → actualizar
  hash → revocar refresh tokens de otras sesiones → `200`.
- **Excepciones:**
  - E1 `current_password` incorrecta → `401`; incrementa el mismo contador anti-fuerza-bruta
    que UC-AUTH-01.
  - E2 `new_password` no cumple política o es igual a la actual → `422`.
  - E3 Cambio de password repetido en ventana corta (anti-abuso) → `429`.
- **Contrato Técnico:** `PATCH /api/v1/auth/password`. Componente: Auth Service, Rate
  Limiter, Refresh Token Store.

### [UC-AUTH-09] Listar Sesiones Activas
- **Descripción:** consulta de solo lectura — precondición funcional de UC-AUTH-05 (no se
  puede revocar un `session_id` sin poder listarlas primero).
- **Actores:** *Primario:* Usuario autenticado (o Admin sobre otra cuenta). *Secundario:*
  Session Registry.
- **Precondiciones:** sesión válida del solicitante.
- **Poscondiciones:** operación pura de lectura; ningún estado se altera en éxito ni en
  fallo.
- **Flujo Principal:** `GET /auth/sessions` → validar token → consultar Session Registry
  por `user_id` → `200` con `[{session_id, device, ip, created_at, last_used_at,
  current}]`.
- **Excepciones:**
  - E1 Admin sin scope `sessions:read:any` consultando otra cuenta → `403`.
  - E2 Session Registry no disponible → `503`; nunca se devuelven datos parcialmente
    inconsistentes.
  - E3 `user_id` objetivo no existe (Admin sobre cuenta eliminada) → `404`.
- **Contrato Técnico:** `GET /api/v1/auth/sessions`. Componente: Session Registry
  (Postgres).

## FAMILIA B · Verificación de Solvencia ZK — 9 casos

### [UC-ZK-01] Conectar Cuenta Bancaria (Open Banking)
- **Descripción:** el Inquilino autoriza a CIVITAS acceso de solo lectura a su cuenta
  bancaria vía un proveedor de Open Banking, como insumo temporal para generar la prueba
  ZK — nunca se persisten credenciales ni datos bancarios crudos.
- **Actores:** *Primario:* Inquilino (certificación de solvencia ZK, exclusiva de este
  actor — el Comprador no la usa, ver §1.2/§1.3). *Secundario:* Proveedor de Open Banking
  (ej. Belvo/Finerio), banco emisor.
- **Precondiciones:** Inquilino autenticado (UC-AUTH-01 completado).
- **Poscondiciones:** *Éxito:* `link_id` opaco de Open Banking almacenado (sin
  credenciales bancarias); `bank_link_status="connected"`. *Fallo:* ningún `link_id`
  persistido; el estado permanece `"not_connected"`.
- **Flujo Principal:** `POST /zk/bank-link/init` → el sistema pide al proveedor un
  `widget_token` → lo devuelve al cliente para renderizar el widget embebido → el
  Inquilino ingresa credenciales bancarias **dentro del widget del proveedor** (CIVITAS
  nunca las recibe) → el proveedor redirige con un `link_id` tras autorización exitosa →
  `POST /zk/bank-link/confirm {link_id}` → el sistema valida el `link_id` contra la API
  del proveedor y persiste solo `{link_id, banco, fecha}`.
- **Excepciones:**
  - E1 Usuario cancela el widget antes de autorizar → sin efecto; estado permanece
    `not_connected`.
  - E2 Credenciales rechazadas por el banco → "no se pudo conectar", sin reintento
    automático.
  - E3 Timeout de la API del proveedor (>10s) → `504`; ningún `link_id` se persiste.
  - E4 MFA bancario pendiente → estado intermedio `"pending_mfa"`; polling a
    `GET /links/{id}/status` hasta resolución o expiración (TTL 5 min).
- **Contrato Técnico:** `POST /zk/bank-link/confirm {link_id: "belvo_lk_xxx"}`. Componente:
  Open Banking Adapter (wrapper sobre API del proveedor) · Bank Link Store (Postgres —
  solo `link_id` opaco, cero PII bancaria).

### [UC-ZK-02] Generar Witness de Solvencia
- **Descripción:** a partir de un `link_id` ya autorizado, el sistema obtiene el dato
  financiero temporal, lo hace atestiguar por el Oráculo de Privacidad y construye el
  *witness* del circuito (input privado + input público). **No** ejecuta el circuito de
  *proving* — responsabilidad exclusiva de UC-ZK-03. Esta separación permite
  invalidar/expirar un witness sin tocar el subsistema de proving, y aislar el único punto
  donde el dato bancario crudo existe en memoria.
- **Actores:** *Primario:* Inquilino. *Secundario:* Open Banking Adapter, Oráculo de
  Privacidad ZK (zkPass/Reclaim).
- **Precondiciones:** `bank_link_status="connected"` (UC-ZK-01 completado); umbral de
  solvencia (`threshold_type`, `threshold_value`) definido en la solicitud.
- **Poscondiciones:** *Éxito:* `witness_id` persistido cifrado y efímero (TTL corto, ej. 5
  min) junto al input público; el dato bancario crudo nunca toca disco, solo vive en
  memoria durante la construcción. *Fallo:* ningún `witness_id` persistido; cualquier dato
  financiero temporal se descarta de memoria de inmediato.
- **Flujo Principal:** `POST /zk/witness/generate {link_id, threshold_type, threshold_value}`
  → obtener dato financiero temporal vía el adapter (solo en memoria, TTL ≤ 60s) → validar
  que supere `threshold_value` (chequeo temprano, antes de invertir cómputo en proving) →
  invocar al Oráculo de Privacidad para atestiguar la fuente → construir el witness
  (input privado: monto real; input público: `threshold_value`), cifrarlo y persistirlo con
  TTL corto → descartar el dato bancario crudo de memoria → `201 {witness_id, expires_at}`.
- **Excepciones:**
  - E1 El balance no alcanza el umbral → `422`; ningún witness se construye ni persiste; el
    monto real nunca se expone.
  - E2 Falla el Oráculo de Privacidad al atestiguar → `502`; ningún witness se persiste.
  - E3 Timeout obteniendo el dato financiero (>10s) → `504`; ningún estado parcial persiste.
  - E4 El `link_id` ya no está autorizado (revocado desde el banco) → `401`; repetir
    UC-ZK-01.
- **Contrato Técnico:** `POST /api/v1/zk/witness/generate {link_id, threshold_type:
  "income_multiple", threshold_value: 3}` → `201 {witness_id, expires_at}`. Componente:
  Open Banking Adapter · Oráculo zkPass/Reclaim · Witness Store (Redis cifrado, TTL corto,
  sin acceso a red saliente).

### [UC-ZK-03] Generar Prueba ZK de Solvencia
- **Descripción:** a partir de un `witness_id` vigente, el sistema ejecuta el circuito ZK
  (Groth16) y persiste la prueba resultante. Es la única responsabilidad de este caso de
  uso; no conoce ni vuelve a tocar el dato bancario crudo.
- **Actores:** *Primario:* Inquilino (o el sistema, encadenado automáticamente tras
  UC-ZK-02). *Secundario:* ZK Proving Worker (circom/snarkjs).
- **Precondiciones:** `witness_id` vigente (no expirado, no usado previamente — uso único).
- **Poscondiciones:** *Éxito:* `proof_id` con estado `"valid"` y TTL de expiración (ej. 30
  días) persistido junto al `proof`, `publicSignals` y clave pública de verificación; el
  `witness_id` usado queda invalidado (uso único) y se libera de memoria. *Fallo:* ningún
  `proof_id` persistido; el `witness_id` permanece disponible para reintento solo si no ha
  expirado ni fue consumido.
- **Flujo Principal:** `POST /zk/proof/generate {witness_id}` → recuperar y descifrar el
  witness → ejecutar el circuito (`snarkjs groth16 prove`) generando `{proof,
  publicSignals}` → marcar `witness_id` como usado y liberarlo de memoria (uso único) →
  persistir `{proof_id, proof, publicSignals, threshold_type, threshold_value, expires_at}`
  — nunca el monto real → `201` con `proof_id`.
- **Excepciones:**
  - E1 `witness_id` expirado o ya usado → `410 Gone`; obliga a repetir UC-ZK-02 desde cero.
  - E2 Timeout en el proving (excede SLA, ej. >10s) → `504`; el witness se libera de
    memoria pero permanece no-consumido si no expiró, permitiendo reintento controlado;
    ningún `proof_id` parcial se persiste.
  - E3 El circuito produce una prueba corrupta/inconsistente → `500`; ningún `proof_id` se
    persiste; se registra para revisión del circuito.
- **Contrato Técnico:** `POST /api/v1/zk/proof/generate {witness_id}` → `201 {proof_id,
  threshold_type, threshold_value, expires_at}`. Componente: ZK Proving Service (worker
  aislado, sin acceso a red tras iniciar el proving), circuito `income_threshold.circom`.

### [UC-ZK-04] Verificar Prueba ZK
- **Descripción:** una Administradora de Propiedades o un Cliente PropTech valida
  criptográficamente una prueba ZK recibida, sin depender de CIVITAS como intermediario de
  confianza sobre los datos.
- **Actores:** *Primario:* Administradora de Propiedades o Cliente PropTech. *Secundario:*
  Smart Contract Verifier (on-chain o servicio off-chain equivalente).
- **Precondiciones:** el actor B2B recibió un `proof_id` compartido (UC-ZK-05); posee
  credenciales API activas con scope `zk:verify`.
- **Poscondiciones:** *Éxito:* resultado `"valid"` registrado en la bitácora de auditoría
  con timestamp y `proof_id`. *Fallo:* resultado `"invalid"` o `"expired"`, registrado
  igualmente para trazabilidad, sin alterar el estado del solicitante.
- **Flujo Principal:** `POST /zk/proof/verify {proof_id}` → recuperar `{proof,
  publicSignals, expires_at}` → verificar `expires_at > now()` → invocar la verificación
  del circuito (`snarkjs.groth16.verify` o `Verifier.verifyProof()` on-chain) → registrar
  el resultado en la bitácora de auditoría (insumo de UC-B5) → `200 {valid, threshold_type,
  threshold_value}` — nunca el monto real.
- **Excepciones:**
  - E1 Prueba expirada → resultado `"expired"`; no se ejecuta la criptografía de
    verificación (ahorro de cómputo).
  - E2 La verificación criptográfica falla (proof inválida/corrupta) → resultado
    `"invalid"`; se registra el intento con IP/origen para detección de abuso.
  - E3 `proof_id` no existe o fue revocado (UC-ZK-06) → `404`/`410`, resultado `"revoked"`.
  - E4 El Smart Contract Verifier no responde (congestión de red si es on-chain) → `503`;
    reintento con backoff; nunca se asume `"valid"` por default ante la duda.
- **Contrato Técnico:** `snarkjs.groth16.verify(vKey, publicSignals, proof)` o contrato
  `Verifier.sol: verifyProof(uint[2] a, uint[2][2] b, uint[2] c, uint[] input) view
  returns (bool)`. Componente: ZK Verification Service · Audit Log Store (append-only,
  insumo de UC-B5).

### [UC-ZK-05] Compartir Prueba ZK con Tercero
- **Descripción:** el Inquilino otorga explícitamente a un receptor específico permiso de
  acceso acotado sobre una prueba ya generada.
- **Actores:** *Primario:* Inquilino. *Secundario:* Access Grant Service.
- **Precondiciones:** el `proof_id` existe y está vigente (UC-ZK-03 completado, no
  expirado, no revocado).
- **Poscondiciones:** *Éxito:* registro `{proof_id, grantee_id, granted_at}` creado; el
  receptor puede ejecutar UC-ZK-04 sobre ese `proof_id`. *Fallo:* ningún grant creado.
- **Flujo Principal:** `POST /zk/proof/{proof_id}/share {grantee_email}` o
  `{grantee_org_id}` → validar propiedad y vigencia → crear registro de grant y token de
  acceso de vigencia limitada → notificar al receptor (email o webhook si es B2B).
- **Excepciones:**
  - E1 `proof_id` ya expirado → `410 Gone`; sugiere regenerar (UC-ZK-02/UC-ZK-03).
  - E2 `grantee_org_id` sin cuenta B2B activa → `422`.
  - E3 El Inquilino intenta compartir un `proof_id` que no le pertenece → `403` (control de
    propiedad estricto, sin excepciones).
- **Contrato Técnico:** Componente: Access Grant Service — tabla `grants` con FK a
  `proof_id` y expiración independiente de la del `proof_id` mismo.

### [UC-ZK-06] Revocar Prueba ZK Compartida
- **Descripción:** el Inquilino corta el acceso de un tercero a una prueba previamente
  compartida, antes de su expiración natural.
- **Actores:** *Primario:* Inquilino. *Secundario:* Access Grant Service.
- **Precondiciones:** existe al menos un grant activo para ese `proof_id`.
- **Poscondiciones:** *Éxito:* grant marcado `revoked=true`; futuros intentos de UC-ZK-04
  sobre ese grant devuelven `"revoked"`. *Fallo:* el grant permanece activo.
- **Flujo Principal:** `DELETE /zk/proof/{proof_id}/share/{grant_id}` → validar propiedad
  del `proof_id` → marcar grant como `revoked` con timestamp → notificar (webhook opcional)
  al receptor.
- **Excepciones:**
  - E1 `grant_id` no existe o ya estaba revocado → `204` idempotente.
  - E2 El receptor ya había verificado la prueba antes de la revocación → la revocación
    **no** invalida verificaciones ya registradas en bitácora (garantía de auditoría
    histórica); solo bloquea verificaciones futuras.
- **Contrato Técnico:** Componente: Access Grant Service — actualización *soft-delete*
  (nunca *hard-delete*, por trazabilidad regulatoria).

### [UC-ZK-07] Desconectar Cuenta Bancaria
- **Descripción:** acción opuesta a UC-ZK-01 — "conectar" y "desconectar" no pueden
  compartir un mismo caso de uso.
- **Actores:** *Primario:* Inquilino. *Secundario:* Proveedor de Open Banking, Open
  Banking Adapter.
- **Precondiciones:** `bank_link_status="connected"`; el `link_id` pertenece al
  solicitante.
- **Poscondiciones:** *Éxito:* `bank_link_status="not_connected"`; consentimiento revocado
  ante el proveedor; las pruebas ZK ya emitidas no se invalidan retroactivamente (garantía
  de inmutabilidad), pero no pueden generarse witnesses nuevos con ese `link_id`. *Fallo:*
  `bank_link_status` permanece `"connected"`.
- **Flujo Principal:** `DELETE /zk/bank-link/{link_id}` → validar propiedad → revocar
  consentimiento en la API del proveedor → actualizar estado local → `204`.
- **Excepciones:**
  - E1 El proveedor no responde a la revocación (timeout) → estado local pasa a
    `"disconnected_pending_provider_ack"`; reintento asíncrono; responde `202 Accepted`
    (nunca se informa `"connected"` de forma falsa).
  - E2 `link_id` ya estaba desconectado → `204` idempotente.
  - E3 `link_id` no pertenece al solicitante → `403`.
- **Contrato Técnico:** `DELETE /api/v1/zk/bank-link/{link_id}`. Componente: Open Banking
  Adapter, Bank Link Store.

### [UC-ZK-08] Renovar Prueba ZK Próxima a Expirar
- **Descripción:** distinto de la generación inicial porque su trigger y precondición son
  la proximidad de expiración de un `proof_id` existente, no una primera solicitud.
- **Actores:** *Primario:* Inquilino (o Sistema, vía notificación proactiva).
  *Secundario:* Open Banking Adapter, ZK Proving Worker.
- **Precondiciones:** `proof_id` pertenece al solicitante; `expires_at` dentro de la
  ventana de renovación (ej. ≤48h); `bank_link_status` sigue `"connected"`.
- **Poscondiciones:** *Éxito:* nuevo `proof_id` emitido (orquesta internamente UC-ZK-02 +
  UC-ZK-03 con el mismo umbral); el `proof_id` original queda `superseded_by=<nuevo_id>`
  pero sigue siendo válido hasta su expiración natural (terceros que ya lo verificaron no
  se ven afectados). *Fallo:* ningún `proof_id` nuevo; el original no cambia.
- **Flujo Principal:** `POST /zk/proof/{proof_id}/renew` → validar propiedad y ventana de
  renovación → ejecutar UC-ZK-02 → ejecutar UC-ZK-03 → marcar el original
  `superseded_by` → `201` con el nuevo `proof_id`.
- **Excepciones:**
  - E1 `bank_link_status` ya no es `"connected"` → `401`; solicita repetir UC-ZK-01.
  - E2 Renovación prematura (fuera de la ventana) → `422`.
  - E3 El balance ya no alcanza el umbral al renovar → `422`; el `proof_id` original sigue
    vigente hasta su expiración natural.
- **Contrato Técnico:** `POST /api/v1/zk/proof/{proof_id}/renew`. Componente: orquesta
  UC-ZK-02 + UC-ZK-03.

### [UC-ZK-09] Listar Pruebas Compartidas (Grants Activos)
- **Descripción:** consulta de solo lectura — precondición funcional de UC-ZK-06 (Revocar).
- **Actores:** *Primario:* Inquilino. *Secundario:* Access Grant Service.
- **Precondiciones:** sesión válida; el `proof_id` pertenece al solicitante.
- **Poscondiciones:** operación pura de lectura, sin alteración de estado.
- **Flujo Principal:** `GET /zk/proof/{proof_id}/shares` → validar propiedad → consultar
  grants activos e históricos → `200` con `[{grant_id, grantee, granted_at, revoked,
  revoked_at}]`.
- **Excepciones:**
  - E1 `proof_id` no pertenece al solicitante → `403`.
  - E2 `proof_id` no existe → `404`.
  - E3 Access Grant Service no disponible → `503`.
- **Contrato Técnico:** `GET /api/v1/zk/proof/{proof_id}/shares`. Componente: Access Grant
  Service.

## FAMILIA C · Gobernanza DAO — 7 casos

### [UC-DAO-01] Crear Propuesta de Gobernanza DAO
- **Descripción:** un Validador DAO con reputación suficiente propone un cambio en las
  reglas de su comunidad (ej. ajustar umbral de consenso, nuevo criterio de validación).
- **Actores:** *Primario:* Validador DAO. *Secundario:* Smart Contract de Gobernanza
  (`Governor.sol`), Sistema de Reputación.
- **Precondiciones:** reputación del Validador ≥ umbral mínimo para proponer; no tiene
  otra propuesta activa pendiente en la misma zona (control anti-spam).
- **Poscondiciones:** *Éxito:* propuesta creada on-chain con estado `"pending"`, periodo de
  votación iniciado (ej. 72h). *Fallo:* ninguna propuesta persistida ni transacción
  confirmada.
- **Flujo Principal:** `POST /dao/proposals {title, description, action_type,
  action_payload, zone_id}` → validar reputación mínima → validar `action_type` permitido
  → construir `Governor.propose(targets[], values[], calldatas[], description)` → firmar y
  enviar (vía relayer/meta-tx si el usuario no paga gas) → el contrato emite
  `ProposalCreated(proposalId, proposer, ...)` → indexar con estado `"pending"` y
  `voting_deadline`.
- **Excepciones:**
  - E1 Reputación insuficiente → `403`; informa umbral requerido y reputación actual.
  - E2 `action_payload` malformado o `action_type` no soportado → `422`; nunca se envía
    on-chain.
  - E3 Transacción revertida on-chain (ej. propuesta duplicada por hash de descripción) →
    `409`; informa el `proposalId` en conflicto.
  - E4 Fallo de red/nodo blockchain → `503`; reintento con el mismo `nonce`; ninguna
    propuesta queda en estado ambiguo.
- **Contrato Técnico:** `Governor.sol` (OpenZeppelin Governor extendido). Componente: DAO
  Governance Service · Blockchain Indexer (The Graph o equivalente).

### [UC-DAO-02] Votar Propuesta de Gobernanza DAO
- **Descripción:** un Validador DAO emite su voto (a favor / en contra / abstención) sobre
  una propuesta activa, con peso proporcional a su reputación.
- **Actores:** *Primario:* Validador DAO. *Secundario:* Smart Contract de Gobernanza,
  Sistema de Reputación (voting power).
- **Precondiciones:** la propuesta está en estado `"pending"` y dentro del periodo de
  votación; el Validador no ha votado ya esa propuesta.
- **Poscondiciones:** *Éxito:* voto registrado on-chain; el voting power del Validador se
  suma al tally correspondiente. *Fallo:* ningún voto registrado; el tally no cambia.
- **Flujo Principal:** `POST /dao/proposals/{id}/vote {support: "for"|"against"|
  "abstain"}` → validar que la propuesta siga en periodo de votación → consultar el voting
  power del Validador al momento del snapshot de la propuesta (evita manipulación
  posterior) → `Governor.castVote(proposalId, support)` → el contrato emite
  `VoteCast(voter, proposalId, support, weight)` → actualizar el tally indexado.
- **Excepciones:**
  - E1 Periodo de votación ya cerrado → `410`; informa el resultado final si ya está
    disponible.
  - E2 Doble voto → `409`; informa el voto previamente emitido (inmutable).
  - E3 Voting power = 0 en el snapshot (perdió reputación después de creada la propuesta
    pero antes del snapshot) → `403`.
  - E4 Fallo de transacción on-chain → `503`; reintento; el voto nunca se cuenta
    parcialmente.
- **Contrato Técnico:** `Governor.castVote()` con snapshot de voting power vía checkpoint
  `ERC20Votes`/`ERC721Votes`. Componente: DAO Governance Service.

### [UC-DAO-03] Contabilizar Quórum de Propuesta
- **Descripción:** al vencer el periodo de votación, se determina si la propuesta alcanzó
  el quórum mínimo y la mayoría requerida, transicionando su estado de `"pending"` a
  `"succeeded"` o `"defeated"`. Paso de agregación/lectura de estado, disparado por un
  keeper automatizado o consultado bajo demanda — deliberadamente separado de "Ejecutar"
  (UC-DAO-04), que es quien aplica el cambio una vez que este caso confirma que procede.
- **Actores:** *Primario:* Sistema (keeper automatizado / cronjob) o cualquier actor que
  consulte el resultado. *Secundario:* Smart Contract de Gobernanza, Blockchain Indexer.
- **Precondiciones:** el periodo de votación ya venció (`block.timestamp >
  voting_deadline`); la propuesta está indexada en estado `"pending"` o `"active"`.
- **Poscondiciones:** *Éxito:* estado indexado actualizado a `"succeeded"` (quórum
  alcanzado y mayoría a favor) o `"defeated"`; si pasa a `"succeeded"`, se notifica a los
  Validadores de la zona que la propuesta es ejecutable (habilita UC-DAO-04). *Fallo:* el
  estado indexado no cambia; ninguna inconsistencia se escribe.
- **Flujo Principal:** `GET /dao/proposals/{id}/tally` → consultar on-chain
  `Governor.state(proposalId)` (evalúa internamente `quorum(snapshotBlock)` contra votos
  totales y mayoría for/against) → mapear el `ProposalState` al estado indexado → persistir
  la transición y emitir evento interno `proposal_tallied` → si `"succeeded"`, notificar a
  los Validadores de la zona afectada.
- **Excepciones:**
  - E1 El periodo de votación aún no ha vencido → `425 Too Early`; informa el tiempo
    restante.
  - E2 El nodo blockchain no responde al consultar `state()` → `503`; reintento con
    backoff exponencial; el estado indexado no se modifica hasta tener lectura confiable.
  - E3 Discrepancia entre el estado indexado y el estado on-chain real (ej. tras un reorg)
    → el estado on-chain es siempre la fuente de verdad; el sistema re-sincroniza el
    índice y registra el evento de discrepancia para auditoría.
- **Contrato Técnico:** `GET /api/v1/dao/proposals/{id}/tally` (lectura pura —
  `Governor.state()` es una view function, no hay estado on-chain nuevo que escribir).
  Función on-chain: `Governor.state(uint256) view returns (ProposalState)` combinada con
  `quorum(uint256) view returns (uint256)`. Componente: DAO Governance Service ·
  Blockchain Indexer · Keeper Scheduler.

### [UC-DAO-04] Ejecutar Propuesta de Gobernanza DAO
- **Descripción:** una vez que una propuesta alcanzó estado `"succeeded"` (según
  UC-DAO-03) y fue puesta en cola en el Timelock (UC-DAO-05), un actor autorizado o un
  keeper automatizado dispara su ejecución on-chain, aplicando el cambio propuesto.
- **Actores:** *Primario:* Validador DAO o Sistema (keeper automatizado). *Secundario:*
  Smart Contract de Gobernanza, Timelock Controller.
- **Precondiciones:** la propuesta está en estado `"queued"` (UC-DAO-05 ya ejecutado) y su
  `eta` en el Timelock ya se cumplió — no basta con que el periodo de votación haya
  vencido ni con que esté `"succeeded"` sin haber pasado por la cola.
- **Poscondiciones:** *Éxito:* la acción propuesta se aplica on-chain (ej. parámetro de
  consenso actualizado en el contrato correspondiente); estado de la propuesta pasa a
  `"executed"`. *Fallo:* el estado permanece `"queued"` (no se pierde la posibilidad de
  reintentar); ningún cambio de parámetro se aplica.
- **Flujo Principal:** `POST /dao/proposals/{id}/execute` → validar `state==Queued` y `eta`
  cumplido → `Governor.execute(targets[], values[], calldatas[], descriptionHash)` → el
  contrato ejecuta el calldata contra el contrato objetivo (ej.
  `ParameterRegistry.setConsensusThreshold(newValue)`) → emite
  `ProposalExecuted(proposalId)` → actualizar estado indexado a `"executed"` y notificar a
  los Validadores de la zona afectada.
- **Excepciones:**
  - E1 La propuesta no alcanzó quórum → estado `"defeated"`; si se intenta ejecutar de
    todas formas → `409`.
  - E2 Timelock aún no cumplido → `425 Too Early`; informa el ETA restante.
  - E3 Ejecución revertida por el contrato objetivo (ej. el nuevo valor viola un límite
    hard-coded de seguridad) → `500` con el revert reason decodificado; el estado
    permanece `"queued"` para permitir corrección y re-propuesta.
  - E4 Doble ejecución (ya ejecutada previamente) → `409` idempotente; informa el
    `executed_at` original.
- **Contrato Técnico:** `Governor.execute()` · `Timelock.sol` (delay de seguridad) ·
  evento `ProposalExecuted`. Componente: DAO Governance Service + Blockchain Indexer.

### [UC-DAO-05] Poner en Cola Propuesta en Timelock (Queue)
- **Descripción:** paso intermedio en el patrón estándar Governor+Timelock: entre
  "Succeeded" (UC-DAO-03) y "Ejecutar" (UC-DAO-04) existe un tercer paso obligatorio,
  agendar la operación en el Timelock, que es quien realmente inicia la cuenta regresiva de
  seguridad (`eta`).
- **Actores:** *Primario:* Validador DAO o Sistema (keeper). *Secundario:* `Governor.sol`,
  Timelock Controller.
- **Precondiciones:** `Governor.state(proposalId) == Succeeded` (UC-DAO-03 ya ejecutado);
  la propuesta no ha sido puesta en cola previamente.
- **Poscondiciones:** *Éxito:* `Governor.queue(...)` confirmada; el Timelock registra la
  operación con `eta = now + delay`; estado indexado pasa a `"queued"`. *Fallo:* ninguna
  operación queda agendada; estado permanece `"succeeded"`.
- **Flujo Principal:** `POST /dao/proposals/{id}/queue` → validar `state==Succeeded` →
  enviar `Governor.queue(targets[], values[], calldatas[], descriptionHash)` → el Timelock
  calcula `eta` → emite `ProposalQueued(proposalId, eta)` → indexar `"queued"` + `eta`.
- **Excepciones:**
  - E1 La propuesta no está `Succeeded` (se intenta encolar prematuramente o dos veces) →
    `409`.
  - E2 Fallo de red/nodo al enviar la transacción → `503`; reintento con el mismo `nonce`;
    ninguna operación queda ambigua en el Timelock.
  - E3 Colisión de `operationId` (ya existe una operación idéntica agendada por hash) →
    `409`; informa el `eta` de la operación existente.
- **Contrato Técnico:** `Governor.queue(...)` / `Timelock.schedule(...)`. Evento:
  `ProposalQueued(proposalId, eta)`. Componente: DAO Governance Service, Timelock
  Controller.

### [UC-DAO-06] Delegar Poder de Voto
- **Descripción:** asignar el voting power (checkpoint ERC20Votes/ERC721Votes) a sí mismo o
  a un tercero — acción independiente de votar una propuesta puntual (UC-DAO-02); sin
  delegación explícita, el poder de voto no cuenta en los checkpoints.
- **Actores:** *Primario:* Validador DAO (delegante). *Secundario:* Token de gobernanza
  (`ERC20Votes`/`ERC721Votes`).
- **Precondiciones:** el delegante posee balance/reputación tokenizada > 0.
- **Poscondiciones:** *Éxito:* checkpoint actualizado on-chain a favor del `delegatee`;
  eventos `DelegateChanged`/`DelegateVotesChanged` emitidos. *Fallo:* la delegación previa
  permanece sin cambios.
- **Flujo Principal:** `POST /dao/delegate {delegatee_address}` → construir y enviar
  `token.delegate(delegatee_address)` → el contrato actualiza el checkpoint y emite los
  eventos → se indexa el nuevo delegado.
- **Excepciones:**
  - E1 `delegatee_address` inválida → `422`.
  - E2 Fallo de transacción on-chain (ej. gas insuficiente en el relayer de meta-tx) →
    `503`; la delegación anterior no se pierde.
  - E3 Delegación ejecutada durante el snapshot block de una propuesta activa → se permite
    la transacción, pero se responde `200` con una advertencia explícita: no afectará el
    voting power de propuestas cuyo snapshot ya pasó (no es un error duro).
- **Contrato Técnico:** `ERC20Votes.delegate(address)`. Eventos: `DelegateChanged`,
  `DelegateVotesChanged`. Componente: DAO Governance Service, Blockchain Indexer.

### [UC-DAO-07] Cancelar Propuesta
- **Descripción:** terminación anticipada por el proponente original o un Guardian/Admin
  de emergencia — distinta de `"defeated"` (resultado natural del conteo) y distinta de
  ejecutar.
- **Actores:** *Primario:* Validador DAO proponente, o Guardian/Administrador.
  *Secundario:* `Governor.sol`, Timelock Controller.
- **Precondiciones:** la propuesta está en `"pending"`, `"active"` o `"queued"` (nunca
  `"executed"`); si el actor no es el proponente original, posee el rol Guardian.
- **Poscondiciones:** *Éxito:* `Governor.cancel(...)` confirmada; estado pasa a
  `"canceled"`; si estaba `"queued"`, la operación agendada en el Timelock también se
  cancela. *Fallo:* la propuesta permanece en su estado previo.
- **Flujo Principal:** `DELETE /dao/proposals/{id}` → validar autoría/rol → validar que el
  estado permite cancelación → `Governor.cancel(targets[], values[], calldatas[],
  descriptionHash)` → si estaba `"queued"`, cancelar también en el Timelock → emite
  `ProposalCanceled(proposalId)` → indexar `"canceled"`.
- **Excepciones:**
  - E1 La propuesta ya fue ejecutada → `409`; no se puede cancelar lo ya ejecutado.
  - E2 El actor no es el proponente ni tiene rol Guardian → `403`.
  - E3 Fallo de transacción on-chain al cancelar → `503`; reintento; el estado nunca queda
    `"canceled"` sin confirmación on-chain.
- **Contrato Técnico:** `Governor.cancel(...)`. Evento: `ProposalCanceled(proposalId)`.
  Componente: DAO Governance Service, Timelock Controller.

---

# PARTE 3 — Trazabilidad entre las dos capas

| Especificación atómica | Caso de uso de origen en el catálogo UML |
|---|---|
| UC-AUTH-01 a 05 | UC-V4 (Registrarse/iniciar sesión) — descompuesto atómicamente; UC-AUTH-05 (Revocar Sesión) también sostiene la gestión de sesión del Administrador sobre otras cuentas |
| UC-AUTH-06 a 09 | Precondiciones y consultas de apoyo de UC-V4 y su ciclo de cuenta, no modeladas como pasos propios en el catálogo original |
| UC-ZK-01 a 03, 07, 08 | UC-I3 e hijos (Certificar solvencia vía ZK) |
| UC-ZK-04 | Reverso de UC-B2/UC-B2.1 (Verificar solvencia — lado Administradora/PropTech) |
| UC-ZK-05, 06, 09 | UC-I3.3 y UC-I3.4 (compartir y revocar prueba) |
| UC-DAO-01, 02 | UC-D2 (votar validez del dato) llevado a mecanismo on-chain formal |
| UC-DAO-03 a 07 | Extensión técnica del ciclo de vida de propuestas que sostiene UC-D2/UC-D3 y el gate económico UC-A6, no modelada explícitamente a nivel de negocio |

---

# Resumen ejecutivo final

| Capa | Elementos | Total |
|---|---|---|
| Actores | 11 primarios (tras separar los 3 actores compuestos) + 4 secundarios de sistema | 15 |
| Casos de uso UML (negocio) | 38 base + 32 anidados | 70 |
| Casos de uso atómicos (ingeniería) | 9 Auth + 9 ZK + 7 DAO | 25 |

Para reducir el catálogo UML a ~50 si el profesor lo pide, recortar en este orden: primero
los `«extend»` de flujos alternos menos críticos (UC-V4.1, UC-I2.4, UC-B2.2), después los
casos nuevos independientes de menor peso narrativo (UC-C4, UC-D4, UC-A7). La capa de
especificaciones atómicas (25) no depende de ese recorte: describe mecanismos técnicos
(Auth/ZK/DAO) que existen independientemente de cuántos actores de negocio se presenten en
el diagrama.
