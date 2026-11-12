import Link from 'next/link';
import { redirect } from 'next/navigation';
import FormEntrevista from '@/components/FormEntrevista';
import { api, fechaMX, mxn, num } from '@/lib/api';
import { usuarioActual } from '@/lib/sesion';
import type { ListaCatalogo } from '@/lib/zonas';
import { eliminarEntrevista } from './acciones';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Entrevistas de precio · CIVITAS' };

interface Entrevista {
  id: string; tipo: 'inquilino' | 'b2b'; alias: string; realizada_en: string; modalidad: string; duracion_min: number | null;
  zona_id: string | null; zona_nombre: string | null; renta_actual_mxn: number | null; renta_justa_mxn: number | null;
  acepta_pagar: boolean | null; monto_dispuesto_mxn: number | null; notas: string; creada_por: string; actualizada_en: string;
}
interface Respuesta {
  items: Entrevista[];
  resumen: { total: number; por_tipo: Record<'inquilino' | 'b2b', { hechas: number; objetivo: number }>; con_notas: number; completas: boolean; b2b_aceptarian_pagar: number; faltan: string[] };
}
type SP = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const TIPO = { inquilino: 'Inquilino o estudiante', b2b: 'Inmobiliaria o administradora' } as const;

/** Entrevistas de precio (MVP-5, negocio): captura, avance contra el objetivo (3 inquilinos + 2 B2B) y correcciones. Solo administradores. */
export default async function Entrevistas({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sesion = await usuarioActual();
  if (!sesion) redirect('/iniciar-sesion?siguiente=/admin/entrevistas');
  if (sesion.cuenta.rol !== 'administrador') return <div><h1>Entrevistas de precio</h1><p className="aviso-borrador">Esta sección es solo para administradores.</p></div>;

  let datos: Respuesta, zonas: ListaCatalogo;
  try {
    [datos, zonas] = await Promise.all([api<Respuesta>('/entrevistas', sesion.token), api<ListaCatalogo>('/zonas?limit=200&orden=nombre')]);
  } catch {
    return <div><h1>Entrevistas de precio</h1><p className="aviso-borrador">No se pudieron cargar las entrevistas en este momento. Inténtalo de nuevo en unos minutos.</p></div>;
  }

  const r = datos.resumen;
  const editar = datos.items.find((e) => e.id === uno(sp.editar));
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="ancho">
      <nav className="migas" aria-label="Ruta"><Link href="/admin">Panel</Link> › <span aria-current="page">Entrevistas de precio</span></nav>
      <h1>Entrevistas de precio</h1>
      <p className="nota">Objetivo del sprint: 5 entrevistas cortas, 3 a inquilinos o estudiantes y 2 a inmobiliarias o administradoras. Guarda un alias y las notas;
        no registres nombres, correos ni teléfonos.</p>
      {uno(sp.guardada) && <p className="aviso-ok" role="status">Entrevista guardada.</p>}
      {uno(sp.eliminada) && <p className="aviso-ok" role="status">Entrevista eliminada.</p>}

      <section className="kpis">
        <div><b>{r.por_tipo.inquilino.hechas} / {r.por_tipo.inquilino.objetivo}</b><span>inquilinos o estudiantes</span></div>
        <div><b>{r.por_tipo.b2b.hechas} / {r.por_tipo.b2b.objetivo}</b><span>inmobiliarias o administradoras</span></div>
        <div><b>{r.b2b_aceptarian_pagar}</b><span>B2B que aceptarían pagar por un reporte de zona (meta: 2 de 5)</span></div>
      </section>
      {r.completas ? <p className="aviso-ok" role="status">Objetivo cumplido: 5 entrevistas con notas guardadas.</p>
        : <p className="aviso-borrador">Faltan {r.faltan.join(' y ')}.</p>}

      <h2>{editar ? `Corregir «${editar.alias}»` : 'Registrar una entrevista'}</h2>
      <FormEntrevista key={editar?.id ?? 'nueva'} zonas={zonas.items.map((z) => ({ id: z.id, nombre: z.nombre }))} inicial={editar} hoy={hoy} />

      <h2>Entrevistas hechas ({datos.items.length})</h2>
      {datos.items.length === 0 ? <p className="vacio">Todavía no hay entrevistas registradas.</p> : (
        <ul className="lista-entrevistas">
          {datos.items.map((e) => (
            <li key={e.id} className="tarjeta">
              <div className="tarjeta-cab">
                <h3>{e.alias}</h3>
                <span className="nota">{TIPO[e.tipo]} · {e.realizada_en} · {e.modalidad}{e.duracion_min ? ` · ${num(e.duracion_min)} min` : ''}</span>
              </div>
              <p className="nota">
                {e.zona_nombre && <>Zona: {e.zona_nombre} · </>}
                {e.renta_actual_mxn !== null && <>Paga {mxn(e.renta_actual_mxn)} · </>}
                {e.renta_justa_mxn !== null && <>Considera justo {mxn(e.renta_justa_mxn)} · </>}
                {e.acepta_pagar === true ? <>Pagaría por un reporte{e.monto_dispuesto_mxn !== null && <> ({mxn(e.monto_dispuesto_mxn)})</>}</> : e.acepta_pagar === false ? 'No pagaría por un reporte' : 'Sin respuesta sobre pagar'}
              </p>
              <p className="notas-entrevista">{e.notas}</p>
              <div className="tarjeta-pie">
                <small className="nota">Capturada por {e.creada_por} · {fechaMX(e.actualizada_en)}</small>
                <span className="barra-comparar-acciones">
                  <Link href={`/admin/entrevistas?editar=${e.id}`}>Corregir</Link>
                  <form action={eliminarEntrevista}><input type="hidden" name="id" value={e.id} /><button type="submit" className="enlace">Eliminar</button></form>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
