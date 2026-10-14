import { Client } from 'pg';

/** BD de pruebas aparte: las pruebas del ETL borran y recrean su esquema (civitas_test, nunca la de desarrollo). */
export const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://civitas:civitas@localhost:5432/civitas_test';

/**
 * Crea la BD de pruebas si no existe. Devuelve false si el servidor no responde.
 * Con REQUIRE_DB=1 (CI, contenedor `test`) la falta de BD es un error, no un "omitido" silencioso.
 */
export async function prepararBdPruebas(): Promise<boolean> {
  const u = new URL(TEST_DB_URL);
  const nombre = u.pathname.slice(1);
  u.pathname = '/postgres';
  const admin = new Client({ connectionString: u.toString(), connectionTimeoutMillis: 3000 });
  try {
    await admin.connect();
    const r = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombre]);
    if (!r.rowCount) await admin.query(`CREATE DATABASE "${nombre.replace(/"/g, '')}"`);
    return true;
  } catch (e) {
    if (process.env.REQUIRE_DB === '1') throw new Error(`PostGIS de pruebas no disponible (${(e as Error).message})`);
    console.warn(`[pruebas] PostGIS no disponible (${(e as Error).message}); se omiten las pruebas con BD. Define TEST_DATABASE_URL.`);
    return false;
  } finally {
    await admin.end().catch(() => undefined);
  }
}
