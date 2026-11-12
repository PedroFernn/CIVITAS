import Link from 'next/link';
import AvisoDatos from '@/components/AvisoDatos';
import Mosaico, { type PiezaMunicipio } from '@/components/Mosaico';
import { api, num } from '@/lib/api';
import type { GeoCatalogo } from '@/lib/zonas';
import { modosDatos } from '@/lib/modo';

export const dynamic = 'force-dynamic';

const PROBLEMAS: { titulo: string; texto: string }[] = [
  { titulo: 'Nadie sabe cuánto vale una colonia', texto: 'Los precios reales están repartidos entre portales con intereses comerciales, dependencias lentas y el «dicen que» de boca en boca.' },
  { titulo: 'Rentar exige exponer tu dinero', texto: 'Para probar que puedes pagar entregas estados de cuenta completos, cuando al arrendador solo le importa un «sí» o un «no».' },
  { titulo: 'Los precios se inflan sin contraste', texto: 'Sin una referencia pública es fácil pedir de más, y difícil saber si lo que te piden es justo.' },
  { titulo: 'La gentrificación se nota tarde', texto: 'Cuando el barrio ya cambió y los vecinos de siempre se fueron, ya no hay nada que hacer. Falta verlo venir.' },
];

const PASOS: { titulo: string; texto: string }[] = [
  { titulo: 'Reúne datos abiertos', texto: 'El mapa oficial de zonas y municipios, la población del Censo y los comercios del INEGI, y las paradas de transporte público de OpenStreetMap.' },
  { titulo: 'Recoge precios de renta', texto: 'Anuncios limpios y sin repetir, asignados a su zona. Sin teléfonos ni nombres de quien anuncia.' },
  { titulo: 'Te lo explica en claro', texto: 'Cuánto cuesta rentar en cada zona, si es cara o barata frente a su municipio, si un anuncio parece inflado y qué tan bien servida está.' },
];

const PRUEBALO: { href: string; titulo: string; texto: string }[] = [
  { href: '/colonias', titulo: 'Explorar zonas', texto: 'Un mapa y una lista de todas las zonas. Búscalas, filtra por precio o transporte y mira cuáles son más caras.' },
  { href: '/comparar', titulo: 'Comparar zonas', texto: 'Pon hasta tres zonas lado a lado: precio, comercios y transporte. Para decidir entre dos opciones.' },
  { href: '/rentas', titulo: 'Ver precios de renta', texto: 'Cuánto se paga de renta en cada zona y los anuncios que respaldan esas cifras.' },
];

export default async function Inicio() {
  // En el héroe cada zona es un punto del estado: basta un contorno muy simplificado (el HTML pesa decenas de veces menos).
  const [modos, geo, mun] = await Promise.all([
    modosDatos(),
    api<GeoCatalogo>('/zonas/geojson?limit=3000&piloto=false&simplificar=0.0012').catch(() => null),
    api<{ features: PiezaMunicipio[] }>('/municipios/geojson?simplificar=0.004').catch(() => null),
  ]);
  const zonas = geo?.features ?? [];
  const municipios = mun?.features ?? [];
  const comercios = zonas.reduce((s, z) => s + z.properties.num_comercios, 0);
  const paradas = zonas.reduce((s, z) => s + z.properties.num_paradas, 0);
  const habitantes = zonas.reduce((s, z) => s + (z.properties.poblacion ?? 0), 0);
  const millones = (n: number) => (n / 1_000_000).toLocaleString('es-MX', { maximumFractionDigits: 1 });

  return (
    <div className="portada">
      <section className="hero" aria-labelledby="h-hero">
        <div className="hero-texto">
          <h1 id="h-hero">¿Cuánto cuesta de verdad vivir en tu colonia?</h1>
          <p className="hero-lead">
            CIVITAS junta los datos abiertos del INEGI y los precios de renta de todo el estado de Puebla en un solo lugar y los explica en claro, para que decidir dónde vivir deje de ser una apuesta a ciegas.
          </p>
          <div className="hero-acciones">
            <Link className="boton boton-amarillo" href="/colonias">Explorar zonas</Link>
            <Link className="boton boton-fantasma" href="/comparar">Comparar zonas</Link>
          </div>
        </div>
        {zonas.length > 0 && (
          <div className="hero-mapa">
            <Mosaico zonas={zonas} municipios={municipios} />
            <p className="hero-cifras">
              <b>{num(zonas.length)}</b> zonas urbanas de <b>{num(municipios.length)}</b> municipios, con <b>{millones(habitantes)} millones</b> de habitantes, <b>{num(comercios)}</b> comercios y <b>{num(paradas)}</b> paradas de transporte del estado de Puebla, tomados de datos abiertos.
            </p>
          </div>
        )}
      </section>

      <AvisoDatos modos={modos} />

      <section className="bloque" aria-labelledby="h-problema">
        <h2 id="h-problema">El problema</h2>
        <p className="lead">Rentar o comprar en una ciudad con poca información tiene cuatro fallas que se alimentan entre sí.</p>
        <dl className="problemas">
          {PROBLEMAS.map((p) => (
            <div key={p.titulo}><dt>{p.titulo}</dt><dd>{p.texto}</dd></div>
          ))}
        </dl>
      </section>

      <section className="bloque" aria-labelledby="h-como">
        <h2 id="h-como">Qué hace CIVITAS</h2>
        <ol className="pasos">
          {PASOS.map((p, i) => (
            <li key={p.titulo}>
              <span className="paso-n" aria-hidden="true">{i + 1}</span>
              <div><h3>{p.titulo}</h3><p>{p.texto}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bloque" aria-labelledby="h-prueba">
        <h2 id="h-prueba">Pruébalo</h2>
        <ul className="accesos">
          {PRUEBALO.map((p) => (
            <li key={p.href}>
              <Link href={p.href}><strong>{p.titulo}</strong><span>{p.texto}</span></Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="bloque" aria-labelledby="h-estado">
        <h2 id="h-estado">Qué funciona hoy y qué sigue</h2>
        <div className="dos-col estado">
          <div>
            <h3>Ya funciona</h3>
            <ul>
              <li>Mapa y catálogo de las zonas urbanas de los 217 municipios, con búsqueda y filtros</li>
              <li>Precio típico de renta por zona, comparado con su municipio</li>
              <li>Etiqueta de precio en cada anuncio: justo, inflado o subprecio</li>
              <li>Comparador de hasta tres zonas</li>
              <li>Cuentas de usuario y captura de entrevistas de precio</li>
            </ul>
          </div>
          <div>
            <h3>Lo que sigue</h3>
            <ul>
              <li>Probar que puedes pagar una renta sin entregar tus estados de cuenta, con pruebas criptográficas</li>
              <li>Avisarte cuando aparece un anuncio inflado en tu zona</li>
              <li>Anticipar la gentrificación antes de que sea irreversible</li>
            </ul>
          </div>
        </div>
        <p className="nota">Todo se apoya en datos abiertos y cada cifra indica de dónde sale.</p>
      </section>
    </div>
  );
}
