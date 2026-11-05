import { nuevaConfig } from '../../src/etl/config';
import { conectar, Conn } from '../../src/etl/db';
import { correrMvp2 } from '../../src/etl/pipeline';
import { correrMvp3 } from '../../src/etl/renta/pipeline';
import { ejecutar, guardar } from '../../src/etl/mvp5/validacion';
import { prepararBdPruebas, TEST_DB_URL } from '../helpers/db';

/** Checklist de MVP-5 sobre PostGIS real, con los datos que cargan MVP-2 y MVP-3 (la migración 010 se aplica con el ETL). */
describe('MVP-5 · checklist (PostGIS real)', () => {
  let listo = false;
  let conn: Conn | undefined;
  const cfg = () => nuevaConfig({ databaseUrl: TEST_DB_URL, comando: 'jest' });

  beforeAll(async () => {
    listo = await prepararBdPruebas();
    if (!listo) return;
    expect(await correrMvp2(cfg(), true, true)).toBe(true);
    expect(await correrMvp3(cfg())).toBe(true);
    conn = await conectar(TEST_DB_URL);
  }, 180_000);
  afterAll(async () => { await conn?.close(); });

  const por = (checks: { id: string }[]) => Object.fromEntries(checks.map((c) => [c.id, c])) as Record<string, any>;

  it('búsqueda, filtros, comparador y carga de 50 usuarios pasan; sin entrevistas el checklist no se aprueba', async () => {
    if (!listo) return;
    const c = por(await ejecutar(conn!, cfg()));
    expect(c.busqueda_y_filtros.estado).toBe('ok');
    expect(c.comparador_3_zonas.estado).toBe('ok');
    expect(['ok', 'warn']).toContain(c.latencia_busqueda.estado);     // warn con datos sintéticos
    expect(['ok', 'warn']).toContain(c.carga_50_usuarios.estado);
    expect(c.carga_50_usuarios.detalle).toContain('50 usuarios');
    expect(c.carga_50_usuarios.detalle).toContain('0 error(es)');
    expect(c.entrevistas_5.estado).toBe('fail');
    expect(await guardar(conn!, Object.values(c) as any, 'fixture')).toBe(false);
  }, 120_000);

  it('con 3 inquilinos y 2 B2B con notas, el criterio de negocio pasa; las notas cortas violan la restricción de la BD', async () => {
    if (!listo) return;
    const notas = 'Paga ocho mil quinientos y le parece caro por la distancia al metro.';
    for (const [i, tipo] of ['inquilino', 'inquilino', 'inquilino', 'b2b', 'b2b'].entries()) {
      await conn!.query("INSERT INTO entrevistas_precio (tipo, alias, realizada_en, notas, creada_por) VALUES ($1, $2, '2026-11-03', $3, 'jest')", [tipo, `Alias ${i + 1}`, notas]);
    }
    expect(por(await ejecutar(conn!, cfg())).entrevistas_5.estado).toBe('ok');
    await expect(conn!.query("INSERT INTO entrevistas_precio (tipo, alias, realizada_en, notas, creada_por) VALUES ('b2b','xx','2026-11-03','corta','jest')")).rejects.toThrow();
  }, 120_000);

  it('borrar una zona no borra la entrevista (zona_id pasa a NULL)', async () => {
    if (!listo) return;
    const z = (await conn!.query('SELECT id FROM colonias LIMIT 1'))[0].id;
    const e = (await conn!.query("INSERT INTO entrevistas_precio (tipo, alias, realizada_en, notas, creada_por, zona_id) VALUES ('b2b','Con zona','2026-11-03','Notas de más de veinte caracteres sobre esa zona.','jest',$1) RETURNING id", [z]))[0].id;
    await conn!.query('DELETE FROM listados_renta WHERE zona_id = $1', [z]);
    await conn!.query('DELETE FROM zona_atributos WHERE zona_id = $1', [z]);
    await conn!.query('DELETE FROM colonias WHERE id = $1', [z]);
    expect((await conn!.query('SELECT zona_id FROM entrevistas_precio WHERE id = $1', [e]))[0].zona_id).toBeNull();
  }, 60_000);
});
