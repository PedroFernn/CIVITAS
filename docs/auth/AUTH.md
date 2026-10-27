# Cuentas, registro e inicio de sesión

Implementa P-04 (registro), P-11 (inicio de sesión), P-12 (cuenta por rol) y una primera versión de P-10 (panel de administración) del mockup.

## Cuentas de ejemplo

| Usuario | Contraseña | Rol | Al entrar va a |
|---|---|---|---|
| `usr1` | `123` | usuario | `/mi-cuenta` |
| `adm` | `456` | administrador | `/admin` |

Son de **demostración**: contraseñas triviales a propósito. Existen solo mientras el modo demo está activo. Se siembran al arrancar la API (idempotente, no pisa contraseñas cambiadas):

- `DEMO_USERS=1` → siempre · `DEMO_USERS=0` → nunca.
- Sin definir → **solo si `WEB_ORIGIN` es local** (`localhost`/`127.0.0.1`). Con un dominio real quedan apagadas.
- **Apagarlas las elimina:** con el modo demo apagado, la API borra al arrancar toda cuenta marcada `es_demo` (y sus sesiones), aunque se hubiera sembrado antes. Para limpiar un servidor basta `DEMO_USERS=0` y reiniciar la API. Las cuentas reales nunca se tocan.
- La web avisa con un recuadro "Modo demostración" y el panel de administración muestra cuántas hay activas.

## Cómo funciona

- **Registro** (`POST /auth/registro`): usuario (3–30: letras, números, `.`, `-`, `_`), correo, contraseña (8–128 caracteres), uso previsto (rentar/comprar/otro) y aceptación del aviso de privacidad (se guarda cuándo). Toda cuenta nueva es **rol `usuario`**: el rol nunca se lee de la petición. No hay verificación por correo todavía.
- **Acceso** (`POST /auth/login`): usuario **o** correo + contraseña. Mensaje de error genérico, tiempo de respuesta uniforme (no revela qué cuentas existen) y bloqueo temporal tras 5 fallos por cuenta (429, 15 min; en memoria, se reinicia con la API). La política de 8 caracteres se aplica al registrar, no al entrar (las cuentas de ejemplo son más cortas).
- **Contraseñas:** solo hash `scrypt` con sal (`crypto` de Node, sin dependencias nuevas).
- **Sesiones:** token aleatorio de 256 bits; en BD solo su SHA-256. Vigencia 12 h, o 30 días con "Recordarme". `POST /auth/logout` la revoca.
- **Web:** la cookie `civitas_sesion` es `HttpOnly`, `SameSite=Lax` y `Secure` cuando el acceso es por HTTPS. Sin "Recordarme" es cookie de sesión. La web llama a la API desde el servidor con `Authorization: Bearer`. El destino posterior al login se restringe a rutas internas.
- **Roles:** `@UseGuards(SesionGuard)` + `@Roles('administrador')`: 401 sin sesión, 403 sin el rol. El panel (`GET /admin/resumen`) no expone correos ni contraseñas.
- **Rutas públicas** (zonas, rentas, aviso): siguen sin cuenta, como pide el mockup para el visitante.

## Límites conocidos

- Sin verificación de correo, recuperación de contraseña ni KYC (P-04/P-11 los marcan como ramas posteriores).
- Sin límite de registros por IP.
- El bloqueo por intentos es en memoria (una sola instancia de la API).
- El registro ya guarda correo: **completar el aviso de privacidad** antes de abrirlo al público.
- `etl mvp2 --desde-cero` borra el esquema completo, incluidas las cuentas (la BD del compose es desechable).
