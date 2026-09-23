# Arquitectura Unificada del Sistema CIVITAS

## 1. Visión General de la Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENTE / FRONTEND                                    │
│ Next.js App Router (SSG / ISR / SSR / CSR) + MapLibre / Deck.gl + TanStack Query + Tailwind │
└───────────────────────────┬─────────────────────────────────────────────────────────────┘
                            │ HTTP / REST / WebSockets
                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CAPA DE API Y AUTH                                    │
│ NestJS API Gateway + Supabase Auth & Row Level Security (RLS) + Middleware de Sesión    │
└───────────────────────┬───────────────────┬──────────────────────────┬──────────────────┘
                        │                   │                          │
                        ▼                   ▼                          ▼
┌───────────────────────────────┐ ┌───────────────────┐ ┌────────────────────────────────┐
│   POSTGRESQL + POSTGIS        │ │   REDIS + BULLMQ  │ │  MICROSERVICIO PYTHON (FASTAPI)│
│  (Persistencia Transaccional  │ │  (Colas & Jobs    │ │  (GeoPandas + Scikit-Learn     │
│   y Datos Geoespaciales)      │ │   Asíncronos)     │ │   Motor de Anomalías/ML)       │
└───────────────────────────────┘ └───────────────────┘ └────────────────────────────────┘
```

El sistema utiliza una arquitectura distribuida modular:
* **Frontend**: Next.js App Router para una combinación optimizada de SSG, ISR, SSR y CSR.
* **API Principal & Auth**: Supabase y NestJS para gestión de API, autenticación y políticas de seguridad a nivel de base de datos (RLS).
* **Base de Datos**: PostgreSQL enriquecido con la extensión PostGIS para cálculos geoespaciales nativos.
* **Microservicio Asíncrono de ML**: Servicio interno en FastAPI (Python) desconectado del cliente directo para el cálculo de rangos e índices.
* **Procesamiento de Fondo**: Redis con BullMQ/Celery para la gestión de colas de tareas pesadas (PDFs, notificaciones, ingestas).

---

## 2. Capa Frontend: Renderizado, Estructura de Rutas y Mapas

### 2.1 Estrategia de Renderizado por Pantalla
Estrategia para equilibrar rendimiento SEO e interactividad:

| Pantalla | Estrategia | Motivo |
|---|---|---|
| **P-01 Inicio** | SSG + ISR (revalidar cada N horas) | Contenido cambia poco, necesita SEO |
| **P-02 Explorador** | SSR inicial + CSR para filtros | SEO en la carga, pero filtros/mapa son interactivos |
| **P-03 Ficha de colonia** | SSG con `generateStaticParams` por colonia + ISR | Es la página que más tráfico orgánico recibe |
| **P-04, P-11** | CSR (bajo `app/(auth)/`) | Formularios con estado, sin valor SEO |
| **P-05 a P-10, P-12 a P-15** | CSR bajo `app/(privado)/` y `app/admin/` con middleware | Requieren cuenta o rol específico, sin necesidad de indexar |
| **P-16** | Estático, sin ruta real | Documentación interna |

**Revalidación bajo demanda (on-demand ISR):** P-01 y P-03 usan SSG + ISR pasivo (revalida
cada N horas), pero cuando el job `recalcular-indices-colonia` o `ingesta-fuentes-abiertas`
(sección 4.2) actualizan `indice_asequibilidad`/`inflacion_local_proyectada`, esos cambios no
deberían esperar al ciclo de revalidación pasivo. Al terminar con éxito, el job llama a un
route handler de Next.js que invalida la ruta afectada al instante:

```typescript
// Disparado por NestJS al finalizar recalcular-indices-colonia / ingesta-fuentes-abiertas
await fetch(
  `${NEXT_APP_URL}/api/revalidate?secret=${REVALIDATE_TOKEN}&path=/colonias/${ciudad}/${colonia}`
);
```

Esto mantiene el beneficio de SEO/rendimiento del SSG sin dejar datos desactualizados en
caché mientras se espera la próxima revalidación pasiva.

### 2.2 Estructura del Árbol de Directorios (Next.js App Router)
Organización de rutas y agrupamiento por permisos:

```
app/
├─ (publico)/
│  ├─ page.tsx                    # P-01
│  ├─ colonias/page.tsx           # P-02
│  └─ colonias/[ciudad]/[colonia]/page.tsx  # P-03, SSG
├─ (auth)/
│  ├─ crear-cuenta/page.tsx       # P-04
│  └─ entrar/page.tsx             # P-11
├─ (privado)/
│  ├─ inmuebles/[id]/page.tsx     # P-05
│  ├─ reportes/[folio]/page.tsx   # P-06
│  ├─ comparar/page.tsx           # P-07
│  ├─ mapa/page.tsx               # P-08
│  ├─ mi-cuenta/
│  │  ├─ alertas/page.tsx         # P-09
│  │  └─ perfil/page.tsx          # P-12
│  ├─ notificaciones/page.tsx     # P-13
│  ├─ soporte/page.tsx            # P-14
│  └─ feedback/page.tsx           # P-15
├─ admin/
│  └─ catalogo/page.tsx           # P-10
└─ middleware.ts                  # Intercepta P-12/P-05/etc. sin sesión y redirige a P-11
```

El `middleware.ts` intercepta peticiones sin sesión activa y las redirige a P-11, replicando en el cliente el control de acceso que RLS aplica en la base de datos.

### 2.3 Componentes de Mapas (MapLibre + Deck.gl)

**Nota de hidratación (App Router):** `MapLibre` y `Deck.gl` dependen de WebGL y de `window`,
así que no pueden ejecutarse en un Server Component. Todo componente que los use —incluido
el minimapa de P-03, que vive dentro de una ruta SSG/ISR— debe llevar `"use client"` explícito
y cargarse con `dynamic(() => import('./Mapa'), { ssr: false })`, o Next.js fallará al
hidratar la página en el servidor.

#### P-01 / P-02 — Mapa de índice agregado (ligero)
Enviar el polígono completo de cada colonia como GeoJSON en `GET /colonias` no escala: una
ciudad con miles de polígonos genera un payload de varios MB que degrada la memoria del
navegador y congela dispositivos móviles en CSR. En vez de eso, las colonias se sirven como
**Vector Tiles (MVT)** vía `MVTLayer`, que solo pide los tiles visibles en pantalla por
coordenada `z/x/y`:

```tsx
<Map mapStyle={styleUrl} initialViewState={bounds}>
  <MVTLayer
    id="colonias-agregado"
    data={`${API_URL}/tiles/colonias/{z}/{x}/{y}.mvt`}
    getFillColor={f => colorPorIndice(f.properties.indice_asequibilidad)}
    pickable
  />
