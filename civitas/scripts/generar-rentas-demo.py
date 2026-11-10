#!/usr/bin/env python3
"""Genera listados de renta de DEMOSTRACIÓN dentro de las AGEB reales de Puebla (data/raw/rentas-demo/renta_demo_puebla.csv).

⚠ Los precios son SINTÉTICOS. No existe una fuente abierta de rentas por zona (ADR-002 prevé captura manual), así que, por decisión explícita del
equipo, la demo usa precios inventados SOBRE zonas, comercios y paradas reales. Se cargan siempre como modo `fixture`
(`etl mvp3 --fuente fixture --listados …`), nunca como `real`, y la UI y la validación lo avisan.

Modelo (deliberadamente simple, no pretende describir el mercado): renta base por m² que baja con la distancia al centro histórico, más un
efecto aleatorio fijo por zona y ruido por anuncio. Semilla fija: mismos datos en cada corrida.

Uso:  python3 scripts/generar-rentas-demo.py   (desde civitas/, después de scripts/preparar-datos-reales.py)
"""
import csv, json, math, random
from datetime import date, timedelta
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
AGEB = RAIZ / 'data' / 'raw' / 'mgn' / 'agebu_21_114.geojson'
SALIDA = RAIZ / 'data' / 'raw' / 'rentas-demo' / 'renta_demo_puebla.csv'
CENTRO = (19.0433, -98.1982)  # Zócalo de Puebla (lat, lon)
POR_ZONA = (8, 16)
HOY = date(2026, 11, 9)


def anillos(g):
    return g['coordinates'] if g['type'] == 'Polygon' else [p for poly in g['coordinates'] for p in poly]


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
    for poly in poligonos(g):
        if dentro_anillo(x, y, poly[0]) and not any(dentro_anillo(x, y, h) for h in poly[1:]):
            return True
    return False


def punto_en(g, rng):
    pts = [p for a in anillos(g) for p in a]
    x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
    y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
    for _ in range(200):
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        if dentro(x, y, g):
            return x, y
    return None


def km(lat, lon):
    return math.hypot((lat - CENTRO[0]) * 111.0, (lon - CENTRO[1]) * 111.0 * math.cos(math.radians(CENTRO[0])))


def main() -> None:
    rng = random.Random(2026)
    zonas = json.load(open(AGEB, encoding='utf-8'))['features']
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with open(SALIDA, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['id_anuncio', 'url', 'tipo', 'precio', 'moneda', 'superficie_m2', 'recamaras', 'latitud', 'longitud', 'fecha_publicacion'])
        for z in zonas:
            efecto = rng.gauss(0, 0.10)  # «carácter» fijo de la zona
            for _ in range(rng.randint(*POR_ZONA)):
                p = punto_en(z['geometry'], rng)
                if not p:
                    break
                lon, lat = p
                d = km(lat, lon)
                m2_base = 70 + 190 * math.exp(-d / 6.0)  # $/m² al mes: ~260 en el centro, ~70 en la periferia
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
                precio = m2_base * sup * factor * math.exp(efecto + rng.gauss(0, 0.14))
                precio = int(round(max(1500, precio) / 50) * 50)
                n += 1
                w.writerow([f'demo-{n:05d}', '', tipo, precio, 'MXN', sup, rec, f'{lat:.6f}', f'{lon:.6f}',
                            (HOY - timedelta(days=rng.randint(0, 80))).isoformat()])
    print(f'{n} listados DEMO en {SALIDA.relative_to(RAIZ)} ({len(zonas)} zonas)')


if __name__ == '__main__':
    main()
