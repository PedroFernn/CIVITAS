/** Pruebas unitarias sin base de datos: lectores, alias de columnas y validación de coordenadas. */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { zipSync } from 'fflate';
import { coord } from '../../src/etl/loaders';
import { leerDenue, leerParadas, leerZonas } from '../../src/etl/readers';

const tmp = () => mkdtempSync(path.join(tmpdir(), 'civitas-'));
const todo = async <T>(g: AsyncGenerator<T>) => { const o: T[] = []; for await (const x of g) o.push(x); return o; };

describe('coord', () => {
  it('válidas y rechazos', () => {
    expect(coord('19.04', '-98.20')).toEqual([19.04, -98.2]);
    expect(coord(null, '-98')).toBe('sin coordenadas');
    expect(coord('abc', '-98')).toBe('coordenadas no numéricas');
    expect(coord('nan', '-98')).toBe('coordenadas no finitas');
    expect(coord('0', '0')).toMatch(/^coordenadas fuera de México/);
    expect(coord('0', '0')).toBe('coordenadas fuera de México (0.0, 0.0)');
    expect(coord('48.85', '2.35')).toMatch(/^coordenadas fuera de México/);
  });
});

describe('lectores', () => {
  it('DENUE: CSV en zip, latin-1, columnas en mayúsculas, ignora diccionarios', async () => {
    const csv = 'ID,NOM_ESTAB,CODIGO_ACT,NOMBRE_ACT,PER_OCU,CVE_ENT,CVE_MUN,LATITUD,LONGITUD\n1,Tienda Ñandú,461110,Abarrotes,0 a 5,21,114,19.04,-98.2\n';
    const zp = path.join(tmp(), 'denue.zip');
    writeFileSync(zp, zipSync({
      'conjunto_de_datos/denue_inegi_21_.csv': new Uint8Array(Buffer.from(csv, 'latin1')),
      'diccionario_de_datos/diccionario.csv': new Uint8Array(Buffer.from('x,y\n1,2\n')),
    }));
    const filas = await todo(leerDenue(zp));
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ nombre: 'Tienda Ñandú', codigoAct: '461110', lat: '19.04', fila: 2 });
  });

  it('DENUE: UTF-8 con BOM', async () => {
    const f = path.join(tmp(), 'd.csv');
    writeFileSync(f, '﻿id,nom_estab,codigo_act,latitud,longitud\n7,Ñ,461110,19,-98\n', 'utf8');
    const [u] = await todo(leerDenue(f));
    expect(u).toMatchObject({ idDenue: '7', nombre: 'Ñ' });
  });

  it('paradas: GTFS csv y geojson', async () => {
    const d = tmp();
    writeFileSync(path.join(d, 'stops.txt'), 'stop_id,stop_name,stop_lat,stop_lon\nA,Uno,19.0,-98.2\n', 'utf8');
    const [p] = await todo(leerParadas(path.join(d, 'stops.txt')));
    expect([p.referencia, p.lat, p.lon]).toEqual(['A', '19.0', '-98.2']);
    const gj = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { stop_id: 'B', name: 'Dos' }, geometry: { type: 'Point', coordinates: [-98.3, 19.1] } }] };
    writeFileSync(path.join(d, 'p.geojson'), JSON.stringify(gj), 'utf8');
    const [q] = await todo(leerParadas(path.join(d, 'p.geojson')));
    expect([q.referencia, q.lat, q.lon]).toEqual(['B', '19.1', '-98.3']);
  });

  it('paradas: GTFS en zip toma stops.txt aunque haya otros archivos', async () => {
    const zp = path.join(tmp(), 'gtfs.zip');
    writeFileSync(zp, zipSync({
      'agency.txt': new Uint8Array(Buffer.from('agency_id,agency_name\n1,X\n')),
      'stops.txt': new Uint8Array(Buffer.from('stop_id,stop_name,stop_lat,stop_lon\nS1,Uno,19.0,-98.2\n')),
    }));
    const [p] = await todo(leerParadas(zp));
    expect(p.referencia).toBe('S1');
  });

  it('zonas geojson: deriva CVEGEO de sus partes', async () => {
    const gj = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      properties: { CVE_ENT: '21', CVE_MUN: '114', CVE_LOC: '0001', CVE_AGEB: '0123' } }] };
    const f = path.join(tmp(), 'z.geojson');
    writeFileSync(f, JSON.stringify(gj), 'utf8');
    const [z] = await todo(leerZonas(f));
    expect(z).toMatchObject({ claveGeo: '2111400010123', cveMun: '114' });
  });

  it('zonas .gpkg: error claro con la conversión sugerida', async () => {
    await expect(todo(leerZonas('/tmp/x.gpkg'))).rejects.toThrow(/ogr2ogr/);
  });
});