</Map>
```

El backend genera cada tile con la función nativa `ST_AsMVT()` de PostGIS (ver 3.4), sin
necesidad de precalcular ni enviar la geometría completa por HTTP.

#### P-08 — Mapa de calor (una sola capa activa a la vez)
Por la misma razón que P-02, los puntos de calor tampoco se envían como JSON crudo cuando el
volumen es alto: `HeatmapLayer` de Deck.gl puede alimentarse de un `MVTLayer` en modo
`binary: true`, manteniendo el estado en un store global para alternar capas y evitar
sobreposición ilegible:

```tsx
const capa = useMapaCalorStore(s => s.capaActiva); // 'anomalias' | 'indice' | 'inflacion'

<MVTLayer
  id={`heatmap-${capa}`}
  data={`${API_URL}/tiles/mapa-calor/${capa}/{z}/{x}/{y}.mvt`}
  renderSubLayers={props => new HeatmapLayer({
    ...props,
    getWeight: d => d.properties.valor,
    radiusPixels: 40,
  })}
/>
```

#### P-03 — Minimapa de límites
Un componente `<Map>` simple de MapLibre renderiza únicamente el polígono de la colonia, omitiendo Deck.gl para no penalizar el peso del bundle en una página estática (SSG) de alto tráfico SEO.

### 2.4 TanStack Query: Fetching por Viewport
El mapa en sí ya no depende de esto — las capas se piden como tiles MVT por `z/x/y` (ver 2.3
y 3.4), cacheadas por el propio navegador/CDN. Este patrón de bbox sigue existiendo para la
**lista/sidebar** de resultados (P-02) que acompaña al mapa, para evitar peticiones duplicadas
al desplazarse o hacer zoom:

```tsx
const bbox = useDebouncedBoundingBox(mapRef); // debounce ~300ms al mover el mapa

const { data: colonias } = useQuery({
  queryKey: ['colonias', bbox, filtros],
  queryFn: () => fetchColonias({ bbox, ...filtros }),
  staleTime: 60_000, // el índice de asequibilidad no cambia minuto a minuto
  placeholderData: keepPreviousData, // evita parpadeo al mover el mapa
});
```

### 2.5 Componentes Reutilizables (Tailwind + Shadcn/ui)

| Componente | Dónde se usa | Nota |
|---|---|---|
| `<DataTable>` (shadcn) | P-03 (indicadores), P-07 (comparador), P-10 (catálogo), P-14 (tickets) | Una sola implementación con columnas configurables |
| `<Badge severidad>` | P-05 (anomalía alta/media/baja), P-13 (tipo de notificación) | Variantes de color por `severidad_anomalia` |
| Bloque condicional `<Extend>` | Ramas "extend" (KYC en P-04, recuperar contraseña en P-11, encuesta en P-06) | Un wrapper `<Extend>` con `border-dashed` colapsable |
| `<EmptyState>` | P-09 ("Aún no tienes alertas"), P-14 ("sin tickets abiertos") | Un solo componente reutilizado |

---

## 3. Capa Backend: Persistencia, Seguridad y API

### 3.1 Modelo de Datos Relacional y Geoespacial (PostgreSQL + PostGIS)

**Gestión de conexiones (connection pooling):** NestJS, los workers de BullMQ y el
microservicio de FastAPI (que ahora se conecta directo a Postgres — ver 4.1) son tres
clientes independientes hacia la misma base. Ninguno se conecta directo al puerto de
Postgres: todos pasan por **PgBouncer / Supabase Connection Pooler en modo Transaction**,
para no saturar `max_connections` cuando los tres servicios escalen horizontalmente al
mismo tiempo.

```sql
-- Usuarios y roles (RBAC)
CREATE TYPE rol_usuario AS ENUM ('visitante', 'usuario_verificado', 'administrador');
CREATE TYPE tipo_uso AS ENUM ('inquilino', 'comprador', 'otro');

