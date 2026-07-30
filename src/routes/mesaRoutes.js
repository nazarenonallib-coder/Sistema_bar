const { Router } = require('express');
const {
  getAll, create, cerrarCuenta, confirmarTicket, remove, getPedidosActivos,
  updatePosicion, updateColor, updateTamano, combinar, separar,
} = require('../controllers/mesaController');
const { create: crearSilla } = require('../controllers/sillaController');
const { ticketCuentaMesa } = require('../controllers/ticketController');

const router = Router();

router.get('/', getAll);
router.post('/', create);
router.post('/combinar', combinar);
router.post('/grupos/:grupoId/separar', separar);
router.get('/:id/pedidos-activos', getPedidosActivos);
router.get('/:id/ticket', ticketCuentaMesa);
router.patch('/:id/posicion', updatePosicion);
router.patch('/:id/color', updateColor);
router.patch('/:id/tamano', updateTamano);
router.post('/:id/cerrar', cerrarCuenta);
router.post('/:id/confirmar-ticket', confirmarTicket);
router.post('/:id/sillas', crearSilla);
router.delete('/:id', remove);

module.exports = router;
