import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'CIVITAS · Observatorio urbano',
  description: 'Asequibilidad inmobiliaria y datos abiertos de zonas urbanas',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header>
          <Link href="/" className="marca"><img src="/civitas_logo.svg" alt="CIVITAS" height={44} /></Link>
          <nav><Link href="/zonas">Zonas piloto</Link><Link href="/rentas">Rentas</Link><Link href="/aviso-privacidad">Aviso de privacidad</Link></nav>
        </header>
        <main>{children}</main>
        <footer>
          CIVITAS · Observatorio urbano · <Link href="/aviso-privacidad">Aviso de privacidad</Link>
        </footer>
      </body>
    </html>
  );
}