CREATE TABLE usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- FK real a auth.users; auth.uid() no es válido como DEFAULT en migraciones
  rol rol_usuario NOT NULL DEFAULT 'usuario_verificado',
  tipo_uso tipo_uso,
  nombre TEXT, telefono TEXT,
  identidad_verificada BOOLEAN DEFAULT FALSE,
  kyc_status TEXT CHECK (kyc_status IN ('no_iniciado','en_revision','aprobado','rechazado')),
  kyc_documento_url TEXT, kyc_selfie_url TEXT, -- en bucket privado
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Zonas / colonias (P-01, P-02, P-03)
CREATE TABLE colonias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL, ciudad TEXT NOT NULL,
  geom GEOMETRY(POLYGON, 4326) NOT NULL, -- límites reales, para ST_Contains
  renta_mediana NUMERIC, ingreso_mediano NUMERIC,
  indice_asequibilidad NUMERIC GENERATED ALWAYS AS (renta_mediana / NULLIF(ingreso_mediano,0)) STORED,
  cobertura_transporte NUMERIC, equipamiento_urbano NUMERIC, seguridad_score NUMERIC,
  inflacion_local_proyectada NUMERIC, -- capa predictiva P-08
  completitud NUMERIC, estado TEXT CHECK (estado IN ('borrador','revision','publicada')),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_colonias_geom ON colonias USING GIST(geom);
-- Los filtros de P-01/P-02 casi nunca son solo espaciales: combinan ciudad + estado
-- publicado. Un índice B-Tree parcial cubre ese patrón sin tocar el GiST de geom.
CREATE INDEX idx_colonias_publicadas ON colonias (ciudad, estado)
  WHERE estado = 'publicada';

-- Histórico de indicadores por colonia (gráfica P-03, línea de tiempo P-08)
CREATE TABLE colonias_historico (
  id BIGSERIAL PRIMARY KEY,
  colonia_id UUID REFERENCES colonias(id),
  fecha DATE NOT NULL,
  renta_mediana NUMERIC, indice_asequibilidad NUMERIC, inflacion_proyectada NUMERIC
);

-- Inmuebles (P-05)
CREATE TABLE inmuebles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colonia_id UUID REFERENCES colonias(id),
  ubicacion GEOMETRY(POINT, 4326),
  precio_pedido NUMERIC, superficie NUMERIC, tipo TEXT,
  rango_esperado_min NUMERIC, rango_esperado_max NUMERIC, -- lo llena el microservicio
  severidad_anomalia TEXT CHECK (severidad_anomalia IN ('ninguna','baja','media','alta')),
  precision_modelo NUMERIC, -- si < umbral (0.85), no se muestra el bloque (anotación P-05)
  publicado_en TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_inmuebles_geom ON inmuebles USING GIST(ubicacion);
-- Un GiST puro sobre ubicacion obliga a Postgres a escanear y filtrar después.
-- Índice parcial para el mapa de calor de anomalías (P-08, capa 'anomalias'):
-- solo indexa inmuebles que ya tienen severidad calculada.
CREATE INDEX idx_inmuebles_geo_activos ON inmuebles USING GIST(ubicacion)
  WHERE severidad_anomalia IS NOT NULL;
-- Índice compuesto para los filtros multicriterio de P-02/sidebar (colonia + tipo + precio).
CREATE INDEX idx_inmuebles_colonia_tipo_precio ON inmuebles (colonia_id, tipo, precio_pedido);

-- Reporte de Precio Justo (P-06)
CREATE TABLE reportes_precio_justo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT UNIQUE NOT NULL,
  inmueble_id UUID REFERENCES inmuebles(id),
  usuario_id UUID REFERENCES usuarios(id),
  precio_min NUMERIC, precio_max NUMERIC,
  rango_negociacion_objetivo NUMERIC, rango_negociacion_aceptable NUMERIC, rango_negociacion_limite NUMERIC,
  pdf_url TEXT, qr_sello TEXT,
  vigencia_hasta TIMESTAMPTZ, generado_en TIMESTAMPTZ DEFAULT now(),
  -- UC-I2.4: encuesta de uso
  encuesta_uso_declarado BOOLEAN, precio_cierre NUMERIC
);

-- Favoritos y alertas (P-09)
-- Nota: COALESCE() no es válido dentro de una PRIMARY KEY en PostgreSQL y las
-- columnas de una PK deben ser NOT NULL. Se usa un UUID propio como PK y un
-- CHECK que obliga a que cada fila sea favorito de inmueble O de colonia (no ambos,
-- no ninguno), más índices UNIQUE parciales para evitar duplicados por usuario.
CREATE TABLE favoritos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) NOT NULL,
  inmueble_id UUID REFERENCES inmuebles(id),
  colonia_id UUID REFERENCES colonias(id),
  creado_en TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT favoritos_un_solo_tipo CHECK (
    (inmueble_id IS NOT NULL AND colonia_id IS NULL) OR
    (inmueble_id IS NULL AND colonia_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX idx_favoritos_usuario_inmueble ON favoritos(usuario_id, inmueble_id) WHERE inmueble_id IS NOT NULL;
CREATE UNIQUE INDEX idx_favoritos_usuario_colonia ON favoritos(usuario_id, colonia_id) WHERE colonia_id IS NOT NULL;

CREATE TABLE alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id),
  colonia_id UUID REFERENCES colonias(id), inmueble_id UUID REFERENCES inmuebles(id),
  condicion TEXT, umbral NUMERIC, canal TEXT[] DEFAULT '{correo}',
  activa BOOLEAN DEFAULT TRUE
);

