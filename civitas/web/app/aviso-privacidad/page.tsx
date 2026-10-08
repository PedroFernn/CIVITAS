import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Aviso de Privacidad — CIVITAS' };

const VERSION = '0.1 (borrador)';
const FECHA = '1 de octubre de 2026';

// UC-V3 · OE4. BORRADOR: debe revisarse con asesoría legal (LFPDPPP) antes de capturar datos personales.
export default function AvisoPrivacidad() {
  return (
    <article>
      <h1>Aviso de Privacidad</h1>
      <p className="aviso-borrador">
        Versión {VERSION} · vigente desde {FECHA}. Documento preliminar sujeto a revisión legal.
      </p>

      <h2>1. Responsable</h2>
      <p>[Nombre o razón social del responsable], con domicilio en [domicilio], es responsable del tratamiento de los datos personales conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).</p>

      <h2>2. Datos que recabamos hoy</h2>
      <p>En esta etapa el sitio es solo informativo: <strong>no recabamos datos personales</strong>, no existe registro de usuarios ni formularios, y no usamos cookies de seguimiento ni analítica de terceros. Los servidores pueden conservar registros técnicos mínimos (por ejemplo, fecha y ruta solicitada) para seguridad y disponibilidad.</p>

      <h2>3. Datos que podríamos recabar en el futuro</h2>
      <p>Cuando se habilite el registro de cuentas, podremos solicitar datos de contacto e identificación. Antes de hacerlo publicaremos una versión actualizada de este aviso con las finalidades, y no capturaremos ningún dato hasta que esté publicada.</p>

      <h2>4. Finalidades</h2>
      <p>Operar la plataforma, mantener su seguridad y, en su caso, atender solicitudes de las personas usuarias.</p>

      <h2>5. Derechos ARCO</h2>
      <p>Puedes ejercer tus derechos de Acceso, Rectificación, Cancelación y Oposición escribiendo a [correo de contacto de privacidad].</p>

      <h2>6. Transferencias</h2>
      <p>No transferimos datos personales a terceros.</p>

      <h2>7. Cambios al aviso</h2>
      <p>Cualquier modificación se publicará en esta misma página, con su número de versión y fecha.</p>
    </article>
  );
}
