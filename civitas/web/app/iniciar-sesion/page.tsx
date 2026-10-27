import { redirect } from 'next/navigation';
import FormLogin from '@/components/FormLogin';
import { destinoPorRol, estadoDemo, rutaInterna, usuarioActual } from '@/lib/sesion';

export const metadata = { title: 'Iniciar sesión · CIVITAS' };

export default async function IniciarSesion({ searchParams }: { searchParams: Promise<{ siguiente?: string }> }) {
  const sesion = await usuarioActual();
  if (sesion) redirect(destinoPorRol(sesion.cuenta.rol));
  const siguiente = rutaInterna((await searchParams).siguiente) ?? undefined;
  const demo = await estadoDemo();
  return (
    <div className="tarjeta-form">
      <h1>Iniciar sesión</h1>
      {demo && (
        <div className="aviso-borrador" role="note">
          <strong>Modo demostración.</strong> Cuentas de ejemplo: <code>usr1</code> / <code>123</code> (usuario) · <code>adm</code> / <code>456</code> (administrador).
          Deben desactivarse en un servidor público (<code>DEMO_USERS=0</code>).
        </div>
      )}
      <FormLogin siguiente={siguiente} />
    </div>
  );
}