CREATE TABLE alertas_historial (
  id BIGSERIAL PRIMARY KEY, alerta_id UUID REFERENCES alertas(id),
  que_cambio TEXT, leido BOOLEAN DEFAULT FALSE, creado_en TIMESTAMPTZ DEFAULT now()
);

-- Notificaciones del sistema (P-13)
CREATE TABLE notificaciones (
  id BIGSERIAL PRIMARY KEY, usuario_id UUID REFERENCES usuarios(id),
  tipo TEXT CHECK (tipo IN ('cuenta','seguridad','producto','cumplimiento')),
  mensaje TEXT, leido BOOLEAN DEFAULT FALSE, creado_en TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE preferencias_notificacion (
  usuario_id UUID REFERENCES usuarios(id), categoria TEXT,
  correo BOOLEAN DEFAULT TRUE, en_app BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (usuario_id, categoria)
);

-- Soporte (P-14) y feedback (P-15)
CREATE TABLE tickets_soporte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), folio TEXT UNIQUE,
  usuario_id UUID REFERENCES usuarios(id),
  asunto TEXT, categoria TEXT, prioridad TEXT,
  descripcion TEXT, captura_url TEXT,
  estado TEXT CHECK (estado IN ('en_revision','resuelto')) DEFAULT 'en_revision',
  creado_en TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE feedback_producto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), folio TEXT UNIQUE,
  usuario_id UUID REFERENCES usuarios(id),
  calificacion SMALLINT CHECK (calificacion BETWEEN 1 AND 5),
  tipo TEXT CHECK (tipo IN ('error','idea','dato_incorrecto','otro')),
  descripcion TEXT, pantalla_origen TEXT,
  estado TEXT CHECK (estado IN ('recibido','triaje','aplicado')) DEFAULT 'recibido',
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Fuentes de datos abiertas y catálogo admin (P-10)
CREATE TABLE fuentes_datos (
  id SERIAL PRIMARY KEY, nombre TEXT, estado TEXT CHECK (estado IN ('ok','retraso','error')),
  ultima_ingesta TIMESTAMPTZ
);
CREATE TABLE cumplimiento_normativo (
  id SERIAL PRIMARY KEY, item TEXT, estado TEXT, fecha TIMESTAMPTZ
);
```

### 3.2 Seguridad y Control de Acceso (Supabase RLS)

```sql
ALTER TABLE inmuebles ENABLE ROW LEVEL SECURITY;

-- Cualquiera ve la fila (colonia, precio) — la RLS aquí es a nivel de FILA, no de columna.
-- El ocultamiento de severidad_anomalia/rango_esperado_* para no verificados NO se hace
-- en SQL (ver nota abajo): a nivel de fila, cualquier usuario puede leer el inmueble.
CREATE POLICY inmuebles_publico ON inmuebles FOR SELECT
  USING (true);

-- Reportes de precio justo: cada quien ve solo los suyos
CREATE POLICY reportes_propios ON reportes_precio_justo FOR SELECT
  USING (usuario_id = auth.uid());

