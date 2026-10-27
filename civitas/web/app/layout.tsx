import type { Metadata } from 'next';
import Link from 'next/link';
import BuscadorZonas from '@/components/BuscadorZonas';
import { cerrarSesion } from './acciones-auth';
import { usuarioActual } from '@/lib/sesion';
import './globals.css';

export const metadata: Metadata = {
  title: 'CIVITAS · Observatorio urbano',
  description: 'Asequibilidad inmobiliaria y datos abiertos de zonas urbanas',
  icons: { icon: '/favicon.svg' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sesion = await usuarioActual();
  return (
    <html lang="es">
      <body>
        <header>
          <Link href="/" className="marca"><img src="/civitas_logo.svg" alt="CIVITAS" height={44} /></Link>
          <BuscadorZonas />
          <nav><Link href="/colonias">Catálogo</Link><Link href="/zonas">Zonas piloto</Link><Link href="/rentas">Rentas</Link><Link href="/aviso-privacidad">Aviso de privacidad</Link>            {sesion ? (
              <>
                {sesion.cuenta.rol === 'administrador' && <Link href="/admin">Panel</Link>}
                <Link href="/mi-cuenta" className="sesion">{sesion.cuenta.usuario}</Link>
                <form action={cerrarSesion}><button type="submit" className="enlace">Salir</button></form>
              </>
            ) : (
              <><Link href="/iniciar-sesion">Entrar</Link><Link href="/crear-cuenta" className="boton-nav">Crear cuenta</Link></>
            )}
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          CIVITAS · Observatorio urbano · <Link href="/aviso-privacidad">Aviso de privacidad</Link>
        </footer>
      </body>
    </html>
  );
}
