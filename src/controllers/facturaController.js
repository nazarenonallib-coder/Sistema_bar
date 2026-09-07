const Factura = require('../models/facturaModel');
const Pedido = require('../models/pedidoModel');
const afipService = require('../services/afipService');
const afipConfig = require('../config/afipConfig');
const { generarFacturaPDF } = require('../services/facturaPdfService');
const logger = require('../utils/logger');

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
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
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
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
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
    // Se accede a esta ruta desde el historial (no desde el cierre de cuenta recién hecho), así
    // que cualquier impresión acá es una reimpresión de archivo: se marca DUPLICADO.
    await generarFacturaPDF(res, factura, { items, copia: 'DUPLICADO' });
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
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
      logger.error(`${req.method} ${req.originalUrl} - ARCA rechazó el reintento de la factura ${id}: ${err.message}`, { stack: err.stack });
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
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const TIPO_COMPROBANTE_LABEL = { 1: 'Factura A', 6: 'Factura B', 11: 'Factura C' };
const METODO_PAGO_LABEL = {
  efectivo: 'Efectivo',
  tarjeta_debito: 'Tarjeta débito',
  tarjeta_credito: 'Tarjeta crédito',
  transferencia: 'Transferencia',
  otro: 'Otro',
};

// Escapa un valor para CSV: si contiene coma, comilla o salto de línea hay que encomillarlo y
// duplicar las comillas internas (RFC 4180).
const csvCell = (valor) => {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

// Reporte contable de ventas ya facturadas (con CAE aprobado ante ARCA) en un rango de fechas.
// Se descarga como CSV para que el dueño se lo pueda pasar al contador o abrir en Excel.
const getReporte = async (req, res) => {
  const { desde, hasta } = req.query;

  try {
    const facturas = await Factura.getVentasFacturadas(desde || null, hasta || null);

    const encabezado = [
      'Fecha', 'Comprobante', 'Punto de Venta', 'Número', 'Mesa', 'Método de Pago',
      'Neto', 'IVA', 'Total', 'CAE',
    ];
    const filas = facturas.map((f) => [
      csvCell(new Date(f.fecha_emision).toLocaleString('es-AR', { hour12: false })),
      csvCell(TIPO_COMPROBANTE_LABEL[f.tipo_comprobante] || f.tipo_comprobante),
      csvCell(String(f.punto_venta).padStart(4, '0')),
      csvCell(String(f.numero).padStart(8, '0')),
      csvCell(f.numero_mesa),
      csvCell(METODO_PAGO_LABEL[f.metodo_pago] || f.metodo_pago),
      csvCell(Number(f.importe_neto).toFixed(2)),
      csvCell(Number(f.importe_iva).toFixed(2)),
      csvCell(Number(f.importe_total).toFixed(2)),
      csvCell(f.cae),
    ].join(','));

    const totalVentas = facturas.reduce((acc, f) => acc + Number(f.importe_total), 0);
    filas.push(['', '', '', '', '', 'TOTAL', '', '', csvCell(totalVentas.toFixed(2)), ''].join(','));

    const csv = '﻿' + [encabezado.join(','), ...filas].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-ventas-facturadas.csv"`);
    res.send(csv);
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const getEstadoAfip = async (req, res) => {
  try {
    res.json(await afipService.estadoServicio());
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(502).json({ error: 'No se pudo consultar el estado de ARCA.', detail: err.message });
  }
};

module.exports = { getConfig, getHistorial, getOne, getPdf, reintentar, getEstadoAfip, getReporte };
