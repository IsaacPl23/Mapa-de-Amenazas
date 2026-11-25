require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const PUERTO = process.env.PORT || 3000;
const ABUSEIPDB_KEY = (process.env.ABUSEIPDB_KEY || '').trim();
const IPINFO_TOKEN = (process.env.IPINFO_TOKEN || '').trim();

const MAX_HISTORIAL = 200;
const MS_ENTRE_ATAQUES = 1000;
const HORAS_ENTRE_DESCARGAS = 6;
const IPS_POR_DESCARGA = 100;

const TIPOS_DE_ATAQUE = ['ddos', 'malware', 'intrusion'];

const PAISES = {
  CN: { nombre: 'China', lat: 35.8, lon: 104.2 },
  US: { nombre: 'Estados Unidos', lat: 37.1, lon: -95.7 },
  RU: { nombre: 'Rusia', lat: 55.8, lon: 37.6 },
  BR: { nombre: 'Brasil', lat: -15.7, lon: -47.9 },
  DE: { nombre: 'Alemania', lat: 51.2, lon: 10.5 },
  IN: { nombre: 'India', lat: 20.6, lon: 78.9 },
  GB: { nombre: 'Reino Unido', lat: 52.4, lon: -1.5 },
  FR: { nombre: 'Francia', lat: 46.2, lon: 2.4 },
  KR: { nombre: 'Corea del Sur', lat: 35.9, lon: 127.7 },
  JP: { nombre: 'Japón', lat: 36.2, lon: 138.3 },
  UA: { nombre: 'Ucrania', lat: 48.4, lon: 31.2 },
  NL: { nombre: 'Países Bajos', lat: 52.1, lon: 5.3 },
  TR: { nombre: 'Turquía', lat: 39.0, lon: 32.9 },
  IR: { nombre: 'Irán', lat: 32.4, lon: 53.7 },
  MX: { nombre: 'México', lat: 23.6, lon: -102.6 },
  CA: { nombre: 'Canadá', lat: 45.4, lon: -75.7 },
  AU: { nombre: 'Australia', lat: -25.3, lon: 133.8 },
  AR: { nombre: 'Argentina', lat: -38.4, lon: -63.6 },
  SG: { nombre: 'Singapur', lat: 1.35, lon: 103.8 },
  PL: { nombre: 'Polonia', lat: 52.1, lon: 19.4 },
  IT: { nombre: 'Italia', lat: 42.5, lon: 12.6 },
  ES: { nombre: 'España', lat: 40.4, lon: -3.7 },
  ZA: { nombre: 'Sudáfrica', lat: -29.0, lon: 25.1 },
  NG: { nombre: 'Nigeria', lat: 9.1, lon: 8.7 },
  ID: { nombre: 'Indonesia', lat: -0.8, lon: 113.9 },
  PK: { nombre: 'Pakistán', lat: 30.4, lon: 69.3 },
  SA: { nombre: 'Arabia Saudí', lat: 23.9, lon: 45.1 },
  TH: { nombre: 'Tailandia', lat: 15.9, lon: 100.9 },
  VN: { nombre: 'Vietnam', lat: 16.1, lon: 108.3 },
  RO: { nombre: 'Rumanía', lat: 45.9, lon: 24.9 },
  HK: { nombre: 'Hong Kong', lat: 22.3, lon: 114.2 },
  CL: { nombre: 'Chile', lat: -35.7, lon: -71.5 },
  SE: { nombre: 'Suecia', lat: 59.3, lon: 18.1 },
  CH: { nombre: 'Suiza', lat: 46.8, lon: 8.2 },
  BE: { nombre: 'Bélgica', lat: 50.5, lon: 4.5 },
  CZ: { nombre: 'Rep. Checa', lat: 49.8, lon: 15.5 },
  EG: { nombre: 'Egipto', lat: 26.8, lon: 30.8 },
  MY: { nombre: 'Malasia', lat: 4.2, lon: 102.0 },
  BD: { nombre: 'Bangladesh', lat: 23.7, lon: 90.4 },
  IL: { nombre: 'Israel', lat: 31.0, lon: 34.9 },
  PT: { nombre: 'Portugal', lat: 39.4, lon: -8.2 },
  HU: { nombre: 'Hungría', lat: 47.5, lon: 19.0 },
  AT: { nombre: 'Austria', lat: 47.5, lon: 14.5 },
  FI: { nombre: 'Finlandia', lat: 61.9, lon: 25.7 },
  NO: { nombre: 'Noruega', lat: 59.9, lon: 10.7 },
  DK: { nombre: 'Dinamarca', lat: 55.7, lon: 9.5 },
  GR: { nombre: 'Grecia', lat: 39.1, lon: 21.8 },
  PH: { nombre: 'Filipinas', lat: 12.9, lon: 121.8 },
  TW: { nombre: 'Taiwán', lat: 23.7, lon: 120.9 },
  KZ: { nombre: 'Kazajistán', lat: 48.0, lon: 66.9 }
};

let ultimosAtaques = [];
let ipsReales = [];
let cacheGeo = {};

const app = express();
const servidor = http.createServer(app);

