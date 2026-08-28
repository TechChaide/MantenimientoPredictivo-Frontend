const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { X509Certificate } = require('crypto');
const selfsigned = require('selfsigned');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = 9002; // El puerto que quieres usar

const certsDir = path.join(__dirname, 'certs');
const keyPath = path.join(certsDir, 'localhost-key.pem');
const certPath = path.join(certsDir, 'localhost.pem');

function getLocalIPv4s() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

// Para IPs 192.168.x.y, devuelve las 254 direcciones host de esa subred /24
// (192.168.x.1 .. 192.168.x.254), asi el certificado sigue siendo valido
// aunque el DHCP asigne otra IP dentro de la misma red de oficina.
function getSubnetHostIPs(ip) {
  const match = /^192\.168\.(\d{1,3})\.\d{1,3}$/.exec(ip);
  if (!match) return [ip];

  const thirdOctet = match[1];
  const hosts = [];
  for (let host = 1; host <= 254; host++) {
    hosts.push(`192.168.${thirdOctet}.${host}`);
  }
  return hosts;
}

function certCoversIPs(pemCert, ips) {
  try {
    const cert = new X509Certificate(pemCert);
    const san = cert.subjectAltName || '';
    return ips.every((ip) => san.includes(`IP Address:${ip}`));
  } catch {
    return false;
  }
}

async function generateCerts(ips) {
  fs.mkdirSync(certsDir, { recursive: true });

  const subnetIPs = [...new Set(ips.flatMap(getSubnetHostIPs))];

  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    { type: 7, ip: '::1' },
    ...subnetIPs.map((ip) => ({ type: 7, ip })),
  ];

  const pems = await selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
    days: 365,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'subjectAltName', altNames },
    ],
  });

  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);

  const subnets = [...new Set(ips.map((ip) => ip.replace(/\.\d{1,3}$/, '.0/24')))];
  console.log(`> Certificado SSL generado para: localhost, 127.0.0.1, y las subredes ${subnets.join(', ')}`);
}

async function start() {
  const localIPs = getLocalIPv4s();

  const hasCerts = fs.existsSync(keyPath) && fs.existsSync(certPath);
  if (!hasCerts || !certCoversIPs(fs.readFileSync(certPath, 'utf8'), localIPs)) {
    console.log('> El certificado SSL falta o no cubre la IP actual de la red, generando uno nuevo...');
    await generateCerts(localIPs);
  }

  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  await app.prepare();
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(`> Ready on https://localhost:${port}`);
    for (const ip of localIPs) {
      console.log(`> Disponible en la red: https://${ip}:${port}`);
    }
  });
}

start();
