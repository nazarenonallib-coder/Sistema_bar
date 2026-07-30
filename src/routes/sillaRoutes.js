const { Router } = require('express');
const { updatePosicion, remove } = require('../controllers/sillaController');

const router = Router();

router.patch('/:id/posicion', updatePosicion);
router.delete('/:id', remove);

module.exports = router;
