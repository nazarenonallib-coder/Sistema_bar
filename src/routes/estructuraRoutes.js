const { Router } = require('express');
const { getAllBySalon, create, updatePosicion, update, remove } = require('../controllers/estructuraController');

const router = Router();

router.get('/', getAllBySalon);
router.post('/', create);
router.patch('/:id/posicion', updatePosicion);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
