const TIPOS = {
  ddos: { nombre: 'DDoS', color: '#ff5c4d' },
  malware: { nombre: 'Malware', color: '#ffa94d' },
  intrusion: { nombre: 'Intrusión', color: '#ffe066' }
};

const URL_MAPA = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';

const DURACION_MIN = 500;
const DURACION_MAX = 2000;
const SEGMENTOS_COLA = 10;
const MAX_FEED = 8;
const MAX_RECIENTES = 100;

let filtroActual = 'todos';
let totalAtaques = 0;
let paisesOrigen = new Set();
let recientes = [];

let svg = null;
let capaPaises = null;
let capaAtaques = null;
let proyeccion = null;
let paisesGeo = null;

function mostrarEstado(texto) {
  document.getElementById('estado').textContent = texto;
}

function actualizarReloj() {
  document.getElementById('reloj').textContent = new Date().toTimeString().slice(0, 8);
}

function actualizarContadores() {
  document.getElementById('contAtaques').textContent = totalAtaques.toLocaleString('es');
  document.getElementById('contPaises').textContent = paisesOrigen.size;
}

function horaDe(fechaTexto) {
  return new Date(fechaTexto).toTimeString().slice(0, 8);
}

function coincideConFiltro(ataque) {
  return filtroActual === 'todos' || ataque.attackType === filtroActual;
}

function crearElemento(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  elemento.className = clase;
  elemento.textContent = texto;
  return elemento;
}

function registrarAtaque(ataque) {
  totalAtaques++;
  paisesOrigen.add(ataque.srcCountryCode);
  recientes.push(ataque);
  if (recientes.length > MAX_RECIENTES) {
    recientes.shift();
  }
}

function pintarFeed() {
  const lista = document.getElementById('listaFeed');
  lista.innerHTML = '';

  const visibles = recientes.filter(coincideConFiltro).slice(-MAX_FEED).reverse();

  visibles.forEach(function (ataque) {
    const tipo = TIPOS[ataque.attackType] || TIPOS.intrusion;

    const linea1 = crearElemento('div', 'feed-linea', '');
    linea1.appendChild(crearElemento('span', 'feed-ip', ataque.ip));
    linea1.appendChild(crearElemento('span', 'feed-hora', horaDe(ataque.createdAt)));

    const nombreTipo = crearElemento('span', 'feed-tipo', tipo.nombre);
    nombreTipo.style.color = tipo.color;

    const linea2 = crearElemento('div', 'feed-linea', '');
    linea2.appendChild(crearElemento('span', 'feed-pais', ataque.srcCountry));
    linea2.appendChild(nombreTipo);

    const item = document.createElement('li');
    item.appendChild(linea1);
    item.appendChild(linea2);
    lista.appendChild(item);
  });
}

function mostrarModo(ataque) {
  const etiqueta = document.getElementById('etiquetaModo');
  etiqueta.hidden = false;

  if (ataque.simulated) {
    etiqueta.textContent = 'Datos simulados';
    etiqueta.className = 'simulado';
  } else {
    etiqueta.textContent = 'Origen real (AbuseIPDB) · destino simulado';
    etiqueta.className = '';
  }
}

function suavizar(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function crearCurva(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const largo = Math.hypot(dx, dy) || 1;
  const altura = Math.max(30, largo * 0.3);

  let normalX = -dy / largo;
  let normalY = dx / largo;
  if (normalY > 0) {
    normalX = -normalX;
    normalY = -normalY;
  }

  const controlX = (a[0] + b[0]) / 2 + normalX * altura;
  const controlY = (a[1] + b[1]) / 2 + normalY * altura;
  return 'M' + a[0] + ',' + a[1] + ' Q' + controlX + ',' + controlY + ' ' + b[0] + ',' + b[1];
}

function iniciarMapa() {
  svg = d3.select('#mapa');
  capaPaises = svg.append('g');
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
  capaPaises
    .selectAll('path')
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
  } catch (error) {
    console.warn('No se pudo cargar el mapa base: ' + error.message);
    capaPaises
      .append('text')
      .attr('class', 'aviso-mapa')
      .attr('x', '50%')
      .attr('y', '50%')
      .text('No se pudo cargar el mapa base. Revisa tu conexión a internet.');
  }
}

function marcarImpacto(punto, color) {
  capaAtaques
    .append('circle')
    .attr('cx', punto[0])
    .attr('cy', punto[1])
    .attr('r', 2)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 1)
    .transition()
    .duration(500)
    .attr('r', 10)
    .attr('stroke-opacity', 0)
    .remove();
}

