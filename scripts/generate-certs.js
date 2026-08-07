const selfsigned = require('selfsigned');
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

try {
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const pems = selfsigned.generate(attrs, { days: 365, algorithm: 'sha256' });

  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);

  console.log('✓ Certificados SSL generados exitosamente');
  console.log(`  Clave privada: ${keyPath}`);
  console.log(`  Certificado: ${certPath}`);
  process.exit(0);
} catch (err) {
  console.error('❌ Error generando certificados:', err.message);
  process.exit(1);
}
