import { api, type ReporteCalidad, type Validacion } from '@/lib/api';

/** Origen de los datos que se muestran: zonas/comercios/paradas por un lado y precios de renta por otro (pueden diferir). */
export interface ModosDatos { zonas: 'real' | 'fixture' | null; precios: 'real' | 'fixture' | null }

export async function modosDatos(): Promise<ModosDatos> {
  const [z, p] = await Promise.all([
    api<Validacion>('/datos-abiertos/validacion').catch(() => null),
    api<ReporteCalidad>('/listados-renta/calidad').catch(() => null),
  ]);
  const m = (x: string | undefined | null) => (x === 'real' || x === 'fixture' ? x : null);
  return { zonas: m(z?.modo), precios: m(p?.modo) };
}
