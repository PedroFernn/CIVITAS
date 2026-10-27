const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/**
 * ¿Se crean las cuentas de ejemplo (usr1 / adm)? Seguro por defecto:
 *  - DEMO_USERS=1 → sí, siempre (decisión explícita);  DEMO_USERS=0 → no, nunca.
 *  - Sin definir → solo si TODOS los orígenes web configurados (WEB_ORIGIN) son locales. Con un dominio real quedan apagadas,
 *    así un despliegue público no se queda con contraseñas triviales por olvido.
 */
export function demoHabilitado(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.DEMO_USERS === '1') return true;
  if (env.DEMO_USERS === '0') return false;
  return (env.WEB_ORIGIN ?? 'http://localhost:3000').split(',').every((o) => LOCAL.test(o.trim()));
}