function numeroAleatorio(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function elegirAlAzar(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function paisAleatorio(codigoExcluido) {
  const codigos = Object.keys(PAISES).filter(function (codigo) {
    return codigo !== codigoExcluido;
  });
  return elegirAlAzar(codigos);
}

function generarIPAleatoria() {
  return [numeroAleatorio(1, 223), numeroAleatorio(0, 255), numeroAleatorio(0, 255), numeroAleatorio(1, 254)].join('.');
}

function calcularSeveridad(puntaje) {
  return Math.min(5, Math.max(1, Math.ceil(puntaje / 20)));
}

function infoDesdePais(codigo) {
  const pais = PAISES[codigo];
  if (!pais) return null;
  return { codigoPais: codigo, pais: pais.nombre, lat: pais.lat, lon: pais.lon };
}

function armarAtaque(ip, puntaje, origen, destino, simulado) {
  return {
    ip: ip,
    abuseScore: puntaje,
    attackType: elegirAlAzar(TIPOS_DE_ATAQUE),
    severity: calcularSeveridad(puntaje),
    srcCountry: origen.pais,
    srcCountryCode: origen.codigoPais,
    srcLat: origen.lat,
    srcLon: origen.lon,
    dstCountry: destino.pais,
    dstCountryCode: destino.codigoPais,
    dstLat: destino.lat,
    dstLon: destino.lon,
    simulated: simulado,
    createdAt: new Date().toISOString()
  };
}

function generarAtaqueSimulado() {
  const origen = infoDesdePais(paisAleatorio());
  const destino = infoDesdePais(paisAleatorio(origen.codigoPais));
  return armarAtaque(generarIPAleatoria(), numeroAleatorio(40, 100), origen, destino, true);
}

async function generarAtaqueReal() {
  const entrada = elegirAlAzar(ipsReales);
  const origen = await obtenerInfoIP(entrada.ip, entrada.codigoPais);
  if (!origen) return null;

  const destino = infoDesdePais(paisAleatorio(origen.codigoPais));
  return armarAtaque(entrada.ip, entrada.puntaje, origen, destino, false);
}

async function generarAtaque() {
  if (ipsReales.length > 0) {
    for (let intento = 0; intento < 5; intento++) {
      const ataqueReal = await generarAtaqueReal();
      if (ataqueReal) return ataqueReal;
    }
  }
  return generarAtaqueSimulado();
}

async function descargarListaNegra() {
  if (!ABUSEIPDB_KEY) return;

  try {
    const url = 'https://api.abuseipdb.com/api/v2/blacklist?confidenceMinimum=50&limit=' + IPS_POR_DESCARGA;
    const respuesta = await fetch(url, {
      headers: { Key: ABUSEIPDB_KEY, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    if (!respuesta.ok) {
      throw new Error('AbuseIPDB respondió con código ' + respuesta.status);
    }

    const datos = await respuesta.json();
    ipsReales = datos.data.map(function (item) {
      return { ip: item.ipAddress, puntaje: item.abuseConfidenceScore, codigoPais: item.countryCode };
    });
    cacheGeo = {};
    console.log('[AbuseIPDB] ' + ipsReales.length + ' IPs descargadas');
  } catch (error) {
    console.warn('[AbuseIPDB] No se pudo descargar la lista: ' + error.message);
  }
}

async function consultarIPinfo(ip) {
  try {
    const respuesta = await fetch('https://ipinfo.io/' + ip + '/json', {
      headers: { Authorization: 'Bearer ' + IPINFO_TOKEN },
      signal: AbortSignal.timeout(5000)
    });
    if (!respuesta.ok) return null;

    const datos = await respuesta.json();
    if (!datos.loc) return null;

    const partes = datos.loc.split(',');
    const pais = PAISES[datos.country];
    return {
      codigoPais: datos.country,
      pais: pais ? pais.nombre : datos.country,
      lat: Number(partes[0]),
      lon: Number(partes[1])
    };
  } catch (error) {
    return null;
  }
}

async function obtenerInfoIP(ip, codigoPais) {
  if (cacheGeo[ip]) return cacheGeo[ip];

  let info = null;
  if (IPINFO_TOKEN) {
    info = await consultarIPinfo(ip);
  }
  if (!info) {
    info = infoDesdePais(codigoPais);
  }

  if (info) cacheGeo[ip] = info;
  return info;
}

const io = new Server(servidor);

function enviarAtaque(ataque) {
  ultimosAtaques.push(ataque);
  if (ultimosAtaques.length > MAX_HISTORIAL) {
    ultimosAtaques.shift();
  }
  io.emit('attack', ataque);
}

io.on('connection', function (socket) {
  console.log('[socket.io] Navegador conectado: ' + socket.id);
  socket.emit('history', ultimosAtaques);
});

async function ciclo() {
  try {
    const ataque = await generarAtaque();
    enviarAtaque(ataque);
  } catch (error) {
    console.error('[ciclo] Error: ' + error.message);
  }
  setTimeout(ciclo, MS_ENTRE_ATAQUES);
}

async function iniciar() {
  app.use(express.static(path.join(__dirname, 'public')));

  servidor.on('error', function (error) {
    if (error.code === 'EADDRINUSE') {
      console.error('El puerto ' + PUERTO + ' ya está en uso. Cambia PORT en el archivo .env');
    } else {
      console.error(error.message);
    }
    process.exit(1);
  });

  servidor.listen(PUERTO, function () {
    console.log('Mapa de amenazas en http://localhost:' + PUERTO);
    console.log(ABUSEIPDB_KEY ? 'AbuseIPDB: llave configurada' : 'AbuseIPDB: sin llave, modo simulación');
    console.log(IPINFO_TOKEN ? 'IPinfo: token configurado' : 'IPinfo: sin token, se usa el centro de cada país');
  });

  await descargarListaNegra();
  setInterval(descargarListaNegra, HORAS_ENTRE_DESCARGAS * 60 * 60 * 1000);

  ciclo();
}

iniciar();
