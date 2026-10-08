import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'CIVITAS — Transparencia del mercado inmobiliario',
  description: 'Plataforma de transparencia de precios de renta por zona.',
};

// El pie vive en el layout raíz: aparece en TODAS las páginas (incluida 404 y el propio aviso).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body>
        <header><Link href="/">CIVITAS</Link></header>
        <main>{children}</main>
        <footer id="pie">
          © {new Date().getFullYear()} CIVITAS · <Link href="/aviso-privacidad">Aviso de Privacidad</Link>
        </footer>
      </body>
    </html>
  );
}
