const pool = require('../config/db');
const config = require('../config/afipConfig');
const wsfeClient = require('../afip/wsfeClient');

const TIPOS_VALIDOS_POR_CONDICION = {
  monotributista: [11], // Factura C únicamente, nunca discrimina IVA
  responsable_inscripto: [1, 6], // Factura A (a otros RI) y Factura B (consumidor final)
};

const TIPOS_COMPROBANTE = { 1: 'Factura A', 6: 'Factura B', 11: 'Factura C' };

const formatFechaAfip = (fecha = new Date()) => {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
};

const parseFechaAfip = (yyyymmdd) => {
  if (!yyyymmdd || yyyymmdd.length !== 8) return null;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
};

const _asArray = (campo) => (Array.isArray(campo) ? campo : [campo]);
const _listarObservaciones = (campo) =>
  _asArray(campo)
    .map((e) => `[${e.Code}] ${e.Msg}`)
    .join('; ');

// Valida que el tipo de comprobante pedido sea legal para la condición IVA configurada del
// emisor (ver AFIP_CONDICION_IVA_EMISOR). Lanza un error con .status = 400 para que el
// controller lo devuelva como tal, sin llegar a tocar ARCA.
const validarTipoComprobante = (tipoComprobante) => {
  const validos = TIPOS_VALIDOS_POR_CONDICION[config.condicionIvaEmisor];
  if (!validos.includes(tipoComprobante)) {
    const err = new Error(
      `Con la condición IVA configurada (${config.condicionIvaEmisor}) no se puede emitir ` +
        `${TIPOS_COMPROBANTE[tipoComprobante] || `tipo ${tipoComprobante}`}.`
    );
    err.status = 400;
    throw err;
  }
};

// Factura C (monotributista) nunca discrimina IVA: neto = total. Factura A/B (responsable
// inscripto) discrimina la alícuota general configurada a partir del total (los precios de la
// carta ya se cargan con IVA incluido).
const calcularImportes = (tipoComprobante, importeTotal) => {
  if (tipoComprobante === 11) {
    return { impNeto: importeTotal, impIva: 0, impTotal: importeTotal };
  }
  const alicuota = config.ivaAlicuotaPorcentaje / 100;
  const impNeto = Math.round((importeTotal / (1 + alicuota)) * 100) / 100;
  const impIva = Math.round((importeTotal - impNeto) * 100) / 100;
  return { impNeto, impIva, impTotal: importeTotal };
};

const _normalizarResultado = (resultado, { numero, impNeto, impIva, impTotal }) => {
  const detalles = resultado.FeDetResp ? _asArray(resultado.FeDetResp.FECAEDetResponse) : [];
  const det = detalles[0];

  const observaciones =
    [
      resultado.Errors ? _listarObservaciones(resultado.Errors.Err) : null,
      det?.Observaciones ? _listarObservaciones(det.Observaciones.Obs) : null,
    ]
      .filter(Boolean)
      .join(' | ') || null;

  if (!det || det.Resultado !== 'A') {
    return { estado: 'rechazada', numero, cae: null, caeVencimiento: null, observaciones, importeNeto: impNeto, importeIva: impIva, importeTotal: impTotal };
  }

  return {
    estado: 'aprobada',
    numero,
    cae: det.CAE,
    caeVencimiento: parseFechaAfip(det.CAEFchVto),
    observaciones,
    importeNeto: impNeto,
    importeIva: impIva,
    importeTotal: impTotal,
  };
};

// Emite un comprobante para una cuenta ya cerrada. No toca la tabla `facturas`: el controller es
// quien persiste el resultado devuelto acá (este módulo solo sabe hablar con ARCA).
const emitirFactura = async ({ tipoComprobante, docTipo, docNro, condicionIvaReceptorId, importeTotal }) => {
  validarTipoComprobante(tipoComprobante);
  const { impNeto, impIva, impTotal } = calcularImportes(tipoComprobante, importeTotal);

  // Lock por punto de venta: evita que dos cierres casi simultáneos consulten el mismo "último
  // autorizado" y terminen pidiendo el mismo número de comprobante.
  const lockName = `afip_ptovta_${config.puntoVenta}`;
  const conn = await pool.getConnection();
  try {
    const [[{ lock_ok }]] = await conn.query('SELECT GET_LOCK(?, 10) AS lock_ok', [lockName]);
    if (!lock_ok)
      throw new Error('No se pudo obtener el lock de facturación (otro cierre en curso). Reintentá en unos segundos.');

    try {
      const ultimoAutorizado = await wsfeClient.compUltimoAutorizado(config.puntoVenta, tipoComprobante);
      const numero = ultimoAutorizado + 1;

      const item = {
        Concepto: 1, // Productos (consumo en el momento, no un servicio facturado por período)
        DocTipo: docTipo,
        DocNro: Number(docNro),
        CbteDesde: numero,
        CbteHasta: numero,
        CbteFch: formatFechaAfip(),
        ImpTotal: impTotal,
        ImpTotConc: 0,
        ImpNeto: impNeto,
        ImpOpEx: 0,
        ImpIVA: impIva,
        ImpTrib: 0,
        MonId: 'PES',
        MonCotiz: 1,
        CondicionIVAReceptorId: condicionIvaReceptorId,
        ...(tipoComprobante !== 11 && {
          Iva: { AlicIva: [{ Id: config.ivaAlicuotaId, BaseImp: impNeto, Importe: impIva }] },
        }),
      };

      const resultado = await wsfeClient.solicitarCAE({
        PtoVta: config.puntoVenta,
        CbteTipo: tipoComprobante,
        item,
      });

      return _normalizarResultado(resultado, { numero, impNeto, impIva, impTotal });
    } finally {
      await conn.query('SELECT RELEASE_LOCK(?)', [lockName]);
    }
  } finally {
    conn.release();
  }
};

const estadoServicio = () => wsfeClient.dummy();

module.exports = { emitirFactura, estadoServicio, TIPOS_VALIDOS_POR_CONDICION, TIPOS_COMPROBANTE };
