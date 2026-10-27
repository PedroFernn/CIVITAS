import { redirect } from 'next/navigation';
import FormRegistro from '@/components/FormRegistro';
import { destinoPorRol, usuarioActual } from '@/lib/sesion';

export const metadata = { title: 'Crear cuenta · CIVITAS' };

export default async function CrearCuenta() {
  const sesion = await usuarioActual();
  if (sesion) redirect(destinoPorRol(sesion.cuenta.rol));
  return (
    <div className="tarjeta-form">
      <h1>Crear cuenta</h1>
      <p className="nota">Con una cuenta puedes guardar favoritos y alertas (próximamente). Solo pedimos lo necesario: usuario, correo y contraseña.</p>
      <FormRegistro />
    </div>
  );
}