function animarAtaque(ataque) {
  if (!capaAtaques || !proyeccion) return;
  if (document.hidden) return;

  const origen = proyeccion([ataque.srcLon, ataque.srcLat]);
  const destino = proyeccion([ataque.dstLon, ataque.dstLat]);
  if (!origen || !destino) return;

  const tipo = TIPOS[ataque.attackType] || TIPOS.intrusion;
  const grosor = 0.8 + ataque.severity * 0.3;
  const duracion = DURACION_MIN + Math.random() * (DURACION_MAX - DURACION_MIN);

  const grupo = capaAtaques.append('g');

  const camino = grupo.append('path').attr('d', crearCurva(origen, destino)).attr('fill', 'none').node();
  const largoCamino = camino.getTotalLength();
  const largoCola = Math.min(largoCamino * 0.35, 90);

  const tramos = [];
  for (let i = 0; i < SEGMENTOS_COLA; i++) {
    const tramo = grupo
      .append('line')
      .attr('stroke', tipo.color)
      .attr('stroke-width', grosor)
      .attr('stroke-linecap', 'round')
      .attr('stroke-opacity', (i + 1) / SEGMENTOS_COLA)
      .node();
    tramos.push(tramo);
  }

  const cabeza = grupo.append('circle').attr('r', grosor + 0.8).attr('fill', tipo.color);

  const inicio = performance.now();
  let impactoMarcado = false;

  function paso(ahora) {
    const t = Math.min((ahora - inicio) / duracion, 1);

    const viaje = Math.min(t / 0.85, 1);
    const avance = suavizar(viaje) * largoCamino;
    const colaActual = t < 0.85 ? largoCola : largoCola * (1 - (t - 0.85) / 0.15);

    for (let i = 0; i < SEGMENTOS_COLA; i++) {
      const desde = Math.max(0, avance - colaActual * (SEGMENTOS_COLA - i) / SEGMENTOS_COLA);
      const hasta = Math.max(0, avance - colaActual * (SEGMENTOS_COLA - i - 1) / SEGMENTOS_COLA);
      const p1 = camino.getPointAtLength(desde);
      const p2 = camino.getPointAtLength(hasta);
      tramos[i].setAttribute('x1', p1.x);
      tramos[i].setAttribute('y1', p1.y);
      tramos[i].setAttribute('x2', p2.x);
      tramos[i].setAttribute('y2', p2.y);
    }

    const punta = camino.getPointAtLength(avance);
    cabeza.attr('cx', punta.x).attr('cy', punta.y).attr('opacity', t < 0.85 ? 1 : 0);

    if (viaje >= 1 && !impactoMarcado) {
      impactoMarcado = true;
      marcarImpacto(destino, tipo.color);
    }

    if (t < 1) {
      requestAnimationFrame(paso);
    } else {
      grupo.remove();
    }
  }

  requestAnimationFrame(paso);
}

function conectarSocket() {
  const socket = io();
  mostrarEstado('Conectando...');

  socket.on('connect', function () {
    mostrarEstado('Conectado');
  });

  socket.on('disconnect', function () {
    mostrarEstado('Sin conexión');
  });

  socket.on('connect_error', function () {
    mostrarEstado('Sin conexión, reintentando...');
  });

  socket.on('history', function (lista) {
    totalAtaques = 0;
    paisesOrigen = new Set();
    recientes = [];

    lista.forEach(registrarAtaque);
    actualizarContadores();
    pintarFeed();

    if (lista.length > 0) {
      mostrarModo(lista[lista.length - 1]);
    }
  });

  socket.on('attack', function (ataque) {
    registrarAtaque(ataque);
    actualizarContadores();
    pintarFeed();
    mostrarModo(ataque);

    if (coincideConFiltro(ataque)) {
      animarAtaque(ataque);
    }
  });
}

function conectarFiltros() {
  document.getElementById('filtros').addEventListener('click', function (evento) {
    const boton = evento.target.closest('button');
    if (!boton) return;

    filtroActual = boton.dataset.tipo;
    document.querySelectorAll('#filtros button').forEach(function (otro) {
      otro.classList.toggle('activo', otro === boton);
    });
    pintarFeed();
  });
}

function arrancar() {
  actualizarReloj();
  setInterval(actualizarReloj, 1000);
  conectarFiltros();

  if (typeof d3 !== 'undefined') {
    iniciarMapa();
  } else {
    console.warn('No cargó la librería d3: el mapa no se puede dibujar.');
  }

  if (typeof io !== 'undefined') {
    conectarSocket();
  } else {
    mostrarEstado('Sin conexión');
  }
}

arrancar();
