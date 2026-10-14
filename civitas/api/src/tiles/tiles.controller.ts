import { BadRequestException, Controller, Get, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { DatabaseService } from '../database/database.service';

/** Vector tiles (MVT) generados en PostGIS — ARQUITECTURA_TECNICA.md §3.4. */
@ApiTags('tiles')
@Controller('tiles')
export class TilesController {
  constructor(private readonly db: DatabaseService) {}

  @Get('colonias/:z/:x/:y.mvt')
  @ApiOperation({ summary: 'Tile MVT de zonas piloto con conteos de comercios y paradas' })
  async colonias(@Param('z') zs: string, @Param('x') xs: string, @Param('y') ys: string, @Res() res: Response) {
    const num = (v: string, max: number) => (new RegExp(`^\\d{1,${max}}$`).test(v) ? Number(v) : NaN);
    const [z, x, y] = [num(zs, 2), num(xs, 7), num(ys, 7)];
    if (!(z >= 0 && z <= 22) || !(x >= 0 && x < 2 ** z) || !(y >= 0 && y < 2 ** z)) {
      throw new BadRequestException('z/x/y fuera de rango');
    }
    const rows = await this.db.query<{ mvt: Buffer | null }>(
      `SELECT ST_AsMVT(tile, 'colonias', 4096, 'geom') AS mvt FROM (
         SELECT c.id::text AS id, c.nombre, c.clave_geo,
                COALESCE(a.num_comercios,0)::int AS num_comercios, COALESCE(a.num_paradas,0)::int AS num_paradas,
                ST_AsMVTGeom(ST_Transform(c.geom, 3857), ST_TileEnvelope($1,$2,$3), 4096, 64, true) AS geom
         FROM colonias c LEFT JOIN zona_atributos a ON a.zona_id = c.id
         WHERE c.es_piloto AND c.geom && ST_Transform(ST_TileEnvelope($1,$2,$3), 4326)  -- usa el índice GiST de geom
       ) tile`, [z, x, y]);
    res.setHeader('Content-Type', 'application/x-protobuf');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.end(rows[0]?.mvt ?? Buffer.alloc(0));
  }
}
