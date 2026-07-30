const { Router } = require('express');
const {
  getAll,
  getOne,
  create,
  update,
  remove,
} = require('../controllers/insumoController');

const router = Router();

router.get('/', getAll);
router.get('/:identifier', getOne);   // resuelve ID (numérico) o nombre (texto)
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
