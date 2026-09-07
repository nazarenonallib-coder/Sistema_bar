// Única fuente de verdad para la configuración de ARCA (ex AFIP). Pasar de "mi CUIT en
// homologación" a "CUIT del cliente en producción" es exclusivamente cambiar las AFIP_* env vars
// que este módulo lee — ningún otro archivo del módulo de facturación debe leer process.env
// directamente.

const WSAA_URLS = {
  homologacion: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms?wsdl',
  produccion: 'https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl',
};

const WSFE_URLS = {
  homologacion: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL',
  produccion: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL',
};

const entorno = process.env.AFIP_ENTORNO === 'produccion' ? 'produccion' : 'homologacion';
const condicionIvaEmisor =
  process.env.AFIP_CONDICION_IVA_EMISOR === 'responsable_inscripto'
    ? 'responsable_inscripto'
    : 'monotributista';

module.exports = {
  entorno,
  condicionIvaEmisor,
  cuit: process.env.AFIP_CUIT,
  puntoVenta: Number(process.env.AFIP_PUNTO_VENTA) || 1,
  certPath: process.env.AFIP_CERT_PATH,
  keyPath: process.env.AFIP_KEY_PATH,
  ivaAlicuotaId: Number(process.env.AFIP_IVA_ALICUOTA_ID) || 5,
  ivaAlicuotaPorcentaje: Number(process.env.AFIP_IVA_ALICUOTA_PORCENTAJE) || 21,
  razonSocial: process.env.AFIP_RAZON_SOCIAL || '',
  domicilioComercial: process.env.AFIP_DOMICILIO_COMERCIAL || '',
  inicioActividades: process.env.AFIP_INICIO_ACTIVIDADES || '',
  ingresosBrutos: process.env.AFIP_INGRESOS_BRUTOS || '',
  wsaaWsdl: WSAA_URLS[entorno],
  wsfeWsdl: WSFE_URLS[entorno],
};
