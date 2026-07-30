const Pedido = require('../models/pedidoModel');
const Mesa = require('../models/mesaModel');
const Factura = require('../models/facturaModel');
const { generarTicketPedido, generarTicketCuenta } = require('../services/ticketService');
const { generarFacturaPDF } = require('../services/facturaPdfService');

// Ticket (comprobante interno, no fiscal) de una silla/pedido puntual. Se puede pedir tanto para
// un pedido activo como para uno ya finalizado (para reimprimir desde el historial).
const ticketPedido = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id))
    return res.status(400).json({ error: 'El parámetro "id" debe ser un entero válido.' });

  try {
    const pedido = await Pedido.getById(id);
    if (!pedido)
      return res.status(404).json({ error: `Pedido con id ${id} no encontrado.` });

    const items = await Pedido.getItems(id);
    const sillasIds = await Pedido.getSillasSesion(pedido.mesa_id, pedido.sesion_apertura);
    const sillaNumero = sillasIds.indexOf(pedido.id) + 1;

    generarTicketPedido(res, {
      pedido,
      items,
      sillaNumero: sillaNumero || 1,
      sillasTotales: sillasIds.length || 1,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

// Ticket consolidado de la última cuenta cerrada de una mesa (todas las sillas de esa sesión).
// Pensado para ofrecerse justo después de "Cerrar Cuenta".
const ticketCuentaMesa = async (req, res) => {
  const mesa_id = parseInt(req.params.id, 10);
  if (isNaN(mesa_id))
    return res.status(400).json({ error: 'El parámetro "id" debe ser un entero válido.' });

  try {
    const mesa = await Mesa.getById(mesa_id);
    if (!mesa)
      return res.status(404).json({ error: `Mesa con id ${mesa_id} no encontrada.` });

    const sesionApertura = await Pedido.getUltimaSesionCerrada(mesa_id);
    if (!sesionApertura)
      return res.status(404).json({ error: 'Esta mesa todavía no tiene ninguna cuenta cerrada.' });

    const pedidos = await Pedido.getPedidosSesion(mesa_id, sesionApertura);
    const items = await Pedido.getItemsByPedidoIds(pedidos.map((p) => p.id));

    // Si la cuenta ya tiene una factura fiscal aprobada, se sirve ese PDF real (con CAE y QR) en
    // esta misma URL en vez del ticket interno; si todavía no hay factura aprobada (pendiente,
    // error, o nunca se intentó), se sigue sirviendo el ticket no fiscal de siempre como respaldo.
    // El cliente puede pedir explícitamente el ticket interno con ?tipo=interno aunque ya haya
    // factura aprobada (por ejemplo, para uso interno de cocina/mostrador sin valor fiscal).
    const factura = await Factura.getBySesion(mesa_id, sesionApertura);
    if (req.query.tipo !== 'interno' && factura && factura.estado === 'aprobada') {
      return await generarFacturaPDF(res, factura, { items });
    }

    generarTicketCuenta(res, { mesa, pedidos, items });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

module.exports = { ticketPedido, ticketCuentaMesa };
