/** Carga idempotente (upsert) de listados de renta: normaliza, descarta con motivo, deduplica y asigna zona. */
import { Carga } from '../cargas';
import { Config } from '../config';
import { Conn } from '../db';
import { coord } from '../loaders';
import { EstadisticasCarga } from './estadisticas';
import { huella, normalizarFecha, normalizarPrecio, normalizarRecamaras, normalizarSuperficie, normalizarTipo, sanitizarUrl } from './normalizar';
import { AvisosLectura, ParserRenta, TipoInmueble } from './tipos';

const LOTE = 2000;

interface Fila {
  id: string; url: string | null; tipo: TipoInmueble; precio: number; superficie: number | null; recamaras: number | null;
  publicado: string | null; lon: number; lat: number; huella: string | null;
}

const SQL_LISTADO = `
INSERT INTO listados_renta (fuente_clave, id_fuente, url, tipo_inmueble, precio_mxn, superficie_m2, recamaras, publicado_en,
                            geom, huella, carga_id)
SELECT $1, t.id, t.url, t.tipo, t.precio, t.superficie, t.recamaras, t.publicado::date,
       ST_SetSRID(ST_MakePoint(t.lon, t.lat), 4326), t.huella, $2
FROM unnest($3::text[], $4::text[], $5::text[], $6::numeric[], $7::numeric[], $8::smallint[], $9::text[],
            $10::float8[], $11::float8[], $12::text[])
  AS t(id, url, tipo, precio, superficie, recamaras, publicado, lon, lat, huella)
ON CONFLICT (fuente_clave, id_fuente) DO UPDATE SET
  url = EXCLUDED.url, tipo_inmueble = EXCLUDED.tipo_inmueble, precio_mxn = EXCLUDED.precio_mxn,
  superficie_m2 = EXCLUDED.superficie_m2, recamaras = EXCLUDED.recamaras, publicado_en = EXCLUDED.publicado_en,
  geom = EXCLUDED.geom, huella = EXCLUDED.huella, carga_id = EXCLUDED.carga_id, actualizado_en = now()
`;

async function volcar(conn: Conn, fuente: string, cargaId: number, lote: Fila[]): Promise<void> {
  if (!lote.length) return;
  await conn.query(SQL_LISTADO, [
    fuente, cargaId,
    lote.map((l) => l.id), lote.map((l) => l.url), lote.map((l) => l.tipo), lote.map((l) => l.precio),
    lote.map((l) => l.superficie), lote.map((l) => l.recamaras), lote.map((l) => l.publicado),
    lote.map((l) => l.lon), lote.map((l) => l.lat), lote.map((l) => l.huella),
  ]);
}

export async function cargarListados(conn: Conn, cfg: Config, parser: ParserRenta, c: Carga, est: EstadisticasCarga): Promise<void> {
  const avisos: AvisosLectura = { columnasSensibles: [] };
  const idsVistos = new Set<string>();
  const huellasVistas = new Map<string, string>(); // huella → id (dentro del archivo)
  let lote: Fila[] = [];

  const descartar = (ref: string, motivo: string) => {
    c.descartar(ref, motivo);
    est.descartar(motivo);
  };

  await conn.tx(async () => {
    // Ofertas ya cargadas antes (otra corrida): una huella igual con otro id es una republicación.
    const previas = new Map<string, string>(
      (await conn.query('SELECT huella, id_fuente FROM listados_renta WHERE fuente_clave = $1 AND huella IS NOT NULL', [parser.clave]))
        .map((r) => [r.huella as string, r.id_fuente as string]),
    );

    for await (const raw of parser.leer(cfg.rutaListados!, avisos)) {
      c.leidos++;
      const ref = `fila ${raw.fila}${raw.idFuente ? ` id=${raw.idFuente}` : ''}`;

      const precio = normalizarPrecio(raw.precio, raw.moneda, cfg.precioMin, cfg.precioMax);
      const superficie = normalizarSuperficie(raw.superficie);
      const recamaras = normalizarRecamaras(raw.recamaras);
      const co = coord(raw.lat, raw.lon);
      est.evaluar({ precio, superficie, recamaras, coordenadas: co });

      if (!raw.idFuente) { descartar(ref, 'sin id de anuncio'); continue; }
      if (!precio.ok) { descartar(ref, precio.motivo); continue; }
      if (typeof co === 'string') { descartar(ref, co); continue; }
      if (idsVistos.has(raw.idFuente)) { descartar(ref, 'id duplicado en el archivo'); continue; }

      const tipo = normalizarTipo(raw.tipo);
      const h = superficie.ok
        ? huella({ tipo, precio: precio.valor, superficie: superficie.valor, recamaras: recamaras.ok ? recamaras.valor : null, lat: co[0], lon: co[1] })
        : null;
      if (h === null) est.sinHuella++;
      else {
        const otro = huellasVistas.get(h) ?? (previas.get(h) !== raw.idFuente ? previas.get(h) : undefined);
        if (otro !== undefined) {
          est.duplicados++;
          descartar(ref, `republicación duplicada (misma oferta que id=${otro})`);
          continue;
        }
        huellasVistas.set(h, raw.idFuente);
      }

      idsVistos.add(raw.idFuente);
      lote.push({
        id: raw.idFuente, url: sanitizarUrl(raw.url), tipo, precio: precio.valor,
        superficie: superficie.ok ? superficie.valor : null, recamaras: recamaras.ok ? recamaras.valor : null,
        publicado: normalizarFecha(raw.publicado), lon: co[1], lat: co[0], huella: h,
      });
      c.cargados++;
      if (lote.length >= LOTE) { await volcar(conn, parser.clave, c.id, lote); lote = []; }
    }
    await volcar(conn, parser.clave, c.id, lote);
  });
  est.columnasSensibles = avisos.columnasSensibles;
}

/** Punto → zona (misma regla que MVP-2: ST_Covers incluye el borde; ORDER BY id hace determinista el empate). */
export async function asignarZonaListados(conn: Conn): Promise<void> {
  await conn.tx(() =>
    conn.query(`UPDATE listados_renta l SET zona_id =
      (SELECT z.id FROM colonias z WHERE ST_Covers(z.geom, l.geom) ORDER BY z.id LIMIT 1)`),
  );
}

/** Evita mezclar listados sintéticos con reales: borra los cargados por corridas de otro modo. */
export async function limpiarOtroModoRenta(conn: Conn, modo: string): Promise<void> {
  await conn.tx(() => conn.query('DELETE FROM listados_renta WHERE carga_id IN (SELECT id FROM cargas_datos WHERE modo <> $1)', [modo]));
}
