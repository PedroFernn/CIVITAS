#!/usr/bin/env python3
"""Prepara los datos REALES del municipio de Puebla (21/114) en data/raw/ para `etl mvp2 --fuente real`.

Fuentes (todas abiertas):
  · Zonas (AGEB urbanas) ... INEGI, Marco Geoestadístico dic. 2025, servicio wscatgeo (https://gaia.inegi.org.mx/wscatgeo/geo/agebu/21/114)
  · Comercios ............. INEGI, DENUE, descarga masiva de Puebla (denue_21_csv.zip, 'CSV de Puebla' completo)
  · Paradas ............... © OpenStreetMap contributors (ODbL), vía Overpass: highway=bus_stop, plataformas/paradas de bus y estaciones
  · Nombre de cada zona ... colonia (`nomb_asent`) más frecuente entre los comercios del DENUE de esa AGEB

Solo usa la biblioteca estándar. Uso:  python3 scripts/preparar-datos-reales.py   (desde civitas/)
Es idempotente: no vuelve a descargar lo que ya existe (borra el archivo para refrescarlo). `--renombrar` vuelve a calcular los nombres de zona.
"""
import csv, io, json, subprocess, sys, time, urllib.request, zipfile
from collections import Counter, defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
RAW = RAIZ / 'data' / 'raw'
ENT, MUN = '21', '114'
UA = 'civitas-escolar/1.0 (proyecto universitario BUAP)'
URL_AGEB = f'https://gaia.inegi.org.mx/wscatgeo/geo/agebu/{ENT}/{MUN}'
URL_DENUE = f'https://www.inegi.org.mx/contenidos/masiva/denue/denue_{ENT}_csv.zip'
OVERPASS = ['https://lz4.overpass-api.de/api/interpreter', 'https://overpass-api.de/api/interpreter']

AGEB = RAW / 'mgn' / f'agebu_{ENT}_{MUN}.geojson'
DENUE = RAW / 'denue' / f'denue_{ENT}_csv.zip'
PARADAS = RAW / 'transporte' / 'paradas_osm_puebla.geojson'


def bajar(url: str, destino: Path) -> None:
    if destino.exists() and destino.stat().st_size > 0:
        print(f'  ya existe {destino.relative_to(RAIZ)}')
        return
    destino.parent.mkdir(parents=True, exist_ok=True)
    print(f'  descargando {url}')
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=600) as r, open(destino, 'wb') as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)


def recorrer(c, acc):
    if isinstance(c[0], (int, float)):
        acc.append(c)
    else:
        for x in c:
            recorrer(x, acc)


# El DENUE entrega los nombres en mayúsculas y SIN acentos. Se restauran los más frecuentes (lista acotada, no un corrector general).
ACENTOS = {
    'jose': 'José', 'maria': 'María', 'garcia': 'García', 'gonzalez': 'González', 'hernandez': 'Hernández', 'lopez': 'López', 'perez': 'Pérez',
    'ramirez': 'Ramírez', 'martinez': 'Martínez', 'rodriguez': 'Rodríguez', 'sanchez': 'Sánchez', 'fernandez': 'Fernández', 'gomez': 'Gómez',
    'diaz': 'Díaz', 'agricola': 'Agrícola', 'angeles': 'Ángeles', 'angel': 'Ángel', 'andres': 'Andrés', 'nino': 'Niño', 'ninos': 'Niños',
    'cesar': 'César', 'ramon': 'Ramón', 'tomas': 'Tomás', 'jesus': 'Jesús', 'sebastian': 'Sebastián', 'bernabe': 'Bernabé', 'agustin': 'Agustín',
    'martin': 'Martín', 'ines': 'Inés', 'rosario': 'Rosario', 'victoria': 'Victoria', 'zaragoza': 'Zaragoza', 'valsequillo': 'Valsequillo',
    'ladrillera': 'Ladrillera', 'electrica': 'Eléctrica', 'historico': 'Histórico', 'organica': 'Orgánica', 'tecnologico': 'Tecnológico',
    'jardin': 'Jardín', 'pedregal': 'Pedregal', 'cuauhtemoc': 'Cuauhtémoc', 'bethlehem': 'Bethlehem', 'peñafiel': 'Peñafiel', 'penafiel': 'Peñafiel',
    'lazaro': 'Lázaro', 'cardenas': 'Cárdenas', 'alvaro': 'Álvaro', 'obregon': 'Obregón', 'xilotzingo': 'Xilotzingo', 'amalucan': 'Amalucan',
    'maravillas': 'Maravillas', 'union': 'Unión', 'libertad': 'Libertad', 'reforma': 'Reforma', 'poblana': 'Poblana', 'oriente': 'Oriente',
}


def acentuar(p: str) -> str:
    if p in ACENTOS:
        return ACENTOS[p]
    for fin, con in (('cion', 'ción'), ('ciones', 'ciones'), ('sion', 'sión')):
        if p.endswith(fin) and len(p) > len(fin):
            return p[: -len(fin)].capitalize() + con
    return p.capitalize()


