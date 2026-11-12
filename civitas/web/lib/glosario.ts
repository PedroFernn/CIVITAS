/** Glosario en lenguaje llano: cada término técnico de la plataforma con su nombre amigable y una explicación corta. */
export interface EntradaGlosario { etiqueta: string; texto: string }

export const GLOSARIO = {
  mediana: { etiqueta: 'Renta típica', texto: 'Es la renta del punto medio: la mitad de los anuncios cuesta menos y la otra mitad más. Es más justa que el promedio porque un anuncio carísimo no la distorsiona. (En estadística se llama «mediana».)' },
  rango: { etiqueta: 'Rango normal', texto: 'Va de lo que cuestan los anuncios más baratos a lo que cuestan los más caros, sin contar los extremos. La mayoría de las rentas de la zona cae aquí. (Técnicamente: percentiles 25 y 75.)' },
  p25: { etiqueta: 'Renta baja', texto: 'Una de cada cuatro rentas de la zona cuesta esto o menos. (Percentil 25.)' },
  p75: { etiqueta: 'Renta alta', texto: 'Una de cada cuatro rentas de la zona cuesta esto o más. (Percentil 75.)' },
  m2: { etiqueta: 'Renta por m²', texto: 'Cuánto se paga al mes por cada metro cuadrado. Sirve para comparar un departamento chico con una casa grande en igualdad de condiciones.' },
  vsCiudad: { etiqueta: 'Frente a la ciudad', texto: 'Compara la renta típica de la zona con la renta típica de toda la ciudad. «+10 %» significa que la zona es 10 % más cara que el resto.' },
  lugar: { etiqueta: 'Lugar por precio', texto: 'Posición de la zona al ordenar todas de la más cara (lugar 1) a la más barata.' },
  listados: { etiqueta: 'Anuncios de renta', texto: 'Cada anuncio de un inmueble en renta que recopilamos. Se guarda sin teléfonos ni nombres de quien anuncia. (En el sistema se llaman «listados».)' },
  comercios: { etiqueta: 'Comercios', texto: 'Negocios registrados por el INEGI en el DENUE (tiendas, abarrotes, mercados, etc.). Indican qué tan servida de comercio está una zona.' },
  mayoreo: { etiqueta: 'Mayoreo', texto: 'Negocios que venden grandes cantidades a otros negocios, no al público general.' },
  menudeo: { etiqueta: 'Menudeo', texto: 'Negocios que venden al público: la tienda de la esquina, el súper, la papelería.' },
  densidad: { etiqueta: 'Comercios por km²', texto: 'Cuántos negocios hay en cada kilómetro cuadrado. Mide qué tan «viva» y accesible es la zona.' },
  paradas: { etiqueta: 'Paradas de transporte', texto: 'Puntos donde se detiene el transporte público, según OpenStreetMap. Más paradas, más fácil moverse sin auto. Son solo paradas, no rutas ni horarios, y el mapa puede estar incompleto.' },
  paradasKm2: { etiqueta: 'Paradas por km²', texto: 'Cuántas paradas de transporte hay en cada kilómetro cuadrado: qué tan bien conectada está la zona.' },
  area: { etiqueta: 'Área', texto: 'Tamaño de la zona en kilómetros cuadrados.' },
  claveGeo: { etiqueta: 'Clave INEGI', texto: 'Código oficial con el que el INEGI identifica esta área del mapa. Sirve para cruzar nuestros datos con otras fuentes oficiales.' },
  zonaPiloto: { etiqueta: 'Zonas piloto', texto: 'Las 30 zonas de la capital con las que probamos el sistema completo antes de ampliarlo al resto del estado.' },
  suprimida: { etiqueta: 'Sin estadística', texto: 'Con muy pocos anuncios, la cifra no sería confiable y casi permitiría identificar un anuncio concreto, por eso no se muestra.' },
  poblacion: { etiqueta: 'Población', texto: 'Habitantes de la zona según el Censo de Población y Vivienda 2020 del INEGI. Algunas zonas pequeñas no tienen cifra porque INEGI la reserva para proteger la privacidad.' },
  viviendas: { etiqueta: 'Viviendas habitadas', texto: 'Viviendas con gente viviendo en ellas, según el Censo 2020 del INEGI.' },
  densidadHab: { etiqueta: 'Habitantes por km²', texto: 'Cuánta gente vive en cada kilómetro cuadrado: mide qué tan poblada está la zona.' },
  comerciosMil: { etiqueta: 'Comercios por cada 1,000 habitantes', texto: 'Cuántos negocios hay por cada mil personas que viven en la zona. Más negocios por habitante suele indicar una zona de paso o de compras, no solo de vivienda.' },
  municipio: { etiqueta: 'Municipio', texto: 'Nombre oficial del municipio según el INEGI. Puebla tiene 217 municipios.' },
  anomalia: { etiqueta: 'Etiqueta de precio', texto: 'Compara el precio por m² de un anuncio con el de anuncios parecidos de su misma zona (mismo tipo y número de recámaras). «Inflado» y «subprecio» avisan de un precio muy lejos de lo normal; no prueban un abuso.' },
  zRobusto: { etiqueta: 'Qué tan raro es', texto: 'Cuántas «desviaciones típicas robustas» se aleja el precio de lo normal en su zona. Pasado el umbral que calibramos, hacia arriba se marca inflado y hacia abajo, subprecio. (Técnicamente: z robusto con mediana y MAD.)' },
  demo: { etiqueta: 'Datos de demostración', texto: 'Zonas y precios generados para probar el sistema. Muestran cómo funciona la plataforma, no el mercado real de Puebla.' },
} satisfies Record<string, EntradaGlosario>;

export type ClaveGlosario = keyof typeof GLOSARIO;
