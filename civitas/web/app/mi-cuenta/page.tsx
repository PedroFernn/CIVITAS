import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cerrarSesion } from '@/app/acciones-auth';
import AvisoDatos from '@/components/AvisoDatos';
import { api, fechaMX, mxn, num, type ReporteCalidad } from '@/lib/api';
import { ETIQUETA_ROL, usuarioActual } from '@/lib/sesion';

export const metadata = { title: 'Mi cuenta · CIVITAS' };

/** Mismas etiquetas que el formulario de registro. */
const PROPOSITO: Record<string, string> = { rentar: 'Voy a rentar', comprar: 'Voy a comprar', otro: 'Otro' };

const ICONOS = {
  mapa: <><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  comparar: <><rect x="3" y="9" width="7" height="11" rx="1.5" /><rect x="14" y="4" width="7" height="16" rx="1.5" /></>,
  rentas: <><circle cx="12" cy="12" r="9" /><path d="M12 6.5v11M9.2 9.4c0-1 1.2-1.7 2.8-1.7s2.8.7 2.8 1.7-1.2 1.5-2.8 1.8-2.8.8-2.8 1.8 1.2 1.7 2.8 1.7 2.8-.7 2.8-1.7" /></>,
  capas: <><path d="M12 3 3 8l9 5 9-5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  escudo: <><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" /><path d="m9 12 2 2 4-4" /></>,
} as const;

function Icono({ k }: { k: keyof typeof ICONOS }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICONOS[k]}
    </svg>
  );
}

interface Acceso { href: string; titulo: string; texto: string; icono: keyof typeof ICONOS }

const ACCESOS: Acceso[] = [
  { href: '/colonias', titulo: 'Explorar zonas', texto: 'Mapa y lista de todas las zonas, con búsqueda y filtros por precio o transporte.', icono: 'mapa' },
  { href: '/comparar', titulo: 'Comparar zonas', texto: 'Hasta tres zonas lado a lado: precio, comercios y transporte.', icono: 'comparar' },
  { href: '/rentas', titulo: 'Precios de renta', texto: 'Cuánto se paga en cada zona y los anuncios que respaldan las cifras.', icono: 'rentas' },
  { href: '/zonas', titulo: 'Datos de apoyo', texto: 'Zonas piloto, mapa, tablas y trazabilidad de las fuentes de datos.', icono: 'capas' },
];
const ACCESO_ADMIN: Acceso = { href: '/admin', titulo: 'Panel de administración', texto: 'Cuentas, fuentes de datos y validaciones de cada MVP.', icono: 'escudo' };

const diasDesde = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
const fechaLarga = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'long' });

