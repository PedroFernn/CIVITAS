/** Trazabilidad (RNF): cada importación queda registrada con fuente, archivo, hash, fecha y conteos. */
import { statSync } from 'node:fs';
import { Conn, sha256Archivo } from './db';

const MAX_DESCARTES_GUARDADOS = 1000;

export class Carga {
  leidos = 0;
  cargados = 0;
  descartados = 0;
  readonly descartes: [string, string][] = [];

  constructor(readonly id: number, readonly fuente: string) {}

  descartar(referencia: string, motivo: string): void {
    this.descartados++;
    if (this.descartes.length < MAX_DESCARTES_GUARDADOS) this.descartes.push([referencia, motivo]);
  }
}

export async function conCarga<T>(
  conn: Conn,
  fuente: string,
  modo: string,
  archivo: string | undefined,
  comando: string,
  versionFuente: string | null,
  fn: (c: Carga) => Promise<T>,
): Promise<T> {
  const esArchivo = !!archivo && statSync(archivo, { throwIfNoEntry: false })?.isFile();
  const sha = esArchivo ? await sha256Archivo(archivo!) : null;
  // la fila 'en_curso' sobrevive aunque la importación falle
  const row = await conn.tx(() =>
    conn.one(
      'INSERT INTO cargas_datos (fuente_clave, modo, archivo_origen, sha256, version_fuente, comando) ' +
        'VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [fuente, modo, archivo ?? null, sha, versionFuente, comando],
    ),
  );
  const c = new Carga(Number(row.id), fuente);
  try {
    const out = await fn(c);
    await conn.tx(async () => {
      for (const [ref, motivo] of c.descartes) {
        await conn.query('INSERT INTO cargas_descartes (carga_id, referencia, motivo) VALUES ($1,$2,$3)', [c.id, ref, motivo]);
      }
      await conn.query(
        "UPDATE cargas_datos SET estado='ok', finalizada_en=now(), registros_leidos=$1, registros_cargados=$2, " +
          'registros_descartados=$3 WHERE id=$4',
        [c.leidos, c.cargados, c.descartados, c.id],
      );
      await conn.query("UPDATE fuentes_datos SET estado='ok', ultima_ingesta=now() WHERE clave=$1", [fuente]);
    });
    console.info(`[${fuente}] carga #${c.id} ok · leídos=${c.leidos} cargados=${c.cargados} descartados=${c.descartados}`);
    return out;
  } catch (exc) {
    const e = exc as Error;
    await conn.tx(async () => {
      await conn.query(
        "UPDATE cargas_datos SET estado='error', finalizada_en=now(), error=$1, registros_leidos=$2, " +
          'registros_cargados=$3, registros_descartados=$4 WHERE id=$5',
        [`${e.name}: ${e.message}`.slice(0, 2000), c.leidos, c.cargados, c.descartados, c.id],
      );
      await conn.query("UPDATE fuentes_datos SET estado='error' WHERE clave=$1", [fuente]);
    });
    throw exc;
  }
}
