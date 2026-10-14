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
    </div>
  );
}
