const TIPOS = {
  ddos:      { nombre: 'DDoS',      color: '#ff5c4d' },
  malware:   { nombre: 'Malware',   color: '#ffa94d' },
  intrusion: { nombre: 'Intrusión', color: '#ffe066' }
};

const PAISES = [
  { code: 'CN', nombre: 'China',          lat:  35.8, lon:  104.2 },
  { code: 'US', nombre: 'Estados Unidos', lat:  37.1, lon:  -95.7 },
  { code: 'RU', nombre: 'Rusia',          lat:  55.8, lon:   37.6 },
  { code: 'BR', nombre: 'Brasil',         lat: -15.7, lon:  -47.9 },
  { code: 'DE', nombre: 'Alemania',       lat:  51.2, lon:   10.5 },
  { code: 'IN', nombre: 'India',          lat:  20.6, lon:   78.9 },
  { code: 'GB', nombre: 'Reino Unido',    lat:  52.4, lon:   -1.5 },
  { code: 'FR', nombre: 'Francia',        lat:  46.2, lon:    2.4 },
  { code: 'KR', nombre: 'Corea del Sur',  lat:  35.9, lon:  127.7 },
  { code: 'JP', nombre: 'Japón',          lat:  36.2, lon:  138.3 },
  { code: 'UA', nombre: 'Ucrania',        lat:  48.4, lon:   31.2 },
  { code: 'NL', nombre: 'Países Bajos',   lat:  52.1, lon:    5.3 },
  { code: 'AU', nombre: 'Australia',      lat: -25.3, lon:  133.8 },
  { code: 'MX', nombre: 'México',         lat:  23.6, lon: -102.6 },
  { code: 'CA', nombre: 'Canadá',         lat:  45.4, lon:  -75.7 },
  { code: 'SG', nombre: 'Singapur',       lat:   1.4, lon:  103.8 },
  { code: 'ZA', nombre: 'Sudáfrica',      lat: -29.0, lon:   25.1 },
  { code: 'NG', nombre: 'Nigeria',        lat:   9.1, lon:    8.7 },
  { code: 'TR', nombre: 'Turquía',        lat:  39.0, lon:   32.9 },
  { code: 'IR', nombre: 'Irán',           lat:  32.4, lon:   53.7 },
  { code: 'PL', nombre: 'Polonia',        lat:  52.1, lon:   19.4 },
  { code: 'IT', nombre: 'Italia',         lat:  42.5, lon:   12.6 },
  { code: 'ES', nombre: 'España',         lat:  40.4, lon:   -3.7 },
  { code: 'SE', nombre: 'Suecia',         lat:  59.3, lon:   18.1 },
  { code: 'IL', nombre: 'Israel',         lat:  31.0, lon:   34.9 }
];

const URL_MAPA        = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
const DURACION_MIN    = 1000;
const DURACION_MAX    = 2000;
const SEGMENTOS_COLA  = 10;
const MAX_FEED        = 8;
const MAX_RECIENTES   = 100;
const MS_ENTRE_ATAQUES = 1200;

let filtroActual = 'todos';
let totalAtaques = 0;
let paisesOrigen = new Set();
let recientes    = [];

let svg         = null;
let capaPaises  = null;
let capaAtaques = null;
let proyeccion  = null;
let paisesGeo   = null;

