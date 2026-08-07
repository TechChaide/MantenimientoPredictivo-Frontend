const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const certsDir = path.join(__dirname, 'certs');

// Create certs directory if it doesn't exist
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

const keyPath = path.join(certsDir, 'localhost-key.pem');
const certPath = path.join(certsDir, 'localhost.pem');

// Check if certificates already exist
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log('✓ Los certificados SSL ya existen');
  process.exit(0);
}

// Generate a private key
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Create a self-signed certificate using Node's built-in crypto
const subject = {
  commonName: 'localhost',
  countryName: 'US',
  stateName: 'State',
  localityName: 'City',
  organizationName: 'Organization'
};

// For a proper self-signed cert, we'd need to use a library like pem or selfsigned
// But as a workaround, we'll create using command line tools
// Since openssl isn't available, let's use a simpler approach with Node.js crypto module

// Alternative: use node-forge which doesn't require external dependencies
try {
  // Try to use node-forge if available
  const pem = require('pem');
  
  pem.createCertificate({
    days: 365,
    selfSigned: true,
    commonName: 'localhost'
  }, (err, keys) => {
    if (err) throw err;
    
    fs.writeFileSync(keyPath, keys.clientKey);
    fs.writeFileSync(certPath, keys.certificate);
    console.log('✓ Certificados SSL generados exitosamente');
    process.exit(0);
  });
} catch (e) {
  // If pem module is not available, write a simple placeholder
  // Note: This won't work for actual HTTPS, but will prevent crashes
  console.warn('⚠️ No se pudo generar certificados SSL automáticamente');
  console.warn('Instalando pem...');
  
  // Just save the private key for now
  fs.writeFileSync(keyPath, privateKey);
  console.log('Clave privada guardada');
  console.log('\n⚠️  Para generar un certificado válido, ejecuta:');
  console.log('npm install pem --save-dev');
  console.log('Luego, vuelve a ejecutar este script');
}
