# CIVITAS — Diagramas de Paquetes (UML)

Organizados con la misma estructura modular que los diagramas de clase y el UML
general: **Núcleo de Actores (módulo 0)** + **OE1–OE4** + **Integración**.
Sintaxis PlantUML: copia cada bloque en [plantuml.com/plantuml](https://www.plantuml.com/plantuml)
(o cualquier editor con soporte PlantUML) para exportarlo como PNG/SVG.

Convenciones: `<<import>>` = el paquete usa clases públicas del otro (dependencia
fuerte, tomada de las asociaciones de los diagramas de clase); `<<access>>` =
dependencia conceptual o de servicio, sin importar clases concretas. La flecha
apunta del paquete cliente al proveedor.

---

## 1. Vista general — paquetes y dependencias

```plantuml
@startuml CIVITAS_Paquetes_General
skinparam packageStyle folder
skinparam linetype polyline
skinparam shadowing false
skinparam nodesep 60
skinparam ranksep 80
skinparam ArrowColor #333333
skinparam PackageBorderColor #555555
skinparam PackageBackgroundColor #F7F7F7

package "Integración" as INT <<facade>> {
}
package "Cumplimiento Normativo (OE4)" as OE4 {
}
package "Red DAO e IA Predictiva (OE3)" as OE3 {
}
package "Verificación de Solvencia ZK (OE2)" as OE2 {
}
package "Catálogo y Motor de Anomalías (OE1)" as OE1 {
}
package "Núcleo de Actores (módulo 0)" as NUC {
}

OE1 ..> NUC : <<import>>\nUsuarioVerificado
OE2 ..> NUC : <<import>>\nUsuarioVerificado,\nClienteInstitucionalB2B
OE3 ..> NUC : <<import>>\nCiudadanoAportador, ValidadorDAO,\nInversionistaUrbanista, Administrador
OE4 ..> NUC : <<import>>\nAdministrador
OE3 ..> OE1 : <<import>>\nZona

OE4 ..> OE2 : <<access>>\nauditoría de circuitos ZK
OE4 ..> OE3 : <<access>>\ngate económico DAO

INT ..> NUC : <<access>>\nDev
INT ..> OE1 : <<access>>\ncatálogo e índices
INT ..> OE2 : <<access>>\nSDK ZK / sandbox
@enduml
```

---

## 2. Vista de contenido — clases por paquete

```plantuml
@startuml CIVITAS_Paquetes_Detalle
skinparam packageStyle folder
skinparam linetype polyline
skinparam shadowing false
skinparam nodesep 30
skinparam ranksep 60
skinparam ArrowColor #333333
skinparam PackageBorderColor #555555
skinparam PackageBackgroundColor #F7F7F7
skinparam ClassBackgroundColor #FFFFFF
skinparam ClassBorderColor #666666
hide members
hide circle

package "Cumplimiento Normativo (OE4)" as OE4 {
  class AvisoPrivacidad
  class EvaluacionImpacto
  class DictamenLegal
  class CartaNoObjecion
  class AuditoriaZK
  class GateEconomicoDAO
}

package "Red DAO e IA Predictiva (OE3)" as OE3 {
  class AporteDato
  class ConsensoValidacion
  class DisputaDAO
  class ModeloPredictivo
  class SenalPredictiva
  class AlianzaInstitucional
  class ReportePredictivo
}

package "Verificación de Solvencia ZK (OE2)" as OE2 {
  class PruebaZK
  class ConexionOpenBanking
  class OraculoPrivacidad
  class VerificacionSolvencia
}

package "Catálogo y Motor de Anomalías (OE1)" as OE1 {
  class Zona
  class Inmueble
  class MotorAnomalias
  class AnomaliaPrecio
  class ReportePrecioJusto
}

package "Núcleo de Actores (módulo 0)" as NUC {
  abstract class Usuario
  class UsuarioVerificado
  class CiudadanoAportador
  class ValidadorDAO
  abstract class ActorInstitucional
  class InversionistaUrbanista
  class ClienteInstitucionalB2B
  class Administrador
  class Dev

  Usuario <|-- UsuarioVerificado
  Usuario <|-- CiudadanoAportador
  Usuario <|-- ActorInstitucional
  Usuario <|-- Administrador
  Usuario <|-- Dev
  CiudadanoAportador <|-- ValidadorDAO
  ActorInstitucional <|-- InversionistaUrbanista
  ActorInstitucional <|-- ClienteInstitucionalB2B
}

OE1 ..> NUC : <<import>>
OE2 ..> NUC : <<import>>
OE3 ..> NUC : <<import>>
OE4 ..> NUC : <<import>>
OE3 ..> OE1 : <<import>>
OE4 ..> OE2 : <<access>>
OE4 ..> OE3 : <<access>>
@enduml
```

*Integración no tiene clases propias en los diagramas de clase (`Dev` vive en el
Núcleo), por eso solo aparece en la vista general.*

---

## 3. Alternativa en Mermaid (vista general)

Para [mermaid.live](https://mermaid.live), por si no usas PlantUML.

```mermaid
flowchart BT
    NUC["Núcleo de Actores (módulo 0)"]
    OE1["Catálogo y Motor de Anomalías (OE1)"]
    OE2["Verificación de Solvencia ZK (OE2)"]
    OE3["Red DAO e IA Predictiva (OE3)"]
    OE4["Cumplimiento Normativo (OE4)"]
    INT["Integración «facade»"]

    OE1 -.->|"«import» UsuarioVerificado"| NUC
    OE2 -.->|"«import» UsuarioVerificado, ClienteInstitucionalB2B"| NUC
    OE3 -.->|"«import» CiudadanoAportador, ValidadorDAO, InversionistaUrbanista, Administrador"| NUC
    OE4 -.->|"«import» Administrador"| NUC
    OE3 -.->|"«import» Zona"| OE1
    OE4 -.->|"«access» auditoría de circuitos ZK"| OE2
    OE4 -.->|"«access» gate económico DAO"| OE3
    INT -.->|"«access» Dev"| NUC
    INT -.->|"«access» catálogo e índices"| OE1
    INT -.->|"«access» SDK ZK / sandbox"| OE2
```

---

## Notas de diseño

- **Origen de las dependencias `<<import>>`:** las clases marcadas `<<de módulo 0>>` en cada
  diagrama de clase y la asociación `SenalPredictiva → Zona` (OE3 → OE1).
- **Origen de las dos `<<access>>` de OE4:** vienen del catálogo de casos de uso (el
  Administrador audita los circuitos ZK y controla el gate económico de la DAO), no de los
  diagramas de clase; si tu profesor pide trazabilidad estricta con las clases, se pueden quitar.
- **Ciclo Núcleo ↔ módulos:** los métodos de los actores devuelven tipos de los módulos
  (`generarReportePrecioJusto → ReportePrecioJusto`, `certificarSolvencia → PruebaZK`,
  `reportarDato → AporteDato`, etc.), así que en rigor el Núcleo también depende de OE1–OE3.
  Aquí se modeló solo módulo → Núcleo (como en los diagramas de clase). Si te lo señalan,
  la salida estándar es mover esas firmas a los módulos o introducir interfaces en el Núcleo.

[[CIVITAS]]
