'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { guardarEntrevista, type EstadoEntrevista } from '@/app/admin/entrevistas/acciones';

export interface EntrevistaForm {
  id?: string; tipo?: string; alias?: string; realizada_en?: string; modalidad?: string; duracion_min?: number | null; zona_id?: string | null;
  renta_actual_mxn?: number | null; renta_justa_mxn?: number | null; acepta_pagar?: boolean | null; monto_dispuesto_mxn?: number | null; notas?: string;
}

/** Registro y corrección de entrevistas de precio. Sin nombre, correo ni teléfono: solo un alias. */
export default function FormEntrevista({ zonas, inicial, hoy }: { zonas: { id: string; nombre: string }[]; inicial?: EntrevistaForm; hoy: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoEntrevista, FormData>(guardarEntrevista, {});
  const c = estado.campos;
  const v = (k: keyof EntrevistaForm) => c?.[k] ?? (inicial?.[k] === null || inicial?.[k] === undefined ? '' : String(inicial?.[k]));
  const acepta = c?.acepta_pagar ?? (inicial?.acepta_pagar === true ? 'si' : inicial?.acepta_pagar === false ? 'no' : '');
  return (
    <form action={accion} className="form form-entrevista">
      {inicial?.id && <input type="hidden" name="id" value={inicial.id} />}
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      <div className="form-fila">
        <label>Quién
          <select name="tipo" required defaultValue={v('tipo') || 'inquilino'}>
            <option value="inquilino">Inquilino o estudiante</option>
            <option value="b2b">Inmobiliaria o administradora (B2B)</option>
          </select></label>
        <label>Alias <small>un seudónimo, no el nombre</small>
          <input name="alias" required minLength={2} maxLength={60} placeholder="Inquilina 1" defaultValue={v('alias')} /></label>
      </div>
      <div className="form-fila">
        <label>Fecha<input name="realizada_en" type="date" required max={hoy} defaultValue={v('realizada_en') || hoy} /></label>
        <label>Modalidad
          <select name="modalidad" defaultValue={v('modalidad') || 'presencial'}><option value="presencial">Presencial</option><option value="remota">Remota (llamada o video)</option></select></label>
        <label>Duración (min)<input name="duracion_min" type="number" min={1} max={240} inputMode="numeric" defaultValue={v('duracion_min')} /></label>
      </div>
      <label>Zona de la que habló <small>opcional</small>
        <select name="zona_id" defaultValue={v('zona_id')}><option value="">—</option>{zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}</select></label>
      <div className="form-fila">
        <label>Renta que paga o administra hoy<input name="renta_actual_mxn" type="number" min={1000} max={250000} step={100} inputMode="numeric" placeholder="$ al mes" defaultValue={v('renta_actual_mxn')} /></label>
        <label>Renta que considera justa<input name="renta_justa_mxn" type="number" min={1000} max={250000} step={100} inputMode="numeric" placeholder="$ al mes" defaultValue={v('renta_justa_mxn')} /></label>
      </div>
      <div className="form-fila">
        <label>¿Pagaría por un reporte de zona?
          <select name="acepta_pagar" defaultValue={acepta}><option value="">Sin respuesta</option><option value="si">Sí</option><option value="no">No</option></select></label>
        <label>¿Cuánto? <small>solo si dijo que sí</small>
          <input name="monto_dispuesto_mxn" type="number" min={0} max={100000} inputMode="numeric" placeholder="$" defaultValue={v('monto_dispuesto_mxn')} /></label>
      </div>
      <label>Notas <small>qué dijo del precio y por qué (mín. 20 caracteres; sin correos ni teléfonos)</small>
        <textarea name="notas" required minLength={20} maxLength={4000} rows={6} defaultValue={v('notas')} /></label>
      <div className="filtros-acciones">
        <button type="submit" disabled={pendiente}>{pendiente ? 'Guardando…' : inicial?.id ? 'Guardar cambios' : 'Guardar entrevista'}</button>
        {inicial?.id && <Link href="/admin/entrevistas" className="enlace-sec">Cancelar</Link>}
      </div>
    </form>
  );
}
