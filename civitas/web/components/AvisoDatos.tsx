import type { ModosDatos } from '@/lib/modo';

/**
 * Aviso de honestidad sobre el origen de los datos. Depende del modo de cada capa por separado:
 * si las zonas son reales pero los precios son de demostración, lo dice (y no deja pasar los precios por reales).
 * `capas` limita el aviso a lo que la página realmente muestra.
 */
export default function AvisoDatos({ modos, capas = ['zonas', 'precios'] }: { modos: ModosDatos; capas?: ('zonas' | 'precios')[] }) {
  const zonasDemo = capas.includes('zonas') && modos.zonas === 'fixture';
  const preciosDemo = capas.includes('precios') && modos.precios === 'fixture';
  if (!zonasDemo && !preciosDemo) return null;
  if (zonasDemo && preciosDemo) {
    return <p className="aviso" role="note"><strong>Datos de demostración.</strong> Las zonas y los precios son de prueba: sirven para ver cómo funciona la plataforma, no describen Puebla.</p>;
  }
  if (preciosDemo) {
    return (
      <p className="aviso" role="note"><strong>Precios de demostración.</strong> Las zonas, los comercios y las paradas son datos reales (INEGI y OpenStreetMap).
        Los precios de renta aún no tienen una fuente abierta y son inventados para mostrar cómo funciona el sistema.</p>
    );
  }
  return <p className="aviso" role="note"><strong>Zonas de demostración.</strong> Las zonas, comercios y paradas son de prueba, no datos reales del INEGI.</p>;
}
