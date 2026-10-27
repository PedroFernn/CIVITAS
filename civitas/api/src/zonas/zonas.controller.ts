import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { parseFiltrosZonas } from './filtros-zonas';
import { ZonasService } from './zonas.service';

const PARAMS = [
  ['q', 'Texto: nombre, CVEGEO o ciudad (sin acentos ni mayúsculas; todos los términos deben coincidir)'],
  ['orden', 'relevancia (con q) | nombre | renta | precio_m2 | comercios | paradas | listados'],
  ['min_renta', 'Renta mediana mínima (solo zonas con estadística publicable)'], ['max_renta', 'Renta mediana máxima'],
  ['con_precio', 'true: solo zonas con ≥5 listados'], ['ciudad', 'Ciudad'], ['piloto', 'true (por defecto) solo piloto'],
  ['limit', 'Máx. 200 (lista) · 20 (buscar)'], ['offset', 'Paginación'],
] as const;

/** MVP-4 · catálogo v1 (solo lectura): lista, búsqueda, mapa y ficha de zona con la mediana de precio por m². */
@ApiTags('zonas')
@Controller('zonas')
export class ZonasController {
  constructor(private readonly svc: ZonasService) {}

  @Get()
  @ApiOperation({ summary: 'Catálogo de zonas con mediana de renta y de precio por m² (se suprimen con menos de 5 listados) — RF-1.1' })
  @ApiQuery({ name: 'q', required: false }) @ApiQuery({ name: 'orden', required: false }) @ApiQuery({ name: 'min_renta', required: false })
  @ApiQuery({ name: 'max_renta', required: false }) @ApiQuery({ name: 'con_precio', required: false }) @ApiQuery({ name: 'ciudad', required: false })
  @ApiQuery({ name: 'piloto', required: false }) @ApiQuery({ name: 'limit', required: false }) @ApiQuery({ name: 'offset', required: false })
  listar(@Query() q: Record<string, string>) {
    return this.svc.listar(parseFiltrosZonas(q));
  }

  // Las rutas fijas van antes de ':id' para que "buscar" no se interprete como UUID.
  @Get('buscar')
  @ApiOperation({ summary: 'Autocompletado por nombre, CVEGEO o ciudad (barra de la navbar). Sin q: zonas sugeridas' })
  @ApiQuery({ name: 'q', required: false }) @ApiQuery({ name: 'limit', required: false, description: 'Máx. 20 (por defecto 8)' })
  buscar(@Query() q: Record<string, string>) {
    return this.svc.buscar(parseFiltrosZonas(q, 20, 8));
  }

  @Get('geojson')
  @ApiOperation({ summary: 'Zonas como FeatureCollection GeoJSON con renta y precio por m² (mapa Leaflet)' })
  geojson(@Query() q: Record<string, string>) {
    return this.svc.geojson(parseFiltrosZonas(q, 500, 500));
  }

  @Get('validacion')
  @ApiOperation({ summary: 'Último resultado del checklist "Para pasar" de MVP-4' })
  async validacion() {
    const r = await this.svc.ultimaValidacion();
    if (!r) throw new NotFoundException('Aún no hay validaciones de MVP-4: ejecuta `docker compose run --rm etl mvp4`');
    return r;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ficha de zona: atributos, mediana por m², referencia de la ciudad, trazabilidad y últimos listados' })
  detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.detalle(id);
  }
}
