'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { registrar, type EstadoForm } from '@/app/acciones-auth';

export default function FormRegistro() {
  const [estado, accion, pendiente] = useActionState<EstadoForm, FormData>(registrar, {});
  const c = estado.campos ?? {};
  return (
    <form action={accion} className="form">
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      <label>Nombre de usuario
        <input name="usuario" autoComplete="username" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_.\-]{3,30}" defaultValue={c.usuario} autoFocus />
        <small>3 a 30 caracteres: letras, números, punto, guion o guion bajo.</small>
      </label>
      <label>Correo electrónico
        <input name="correo" type="email" autoComplete="email" required maxLength={254} defaultValue={c.correo} />
      </label>
      <label>Contraseña
        <input name="contrasena" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
        <small>Mínimo 8 caracteres.</small>
      </label>
      <label>Repite la contraseña
        <input name="contrasena2" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
      </label>
      <fieldset>
        <legend>¿Para qué vas a usar CIVITAS?</legend>
        {[['rentar', 'Voy a rentar'], ['comprar', 'Voy a comprar'], ['otro', 'Otro']].map(([v, t]) => (
          <label key={v} className="check"><input type="radio" name="proposito" value={v} defaultChecked={(c.proposito || 'otro') === v} /> {t}</label>
        ))}
      </fieldset>
      <label className="check">
        <input name="acepta_aviso" type="checkbox" required />
        <span>Acepto el <Link href="/aviso-privacidad" target="_blank">aviso de privacidad</Link> y el tratamiento de datos descrito en él.</span>
      </label>
      <button type="submit" disabled={pendiente}>{pendiente ? 'Creando…' : 'Crear cuenta'}</button>
      <p className="nota">¿Ya tienes cuenta? <Link href="/iniciar-sesion">Entrar</Link></p>
    </form>
  );
}