/** P-12: la misma ruta muestra contenido distinto según el rol de la sesión activa (aquí, el panel de la cuenta). */
export default async function MiCuenta() {
  const sesion = await usuarioActual();
  if (!sesion) redirect('/iniciar-sesion?siguiente=/mi-cuenta');
  const c = sesion.cuenta, admin = c.rol === 'administrador';
  const calidad = await api<ReporteCalidad>('/listados-renta/calidad').catch(() => null);

  const dias = diasDesde(c.creado_en);
  const usoPrevisto = c.proposito ? (PROPOSITO[c.proposito] ?? c.proposito) : '—';
  /** El acceso que más le sirve según lo que dijo al registrarse (solo resalta, no oculta nada). */
  const sugerido = c.proposito === 'rentar' ? '/rentas' : c.proposito === 'comprar' ? '/colonias' : null;
  const accesos = admin ? [ACCESO_ADMIN, ...ACCESOS] : ACCESOS;

  return (
    <div className="panel">
      <section className="panel-cabecera" aria-labelledby="h-panel">
        <span className="panel-avatar" aria-hidden="true">{c.usuario.charAt(0).toUpperCase()}</span>
        <div>
          <p className="panel-eyebrow">{admin ? 'Cuenta de administración' : 'Panel de usuario'}</p>
          <h1 id="h-panel">Hola, {c.usuario}</h1>
          <p className="panel-sellos">
            <span className="sello claro">{ETIQUETA_ROL[c.rol]}</span>
            {c.es_demo && <span className="sello warn">Cuenta de demostración</span>}
            <span className="panel-desde">Miembro desde el {fechaLarga(c.creado_en)}</span>
          </p>
        </div>
        <span className="panel-azulejos" aria-hidden="true"><i /><i /><i /><i /></span>
      </section>

      {c.es_demo && (
        <p className="aviso-borrador"><strong>Estás usando una cuenta de demostración</strong> (contraseña trivial, solo para entornos locales). Crea una cuenta propia para guardar tu actividad.</p>
      )}

      <section className="kpis kpis-panel" aria-label="Resumen de tu cuenta">
        <div><b>{dias === 0 ? 'Hoy' : num(dias)}</b><span>{dias === 0 ? 'creaste tu cuenta' : dias === 1 ? 'día con tu cuenta' : 'días con tu cuenta'}</span></div>
        <div><b>{fechaMX(c.ultimo_acceso)}</b><span>último acceso</span></div>
        {!admin && <div><b>{usoPrevisto}</b><span>uso previsto</span></div>}
      </section>

      <section aria-labelledby="h-accesos">
        <h2 id="h-accesos">Accesos rápidos</h2>
        <ul className="panel-accesos">
          {accesos.map((a) => {
            const esSugerido = a.href === sugerido;
            return (
              <li key={a.href}>
                <Link href={a.href} className={`panel-acceso${esSugerido || a.href === '/admin' ? ' destacado' : ''}`}>
                  <span className="ico"><Icono k={a.icono} /></span>
                  <strong>{a.titulo}</strong>
                  <span className="desc">{a.texto}</span>
                  {esSugerido && <span className="sello">Según tu uso previsto</span>}
                  <span className="flecha" aria-hidden="true">→</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {calidad && (
        <section aria-labelledby="h-panorama">
          <h2 id="h-panorama">Panorama de rentas en Puebla</h2>
          <AvisoDatos modos={{ zonas: null, precios: calidad.modo }} capas={['precios']} />
          <div className="kpis kpis-panel">
            <div><b>{mxn(calidad.distribucion.precio_mxn?.mediana)}</b><span>renta mensual mediana</span></div>
            <div><b>{num(calidad.zonas.con_listados)}</b><span>zonas con precios de renta</span></div>
            <div><b>{num(calidad.totales.acumulado.listados)}</b><span>anuncios acumulados</span></div>
          </div>
          <p className="nota">Cifras de la última carga ({fechaMX(calidad.generado_en)}). Detalle por zona en <Link href="/rentas">Precios de renta</Link>.</p>
        </section>
      )}

      <div className="panel-cols">
        <section className="panel-tarjeta" aria-labelledby="h-datos">
          <h2 id="h-datos">Datos de tu cuenta</h2>
          <dl className="ficha">
            <dt>Usuario</dt><dd>{c.usuario}</dd>
            <dt>Correo</dt><dd>{c.correo ?? '—'}</dd>
            {!admin && <><dt>Uso previsto</dt><dd>{usoPrevisto}</dd></>}
            <dt>Cuenta creada</dt><dd>{fechaMX(c.creado_en)}</dd>
            <dt>Último acceso</dt><dd>{fechaMX(c.ultimo_acceso)}</dd>
          </dl>
          <p className="nota">Tu correo solo se muestra aquí: el panel de administración no lo muestra.</p>
        </section>

        <section className="panel-tarjeta" aria-labelledby="h-pronto">
          <h2 id="h-pronto">Próximamente</h2>
          <ul className="panel-pronto">
            <li>
              <b>Favoritos y alertas <span className="sello warn">pronto</span></b>
              <p>Guarda zonas y recibe un aviso cuando un precio se vea inflado frente a su zona.</p>
            </li>
            <li>
              <b>Prueba de solvencia <span className="sello warn">pronto</span></b>
              <p>Demuestra que puedes pagar una renta sin entregar tus estados de cuenta.</p>
            </li>
          </ul>
        </section>
      </div>

      <section className="panel-sesion" aria-label="Sesión">
        <p>¿Terminaste? Cierra tu sesión para proteger tu cuenta, sobre todo si usas un equipo compartido.</p>
        <form action={cerrarSesion}><button type="submit" className="secundario">Cerrar sesión</button></form>
      </section>
    </div>
  );
}
