import Link from 'next/link';

export default function NoEncontrada() {
  return (
    <div className="prosa">
      <h1>No encontramos esa página</h1>
      <p className="lead">La dirección no existe o cambió. Prueba por aquí:</p>
      <ul className="accesos">
        <li><Link href="/colonias"><strong>Explorar zonas</strong><span>El mapa y la lista de las zonas urbanas de Puebla.</span></Link></li>
        <li><Link href="/comparar"><strong>Comparar zonas</strong><span>Hasta tres zonas lado a lado.</span></Link></li>
        <li><Link href="/"><strong>Ir al inicio</strong><span>Qué es CIVITAS y cómo se usa.</span></Link></li>
      </ul>
    </div>
  );
}
