/** Marca de CIVITAS: cuatro «azulejos» (zonas) que juntos forman una flor de talavera. Vectorial, sin imágenes externas. */
export function Isotipo({ tamano = 36 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <path d="M2 19V11a9 9 0 0 1 9-9h8v17z" fill="#f3c316" />
      <path d="M21 2h8a9 9 0 0 1 9 9v8H21z" fill="#8fb0f2" />
      <path d="M2 21h17v17h-8a9 9 0 0 1-9-9z" fill="#4f7fe0" />
      <path d="M21 21h17v8a9 9 0 0 1-9 9h-8z" fill="#fff" />
    </svg>
  );
}

export default function Marca() {
  return (
    <span className="marca-logo">
      <Isotipo />
      <span className="marca-texto"><b>CIVITAS</b><small>Observatorio urbano de Puebla</small></span>
    </span>
  );
}
