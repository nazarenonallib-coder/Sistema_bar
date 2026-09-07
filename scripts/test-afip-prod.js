// Verificación puntual de conectividad con ARCA (producción), sin depender de la cache en DB.
// Uso: node scripts/test-afip-prod.js
require('dotenv').config({ path: '.env.test_prod' });

const soap = require('soap');
const wsaaClient = require('../src/afip/wsaaClient');
const config = require('../src/config/afipConfig');

const CBTE_TIPO_FACTURA_B = 6;

(async () => {
  try {
    console.log(`Entorno: ${config.entorno}`);
    console.log(`WSDL WSFE: ${config.wsfeWsdl}`);

    const { token, sign } = await wsaaClient.login('wsfe');
    console.log('Login WSAA OK.');

    const client = await soap.createClientAsync(config.wsfeWsdl);

    const [dummyResult] = await client.FEDummyAsync({});
    console.log('FEDummy:', dummyResult.FEDummyResult);

    const auth = { Token: token, Sign: sign, Cuit: config.cuit };
    const [ultimoResult] = await client.FECompUltimoAutorizadoAsync({
      Auth: auth,
      PtoVta: config.puntoVenta,
      CbteTipo: CBTE_TIPO_FACTURA_B,
    });

    const res = ultimoResult.FECompUltimoAutorizadoResult;
    if (res.Errors) {
      console.error('Error de ARCA:', res.Errors.Err);
    } else {
      console.log(
        `Último comprobante autorizado (Factura B, PtoVta ${config.puntoVenta}): ${res.CbteNro}`
      );
    }
  } catch (err) {
    console.error('Error verificando AFIP:', err);
  }
})();
