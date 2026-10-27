'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { iniciarSesion, type EstadoForm } from '@/app/acciones-auth';

export default function FormLogin({ siguiente }: { siguiente?: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoForm, FormData>(iniciarSesion, {});
  return (
    <form action={accion} className="form">
      {siguiente && <input type="hidden" name="siguiente" value={siguiente} />}
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      <label>Usuario o correo electrónico
        <input name="identificador" autoComplete="username" required maxLength={254} defaultValue={estado.campos?.identificador} autoFocus />
      </label>
      <label>Contraseña
        <input name="contrasena" type="password" autoComplete="current-password" required maxLength={128} />
      </label>
      <label className="check"><input name="recordar" type="checkbox" /> Recordarme en este equipo (30 días)</label>
      <button type="submit" disabled={pendiente}>{pendiente ? 'Entrando…' : 'Entrar'}</button>
      <p className="nota">¿Nuevo? <Link href="/crear-cuenta">Crear cuenta</Link></p>
    </form>
  );
}
