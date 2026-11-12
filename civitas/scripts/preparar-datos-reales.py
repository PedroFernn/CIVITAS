#!/usr/bin/env python3
"""Prepara los datos REALES del estado de Puebla (21) en data/raw/ para `etl mvp2 --fuente real --estado-completo`.

Fuentes (todas abiertas):
  · Zonas (AGEB urbanas) ... INEGI, Marco Geoestadístico dic. 2025, servicio wscatgeo, una consulta por municipio (217).
                              Cada AGEB trae población y viviendas del Censo 2020 (pobtot, tvivhab).
  · Municipios ............. INEGI, MGN, polígonos de los 217 municipios con población y viviendas (para la forma del estado).
  · Localidades ............ INEGI, Catálogo Único de Claves Geoestadísticas: nombre oficial de cada localidad.
  · Comercios .............. INEGI, DENUE, descarga masiva de Puebla (denue_21_csv.zip). Se guarda RECORTADO a las columnas que usa el ETL: el
                              original trae teléfono, correo y sitio web de cada negocio y no hay motivo para conservarlos ni publicarlos.
  · Paradas ................ © OpenStreetMap contributors (ODbL), vía Overpass: paradas, plataformas y estaciones de bus/tren del estado.
  · Nombre de cada zona .... colonia (`nomb_asent`) más frecuente entre los comercios del DENUE de esa AGEB
                              (llave municipio + localidad + AGEB: la clave de AGEB se repite entre municipios);
                              sin comercios, «<localidad> · AGEB <clave>».

Solo usa la biblioteca estándar. Uso:  python3 scripts/preparar-datos-reales.py [--renombrar]   (desde civitas/)
Es idempotente: no vuelve a descargar lo que ya existe (borra el archivo para refrescarlo). `--renombrar` recalcula los nombres.
"""
import csv, io, json, sys, time, urllib.request, zipfile
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
RAW = RAIZ / 'data' / 'raw'
ENT = '21'
UA = 'civitas-escolar/1.0 (proyecto universitario BUAP)'
WS = 'https://gaia.inegi.org.mx/wscatgeo'
URL_DENUE = f'https://www.inegi.org.mx/contenidos/masiva/denue/denue_{ENT}_csv.zip'
OVERPASS = ['https://lz4.overpass-api.de/api/interpreter', 'https://overpass-api.de/api/interpreter']

AGEB = RAW / 'mgn' / f'agebu_{ENT}.geojson'
MUNICIPIOS = RAW / 'municipios' / f'mgem_{ENT}.geojson'
DENUE = RAW / 'denue' / f'denue_{ENT}_recortado.zip'
# columnas del DENUE que el ETL y el nombre de las zonas necesitan (sin teléfono, correo, sitio web ni razón social)
COLUMNAS_DENUE = ['id', 'nom_estab', 'codigo_act', 'nombre_act', 'per_ocu', 'nomb_asent', 'cve_ent', 'cve_mun', 'cve_loc', 'ageb', 'latitud', 'longitud']
PARADAS = RAW / 'transporte' / f'paradas_osm_{ENT}.geojson'
# versiones anteriores (solo la capital): se borran para que el descubrimiento de archivos no encuentre dos
OBSOLETOS = [RAW / 'mgn' / 'agebu_21_114.geojson', RAW / 'transporte' / 'paradas_osm_puebla.geojson', RAW / 'denue' / f'denue_{ENT}_csv.zip']


def http(url: str, destino: Path | None = None, tiempo: int = 600, datos: bytes | None = None):
    for intento in range(6):
        try:
            req = urllib.request.Request(url, data=datos, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=tiempo) as r:
                if destino is None:
                    return r.read()
                destino.parent.mkdir(parents=True, exist_ok=True)
                with open(destino, 'wb') as f:
                    while chunk := r.read(1 << 20):
                        f.write(chunk)
                return None
        except Exception as e:  # DNS intermitente, 502 de Overpass, etc.
            print(f'  {url.split("?")[0][:70]}: {e}; reintento {intento + 1}/6', flush=True)
            time.sleep(8 * (intento + 1))
    sys.exit(f'No se pudo descargar {url}')


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
    'martin': 'Martín', 'ines': 'Inés', 'electrica': 'Eléctrica', 'historico': 'Histórico', 'organica': 'Orgánica', 'tecnologico': 'Tecnológico',
    'jardin': 'Jardín', 'cuauhtemoc': 'Cuauhtémoc', 'penafiel': 'Peñafiel', 'lazaro': 'Lázaro', 'cardenas': 'Cárdenas', 'alvaro': 'Álvaro',
    'obregon': 'Obregón', 'union': 'Unión', 'miguel': 'Miguel', 'hidalgo': 'Hidalgo', 'juarez': 'Juárez', 'rivera': 'Rivera', 'sanchez': 'Sánchez',
    'arboleda': 'Arboleda', 'amalucan': 'Amalucan', 'tecnologia': 'Tecnología', 'raul': 'Raúl', 'dario': 'Darío', 'matias': 'Matías', 'dominguez': 'Domínguez',
    'gutierrez': 'Gutiérrez', 'jimenez': 'Jiménez', 'mendez': 'Méndez', 'nuñez': 'Núñez', 'nunez': 'Núñez', 'suarez': 'Suárez', 'vazquez': 'Vázquez',
}


