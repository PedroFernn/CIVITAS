import { writeFileSync } from 'node:fs';

/**
 * Escribe un Shapefile mínimo (un polígono de un anillo + .dbf + .prj) para probar la ruta real del MGN sin depender
 * de GDAL. El anillo debe ir en sentido horario (convención de exterior en Shapefile).
 */
export function escribirShapefile(base: string, anillo: [number, number][], props: Record<string, string>, prjWkt: string): void {
  const n = anillo.length;
  const xs = anillo.map((p) => p[0]);
  const ys = anillo.map((p) => p[1]);
  const caja = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];

  const contenido = Buffer.alloc(4 + 32 + 4 + 4 + 4 + 16 * n);
  let o = 0;
  contenido.writeInt32LE(5, o); o += 4;
  for (const v of caja) { contenido.writeDoubleLE(v, o); o += 8; }
  contenido.writeInt32LE(1, o); o += 4; // partes
  contenido.writeInt32LE(n, o); o += 4; // puntos
  contenido.writeInt32LE(0, o); o += 4; // inicio de la parte 0
  for (const [x, y] of anillo) { contenido.writeDoubleLE(x, o); o += 8; contenido.writeDoubleLE(y, o); o += 8; }

  const reg = Buffer.alloc(8);
  reg.writeInt32BE(1, 0);
  reg.writeInt32BE(contenido.length / 2, 4);

  const cab = Buffer.alloc(100);
  cab.writeInt32BE(9994, 0);
  cab.writeInt32BE((100 + reg.length + contenido.length) / 2, 24);
  cab.writeInt32LE(1000, 28);
  cab.writeInt32LE(5, 32);
  [...caja, 0, 0, 0, 0].forEach((v, i) => cab.writeDoubleLE(v, 36 + i * 8));
  writeFileSync(`${base}.shp`, Buffer.concat([cab, reg, contenido]));

  // .dbf: campos de texto
  const campos = Object.entries(props);
  const largo = 1 + campos.reduce((s, [, v]) => s + Math.max(v.length, 1), 0);
  const cabDbf = Buffer.alloc(32 + 32 * campos.length + 1);
  cabDbf.writeUInt8(3, 0);
  cabDbf.writeInt32LE(1, 4);
  cabDbf.writeInt16LE(cabDbf.length, 8);
  cabDbf.writeInt16LE(largo, 10);
  campos.forEach(([k, v], i) => {
    const d = 32 + 32 * i;
    cabDbf.write(k, d, 'ascii');
    cabDbf.write('C', d + 11, 'ascii');
    cabDbf.writeUInt8(Math.max(v.length, 1), d + 16);
  });
  cabDbf.writeUInt8(0x0d, cabDbf.length - 1);
  const fila = Buffer.concat([Buffer.from(' '), ...campos.map(([, v]) => Buffer.from(v.padEnd(Math.max(v.length, 1)), 'latin1'))]);
  writeFileSync(`${base}.dbf`, Buffer.concat([cabDbf, fila, Buffer.from([0x1a])]));
  writeFileSync(`${base}.prj`, prjWkt, 'utf8');
}
