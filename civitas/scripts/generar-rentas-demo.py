#!/usr/bin/env python3
"""Genera listados de renta de DEMOSTRACIÓN dentro de las AGEB reales de Puebla (data/raw/rentas-demo/).

⚠ Los precios son SINTÉTICOS. No existe una fuente abierta de rentas por zona (ADR-002 prevé captura manual), así que, por decisión explícita del
equipo, la demo usa precios inventados SOBRE zonas, comercios y paradas reales. Se cargan siempre como modo `fixture`
(`etl mvp3 --fuente fixture --listados …`), nunca como `real`, y la UI y la validación lo avisan.

Salidas:
  renta_demo_estado.csv     listados en el formato de la plantilla de captura manual
  renta_demo_etiquetas.csv  la «verdad» de la demo: qué listados son justos, inflados o de subprecio. Primera línea `# origen=sembrado`:
                            el generador PLANTA las anomalías (no las juzga una persona). Sirve para calibrar y medir el motor de anomalías
                            (MVP-6); medir un método contra datos sembrados por el mismo equipo es una validación débil y el checklist lo declara.

Modelo (deliberadamente simple, no pretende describir el mercado): renta base por m² que baja con la distancia al centro de cada municipio
(el centro es el promedio de sus AGEB ponderado por población) y crece con el tamaño del municipio, más un efecto aleatorio fijo por zona y
ruido por anuncio. ~5 % de los anuncios se siembran inflados y ~3 % con subprecio. Semilla fija: mismos datos en cada corrida.

Uso:  python3 scripts/generar-rentas-demo.py   (desde civitas/, después de scripts/preparar-datos-reales.py)
"""
import csv, json, math, random
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
AGEB = RAIZ / 'data' / 'raw' / 'mgn' / 'agebu_21.geojson'
MUNICIPIOS = RAIZ / 'data' / 'raw' / 'municipios' / 'mgem_21.geojson'
SALIDA = RAIZ / 'data' / 'raw' / 'rentas-demo' / 'renta_demo_estado.csv'
ETIQUETAS = RAIZ / 'data' / 'raw' / 'rentas-demo' / 'renta_demo_etiquetas.csv'
OBSOLETOS = [RAIZ / 'data' / 'raw' / 'rentas-demo' / 'renta_demo_puebla.csv']
POR_ZONA = (8, 15)
P_INFLADO, P_SUBPRECIO = 0.05, 0.03
HOY = date(2026, 11, 9)


def poligonos(g):
    return [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']


def dentro_anillo(x, y, anillo):
    r = False
    j = len(anillo) - 1
    for i in range(len(anillo)):
        xi, yi = anillo[i][:2]
        xj, yj = anillo[j][:2]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            r = not r
        j = i
    return r


def dentro(x, y, g):
    return any(dentro_anillo(x, y, p[0]) and not any(dentro_anillo(x, y, h) for h in p[1:]) for p in poligonos(g))


def caja(g):
    pts = [p for poly in poligonos(g) for a in poly for p in a]
    return min(p[0] for p in pts), max(p[0] for p in pts), min(p[1] for p in pts), max(p[1] for p in pts)


def punto_en(g, cj, rng):
    x0, x1, y0, y1 = cj
    for _ in range(200):
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        if dentro(x, y, g):
            return x, y
    return None


def km(lat1, lon1, lat2, lon2):
    return math.hypot((lat1 - lat2) * 111.0, (lon1 - lon2) * 111.0 * math.cos(math.radians(lat2)))


def main() -> None:
    for viejo in OBSOLETOS:
        viejo.unlink(missing_ok=True)
    rng = random.Random(2026)
    zonas = json.load(open(AGEB, encoding='utf-8'))['features']
    pob_mun = {f['properties']['cve_agem']: int(f['properties'].get('pob') or 0)
               for f in json.load(open(MUNICIPIOS, encoding='utf-8'))['features']} if MUNICIPIOS.exists() else {}

    # centro de cada municipio: promedio de los centros de sus AGEB, ponderado por población
    acum = defaultdict(lambda: [0.0, 0.0, 0.0])
    cajas = []
    for z in zonas:
        cj = caja(z['geometry'])
        cajas.append(cj)
        p = z['properties']
        w = int(p.get('pobtot') or 0) or 1
        a = acum[p['cve_agem']]
        a[0] += w * (cj[2] + cj[3]) / 2
        a[1] += w * (cj[0] + cj[1]) / 2
        a[2] += w
    centro = {m: (a[0] / a[2], a[1] / a[2]) for m, a in acum.items()}

    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    conteo = {'justo': 0, 'inflado': 0, 'subprecio': 0}
    with open(SALIDA, 'w', newline='', encoding='utf-8') as f, open(ETIQUETAS, 'w', newline='', encoding='utf-8') as fe:
        w, we = csv.writer(f), csv.writer(fe)
        w.writerow(['id_anuncio', 'url', 'tipo', 'precio', 'moneda', 'superficie_m2', 'recamaras', 'latitud', 'longitud', 'fecha_publicacion'])
        fe.write('# origen=sembrado\n')
        we.writerow(['id_anuncio', 'etiqueta'])
        for z, cj in zip(zonas, cajas):
            mun = z['properties']['cve_agem']
            pob = pob_mun.get(mun) or 20000
            escala = min(1.0, max(0.45, 0.45 + 0.55 * (math.log10(max(pob, 1000)) - 3.7) / (6.2 - 3.7)))
            lat0, lon0 = centro[mun]
            efecto = rng.gauss(0, 0.10)  # «carácter» fijo de la zona
            for _ in range(rng.randint(*POR_ZONA)):
                p = punto_en(z['geometry'], cj, rng)
                if not p:
                    break
                lon, lat = p
                d = km(lat, lon, lat0, lon0)
                m2_base = (70 + 190 * math.exp(-d / (2 + 4 * escala))) * escala  # $/m² al mes
                tipo = rng.choices(['departamento', 'casa', 'cuarto'], [0.55, 0.30, 0.15])[0]
                if tipo == 'departamento':
                    sup, rec = rng.randint(38, 120), None
                elif tipo == 'casa':
                    sup, rec = rng.randint(70, 260), None
                else:
                    sup, rec = rng.randint(10, 24), 0
                if rec is None:
                    rec = 1 if sup < 55 else 2 if sup < 90 else 3 if sup < 150 else 4
                factor = {'departamento': 1.0, 'casa': 0.88, 'cuarto': 1.35}[tipo]
                et = 'justo'
                r = rng.random()
                if r < P_INFLADO:
                    et, mult = 'inflado', rng.uniform(1.55, 2.2)
                elif r < P_INFLADO + P_SUBPRECIO:
                    et, mult = 'subprecio', rng.uniform(0.40, 0.62)
                else:
                    mult = 1.0
                precio = m2_base * sup * factor * math.exp(efecto + rng.gauss(0, 0.14)) * mult
                precio = int(round(max(1500, precio) / 50) * 50)
                n += 1
                conteo[et] += 1
                idl = f'demo-{n:05d}'
                w.writerow([idl, '', tipo, precio, 'MXN', sup, rec, f'{lat:.6f}', f'{lon:.6f}', (HOY - timedelta(days=rng.randint(0, 80))).isoformat()])
                we.writerow([idl, et])
    print(f'{n} listados DEMO en {SALIDA.relative_to(RAIZ)} ({len(zonas)} zonas) · sembrados: {conteo["inflado"]} inflados, {conteo["subprecio"]} de subprecio')
    print(f'Etiquetas (origen=sembrado) en {ETIQUETAS.relative_to(RAIZ)}')


if __name__ == '__main__':
    main()
