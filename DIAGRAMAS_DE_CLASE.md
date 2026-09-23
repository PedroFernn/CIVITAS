# CIVITAS — Diagramas de Clase (UML)

Organizados por módulo, siguiendo la misma estructura que los objetivos
específicos (OE1–OE4) y el catálogo de casos de uso. Sintaxis Mermaid:
copia cada bloque en [mermaid.live](https://mermaid.live) o en cualquier
editor con soporte Mermaid para exportarlo como imagen/SVG; también se
puede importar a draw.io.

Convenciones: `+` público, `-` privado, `#` protegido. `<|--` generalización,
`-->` asociación (con multiplicidad), `..>` dependencia (uso/`«include»`),
`o--` agregación, `*--` composición.

---

## 0. Núcleo de Actores (generalización, transversal a todos los módulos)

```mermaid
classDiagram
    class Usuario {
        <<abstract>>
        +id: UUID
        +nombre: String
        +email: String
        +fechaRegistro: Date
        +iniciarSesion(credenciales) bool
        +cerrarSesion() void
        +actualizarPerfil(datos) void
    }
    class UsuarioVerificado {
        +nivelVerificacion: String
        +generarReportePrecioJusto(inmuebleId) ReportePrecioJusto
        +certificarSolvencia(umbral) PruebaZK
    }
    class CiudadanoAportador {
        +reputacion: int
        +nivelBadge: String
        +reportarDato(tipo, evidencia) AporteDato
        +consultarReputacion() int
    }
    class ValidadorDAO {
        +tasaAcierto: float
        +validarAporte(aporteId) void
        +participarArbitraje(disputaId) void
    }
    class ActorInstitucional {
        <<abstract>>
        +nombreInstitucion: String
        +tipoInstitucion: String
    }
    class InversionistaUrbanista {
        +suscribirseAlertas(zona, umbral) void
        +solicitarReportePredictivo(zona) ReportePredictivo
        +registrarUsoEnPolitica(evidencia) void
    }
    class ClienteInstitucionalB2B {
        +contratoId: UUID
        +credencialesAPI: String
        +verificarSolvencia(pruebaZKId) VerificacionSolvencia
        +consultarPanelVerificaciones() List
    }
    class Administrador {
        +nivelAcceso: String
        +gestionarCatalogo() void
        +moderarDisputa(disputaId) void
        +administrarCumplimiento() void
        +controlarGateEconomicoDAO() void
    }
    class Dev {
        +apiKey: String
        +consumirAPI(endpoint) Response
        +integrarZK(sandbox) void
    }

    Usuario <|-- UsuarioVerificado
    Usuario <|-- CiudadanoAportador
    Usuario <|-- ActorInstitucional
    Usuario <|-- Administrador
    Usuario <|-- Dev
    CiudadanoAportador <|-- ValidadorDAO
    ActorInstitucional <|-- InversionistaUrbanista
    ActorInstitucional <|-- ClienteInstitucionalB2B
```

*El Visitante no autenticado no se modela como clase: es la ausencia de una
instancia de `Usuario` en la sesión, no un objeto persistente.*

---

## 1. Catálogo y Motor de Anomalías — OE1 (Web 1.0 / 2.0)

```mermaid
classDiagram
    class Zona {
        +id: UUID
        +nombre: String
        +ciudad: String
        +coordenadas: GeoPoint
        +indiceAsequibilidad: float
        +fechaActualizacion: Date
        +calcularIndiceAsequibilidad() float
        +actualizarPrecios() void
    }
    class Inmueble {
        +id: UUID
        +zonaId: UUID
        +precioRenta: float
        +tipoInmueble: String
        +superficie: float
        +fechaPublicacion: Date
        +consultarAnomalia() AnomaliaPrecio
    }
    class MotorAnomalias {
        +umbralPrecision: float
        +modeloVersion: String
        +detectarAnomalia(inmueble) AnomaliaPrecio
        +calcularRangoEsperado(zona) Range
    }
    class AnomaliaPrecio {
        +id: UUID
        +inmuebleId: UUID
        +precioPedido: float
        +rangoEsperadoMin: float
        +rangoEsperadoMax: float
        +severidad: String
    }
    class ReportePrecioJusto {
        +id: UUID
        +usuarioId: UUID
        +inmuebleId: UUID
        +rangoNegociacion: Range
        +fechaGeneracion: Date
        +usadoEnNegociacion: bool
        +generar() void
        +exportarPDF() File
        +registrarUsoDeclarado(encuesta) void
    }
    class UsuarioVerificado {
        <<de módulo 0>>
    }

    Zona "1" --> "*" Inmueble : contiene
    MotorAnomalias "1" --> "*" AnomaliaPrecio : detecta
    AnomaliaPrecio "*" --> "1" Inmueble : referencia
    ReportePrecioJusto "*" --> "1" Inmueble : referencia
    ReportePrecioJusto ..> MotorAnomalias : «include» usa
    UsuarioVerificado "1" --> "*" ReportePrecioJusto : genera
```

---

## 2. Verificación de Solvencia — OE2 (Web 3.0 · ZK)

```mermaid
classDiagram
    class PruebaZK {
        +id: UUID
        +usuarioId: UUID
        +umbralTipo: String
        +resultado: bool
        +fechaGeneracion: Date
        +fechaExpiracion: Date
        +estado: String
        +generar() void
        +verificar() bool
        +revocar() void
    }
    class ConexionOpenBanking {
        +id: UUID
        +usuarioId: UUID
        +proveedor: String
        +estadoConexion: String
        +conectarCuenta() void
        +obtenerDatosFinancieros() Data
    }
    class OraculoPrivacidad {
        +proveedor: String
        +version: String
        +emitirAtestacion(umbral) PruebaZK
    }
    class VerificacionSolvencia {
        +id: UUID
        +clienteId: UUID
        +pruebaZKId: UUID
        +resultado: bool
        +fecha: Date
        +validar() bool
        +rechazar(motivo) void
    }
    class UsuarioVerificado {
        <<de módulo 0>>
    }
    class ClienteInstitucionalB2B {
        <<de módulo 0>>
    }

    PruebaZK "*" --> "1" ConexionOpenBanking : usa datos de
    PruebaZK ..> OraculoPrivacidad : emitida por
    VerificacionSolvencia "*" --> "1" PruebaZK : valida
    UsuarioVerificado "1" --> "*" PruebaZK : posee
    ClienteInstitucionalB2B "1" --> "*" VerificacionSolvencia : realiza
```

---

## 3. Red DAO e IA Predictiva — OE3 (Web 3.0 · IA + Gobernanza)

```mermaid
classDiagram
    class AporteDato {
        +id: UUID
        +aportadorId: UUID
        +tipo: String
        +contenido: String
        +evidencia: String
        +geolocalizacion: GeoPoint
        +estadoValidacion: String
        +fecha: Date
        +adjuntarEvidencia(archivo) void
    }
    class ConsensoValidacion {
        +id: UUID
        +aporteId: UUID
        +resultado: String
        +umbralAlcanzado: float
        +registrarVoto(validadorId, voto) void
        +calcularConsenso() String
    }
    class DisputaDAO {
        +id: UUID
        +aporteId: UUID
        +estado: String
        +escalarAAdministrador() void
    }
    class ModeloPredictivo {
        +version: String
        +precisionHistorica: float
        +anticiparInflexionPrecio(zona) SenalPredictiva
        +generarSenalGentrificacion(zona) SenalPredictiva
    }
    class SenalPredictiva {
        +id: UUID
        +zonaId: UUID
        +tipoSenal: String
        +probabilidad: float
        +antelacionMeses: int
        +fecha: Date
    }
    class AlianzaInstitucional {
        +id: UUID
        +institucionId: UUID
        +tipoInstitucion: String
        +fechaFirma: Date
        +estadoUso: String
        +evidenciaDocumental: String
        +registrarUsoEnPolitica(evidencia) void
        +renovar() void
    }
    class ReportePredictivo {
        +id: UUID
        +alianzaId: UUID
        +zonaId: UUID
        +contenido: String
        +fechaGeneracion: Date
        +generar() void
        +descargar() File
    }
    class CiudadanoAportador {
        <<de módulo 0>>
    }
    class ValidadorDAO {
        <<de módulo 0>>
    }
    class InversionistaUrbanista {
        <<de módulo 0>>
    }
    class Administrador {
        <<de módulo 0>>
    }
    class Zona {
        <<de módulo 1>>
    }

    CiudadanoAportador "1" --> "*" AporteDato : reporta
    AporteDato "1" --> "1" ConsensoValidacion : tiene
    ConsensoValidacion "*" --> "*" ValidadorDAO : vota
    AporteDato "1" --> "0..1" DisputaDAO : puede generar
    DisputaDAO ..> Administrador : escala a
    ModeloPredictivo "1" --> "*" SenalPredictiva : genera
    SenalPredictiva "*" --> "1" Zona : sobre
    InversionistaUrbanista "1" --> "*" AlianzaInstitucional : mantiene
    AlianzaInstitucional "1" --> "*" ReportePredictivo : recibe
    ReportePredictivo ..> ModeloPredictivo : basado en
```

---

## 4. Cumplimiento Normativo — OE4 (Marco Legal Transversal)

```mermaid
classDiagram
    class AvisoPrivacidad {
        +id: UUID
        +version: String
        +fechaPublicacion: Date
        +alcance: String
        +publicar() void
        +actualizar() void
    }
    class EvaluacionImpacto {
        +id: UUID
        +fase: String
        +fechaCompletada: Date
        +hallazgos: String
        +completar() void
        +actualizar() void
    }
    class DictamenLegal {
        +id: UUID
        +tipo: String
        +despacho: String
        +fecha: Date
        +conclusion: String
    }
    class CartaNoObjecion {
        +id: UUID
        +autoridad: String
        +fecha: Date
        +alcance: String
        +estado: String
    }
    class AuditoriaZK {
        +id: UUID
        +auditor: String
        +fecha: Date
        +hallazgosCriticos: int
        +estado: String
        +programar() void
        +cerrarHallazgo(id) void
    }
    class GateEconomicoDAO {
        +id: UUID
        +estado: String
        +opinionLegalId: UUID
        +fechaRevision: Date
        +evaluar() bool
        +habilitar() void
    }
    class Administrador {
        <<de módulo 0>>
    }

    Administrador "1" --> "*" AvisoPrivacidad : administra
    Administrador "1" --> "*" EvaluacionImpacto : administra
    Administrador "1" --> "*" DictamenLegal : registra
    Administrador "1" --> "*" CartaNoObjecion : gestiona
    Administrador "1" --> "*" AuditoriaZK : supervisa
    Administrador "1" --> "1" GateEconomicoDAO : controla
    GateEconomicoDAO ..> DictamenLegal : requiere
```

---

## Nota sobre alcance

Estos diagramas son de **diseño conceptual** (nivel de análisis): atributos y
firmas de método bastan para justificar responsabilidades y relaciones, no
para compilar directamente. Si tu profesor pide un diagrama único integrado
en vez de por módulo, la clase `Usuario` (módulo 0) es el punto de fusión:
todas las asociaciones externas de los módulos 1–4 cuelgan de sus
subclases.

[[CIVITAS]]