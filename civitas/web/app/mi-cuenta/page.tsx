import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cerrarSesion } from '@/app/acciones-auth';
import { fechaMX } from '@/lib/api';
import { ETIQUETA_ROL, usuarioActual } from '@/lib/sesion';

export const metadata = { title: 'Mi cuenta · CIVITAS' };

/** P-12: la misma ruta muestra contenido distinto según el rol de la sesión activa. */
export default async function MiCuenta() {
  const sesion = await usuarioActual();
  if (!sesion) redirect('/iniciar-sesion?siguiente=/mi-cuenta');
  const c = sesion.cuenta, admin = c.rol === 'administrador';
  return (
    <div className="prosa">
      <h1>Mi cuenta</h1>
      <p><span className={`sello ${admin ? 'ok' : ''}`}>{ETIQUETA_ROL[c.rol]}</span> {c.es_demo && <span className="sello warn">Cuenta de demostración</span>}</p>
      <dl className="ficha">
        <dt>Usuario</dt><dd>{c.usuario}</dd>
        <dt>Correo</dt><dd>{c.correo ?? '—'}</dd>
        {!admin && <><dt>Uso previsto</dt><dd>{c.proposito ?? '—'}</dd></>}
        <dt>Cuenta creada</dt><dd>{fechaMX(c.creado_en)}</dd>
        <dt>Último acceso</dt><dd>{fechaMX(c.ultimo_acceso)}</dd>
      </dl>
      <h2>Accesos rápidos</h2>
      <ul>
        {admin
          ? <li><Link href="/admin">Panel de administración</Link></li>
          : <li className="nota">Favoritos y alertas: próximamente.</li>}
        <li><Link href="/zonas">Zonas piloto</Link></li>
        <li><Link href="/rentas">Rentas</Link></li>
      </ul>
      <form action={cerrarSesion}><button type="submit" className="secundario">Cerrar sesión</button></form>
    </div>
  );
}
