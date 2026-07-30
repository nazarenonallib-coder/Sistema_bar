const fs = require('fs');
const forge = require('node-forge');
const soap = require('soap');
const config = require('../config/afipConfig');

// Arma el XML del Ticket de Requerimiento de Acceso (TRA) que hay que firmar y mandarle a WSAA.
const construirTRA = (servicio) => {
  const ahora = new Date();
  const generacion = new Date(ahora.getTime() - 10 * 60 * 1000);
  const expiracion = new Date(ahora.getTime() + 10 * 60 * 1000);
  const uniqueId = Math.floor(ahora.getTime() / 1000);

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${generacion.toISOString()}</generationTime>
    <expirationTime>${expiracion.toISOString()}</expirationTime>
  </header>
  <service>${servicio}</service>
</loginTicketRequest>`;
};

// Firma el TRA como CMS/PKCS#7 con el certificado y clave privada configurados. Node no trae
// soporte nativo para CMS: se usa node-forge (pura JS) en vez de depender de que el binario
// openssl esté disponible en el hosting.
const firmarTRA = (traXml) => {
  const cert = forge.pki.certificateFromPem(fs.readFileSync(config.certPath, 'utf8'));
  const key = forge.pki.privateKeyFromPem(fs.readFileSync(config.keyPath, 'utf8'));

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(traXml, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign({ detached: false });

  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
};

// Extrae token/sign/expirationTime del XML loginTicketResponse embebido en la respuesta de WSAA.
const parsearLoginTicketResponse = (xml) => {
  const token = /<token>([\s\S]*?)<\/token>/.exec(xml)?.[1];
  const sign = /<sign>([\s\S]*?)<\/sign>/.exec(xml)?.[1];
  const expirationTime = /<expirationTime>([\s\S]*?)<\/expirationTime>/.exec(xml)?.[1];
  if (!token || !sign)
    throw new Error('No se pudo interpretar la respuesta de WSAA (loginTicketResponse).');
  return { token, sign, expirationTime };
};

// Pide un Ticket de Acceso (TA) nuevo a WSAA para el servicio indicado (normalmente "wsfe").
// No cachea nada: el cacheo vive en taCache.js, este módulo solo sabe hablar con WSAA.
const login = async (servicio = 'wsfe') => {
  const cms = firmarTRA(construirTRA(servicio));
  const client = await soap.createClientAsync(config.wsaaWsdl);
  const [result] = await client.loginCmsAsync({ in0: cms });
  return parsearLoginTicketResponse(result.loginCmsReturn);
};

module.exports = { login };
