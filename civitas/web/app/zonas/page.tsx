import Link from 'next/link';
import MapaZonas from '@/components/MapaZonas';
import { api, fechaMX, num, type FeatureZona, type Fuente, type ListaZonas, type Validacion } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Zonas piloto · CIVITAS' };

const ICONO = { ok: '✔', fail: '✘', warn: '!' } as const;

export default async function Zonas() {
  let lista: ListaZonas, geo: { features: FeatureZona[] }, fuentes: Fuente[], val: Validacion | null;
  try {
    [lista, geo, fuentes] = await Promise.all([
      api<ListaZonas>('/colonias?limit=200&orden=comercios'),
      api<{ features: FeatureZona[] }>('/colonias/geojson?limit=500'),
      api<Fuente[]>('/datos-abiertos/fuentes'),
    ]);
    val = await api<Validacion>('/datos-abiertos/validacion').catch(() => null);
  } catch (e) {
    return (
      <div>
        <h1>Zonas piloto</h1>
        <p className="aviso-borrador">No se pudo contactar la API ({(e as Error).message}). Levanta el stack (<code>docker compose up -d</code>) y
          carga los datos (<code>docker compose run --rm etl mvp2</code>).</p>
      </div>
    );
  }

  const zonas = lista.items;
  const sintetico = zonas.some((z) => z.modo_datos === 'fixture');
  const totComercios = zonas.reduce((s, z) => s + z.num_comercios, 0);
  const totParadas = zonas.reduce((s, z) => s + z.num_paradas, 0);

  return (
    <div className="ancho">
      <h1>MVP-2 · Datos abiertos y zonas piloto</h1>
      {sintetico && (
        <p className="aviso-borrador"><strong>Datos sintéticos.</strong> Estas zonas, comercios y paradas son datos de prueba generados
          para validar el pipeline, no información real de INEGI por razones de seguridad.</p>
      )}

      <section className="kpis">
        <div><b>{num(lista.total)}</b><span>zonas piloto (unidad: AGEB)</span></div>
        <div><b>{num(totComercios)}</b><span>comercios (DENUE, SCIAN 43/46)</span></div>
        <div><b>{num(totParadas)}</b><span>paradas de transporte</span></div>
      </section>

      <h2>Para pasar {val && <span className={`sello ${val.aprobada ? 'ok' : 'fail'}`}>{val.aprobada ? 'APROBADO' : 'NO APROBADO'}</span>}</h2>
      {val ? (
        <>
          <ul className="checklist">
            {val.resultados.map((c) => (
              <li key={c.id} className={c.estado}><span className="ico">{ICONO[c.estado]}</span>
                <div><strong>{c.requisito}</strong> {c.descripcion}<small>{c.detalle}</small></div></li>
            ))}
          </ul>
          <p className="nota">Validado el {fechaMX(val.ejecutada_en)}.</p>
        </>
      ) : <p className="nota">Aún no hay validación registrada (ejecuta <code>docker compose run --rm etl mvp2</code>).</p>}

      <h2>Mapa</h2>
      <MapaZonas zonas={geo.features} />

      <h2>Zonas</h2>
      <p className="nota">Cada zona enlaza a su ficha en el <Link href="/colonias">catálogo</Link>.</p>
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Zona</th><th>CVEGEO</th><th className="n">Comercios</th><th className="n">Mayoreo</th><th className="n">Menudeo</th>
            <th className="n">Paradas</th><th className="n">Área km²</th><th className="n">Comercios/km²</th></tr></thead>
          <tbody>
            {zonas.map((z) => (
              <tr key={z.id}><td><Link href={`/colonias/${z.id}`}>{z.nombre}</Link></td><td><code>{z.clave_geo}</code></td><td className="n">{num(z.num_comercios)}</td>
                <td className="n">{num(z.num_comercios_mayoreo)}</td><td className="n">{num(z.num_comercios_menudeo)}</td>
                <td className="n">{num(z.num_paradas)}</td><td className="n">{num(z.area_km2, 2)}</td>
                <td className="n">{num(z.densidad_comercios_km2, 0)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Trazabilidad de las fuentes</h2>
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Fuente</th><th>Estado</th><th>Última carga</th><th>Origen</th><th className="n">Cargados</th><th className="n">Descartados</th></tr></thead>
          <tbody>
            {fuentes.map((f) => (
              <tr key={f.clave}><td>{f.nombre}</td><td>{f.estado}</td><td>{fechaMX(f.ultima_ingesta)}</td>
                <td>{f.modo === 'fixture' ? 'sintético' : f.modo ?? '—'}</td><td className="n">{num(f.registros_cargados)}</td>
                <td className="n">{num(f.registros_descartados)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
