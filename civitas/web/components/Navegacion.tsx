'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Menú principal: en pantallas angostas se pliega detrás de un botón, y siempre marca la sección en la que estás. */
export default function Navegacion({ enlaces, children }: { enlaces: { href: string; etiqueta: string }[]; children?: React.ReactNode }) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  useEffect(() => setAbierto(false), [ruta]);
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto]);
  const activo = (href: string) => ruta === href || ruta.startsWith(`${href}/`);
  return (
    <>
      <button type="button" className="menu-boton" aria-expanded={abierto} aria-controls="menu-principal" onClick={() => setAbierto((a) => !a)}>
        <span className="solo-lectores">{abierto ? 'Cerrar menú' : 'Abrir menú'}</span><i aria-hidden="true" />
      </button>
      <nav id="menu-principal" aria-label="Principal" className={abierto ? 'abierto' : ''}>
        {enlaces.map((e) => <Link key={e.href} href={e.href} aria-current={activo(e.href) ? 'page' : undefined}>{e.etiqueta}</Link>)}
        {children}
      </nav>
    </>
  );
}