def acentuar(p: str) -> str:
    if p in ACENTOS:
        return ACENTOS[p]
    for fin, con in (('cion', 'ción'), ('sion', 'sión')):
        if p.endswith(fin) and len(p) > len(fin):
            return p[: -len(fin)].capitalize() + con
    return p.capitalize()


def titulo(s: str) -> str:
    peq = {'de', 'del', 'la', 'las', 'los', 'el', 'y', 'en', 'a'}
    palabras = s.strip().lower().split()
    return ' '.join(p if (i and p in peq) else acentuar(p) for i, p in enumerate(palabras))


def municipios() -> list[dict]:
    """Catálogo oficial de municipios: clave, nombre, población y viviendas."""
    return json.loads(http(f'{WS}/v2/mgem/{ENT}'))['datos']


def bajar_municipios_geo() -> None:
    if MUNICIPIOS.exists():
        print(f'  ya existe {MUNICIPIOS.relative_to(RAIZ)}')
        return
    http(f'{WS}/geo/mgem/{ENT}', MUNICIPIOS)
    print(f'  {len(json.load(open(MUNICIPIOS, encoding="utf-8"))["features"])} municipios')


def bajar_agebs() -> None:
    """Una consulta por municipio (el servicio no ofrece el estado completo) y los junta en un solo GeoJSON."""
    if AGEB.exists():
        print(f'  ya existe {AGEB.relative_to(RAIZ)}')
        return
    munis = municipios()

    def uno(m):
        ag = json.loads(http(f'{WS}/geo/agebu/{ENT}/{m["cve_mun"]}', tiempo=180))
        locs = {l['cve_loc']: l['nomgeo'] for l in json.loads(http(f'{WS}/v2/localidades/{ENT}/{m["cve_mun"]}', tiempo=120))['datos']}
        for f in ag['features']:
            f['properties']['nom_loc'] = locs.get(f['properties'].get('cve_loc'))
        return ag['features']

    feats = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for i, fs in enumerate(ex.map(uno, munis), 1):
            feats += fs
            if i % 40 == 0:
                print(f'  {i}/{len(munis)} municipios · {len(feats)} AGEB', flush=True)
    AGEB.parent.mkdir(parents=True, exist_ok=True)
    json.dump({'type': 'FeatureCollection', 'features': feats,
               'metadatos': {'CRS': 'EPSG:6365 (grados, equivalente a WGS84 a esta escala)', 'fuente': 'INEGI. Marco Geoestadístico, diciembre de 2025',
                             'estadistica': 'INEGI. Censo de Población y Vivienda 2020'}}, open(AGEB, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'  {len(feats)} AGEB urbanas de {len(munis)} municipios')


def completar_municipios() -> None:
    """Algunas AGEB llegan sin nombre de municipio (y sin población, que INEGI reserva por confidencialidad): el nombre se toma del catálogo."""
    gj = json.load(open(AGEB, encoding='utf-8'))
    nombres = {m['cve_mun']: m['nomgeo'] for m in municipios()}
    n = 0
    for f in gj['features']:
        p = f['properties']
        oficial = nombres.get(p['cve_agem'])
        if oficial and p.get('nom_agem') != oficial:
            p['nom_agem'] = oficial
            n += 1
    if n:
        json.dump(gj, open(AGEB, 'w', encoding='utf-8'), ensure_ascii=False)
        print(f'  {n} AGEB con el nombre de municipio tomado del catálogo de INEGI')


def bajar_denue() -> None:
    """Descarga el DENUE del estado y lo guarda recortado (mismo CSV, solo las columnas necesarias), en UTF-8."""
    if DENUE.exists() and DENUE.stat().st_size > 0:
        print(f'  ya existe {DENUE.relative_to(RAIZ)}')
        return
    completo = DENUE.with_name(f'denue_{ENT}_csv.zip')
    http(URL_DENUE, completo)
    with zipfile.ZipFile(completo) as z:
        miembro = next(n for n in z.namelist() if n.endswith('.csv') and 'conjunto_de_datos' in n)
        buf = io.StringIO(newline='')
        w = csv.writer(buf, lineterminator='\n')
        w.writerow(COLUMNAS_DENUE)
        n = 0
        with z.open(miembro) as raw:
            for fila in csv.DictReader(io.TextIOWrapper(raw, encoding='latin1', newline='')):
                w.writerow([fila[c] for c in COLUMNAS_DENUE])
                n += 1
    with zipfile.ZipFile(DENUE, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as out:
        out.writestr(miembro, buf.getvalue().encode('utf-8'))
    completo.unlink()
    print(f'  {n} unidades económicas guardadas, sin teléfono ni correo ({DENUE.stat().st_size / 1e6:.1f} MB)')


def nombrar_zonas() -> None:
    """Pone `nombre` en cada AGEB con la colonia más frecuente del DENUE (misma llave municipio + localidad + AGEB)."""
    gj = json.load(open(AGEB, encoding='utf-8'))
    colonias = defaultdict(Counter)
    with zipfile.ZipFile(DENUE) as z:
        miembro = next(n for n in z.namelist() if n.endswith('.csv') and 'conjunto_de_datos' in n)
        with z.open(miembro) as raw:
            for fila in csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8', newline='')):
                if fila['nomb_asent'].strip():
                    colonias[(fila['cve_mun'], fila['cve_loc'], fila['ageb'])][fila['nomb_asent'].strip()] += 1
    base, sin = {}, 0
    for f in gj['features']:
        p = f['properties']
        c = colonias.get((p['cve_agem'], p['cve_loc'], p['cve_ageb']))
        base[p['cvegeo']] = titulo(c.most_common(1)[0][0]) if c else None
    repetidos = Counter((f['properties']['cve_agem'], base[f['properties']['cvegeo']]) for f in gj['features'] if base[f['properties']['cvegeo']])
    for f in gj['features']:
        p = f['properties']
        n = base[p['cvegeo']]
        if not n:
            sin += 1
            p['nombre'] = f'{p.get("nom_loc") or p["nom_agem"]} · AGEB {p["cve_ageb"]}'
        else:
            p['nombre'] = n if repetidos[(p['cve_agem'], n)] == 1 else f'{n} · AGEB {p["cve_ageb"]}'
    gj.setdefault('metadatos', {})['nombres'] = 'colonia (nomb_asent) más frecuente del DENUE por municipio + localidad + AGEB'
    json.dump(gj, open(AGEB, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'  {len(gj["features"])} zonas nombradas ({sin} sin comercios → «localidad · AGEB»)')


def paradas() -> None:
    if PARADAS.exists():
        print(f'  ya existe {PARADAS.relative_to(RAIZ)}')
        return
    q = (f'[out:json][timeout:300];area["ISO3166-2"="MX-PUE"]->.a;(node["highway"="bus_stop"](area.a);node["public_transport"="platform"]["bus"="yes"](area.a);'
         'node["public_transport"="stop_position"]["bus"="yes"](area.a);node["railway"~"station|tram_stop"](area.a););out body;')
    datos = None
    for i in range(8):
        try:
            datos = json.loads(http(OVERPASS[i % 2], tiempo=330, datos=('data=' + urllib.request.quote(q)).encode()))
            break
        except SystemExit:
            time.sleep(25)
    if datos is None:
        sys.exit('Overpass no respondió; reintenta más tarde')
    feats, vistos = [], set()
    for e in datos['elements']:
        t = e.get('tags', {})
        if e.get('type') != 'node' or e['id'] in vistos:
            continue
        vistos.add(e['id'])
        feats.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [e['lon'], e['lat']]},
                      'properties': {'stop_id': f'osm-{e["id"]}', 'stop_name': t.get('name') or t.get('ref') or 'Parada sin nombre',
                                     'modo': 'tren' if 'railway' in t else 'bus'}})
    PARADAS.parent.mkdir(parents=True, exist_ok=True)
    json.dump({'type': 'FeatureCollection', 'features': feats,
               'metadatos': {'fuente': '© OpenStreetMap contributors (ODbL)', 'consulta': 'Overpass API, área MX-PUE', 'descargado': time.strftime('%Y-%m-%d')}},
              open(PARADAS, 'w'), ensure_ascii=False)
    print(f'  {len(feats)} paradas guardadas')


def main() -> None:
    for viejo in OBSOLETOS:
        if viejo.exists():
            viejo.unlink()
            print(f'  borrado {viejo.relative_to(RAIZ)} (solo cubría la capital)')
    print('1/5 Municipios (INEGI MGN)')
    bajar_municipios_geo()
    print('2/5 AGEB urbanas de todo el estado (INEGI MGN + Censo 2020)')
    nuevo = not AGEB.exists()
    bajar_agebs()
    completar_municipios()
    print('3/5 DENUE (INEGI)')
    bajar_denue()
    gj = json.load(open(AGEB, encoding='utf-8'))
    if nuevo or '--renombrar' in sys.argv or 'nombres' not in gj.get('metadatos', {}):
        print('4/5 Nombres de zona')
        nombrar_zonas()
    else:
        print('4/5 Nombres de zona: ya aplicados')
    print('5/5 Paradas (OpenStreetMap)')
    paradas()
    print('Listo. Siguiente: docker compose run --rm etl mvp2 --fuente real --estado-completo --desde-cero')


if __name__ == '__main__':
    main()
