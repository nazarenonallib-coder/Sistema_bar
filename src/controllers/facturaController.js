const Factura = require('../models/facturaModel');
const Pedido = require('../models/pedidoModel');
const afipService = require('../services/afipService');
const afipConfig = require('../config/afipConfig');
const { generarFacturaPDF } = require('../services/facturaPdfService');

const TIPOS_POR_CONDICION = {
  monotributista: [{ tipo_comprobante: 11, nombre: 'Factura C' }],
  responsable_inscripto: [
    { tipo_comprobante: 1, nombre: 'Factura A' },
    { tipo_comprobante: 6, nombre: 'Factura B' },
  ],
};

// Le dice al frontend qué tipos de comprobante ofrecer al cerrar una cuenta, según la condición
// IVA configurada del emisor (ver AFIP_CONDICION_IVA_EMISOR). Único lugar donde esa regla vive.
const getConfig = (req, res) => {
  res.json({
    entorno: afipConfig.entorno,
    condicion_iva_emisor: afipConfig.condicionIvaEmisor,
    tipos_comprobante: TIPOS_POR_CONDICION[afipConfig.condicionIvaEmisor],
  });
};

const getHistorial = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  try {
    const { rows, total } = await Factura.getHistorial(page, limit);
    res.json({
      facturas: rows,
      total,
      page,
      limit,
      total_paginas: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const getOne = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'El parámetro "id" debe ser un entero válido.' });

  try {
    const factura = await Factura.getById(id);
    if (!factura) return res.status(404).json({ error: `Factura con id ${id} no encontrada.` });
    res.json(factura);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const getPdf = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'El parámetro "id" debe ser un entero válido.' });

  try {
    const factura = await Factura.getById(id);
    if (!factura) return res.status(404).json({ error: `Factura con id ${id} no encontrada.` });
    if (factura.estado !== 'aprobada')
      return res.status(400).json({ error: 'Esta factura todavía no tiene CAE aprobado.' });

    const pedidos = await Pedido.getPedidosSesion(factura.mesa_id, factura.sesion_apertura);
    const items = await Pedido.getItemsByPedidoIds(pedidos.map((p) => p.id));
    await generarFacturaPDF(res, factura, { items });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

// Reintenta la emisión de una factura que quedó pendiente/rechazada/con error (por ejemplo, tras
// una caída de ARCA al cerrar la cuenta). No vuelve a tocar pedidos ni stock: eso ya ocurrió al
// cerrar la cuenta, acá solo se reintenta el trámite ante ARCA.
const reintentar = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'El parámetro "id" debe ser un entero válido.' });

  try {
    const factura = await Factura.getById(id);
    if (!factura) return res.status(404).json({ error: `Factura con id ${id} no encontrada.` });
    if (factura.estado === 'aprobada')
      return res.status(400).json({ error: 'Esta factura ya fue aprobada, no hace falta reintentar.' });

    try {
      const resultado = await afipService.emitirFactura({
        tipoComprobante: factura.tipo_comprobante,
        docTipo: factura.doc_tipo,
        docNro: factura.doc_nro,
        condicionIvaReceptorId: factura.condicion_iva_receptor_id,
        importeTotal: Number(factura.importe_total),
      });
      await Factura.updateResultado(id, resultado);
      return res.json({ message: 'Factura reintentada.', factura: await Factura.getById(id) });
    } catch (err) {
      await Factura.updateResultado(id, {
        estado: 'error',
        numero: null,
        cae: null,
        caeVencimiento: null,
        importeNeto: factura.importe_neto,
        importeIva: factura.importe_iva,
        importeTotal: factura.importe_total,
        observaciones: err.message,
      });
      return res.status(502).json({ error: 'No se pudo emitir la factura ante ARCA.', detail: err.message });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const getEstadoAfip = async (req, res) => {
  try {
    res.json(await afipService.estadoServicio());
  } catch (err) {
    res.status(502).json({ error: 'No se pudo consultar el estado de ARCA.', detail: err.message });
  }
};

module.exports = { getConfig, getHistorial, getOne, getPdf, reintentar, getEstadoAfip };
