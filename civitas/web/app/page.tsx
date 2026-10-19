import Link from 'next/link';

export default function Inicio() {
  return (
    <div className="prosa">
      <h1>CIVITAS</h1>
      <p>Observatorio urbano para entender la asequibilidad de vivir en una ciudad con datos abiertos y verificables.</p>
      <h2>Estado del proyecto</h2>
      <p>
        <strong>MVP-2 · Datos abiertos y zonas piloto:</strong> zonas piloto de Puebla con polígono, comercios (DENUE) y paradas de transporte,
        con trazabilidad de cada carga. <Link href="/zonas">Ver zonas piloto →</Link>
      </p>
      <p>
        <strong>MVP-3 · Ingesta de precios de renta:</strong> listados de renta de una fuente, normalizados (precio, m², recámaras, coordenadas),
        deduplicados y asignados a su zona, con reporte de calidad. No se guardan teléfonos ni nombres de anunciantes.{' '}
        <Link href="/rentas">Ver rentas →</Link>
      </p>
    </div>
  );
}
