const { Router } = require('express');
const {
  getConfig, getHistorial, getOne, getPdf, reintentar, getEstadoAfip,
} = require('../controllers/facturaController');

const router = Router();

router.get('/config', getConfig);
router.get('/estado-afip', getEstadoAfip);
router.get('/', getHistorial);
router.get('/:id', getOne);
router.get('/:id/pdf', getPdf);
router.post('/:id/reintentar', reintentar);

module.exports = router;
