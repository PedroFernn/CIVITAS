'use client';
import MapaLeaflet from './MapaLeaflet';
import type { FeatureCatalogo } from '@/lib/zonas';

/** Minimapa de la ficha: solo el polígono de la zona (sin interacción). */
export default function MiniMapa({ feature }: { feature: FeatureCatalogo }) {
  return <MapaLeaflet features={[feature]} metrica="precio_m2" interactivo={false} altura={240} etiqueta={`Contorno de ${feature.properties.nombre}`} />;
}
