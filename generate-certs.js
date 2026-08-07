const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const certsDir = path.join(__dirname, 'certs');

// Create certs directory if it doesn't exist
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

// Check if certificates already exist
const keyPath = path.join(certsDir, 'localhost-key.pem');
const certPath = path.join(certsDir, 'localhost.pem');

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log('✓ Certificados SSL ya existen');
  process.exit(0);
}

try {
  // Try using PowerShell to create self-signed certificate
  const psCommand = `
    $cert = New-SelfSignedCertificate -DnsName localhost -CertStoreLocation cert:\\CurrentUser\\My -NotAfter (Get-Date).AddDays(365)
    $certPath = '${certPath.replace(/\\/g, '\\\\')}'
    $keyPath = '${keyPath.replace(/\\/g, '\\\\')}'
    
    Export-Certificate -Cert $cert -FilePath $certPath -Force | Out-Null
    $password = ConvertTo-SecureString -String "password" -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath "$([io.path]::GetDirectoryName($keyPath))\\temp.pfx" -Password $password -Force | Out-Null
    
    Write-Host "Certificados generados exitosamente"
  `;
  
  execSync(`powershell -Command "${psCommand}"`, { stdio: 'inherit' });
  console.log('✓ Certificados SSL generados correctamente');
} catch (error) {
  console.error('Error generando certificados:', error.message);
  console.log('\n⚠️  Intenta instalar OpenSSL desde: https://slproweb.com/products/Win32OpenSSL.html');
  console.log('O utiliza: choco install openssl (si tienes Chocolatey)');
  process.exit(1);
}
