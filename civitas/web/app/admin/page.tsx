import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api, fechaMX, num, type Fuente, type Validacion } from '@/lib/api';
import { ETIQUETA_ROL, usuarioActual, type Rol } from '@/lib/sesion';

export const metadata = { title: 'Administración · CIVITAS' };

interface Resumen {
  usuarios_total: number; administradores: number; cuentas_demo: number; sesiones_activas: number;
  usuarios: { usuario: string; rol: Rol; proposito: string | null; es_demo: boolean; creado_en: string; ultimo_acceso: string | null }[];
}
const opcional = <T,>(p: Promise<T>) => p.catch(() => null);

/** P-10 (versión inicial): cuentas, fuentes de datos y estado de las validaciones. Solo rol administrador. */
export default async function Admin() {
  const sesion = await usuarioActual();
  if (!sesion) redirect('/iniciar-sesion?siguiente=/admin');
  if (sesion.cuenta.rol !== 'administrador') {
    return (
      <div className="prosa">
        <h1>Acceso restringido</h1>
        <p className="aviso-borrador">Tu cuenta (<strong>{sesion.cuenta.usuario}</strong>, {ETIQUETA_ROL[sesion.cuenta.rol].toLowerCase()}) no tiene permiso para el panel de administración.</p>
        <p><Link href="/mi-cuenta">Volver a mi cuenta</Link></p>
      </div>
    );
  }
  const [r, fuentes, v2, v3, v4] = await Promise.all([
    api<Resumen>('/admin/resumen', sesion.token),
    opcional(api<Fuente[]>('/datos-abiertos/fuentes')),
    opcional(api<Validacion>('/datos-abiertos/validacion')),
    opcional(api<Validacion>('/listados-renta/validacion')),
    opcional(api<Validacion>('/zonas/validacion')),
  ]);
  return (
    <div>
      <h1>Panel de administración</h1>
      <p><span className="sello ok">rol: administrador</span> sesión de <strong>{sesion.cuenta.usuario}</strong></p>
      {r.cuentas_demo > 0 && (
        <p className="aviso-borrador"><strong>Hay {r.cuentas_demo} cuentas de demostración activas</strong> (contraseñas triviales). Desactívalas antes de publicar: <code>DEMO_USERS=0</code>.</p>
      )}

      <section className="kpis">
        <div><b>{num(r.usuarios_total)}</b><span>cuentas ({num(r.administradores)} {r.administradores === 1 ? 'administradora' : 'administradoras'})</span></div>
        <div><b>{num(r.sesiones_activas)}</b><span>sesiones activas</span></div>
        <div><b>{[v2, v3, v4].map((v) => (v ? (v.aprobada ? 'OK' : 'NO') : '—')).join(' · ')}</b><span>validación MVP-2 · MVP-3 · MVP-4</span></div>
      </section>

      <h2>Fuentes de datos</h2>
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Fuente</th><th>Estado</th><th>Modo</th><th>Última ingesta</th><th className="n">Cargados</th><th className="n">Descartados</th></tr></thead>
          <tbody>
            {(fuentes ?? []).map((f) => (
              <tr key={f.clave}><td>{f.nombre}</td><td>{f.estado}</td><td>{f.modo ?? '—'}</td><td>{fechaMX(f.ultima_ingesta)}</td>
                <td className="n">{num(f.registros_cargados)}</td><td className="n">{num(f.registros_descartados)}</td></tr>
            ))}
            {!fuentes && <tr><td colSpan={6}>No se pudo consultar el catálogo de fuentes.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="nota"><Link href="/zonas">Detalle MVP-2</Link> · <Link href="/rentas">Detalle MVP-3</Link></p>

      <h2>Checklist de MVP-4 (catálogo y recaptura) {v4 && <span className={`sello ${v4.aprobada ? 'ok' : 'fail'}`}>{v4.aprobada ? 'APROBADO' : 'NO APROBADO'}</span>}</h2>
      {v4 ? (
        <>
          <ul className="checklist">
            {v4.resultados.map((c) => (
              <li key={c.id} className={c.estado}><span className="ico">{{ ok: '✔', fail: '✘', warn: '!' }[c.estado]}</span>
                <div><strong>{c.requisito}</strong> {c.descripcion}<small>{c.detalle}</small></div></li>
            ))}
          </ul>
          <p className="nota">Validado el {fechaMX(v4.ejecutada_en)}. Se actualiza con <code>docker compose run --rm etl mvp4</code>.</p>
        </>
      ) : <p className="nota">Aún no hay validación de MVP-4 (ejecuta <code>docker compose run --rm etl mvp4</code>).</p>}

      <h2>Cuentas</h2>
      <p className="nota">Por privacidad el panel no muestra correos ni contraseñas.</p>
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Usuario</th><th>Rol</th><th>Uso previsto</th><th>Creada</th><th>Último acceso</th></tr></thead>
          <tbody>
            {r.usuarios.map((u) => (
              <tr key={u.usuario}><td>{u.usuario} {u.es_demo && <span className="sello warn">demo</span>}</td><td>{ETIQUETA_ROL[u.rol]}</td>
                <td>{u.proposito ?? '—'}</td><td>{fechaMX(u.creado_en)}</td><td>{fechaMX(u.ultimo_acceso)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