def titulo(s: str) -> str:
    peq = {'de', 'del', 'la', 'las', 'los', 'el', 'y', 'en', 'a'}
    palabras = s.strip().lower().split()
    return ' '.join(p if (i and p in peq) else acentuar(p) for i, p in enumerate(palabras))


def paradas(bbox: str) -> None:
    if PARADAS.exists():
        print(f'  ya existe {PARADAS.relative_to(RAIZ)}')
        return
    cuerpo = (f'node["highway"="bus_stop"]({bbox});node["public_transport"="platform"]["bus"="yes"]({bbox});'
              f'node["public_transport"="stop_position"]["bus"="yes"]({bbox});node["railway"~"station|tram_stop"]({bbox});')
    q = f'[out:json][timeout:120];({cuerpo});out body;'
    datos = None
    for i in range(8):
        try:
            req = urllib.request.Request(OVERPASS[i % 2], data=('data=' + urllib.request.quote(q)).encode(), headers={'User-Agent': UA})
            datos = json.load(urllib.request.urlopen(req, timeout=180))
            break
        except Exception as e:  # Overpass responde 502/429 cuando está saturado
            print(f'  Overpass: {e}; reintento {i + 1}/8')
            time.sleep(25)
    if datos is None:
        sys.exit('Overpass no respondió; reintenta más tarde')
    feats, vistos = [], set()
    for e in datos['elements']:
        t = e.get('tags', {})
        if e.get('type') != 'node' or e['id'] in vistos:
            continue
        vistos.add(e['id'])
        modo = 'tren' if 'railway' in t else 'bus'
        feats.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [e['lon'], e['lat']]},
                      'properties': {'stop_id': f'osm-{e["id"]}', 'stop_name': t.get('name') or t.get('ref') or 'Parada sin nombre', 'modo': modo}})
    PARADAS.parent.mkdir(parents=True, exist_ok=True)
    json.dump({'type': 'FeatureCollection', 'features': feats,
               'metadatos': {'fuente': '© OpenStreetMap contributors (ODbL)', 'consulta': 'Overpass API', 'descargado': time.strftime('%Y-%m-%d')}},
              open(PARADAS, 'w'), ensure_ascii=False)
    print(f'  {len(feats)} paradas guardadas')


def nombrar_zonas() -> None:
    """Pone `nombre` en cada AGEB con la colonia más frecuente del DENUE (misma localidad + AGEB)."""
    gj = json.load(open(AGEB, encoding='utf-8'))
    colonias = defaultdict(Counter)
    with zipfile.ZipFile(DENUE) as z:
        miembro = next(n for n in z.namelist() if n.endswith('.csv') and 'conjunto_de_datos' in n)
        with z.open(miembro) as raw:
            for fila in csv.DictReader(io.TextIOWrapper(raw, encoding='latin1', newline='')):
                if fila['cve_mun'] == MUN and fila['nomb_asent'].strip():
                    colonias[(fila['cve_loc'], fila['ageb'])][fila['nomb_asent'].strip()] += 1
    nombres = {}
    for f in gj['features']:
        p = f['properties']
        c = colonias.get((p['cve_loc'], p['cve_ageb']))
        nombres[p['cvegeo']] = titulo(c.most_common(1)[0][0]) if c else None
    repetidos = Counter(n for n in nombres.values() if n)
    sin = 0
    for f in gj['features']:
        p = f['properties']
        n = nombres[p['cvegeo']]
        if not n:
            sin += 1
            p['nombre'] = f'Zona {p["cve_ageb"]}'
        else:
            p['nombre'] = n if repetidos[n] == 1 else f'{n} · AGEB {p["cve_ageb"]}'
    gj.setdefault('metadatos', {})['nombres'] = 'colonia (nomb_asent) más frecuente del DENUE por AGEB'
    json.dump(gj, open(AGEB, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'  {len(gj["features"])} zonas nombradas ({sin} sin comercios → «Zona <AGEB>»)')


def main() -> None:
    print('1/4 AGEB urbanas (INEGI MGN)')
    nuevo = not AGEB.exists() or '--renombrar' in sys.argv
    bajar(URL_AGEB, AGEB)
    print('2/4 DENUE (INEGI)')
    bajar(URL_DENUE, DENUE)
    gj = json.load(open(AGEB, encoding='utf-8'))
    if nuevo or 'nombres' not in gj.get('metadatos', {}):
        print('3/4 Nombres de zona')
        nombrar_zonas()
    else:
        print('3/4 Nombres de zona: ya aplicados')
    xs, ys = [], []
    pts = []
    for f in json.load(open(AGEB, encoding='utf-8'))['features']:
        recorrer(f['geometry']['coordinates'], pts)
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    print('4/4 Paradas (OpenStreetMap)')
    paradas(f'{min(ys)},{min(xs)},{max(ys)},{max(xs)}')
    print('Listo. Siguiente: docker compose run --rm etl mvp2 --fuente real --desde-cero')


if __name__ == '__main__':
    main()