function numeroAleatorio(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function elegirAlAzar(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function generarIP() {
  return [
    numeroAleatorio(1,   223),
    numeroAleatorio(0,   255),
    numeroAleatorio(0,   255),
    numeroAleatorio(1,   254)
  ].join('.');
}

function generarAtaque() {
  const iOrigen  = numeroAleatorio(0, PAISES.length - 1);
  let   iDestino = numeroAleatorio(0, PAISES.length - 1);
  while (iDestino === iOrigen) iDestino = numeroAleatorio(0, PAISES.length - 1);

  const origen  = PAISES[iOrigen];
  const destino = PAISES[iDestino];

  return {
    ip:             generarIP(),
    attackType:     elegirAlAzar(Object.keys(TIPOS)),
    severity:       numeroAleatorio(1, 5),
    srcCountry:     origen.nombre,
    srcCountryCode: origen.code,
    srcLat:         origen.lat,
    srcLon:         origen.lon,
    dstCountry:     destino.nombre,
    dstCountryCode: destino.code,
    dstLat:         destino.lat,
    dstLon:         destino.lon,
    createdAt:      new Date().toISOString()
  };
}

function horaDe(fechaTexto) {
  return new Date(fechaTexto).toTimeString().slice(0, 8);
}

function coincideConFiltro(ataque) {
  return filtroActual === 'todos' || ataque.attackType === filtroActual;
}

function crearElemento(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  el.className   = clase;
  el.textContent = texto;
  return el;
}

function registrarAtaque(ataque) {
  totalAtaques++;
  paisesOrigen.add(ataque.srcCountryCode);
  recientes.push(ataque);
  if (recientes.length > MAX_RECIENTES) recientes.shift();
}

function pintarFeed() {
  const lista = document.getElementById('listaFeed');
  lista.innerHTML = '';

  recientes.filter(coincideConFiltro).slice(-MAX_FEED).reverse().forEach(function (ataque) {
    const tipo = TIPOS[ataque.attackType] || TIPOS.intrusion;

    const linea1 = crearElemento('div', 'feed-linea', '');
    linea1.appendChild(crearElemento('span', 'feed-ip',   ataque.ip));
    linea1.appendChild(crearElemento('span', 'feed-hora', horaDe(ataque.createdAt)));

    const nomTipo = crearElemento('span', 'feed-tipo', tipo.nombre);
    nomTipo.style.color = tipo.color;

    const linea2 = crearElemento('div', 'feed-linea', '');
    linea2.appendChild(crearElemento('span', 'feed-pais', ataque.srcCountry));
    linea2.appendChild(nomTipo);

    const item = document.createElement('li');
    item.appendChild(linea1);
    item.appendChild(linea2);
    lista.appendChild(item);
  });
}

function actualizarContadores() {
  document.getElementById('contAtaques').textContent = totalAtaques.toLocaleString('es');
  document.getElementById('contPaises').textContent  = paisesOrigen.size;
}

function actualizarReloj() {
  document.getElementById('reloj').textContent = new Date().toTimeString().slice(0, 8);
}

function suavizar(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function crearCurva(a, b) {
  const dx    = b[0] - a[0];
  const dy    = b[1] - a[1];
  const largo = Math.hypot(dx, dy) || 1;
  const altura = Math.max(30, largo * 0.3);

  let nx = -dy / largo;
  let ny =  dx / largo;
  if (ny > 0) { nx = -nx; ny = -ny; }

  const cx = (a[0] + b[0]) / 2 + nx * altura;
  const cy = (a[1] + b[1]) / 2 + ny * altura;
  return 'M' + a[0] + ',' + a[1] + ' Q' + cx + ',' + cy + ' ' + b[0] + ',' + b[1];
}

function iniciarMapa() {
  svg         = d3.select('#mapa');
  capaPaises  = svg.append('g');
  capaAtaques = svg.append('g');
  ajustarMapa();
  cargarPaises();
  window.addEventListener('resize', ajustarMapa);
}

function ajustarMapa() {
  const caja = svg.node().getBoundingClientRect();
  proyeccion = d3.geoNaturalEarth1().fitExtent(
    [[10, 10], [caja.width - 10, caja.height - 10]],
    { type: 'Sphere' }
  );
  if (paisesGeo) pintarPaises();
}

function pintarPaises() {
  const ruta = d3.geoPath(proyeccion);
  capaPaises.selectAll('path')
    .data(paisesGeo.features)
    .join('path')
    .attr('class', 'pais')
    .attr('d', ruta);
}

async function cargarPaises() {
  try {
    const mundo = await d3.json(URL_MAPA);
    paisesGeo = topojson.feature(mundo, mundo.objects.countries);
    pintarPaises();
  } catch (err) {
    console.warn('No se pudo cargar el mapa base:', err.message);
  }
}

function marcarImpacto(punto, color) {
  capaAtaques.append('circle')
    .attr('cx', punto[0]).attr('cy', punto[1])
    .attr('r', 2).attr('fill', 'none')
    .attr('stroke', color).attr('stroke-width', 1)
    .transition().duration(500)
    .attr('r', 10).attr('stroke-opacity', 0)
    .remove();
}

function animarAtaque(ataque) {
  if (!capaAtaques || !proyeccion) return;
  if (document.hidden) return;

  const origen  = proyeccion([ataque.srcLon, ataque.srcLat]);
  const destino = proyeccion([ataque.dstLon, ataque.dstLat]);
  if (!origen || !destino) return;

  const tipo     = TIPOS[ataque.attackType] || TIPOS.intrusion;
  const grosor   = 0.8 + ataque.severity * 0.3;
  const duracion = DURACION_MIN + Math.random() * (DURACION_MAX - DURACION_MIN);

  const grupo = capaAtaques.append('g');
  const camino = grupo.append('path').attr('d', crearCurva(origen, destino)).attr('fill', 'none').node();
  const largoCamino = camino.getTotalLength();
  const largoCola   = Math.min(largoCamino * 0.35, 90);

  const tramos = [];
  for (let i = 0; i < SEGMENTOS_COLA; i++) {
    tramos.push(
      grupo.append('line')
        .attr('stroke', tipo.color)
        .attr('stroke-width', grosor)
        .attr('stroke-linecap', 'round')
        .attr('stroke-opacity', (i + 1) / SEGMENTOS_COLA)
        .node()
    );
  }

  const cabeza = grupo.append('circle').attr('r', grosor + 0.8).attr('fill', tipo.color);
  const inicio = performance.now();
  let impactoMarcado = false;

  function paso(ahora) {
    const t      = Math.min((ahora - inicio) / duracion, 1);
    const viaje  = Math.min(t / 0.85, 1);
    const avance = suavizar(viaje) * largoCamino;
    const colaActual = t < 0.85 ? largoCola : largoCola * (1 - (t - 0.85) / 0.15);

    for (let i = 0; i < SEGMENTOS_COLA; i++) {
      const desde = Math.max(0, avance - colaActual * (SEGMENTOS_COLA - i)     / SEGMENTOS_COLA);
      const hasta = Math.max(0, avance - colaActual * (SEGMENTOS_COLA - i - 1) / SEGMENTOS_COLA);
      const p1 = camino.getPointAtLength(desde);
      const p2 = camino.getPointAtLength(hasta);
      tramos[i].setAttribute('x1', p1.x); tramos[i].setAttribute('y1', p1.y);
      tramos[i].setAttribute('x2', p2.x); tramos[i].setAttribute('y2', p2.y);
    }

    const punta = camino.getPointAtLength(avance);
    cabeza.attr('cx', punta.x).attr('cy', punta.y).attr('opacity', t < 0.85 ? 1 : 0);

    if (viaje >= 1 && !impactoMarcado) {
      impactoMarcado = true;
      marcarImpacto(destino, tipo.color);
    }

    if (t < 1) requestAnimationFrame(paso);
    else        grupo.remove();
  }

  requestAnimationFrame(paso);
}

function ciclo() {
  const ataque = generarAtaque();
  registrarAtaque(ataque);
  actualizarContadores();
  pintarFeed();
  if (coincideConFiltro(ataque)) animarAtaque(ataque);
  const espera = MS_ENTRE_ATAQUES + numeroAleatorio(-400, 400);
  setTimeout(ciclo, Math.max(400, espera));
}

function conectarFiltros() {
  document.getElementById('filtros').addEventListener('click', function (ev) {
    const boton = ev.target.closest('button');
    if (!boton) return;
    filtroActual = boton.dataset.tipo;
    document.querySelectorAll('#filtros button').forEach(function (b) {
      b.classList.toggle('activo', b === boton);
    });
    pintarFeed();
  });
}

function arrancar() {
  actualizarReloj();
  setInterval(actualizarReloj, 1000);
  conectarFiltros();
  if (typeof d3 !== 'undefined') iniciarMapa();
  ciclo();
}

arrancar();
