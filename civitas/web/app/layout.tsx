import type { Metadata } from 'next';
import { Bricolage_Grotesque, Public_Sans } from 'next/font/google';
import Link from 'next/link';
import BuscadorZonas from '@/components/BuscadorZonas';
import Marca from '@/components/Marca';
import Navegacion from '@/components/Navegacion';
import { cerrarSesion } from './acciones-auth';
import { usuarioActual } from '@/lib/sesion';
import './globals.css';

const titulos = Bricolage_Grotesque({ subsets: ['latin'], variable: '--f-titulos', display: 'swap' });
const cuerpo = Public_Sans({ subsets: ['latin'], variable: '--f-cuerpo', display: 'swap' });

export const metadata: Metadata = {
  title: 'CIVITAS · Cuánto cuesta vivir en tu colonia',
  description: 'Precios de renta y datos abiertos de las zonas de Puebla, explicados en claro',
  icons: { icon: '/favicon.svg' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sesion = await usuarioActual();
  return (
    <html lang="es" className={`${titulos.variable} ${cuerpo.variable}`}>
      <body>
        <a className="salto" href="#contenido">Saltar al contenido</a>
        <header>
          <Link href="/" className="marca" aria-label="CIVITAS, inicio"><Marca /></Link>
          <BuscadorZonas />
          <Navegacion enlaces={[{ href: '/colonias', etiqueta: 'Explorar zonas' }, { href: '/comparar', etiqueta: 'Comparar' }, { href: '/rentas', etiqueta: 'Precios de renta' }, { href: '/zonas', etiqueta: 'Datos de apoyo' }]}>
            {sesion ? (
              <>
                {sesion.cuenta.rol === 'administrador' && <Link href="/admin">Panel</Link>}
                <Link href="/mi-cuenta" className="sesion">{sesion.cuenta.usuario}</Link>
                <form action={cerrarSesion}><button type="submit" className="enlace">Salir</button></form>
              </>
            ) : (
              <><Link href="/iniciar-sesion">Entrar</Link><Link href="/crear-cuenta" className="boton-nav">Crear cuenta</Link></>
            )}
          </Navegacion>
        </header>
        <main id="contenido">{children}</main>
        <footer>
          <p><b>CIVITAS</b> · Observatorio urbano de Puebla · <Link href="/aviso-privacidad">Aviso de privacidad</Link></p>
          <p className="fuentes">
            Zonas, municipios y población: INEGI, Marco Geoestadístico (dic. 2025) y Censo de Población y Vivienda 2020. Comercios: INEGI, DENUE.
            Paradas y mapa base: © <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer">colaboradores de OpenStreetMap</a> (licencia ODbL).
          </p>
        </footer>
      </body>
    </html>
  );
}
