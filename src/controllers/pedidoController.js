const pool = require('../config/db');
const Mesa = require('../models/mesaModel');
const Pedido = require('../models/pedidoModel');
const Producto = require('../models/productoModel');
const Insumo = require('../models/insumoModel');
const logger = require('../utils/logger');

const create = async (req, res) => {
  const { mesa_id } = req.body;

  if (mesa_id === undefined || mesa_id === null)
    return res.status(400).json({ error: 'El campo "mesa_id" es obligatorio.' });
  if (!Number.isInteger(mesa_id) || mesa_id <= 0)
    return res.status(400).json({ error: '"mesa_id" debe ser un entero positivo.' });

  try {
    const mesa = await Mesa.getById(mesa_id);
    if (!mesa || !mesa.activa)
      return res.status(404).json({ error: `Mesa con id ${mesa_id} no encontrada.` });
    if (mesa.ticket_pendiente)
      return res.status(400).json({ error: 'Esta mesa tiene un ticket pendiente de imprimir o descargar. Resolvé eso antes de abrir un nuevo pedido.' });

    const pedido = await Pedido.create(mesa_id);

    if (mesa.estado === 'libre')
      await Mesa.updateEstado(mesa_id, 'ocupado');

    res.status(201).json(pedido);
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

// Lógica común de validación y cierre de transacción para ambos endpoints de productos
const _resolverYAgregarProductos = async (pedido_id, productosConDatos, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const pedido = await Pedido.getById(pedido_id, conn);
    if (!pedido) {
      await conn.rollback();
      return res.status(404).json({ error: `Pedido con id ${pedido_id} no encontrado.` });
    }
    if (pedido.estado === 'finalizado') {
      await conn.rollback();
      return res.status(400).json({ error: 'No se pueden añadir productos a un pedido finalizado.' });
    }
    if (pedido.mesa_estado === 'libre') {
      await conn.rollback();
      return res.status(400).json({ error: 'No se pueden añadir productos: la mesa de este pedido ya está libre.' });
    }

    await Pedido.addProductos(pedido_id, productosConDatos, conn);
    await conn.commit();

    res.status(201).json({
      message: `${productosConDatos.length} producto(s) añadidos al pedido ${pedido_id}.`,
      pedido_id,
      productos: productosConDatos,
    });
  } catch (err) {
    await conn.rollback();
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  } finally {
    conn.release();
  }
};

const addProductos = async (req, res) => {
  const pedido_id = parseInt(req.params.id, 10);
  if (isNaN(pedido_id))
    return res.status(400).json({ error: 'El parámetro "id" del pedido debe ser un entero válido.' });

  const { productos } = req.body;

  if (!Array.isArray(productos) || productos.length === 0)
    return res.status(400).json({ error: 'El campo "productos" debe ser un array no vacío.' });

  for (let i = 0; i < productos.length; i++) {
    const { producto_id, cantidad } = productos[i];
    if (!producto_id || !Number.isInteger(producto_id) || producto_id <= 0)
      return res.status(400).json({ error: `productos[${i}]: "producto_id" debe ser un entero positivo.` });
    if (!cantidad || !Number.isInteger(cantidad) || cantidad <= 0)
      return res.status(400).json({ error: `productos[${i}]: "cantidad" debe ser un entero mayor a cero.` });
  }

  // Resuelve precio, nombre y descripcion por ID
  const conn = await pool.getConnection();
  let productosConDatos;
  try {
    productosConDatos = [];
    for (const { producto_id, cantidad } of productos) {
      const [rows] = await conn.query(
        'SELECT id, nombre, descripcion, precio FROM productos WHERE id = ?',
        [producto_id]
      );
      if (!rows.length) {
        conn.release();
        return res.status(404).json({ error: `Producto con id ${producto_id} no encontrado.` });
      }
      productosConDatos.push({
        producto_id,
        cantidad,
        nombre: rows[0].nombre,
        descripcion: rows[0].descripcion,
        precio_unitario: Number(rows[0].precio),
      });
    }
  } catch (err) {
    conn.release();
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    return res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
  conn.release();

  await _resolverYAgregarProductos(pedido_id, productosConDatos, res);
};

const addProductosPorNombre = async (req, res) => {
  const pedido_id = parseInt(req.params.id, 10);
  if (isNaN(pedido_id))
    return res.status(400).json({ error: 'El parámetro "id" del pedido debe ser un entero válido.' });

  const { productos } = req.body;

  if (!Array.isArray(productos) || productos.length === 0)
    return res.status(400).json({ error: 'El campo "productos" debe ser un array no vacío.' });

  for (let i = 0; i < productos.length; i++) {
    const { nombre, cantidad } = productos[i];
    if (!nombre || typeof nombre !== 'string' || nombre.trim() === '')
      return res.status(400).json({ error: `productos[${i}]: "nombre" debe ser un texto no vacío.` });
    if (!cantidad || !Number.isInteger(cantidad) || cantidad <= 0)
      return res.status(400).json({ error: `productos[${i}]: "cantidad" debe ser un entero mayor a cero.` });
  }

  // Resuelve producto_id, precio y descripcion por nombre (coincidencia exacta, insensible a mayúsculas)
  const conn = await pool.getConnection();
  let productosConDatos;
  try {
    productosConDatos = [];
    for (const { nombre, cantidad } of productos) {
      const [rows] = await conn.query(
        'SELECT id, nombre, descripcion, precio FROM productos WHERE nombre = ?',
        [nombre.trim()]
      );
      if (!rows.length) {
        conn.release();
        return res.status(404).json({ error: `Producto con nombre "${nombre}" no encontrado.` });
      }
      productosConDatos.push({
        producto_id: rows[0].id,
        cantidad,
        nombre: rows[0].nombre,
        descripcion: rows[0].descripcion,
        precio_unitario: Number(rows[0].precio),
      });
    }
  } catch (err) {
    conn.release();
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    return res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
  conn.release();

  await _resolverYAgregarProductos(pedido_id, productosConDatos, res);
};

// Cierra un único pedido (no toda la mesa). Si era el último pedido activo, libera la mesa.
const cerrarPedido = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id))
    return res.status(400).json({ error: 'El parámetro "id" debe ser un entero válido.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const pedido = await Pedido.getById(id, conn);
    if (!pedido) {
      await conn.rollback();
      return res.status(404).json({ error: `Pedido con id ${id} no encontrado.` });
    }
    if (pedido.estado === 'finalizado') {
      await conn.rollback();
      return res.status(400).json({ error: 'Este pedido ya está cerrado.' });
    }

    const items = await Pedido.getItems(id, conn);
    if (!items.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'No se puede cerrar un pedido sin productos. Eliminalo en su lugar.' });
    }

    await Producto.decrementarStock(items, conn);
    await Insumo.decrementarStockPorVenta(items, conn);
    await Pedido.cerrarPedidoIndividual(id, conn);

    // Si era la última silla activa de la mesa, la cuenta quedó completa: la mesa sigue "ocupada"
    // hasta que se imprima/descargue el ticket consolidado (ver Mesa.setTicketPendiente).
    const pedidosActivosRestantes = await Pedido.getActivosByMesa(pedido.mesa_id, conn);
    let ticketPendiente = false;
    if (!pedidosActivosRestantes.length) {
      await Mesa.setTicketPendiente(pedido.mesa_id, true, conn);
      ticketPendiente = true;
    }

    await conn.commit();

    const total = items.reduce((sum, item) => sum + Number(item.subtotal), 0);
    res.json({
      message: `Pedido ${id} cerrado.`,
      pedido_id: id,
      total: Math.round(total * 100) / 100,
      ticket_pendiente: ticketPendiente,
    });
  } catch (err) {
    await conn.rollback();
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  } finally {
    conn.release();
  }
};