-- Panel admin: solo rol administrador
CREATE POLICY solo_admin_fuentes ON fuentes_datos FOR ALL
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'administrador'));
```

**Ocultamiento de columnas de anomalía: en NestJS, no en SQL.** La versión anterior de este
documento resolvía el ocultamiento de `severidad_anomalia`/`rango_esperado_*` con una vista
(`inmuebles_con_anomalia`) que hacía `LEFT JOIN usuarios ON u.id = auth.uid()` — evaluado por
Postgres en cada fila devuelta, lo que degrada el plan de ejecución con miles de inmuebles.
Como NestJS ya valida el JWT del usuario en su middleware/Guard (sección anterior sobre
propagación del JWT), esa misma información ya está disponible en memoria del request, así
que el ocultamiento se hace en el **DTO Mapper/Serializer** de NestJS antes de responder,
sin JOIN ni vista adicionales:

```typescript
// InmuebleDto se arma desde el resultado plano de `SELECT * FROM inmuebles WHERE id = $1`
if (!request.user?.identidad_verificada) {
  delete inmuebleDto.severidad_anomalia;
  delete inmuebleDto.rango_esperado_min;
  delete inmuebleDto.rango_esperado_max;
  delete inmuebleDto.precision_modelo;
}
```

Esto también simplifica la tabla `inmuebles`: ya no se necesita `CREATE VIEW
inmuebles_con_anomalia`, y el endpoint de la sección 3.3 consulta `inmuebles` directamente.

**Estrategia de integración NestJS ↔ Supabase (obligatoria, no opcional):** si NestJS se
conecta a PostgreSQL con una cadena de conexión estándar (Prisma/TypeORM/cliente `pg`)
usando el rol `service_role`, **todas las políticas RLS anteriores se saltan de forma
silenciosa** — el gateway vería filas y columnas que un usuario no verificado nunca
debería ver. Se define explícitamente una sola estrategia:

* **NestJS propaga el JWT del usuario** en cada request hacia Supabase (`supabase.auth.setSession(jwt)`
  o el cliente `postgrest-js` con el header `Authorization: Bearer <jwt>`), de modo que
  Postgres evalúa `auth.uid()` con la identidad real del solicitante y las políticas RLS
  arriba se aplican tal cual están escritas. Esta es la opción por defecto para este
  proyecto, porque ya se depende de RLS para P-05, P-06 y el panel admin.
* Solo las rutas verdaderamente internas (el worker que actualiza `inmuebles.rango_esperado_*`
  desde el microservicio de ML, los cron de `colonias_historico`) usan `service_role`
  directamente, y en esos casos el control de acceso lo garantiza la topología de red
  (el microservicio y los workers no están expuestos al cliente), no RLS.

### 3.3 Endpoints Principales por Pantalla

| Pantalla | Endpoint | Servicio |
|---|---|---|
| P-01/P-02 | `GET /colonias?ciudad&renta_min&renta_max&equipamiento[]` (lista/sidebar) + `GET /tiles/colonias/{z}/{x}/{y}.mvt` (capa del mapa) | NestJS + PostGIS (`ST_Within` / `ST_AsMVT`) |
| P-03 | `GET /colonias/:id`, `GET /colonias/:id/historico`, `GET /colonias/:id/inmuebles` | NestJS |
| P-04 | `POST /auth/registro`, `POST /kyc/presigned-url` (ver 3.4) | Supabase Auth + Storage bucket privado |
| P-05 | `GET /inmuebles/:id` (consulta directa a `inmuebles`; columnas de anomalía se quitan en el Serializer de NestJS si no verificado — ver 3.2) | NestJS + caché del resultado del microservicio |
| P-06 | `POST /reportes`, `GET /reportes/:folio`, `GET /reportes/:folio/pdf` | NestJS → encola job en BullMQ |
| P-07 | `POST /comparador` (hasta 4 ids) | NestJS |
| P-08 | `GET /mapa/calor?capa=anomalias\|indice\|inflacion&fecha=` (lista/leyenda) + `GET /tiles/mapa-calor/{capa}/{z}/{x}/{y}.mvt` (capa del mapa) | NestJS + PostGIS agregando por polígono |
| P-09 | `POST/GET/DELETE /alertas`, `GET /favoritos` | NestJS |
| P-10 | `GET/PATCH /admin/colonias`, `GET /admin/fuentes-datos`, `GET /admin/salud` | NestJS, rol admin |
| P-11/P-12 | `POST /auth/login`, `GET /perfil`, `PATCH /perfil` | Supabase Auth |
| P-13 | `GET /notificaciones`, `PATCH /preferencias-notificacion` | NestJS |
| P-14 | `GET /faq`, `POST /tickets` | NestJS |
| P-15 | `POST /feedback` | NestJS |

### 3.4 Entrega Geoespacial (Vector Tiles) y Carga de Archivos KYC

**Vector Tiles en vez de GeoJSON crudo (P-02, P-08):** un `GET /colonias` que devuelve el
arreglo completo de polígonos escala mal — miles de features en una ciudad grande significan
varios MB de JSON, lo que degrada la memoria del navegador y congela el mapa en móvil. En vez
de eso, NestJS expone endpoints de tiles que generan MVT en el propio Postgres:

```sql
-- Genera un tile MVT para z/x/y, agregando solo las colonias que caen en ese tile
SELECT ST_AsMVT(tile, 'colonias', 4096, 'geom') AS mvt
FROM (
  SELECT
    id, nombre, indice_asequibilidad,
    ST_AsMVTGeom(geom, ST_TileEnvelope($1, $2, $3), 4096, 64, true) AS geom
  FROM colonias
  WHERE geom && ST_TileEnvelope($1, $2, $3)
) AS tile;
```

`GET /tiles/colonias/:z/:x/:y.mvt` y `GET /tiles/mapa-calor/:capa/:z/:x/:y.mvt` ejecutan esta
consulta parametrizada y devuelven el binario con `Content-Type: application/x-protobuf`. Si
el volumen de tiles crece mucho, esta responsabilidad se puede delegar a un servidor dedicado
(`martin` o `pg_tileserv`) en vez de generarlos dentro de NestJS, sin cambiar el contrato con
el frontend (MapLibre/Deck.gl consumen MVT por `z/x/y` en ambos casos).

**Presigned URLs para archivos de KYC (P-04):** subir `documento`/`selfie` como
`multipart/form-data` directo a NestJS obliga al API Gateway a cargar el archivo binario en
memoria del proceso Node antes de reenviarlo a storage — costoso e innecesario. El patrón
correcto:

1. El cliente pide una URL firmada: `POST /kyc/presigned-url { tipo: 'documento' | 'selfie' }`.
2. NestJS valida la sesión y genera una URL temporal de Supabase Storage con permiso de
   escritura **solo** para el `usuario_id` autenticado (`kyc/{usuario_id}/{tipo}.{ext}`).
3. El cliente sube el archivo directamente al bucket privado con esa URL — el binario nunca
   pasa por NestJS — y al terminar notifica `POST /kyc/documento-subido { tipo }` para que
   NestJS actualice `kyc_documento_url`/`kyc_selfie_url` y dispare el flujo de revisión.

### 3.5 Rate Limiting y Caché para Consultas Geoespaciales

Las consultas PostGIS (`ST_Within`, `ST_Contains`, agregaciones para el mapa de calor) son
costosas en CPU, y un usuario haciendo zoom/pan rápido en P-02 o P-08 puede disparar decenas
de peticiones por segundo y saturar el pool de conexiones de PostgreSQL:

* **Rate limiting**: `@nestjs/throttler` en `/colonias`, `/mapa/calor` y los endpoints de
  tiles de 3.4 (límite razonable por IP/usuario, ej. 30 req/10s).
* **Caché de bbox**: redondear el `bbox` recibido a N decimales (agrupa peticiones cercanas
  en la misma clave) y cachear la respuesta en Redis con TTL corto (ej. 30–60s) — el índice
  de asequibilidad y las capas del mapa de calor no cambian minuto a minuto.
* Los tiles MVT de 3.4 son, además, cacheables por CDN/navegador de forma trivial por ser
  URLs estables (`z/x/y`), lo que reduce aún más la carga real sobre PostGIS.

---

## 4. Microservicio ML y Procesamiento Asíncrono

### 4.1 Microservicio de Anomalías (FastAPI + Python)
No expuesto al público — vive detrás de la API principal, y se invoca **siempre de forma
asíncrona vía cola**, nunca de forma síncrona dentro de una petición HTTP de lectura del
frontend (una petición de lectura no puede esperar a GeoPandas + Scikit-learn):
* **Acceso a datos:** FastAPI **no recibe el conjunto de comparables por HTTP** — un payload
  con todos los inmuebles cercanos saturaría ancho de banda y memoria en zonas de alta
  densidad. En vez de eso, el microservicio se conecta **directamente a PostgreSQL en modo
  solo lectura** (idealmente contra una réplica de lectura) usando `asyncpg` + `GeoAlchemy2`,
  y ejecuta ahí mismo los queries espaciales (`ST_DWithin`) contra `inmuebles`/`colonias`. El
  worker de BullMQ solo le pasa el `inmueble_id` (o `colonia_id`) a procesar; FastAPI resuelve
  el resto con su propia conexión.
* **`POST /interno/calcular-rango-esperado`**: recibe `{ inmueble_id }`, consulta comparables por colonia (`ST_DWithin`) directamente en Postgres, ejecuta regresión y detección de outliers (IsolationForest) con Scikit-learn, y devuelve `{ rango_min, rango_max, severidad, precision_modelo }`. Este endpoint solo lo llama el **worker** del job `calcular-anomalia` (ver 4.2) — nunca el hilo de request de NestJS —, y el worker actualiza `inmuebles.*` solo si `precision_modelo >= 0.85`.
* **`POST /interno/recalcular-indices-colonia`**: Job periódico (cron) que recalcula `indice_asequibilidad` e `inflacion_local_proyectada`, escribiendo en `colonias_historico` para alimentar P-03 y P-08.

### 4.2 Colas (Redis + BullMQ/Celery)

**Memoria y persistencia de Redis:** Redis aquí cumple dos roles con necesidades opuestas, así
que se separan en dos instancias (o dos bases lógicas dentro del mismo contenedor/instancia)
en vez de compartir una sola configuración:

* **Redis Cache/Pub-Sub** — caché de respuestas `bbox` (sección 3.5) y canales de eventos
  SSE/WebSocket (sección 4.3): política de desalojo `volatile-lru`, porque es aceptable perder
  estas claves bajo presión de memoria.
* **Redis BullMQ** — cola de jobs (`generar-reporte-pdf`, `calcular-anomalia`,
  `evaluar-alertas`, etc.): persistencia activa (`AOF` o `RDB`) y `noeviction`, para que un
  reinicio del servicio no pierda reportes o alertas encolados.

| Job | Disparado por | Qué hace |
|---|---|---|
| `generar-reporte-pdf` | `POST /reportes` | `@react-pdf/renderer` genera el PDF de P-06 directamente desde datos (sin navegador headless) → sube PDF a bucket → genera QR/sello → actualiza `pdf_url` → publica el evento de "listo" en Redis Pub/Sub (ver 4.3, evita polling). Se descarta Puppeteer/Playwright: consumen 300MB–1GB de RAM por instancia y son ~10x más lentos que templating directo a PDF para este caso (una plantilla de datos, no una página web arbitraria) |
| `calcular-anomalia` | INSERT/UPDATE en `inmuebles` (trigger o emitido por NestJS tras el write) | Llama a `POST /interno/calcular-rango-esperado` del microservicio Python en segundo plano y actualiza `rango_esperado_min/max`, `severidad_anomalia`, `precision_modelo` — desacopla el cálculo pesado de ML del hilo de request. **Tolerancia a fallos:** timeout estricto de 5000 ms por intento, hasta 3 reintentos con backoff exponencial (BullMQ `attempts`/`backoff`); si el microservicio no responde en el proceso de esos reintentos (OOM por Scikit-learn/GeoPandas, o caído), el job hace *fallback* y guarda `precision_modelo = 0`, `severidad_anomalia = 'ninguna'` en vez de dejar el job colgado indefinidamente o bloquear el worker |
| `evaluar-alertas` | cron cada N horas | Compara condición/umbral de `alertas` contra datos actuales → inserta en `alertas_historial` → dispara `enviar-notificacion` |
| `enviar-notificacion` | evaluar-alertas, KYC, tickets | Respeta `preferencias_notificacion` (correo/en app) → inserta en `notificaciones` → publica el evento en Redis Pub/Sub (ver 4.3) para push in-app inmediato; el envío por correo usa un proveedor externo (Resend/SendGrid/SES) — ver nota de infraestructura en la sección 6 |
| `ingesta-fuentes-abiertas` | cron / manual desde P-10 | Descarga INEGI/movilidad → normaliza → actualiza `fuentes_datos.estado` y dispara recálculo de índices → dispara revalidación bajo demanda de las rutas SSG afectadas (ver 2.1) |

**Nota sobre el fallback:** guardar `severidad_anomalia = 'ninguna'` cuando el modelo no
respondió (en vez de dejar el campo en blanco o el inmueble sin publicar) evita que una caída
del microservicio de ML bloquee la publicación de inmuebles; el inmueble simplemente no
muestra bloque de anomalía hasta que un reintento posterior (o el cron de recálculo) logre
procesarlo con éxito.

### 4.3 Tiempo Real: WebSockets/SSE sobre Redis Pub/Sub

El diagrama de la sección 1 menciona "HTTP / REST / WebSockets" pero el documento no
especificaba su implementación. Dos flujos dependen de esto y, sin ellos, obligarían al
cliente a hacer *polling*:

* **P-06 (estado del PDF)**: en vez de que el cliente haga `GET /reportes/:folio` en bucle
  para saber si el PDF ya está listo, el worker de `generar-reporte-pdf` publica un evento
  `{ folio, estado: 'listo', pdf_url }` en un canal de Redis Pub/Sub al terminar.
* **P-13 (notificaciones in-app)**: en vez de que el cliente solo dependa de `GET
  /notificaciones` pasivo, el job `enviar-notificacion` publica el evento de notificación en
  Redis al insertarla.

Una **Gateway de WebSockets** en NestJS (`@nestjs/websockets` con adaptador de Redis) se
suscribe a esos canales y reenvía el evento en tiempo real solo al cliente conectado y
autenticado como ese `usuario_id`. Para clientes que no necesitan bidireccionalidad (el caso
típico aquí: solo recibir eventos), Server-Sent Events (SSE) sobre el mismo Pub/Sub es una
alternativa más simple de operar que WebSockets full-duplex. `GET /reportes/:folio` y `GET
/notificaciones` se mantienen como respaldo para la carga inicial y para clientes sin
soporte de tiempo real.

---

## 5. Matriz Unificada de Pantallas (P-01 a P-16)

| Pantalla | Estrategia Renderizado | Path Frontend | Endpoint Principal | Nivel de Acceso / RLS | Sprint |
|---|---|---|---|---|---|
| **P-01 Inicio** | SSG + ISR | `app/(publico)/page.tsx` | `GET /colonias` | Público | 1 |
| **P-02 Explorador** | SSR + CSR | `app/(publico)/colonias/page.tsx` | `GET /colonias?params...` | Público | 2 |
| **P-03 Ficha Colonia** | SSG + ISR | `app/(publico)/colonias/[ciudad]/[colonia]/page.tsx` | `GET /colonias/:id` | Público | 2 |
| **P-04 Crear Cuenta** | CSR | `app/(auth)/crear-cuenta/page.tsx` | `POST /auth/registro` | Anónimo | 3 |
| **P-05 Detalle Inmueble** | CSR | `app/(privado)/inmuebles/[id]/page.tsx` | `GET /inmuebles/:id` | Verificado (columnas filtradas en Serializer NestJS) | 4 (base) / 10 (anomalía activa) |
| **P-06 Reporte Precio** | CSR | `app/(privado)/reportes/[folio]/page.tsx` | `POST /reportes` | Verificado (`reportes_propios`) | 4 |
| **P-07 Comparador** | CSR | `app/(privado)/comparar/page.tsx` | `POST /comparador` | Verificado | 5 |
| **P-08 Mapa de Calor** | CSR | `app/(privado)/mapa/page.tsx` | `GET /mapa/calor` | Verificado | 5 |
| **P-09 Alertas/Favoritos** | CSR | `app/(privado)/mi-cuenta/alertas/page.tsx` | `POST/GET /alertas` | Autenticado (`usuario_id = auth.uid()`) | 8 |
| **P-10 Catálogo Admin** | CSR | `app/admin/catalogo/page.tsx` | `GET/PATCH /admin/*` | Administrador (`rol = 'administrador'`) | 7 |
| **P-11 Entrar** | CSR | `app/(auth)/entrar/page.tsx` | `POST /auth/login` | Público | 3 |
| **P-12 Perfil / Cuenta** | CSR | `app/(privado)/mi-cuenta/perfil/page.tsx` | `GET /perfil` | Autenticado | 3 |
| **P-13 Notificaciones** | CSR | `app/(privado)/notificaciones/page.tsx` | `GET /notificaciones` | Autenticado | 9 |
| **P-14 Soporte / Tickets** | CSR | `app/(privado)/soporte/page.tsx` | `POST /tickets` | Autenticado | 11 |
| **P-15 Feedback** | CSR | `app/(privado)/feedback/page.tsx` | `POST /feedback` | Autenticado | 11 |
| **P-16 Documentación** | Estático | Ruta interna | N/A | Interno | 12 |

---

## 6. Planificación Temporal y Encaje con Sprints

* **Sprint 3 — Autenticación y cuentas**: P-04, P-11, P-12.
* **Sprint 4 — Ficha de inmueble y reportes (base)**: P-05 sin anomalía activa todavía, P-06.
* **Sprint 6 — Seguridad y RBAC**: Habilitar el RLS por `identidad_verificada` para respaldar el gate de P-04/P-11 sin lógica duplicada en frontend, y dejar listo el Serializer de NestJS que oculta `severidad_anomalia`/`rango_esperado_*` para usuarios no verificados (sección 3.2).
* **Sprint 7 — Catálogo Admin**: P-10.
* **Sprint 8 — Alertas y Favoritos (P-09)**: **no** son solo tablas relacionales simples con RLS — requieren infraestructura asíncrona nueva: worker `evaluar-alertas` en BullMQ, integración con un proveedor de correo (Resend/SendGrid/SES) para el canal `correo`, y el modelo de `favoritos` con las restricciones de la sección 3.1. Este sprint deja lista esa infraestructura async, que P-13 reutiliza.
* **Sprint 9 — Notificaciones (P-13)**: reutiliza el worker `enviar-notificacion` y el proveedor de correo integrados en el Sprint 8; añade `preferencias_notificacion` e historial de lectura (`leido`).
* **Pre-migración de Esquema (previa al Sprint 10)**: Crear con anticipación las columnas `rango_esperado_min/max` en la tabla `inmuebles` para evitar migraciones en caliente.
* **Sprint 10 — Motor de Anomalías/ML**: se activa el microservicio Python y el job asíncrono `calcular-anomalia` (sección 4.2); a partir de aquí P-05 muestra severidad de anomalía a usuarios verificados.
* **Sprint 11 — Soporte y Feedback (P-14, P-15)**: patrón de tablas relacionales simples con RLS por `usuario_id = auth.uid()` — aquí sí es directo y económico de integrar, sin dependencias asíncronas nuevas.
* **Sprint 12 — Documentación (P-16) y cierre**: QA general y hardening final.

**Corrección importante:** la sección 6 original describía P-09, P-13, P-14 y P-15 como un bloque homogéneo "económico de integrar" por ser tablas relacionales simples con RLS. Eso solo es cierto para P-14 y P-15. P-09 y P-13 dependen de infraestructura asíncrona (colas BullMQ, proveedor de correo, historial de lectura) que no existe en sprints anteriores y debe planearse con anticipación (Sprint 8) para no convertirse en un cuello de botella de integración al final del proyecto.

---

## 7. Observabilidad, Monitoreo y Herramientas de Migración

El documento no especificaba estas piezas; se dejan definidas aquí para que no se decidan
de forma ad hoc a mitad de proyecto:

* **Migraciones de esquema**: `Prisma Migrate` **no es la opción correcta aquí** — no soporta
  nativamente los tipos geoespaciales de PostGIS (`GEOMETRY(POLYGON, 4326)` cae en
  `Unsupported("geometry")`, lo que deshabilita el cliente TypeScript autogenerado para esas
  columnas) y, además, ignora por completo las políticas RLS (`CREATE POLICY`) y los tipos
  `ENUM` de Postgres, obligando a migraciones SQL manuales para todo lo no trivial de todas
  formas. Se usa en su lugar **Drizzle ORM** (`drizzle-orm/pg-core` tiene soporte nativo de
  PostGIS y no rompe el tipado) o, si se prefiere no depender de un ORM para el DDL, la
  **CLI de Supabase** / `dbmate` ejecutando migraciones SQL puras versionadas en el
  repositorio. Cualquiera de las dos opciones versiona junto con el esquema las políticas RLS
  de la sección 3.2 (ya no hay vistas con `security_invoker` que versionar, al haberse movido
  ese ocultamiento al Serializer de NestJS).
* **Logs estructurados**: NestJS usa `Pino` (`nestjs-pino`) para logs en JSON por request,
  incluyendo `usuario_id` cuando existe sesión — necesario para poder correlacionar un error
  del microservicio de ML con la petición que lo originó.
* **Monitoreo de colas**: `Bull-Board` expone un panel para inspeccionar jobs pendientes,
  fallidos y reintentos de BullMQ (`calcular-anomalia`, `generar-reporte-pdf`,
  `evaluar-alertas`, `enviar-notificacion`, `ingesta-fuentes-abiertas`); se complementa con
  métricas de Prometheus (`bull_queue_waiting`, `bull_queue_failed`) y una alerta cuando el
  tamaño de la cola de `calcular-anomalia` crece de forma sostenida — señal temprana de que el
  microservicio de ML está degradado (ver circuit breaker en 4.2).