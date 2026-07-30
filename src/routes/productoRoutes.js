const { Router } = require('express');
const {
  getAll,
  getOne,
  create,
  update,
  remove,
  getInsumosDeProducto,
  addInsumoAProducto,
  updateInsumoDeProducto,
  removeInsumoDeProducto,
} = require('../controllers/productoController');

const router = Router();

router.get('/', getAll);
router.get('/:identifier', getOne);   // resuelve ID (numérico) o nombre (texto)
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

// Receta (insumos que consume el producto)
router.get('/:id/insumos', getInsumosDeProducto);
router.post('/:id/insumos', addInsumoAProducto);
router.put('/:id/insumos/:insumoProductoId', updateInsumoDeProducto);
router.delete('/:id/insumos/:insumoProductoId', removeInsumoDeProducto);

module.exports = router;
