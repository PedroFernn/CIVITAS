import { GLOSARIO, type ClaveGlosario } from '@/lib/glosario';

/**
 * Nombre amigable de un indicador con un «?» que explica qué es. Funciona con ratón (hover), teclado (foco) y lectores de pantalla
 * (el texto viaja en aria-label). Sin JavaScript: es solo CSS.
 * `etiqueta` permite mostrar otro texto manteniendo la explicación (p. ej. «renta típica» en minúsculas dentro de una frase).
 */
export default function Termino({ k, etiqueta }: { k: ClaveGlosario; etiqueta?: string }) {
  const g = GLOSARIO[k];
  const texto = etiqueta ?? g.etiqueta;
  return (
    <span className="termino" tabIndex={0} role="note" aria-label={`${texto}: ${g.texto}`} data-ayuda={g.texto}>
      {texto}<i aria-hidden="true">?</i>
    </span>
  );
}
