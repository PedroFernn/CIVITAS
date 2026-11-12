import type { Etiqueta as Tipo } from '@/lib/zonas';

const TEXTO: Record<Tipo, { texto: string; ayuda: string }> = {
  justo: { texto: 'Precio justo', ayuda: 'Está dentro de lo normal para su zona, tipo de inmueble y recámaras.' },
  inflado: { texto: 'Inflado', ayuda: 'Cuesta mucho más por m² que anuncios parecidos de su zona.' },
  subprecio: { texto: 'Subprecio', ayuda: 'Cuesta mucho menos por m² que anuncios parecidos de su zona: conviene verificarlo.' },
};

/** Etiqueta del motor de anomalías (MVP-6). El color nunca es la única señal: lleva texto y un símbolo. */
export default function Etiqueta({ valor }: { valor: Tipo | null | undefined }) {
  if (!valor) return <span className="etiqueta etiqueta-nd" title="Sin suficientes anuncios parecidos para compararlo">Sin comparar</span>;
  const t = TEXTO[valor];
  return <span className={`etiqueta etiqueta-${valor}`} title={t.ayuda}><i aria-hidden="true">{valor === 'justo' ? '✓' : valor === 'inflado' ? '▲' : '▼'}</i>{t.texto}</span>;
}