// Elimina un pedido activo (cancelación). No se puede eliminar un pedido ya finalizado.
const removePedido = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id))
    return res.status(400).json({ error: 'El parámetro "id" debe ser un entero válido.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const pedido = await Pedido.getById(id, conn);
    if (!pedido) {
      await conn.rollback();
      return res.status(404).json({ error: `Pedido con id ${id} no encontrado.` });
    }
    if (pedido.estado === 'finalizado') {
      await conn.rollback();
      return res.status(400).json({ error: 'No se puede eliminar un pedido ya cerrado.' });
    }

    await Pedido.remove(id, conn);

    const pedidosActivosRestantes = await Pedido.getActivosByMesa(pedido.mesa_id, conn);
    let mesaLiberada = false;
    if (!pedidosActivosRestantes.length) {
      await Mesa.updateEstado(pedido.mesa_id, 'libre', conn);
      mesaLiberada = true;
    }

    await conn.commit();

    res.json({ message: `Pedido ${id} eliminado.`, pedido_id: id, mesa_liberada: mesaLiberada });
  } catch (err) {
    await conn.rollback();
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  } finally {
    conn.release();
  }
};

// Quita un producto (item) de un pedido activo
const removeItem = async (req, res) => {
  const pedido_id = parseInt(req.params.id, 10);
  const item_id = parseInt(req.params.itemId, 10);
  if (isNaN(pedido_id) || isNaN(item_id))
    return res.status(400).json({ error: 'Los parámetros "id" e "itemId" deben ser enteros válidos.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const pedido = await Pedido.getById(pedido_id, conn);
    if (!pedido) {
      await conn.rollback();
      return res.status(404).json({ error: `Pedido con id ${pedido_id} no encontrado.` });
    }
    if (pedido.estado === 'finalizado') {
      await conn.rollback();
      return res.status(400).json({ error: 'No se pueden quitar productos de un pedido ya cerrado.' });
    }

    const item = await Pedido.getItem(item_id, conn);
    if (!item || item.pedido_id !== pedido_id) {
      await conn.rollback();
      return res.status(404).json({ error: `Producto con id ${item_id} no encontrado en este pedido.` });
    }

    await Pedido.removeItem(item_id, conn);
    await conn.commit();

    res.json({ message: `Producto quitado del pedido ${pedido_id}.`, pedido_id, item_id });
  } catch (err) {
    await conn.rollback();
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  } finally {
    conn.release();
  }
};

// Marca (o desmarca) un producto puntual como entregado. Seguimiento de servicio: no afecta el
// total ni requiere que el pedido esté activo.
const marcarItemEntregado = async (req, res) => {
  const pedido_id = parseInt(req.params.id, 10);
  const item_id = parseInt(req.params.itemId, 10);
  if (isNaN(pedido_id) || isNaN(item_id))
    return res.status(400).json({ error: 'Los parámetros "id" e "itemId" deben ser enteros válidos.' });

  const { entregado } = req.body;
  if (typeof entregado !== 'boolean')
    return res.status(400).json({ error: 'El campo "entregado" debe ser true o false.' });

  try {
    const item = await Pedido.getItem(item_id);
    if (!item || item.pedido_id !== pedido_id)
      return res.status(404).json({ error: `Producto con id ${item_id} no encontrado en este pedido.` });

    await Pedido.setItemEntregado(item_id, entregado);
    res.json({ message: 'Producto actualizado.', pedido_id, item_id, entregado });
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

// Marca (o desmarca) TODOS los productos de un pedido (silla) de una sola vez.
const marcarPedidoEntregado = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id))
    return res.status(400).json({ error: 'El parámetro "id" debe ser un entero válido.' });

  const { entregado } = req.body;
  if (typeof entregado !== 'boolean')
    return res.status(400).json({ error: 'El campo "entregado" debe ser true o false.' });

  try {
    const pedido = await Pedido.getById(id);
    if (!pedido)
      return res.status(404).json({ error: `Pedido con id ${id} no encontrado.` });

    await Pedido.setPedidoEntregado(id, entregado);
    res.json({ message: 'Pedido actualizado.', pedido_id: id, entregado });
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const METODOS_PAGO_VALIDOS = ['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'otro'];
const ESTADOS_FACTURA_VALIDOS = ['pendiente', 'aprobada', 'rechazada', 'error'];
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const getHistorial = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const { desde, hasta, metodo_pago, estado_factura, con_factura } = req.query;
  const numero_mesa = req.query.numero_mesa !== undefined ? parseInt(req.query.numero_mesa, 10) : undefined;

  if (desde !== undefined && !FECHA_REGEX.test(desde))
    return res.status(400).json({ error: '"desde" debe tener formato YYYY-MM-DD.' });
  if (hasta !== undefined && !FECHA_REGEX.test(hasta))
    return res.status(400).json({ error: '"hasta" debe tener formato YYYY-MM-DD.' });
  if (desde && hasta && desde > hasta)
    return res.status(400).json({ error: '"desde" no puede ser posterior a "hasta".' });
  if (req.query.numero_mesa !== undefined && (isNaN(numero_mesa) || numero_mesa <= 0))
    return res.status(400).json({ error: '"numero_mesa" debe ser un entero positivo.' });
  if (metodo_pago !== undefined && !METODOS_PAGO_VALIDOS.includes(metodo_pago))
    return res.status(400).json({ error: `"metodo_pago" debe ser uno de: ${METODOS_PAGO_VALIDOS.join(', ')}.` });
  if (estado_factura !== undefined && !ESTADOS_FACTURA_VALIDOS.includes(estado_factura))
    return res.status(400).json({ error: `"estado_factura" debe ser uno de: ${ESTADOS_FACTURA_VALIDOS.join(', ')}.` });
  if (con_factura !== undefined && !['si', 'no'].includes(con_factura))
    return res.status(400).json({ error: '"con_factura" debe ser "si" o "no".' });

  try {
    const { rows, total } = await Pedido.getHistorial(page, limit, {
      desde, hasta, numero_mesa, metodo_pago, estado_factura, con_factura,
    });
    res.json({
      pedidos: rows,
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
  if (isNaN(id))
    return res.status(400).json({ error: 'El parámetro "id" debe ser un entero válido.' });

  try {
    const pedido = await Pedido.getById(id);
    if (!pedido)
      return res.status(404).json({ error: `Pedido con id ${id} no encontrado.` });

    const items = await Pedido.getItems(id);
    res.json({ pedido, items });
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

module.exports = {
  create,
  addProductos,
  addProductosPorNombre,
  cerrarPedido,
  removePedido,
  removeItem,
  marcarItemEntregado,
  marcarPedidoEntregado,
  getHistorial,
  getOne,
};
