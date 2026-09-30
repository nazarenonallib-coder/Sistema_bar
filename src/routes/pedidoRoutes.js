const { Router } = require('express');
const {
  create, addProductos, addProductosPorNombre, cerrarPedido, removePedido, removeItem,
  marcarItemEntregado, marcarPedidoEntregado, getHistorial, getReporte, getEstadisticas, getOne,
} = require('../controllers/pedidoController');
const { ticketPedido } = require('../controllers/ticketController');

const router = Router();

router.post('/', create);
router.get('/historial', getHistorial);
router.get('/estadisticas', getEstadisticas);
router.get('/reporte', getReporte);
router.get('/:id', getOne);
router.get('/:id/ticket', ticketPedido);
router.post('/:id/productos', addProductos);
router.post('/:id/productos/nombre', addProductosPorNombre);
router.post('/:id/cerrar', cerrarPedido);
router.patch('/:id/entregado', marcarPedidoEntregado);
router.patch('/:id/productos/:itemId/entregado', marcarItemEntregado);
router.delete('/:id/productos/:itemId', removeItem);
router.delete('/:id', removePedido);

module.exports = router;
