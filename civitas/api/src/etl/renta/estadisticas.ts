/** Contadores de una carga de listados: base del reporte de calidad. Se evalúan TODAS las filas leídas, incluso las descartadas. */
import { Resultado } from './normalizar';

export const CAMPOS_CLAVE = ['precio', 'superficie_m2', 'recamaras', 'coordenadas'] as const;
export type CampoClave = (typeof CAMPOS_CLAVE)[number];

/** Agrupa motivos con detalle numérico: "precio fuera de rango (120)" → "precio fuera de rango". */
export const motivoBase = (m: string) => m.split(' (')[0];

const suma = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

export class EstadisticasCarga {
  evaluados = 0;
  conAlgunNulo = 0;
  nulos: Record<CampoClave, number> = { precio: 0, superficie_m2: 0, recamaras: 0, coordenadas: 0 };
  /** Motivos por los que un campo clave quedó nulo o inválido (por campo). */
  invalidosPorCampo: Record<CampoClave, Map<string, number>> = {
    precio: new Map(), superficie_m2: new Map(), recamaras: new Map(), coordenadas: new Map(),
  };
  /** Conteo completo de descartes por motivo (cargas_descartes guarda como máximo 1000 filas). */
  descartesPorMotivo = new Map<string, number>();
  duplicados = 0;
  sinHuella = 0;
  columnasSensibles: string[] = [];

  /** Un listado cuenta como "con campo clave nulo" si CUALQUIERA de los cuatro campos está ausente o es inválido. */
  evaluar(r: { precio: Resultado<unknown>; superficie: Resultado<unknown>; recamaras: Resultado<unknown>; coordenadas: unknown }): void {
    this.evaluados++;
    const malos: [CampoClave, string | null][] = [
      ['precio', r.precio.ok ? null : r.precio.motivo],
      ['superficie_m2', r.superficie.ok ? null : r.superficie.motivo],
      ['recamaras', r.recamaras.ok ? null : r.recamaras.motivo],
      ['coordenadas', typeof r.coordenadas === 'string' ? r.coordenadas : null],
    ];
    let alguno = false;
    for (const [campo, motivo] of malos) {
      if (motivo === null) continue;
      alguno = true;
      this.nulos[campo]++;
      suma(this.invalidosPorCampo[campo], motivoBase(motivo));
    }
    if (alguno) this.conAlgunNulo++;
  }

  descartar(motivo: string): void {
    suma(this.descartesPorMotivo, motivoBase(motivo));
  }
}

export const aObjeto = (m: Map<string, number>): Record<string, number> =>
  Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)));
