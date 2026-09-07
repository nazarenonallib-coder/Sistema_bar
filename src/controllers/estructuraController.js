const Estructura = require('../models/estructuraModel');
const logger = require('../utils/logger');

const getAllBySalon = async (req, res) => {
  const salon_id = parseInt(req.query.salon_id, 10);
  if (isNaN(salon_id))
    return res.status(400).json({ error: 'El parámetro "salon_id" es obligatorio y debe ser un entero.' });

  try {
    res.json(await Estructura.getAllBySalon(salon_id));
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const create = async (req, res) => {
  const { salon_id, tipo, pos_x, pos_y } = req.body;

  if (!Number.isInteger(salon_id))
    return res.status(400).json({ error: 'El campo "salon_id" es obligatorio y debe ser un entero.' });
  if (!Estructura.TIPOS_VALIDOS.includes(tipo))
    return res.status(400).json({ error: `El campo "tipo" debe ser uno de: ${Estructura.TIPOS_VALIDOS.join(', ')}.` });

  try {
    const estructura = await Estructura.create(salon_id, tipo, pos_x ?? 0, pos_y ?? 0);
    res.status(201).json(estructura);
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const updatePosicion = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id))
    return res.status(400).json({ error: 'El parámetro "id" debe ser un entero válido.' });

  const { pos_x, pos_y } = req.body;
  if (!Number.isInteger(pos_x) || !Number.isInteger(pos_y))
    return res.status(400).json({ error: '"pos_x" y "pos_y" deben ser enteros.' });

  try {
    const estructura = await Estructura.getById(id);
    if (!estructura)
      return res.status(404).json({ error: `Estructura con id ${id} no encontrada.` });

    await Estructura.updatePosicion(id, pos_x, pos_y);
    res.json({ ...estructura, pos_x, pos_y });
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const update = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id))
    return res.status(400).json({ error: 'El parámetro "id" debe ser un entero válido.' });

  const { ancho, alto, rotacion } = req.body;
  if (!Number.isInteger(ancho) || ancho <= 0 || !Number.isInteger(alto) || alto <= 0)
    return res.status(400).json({ error: '"ancho" y "alto" deben ser enteros positivos.' });
  if (![0, 90, 180, 270].includes(rotacion))
    return res.status(400).json({ error: '"rotacion" debe ser uno de: 0, 90, 180, 270.' });

  try {
    const estructura = await Estructura.getById(id);
    if (!estructura)
      return res.status(404).json({ error: `Estructura con id ${id} no encontrada.` });

    await Estructura.update(id, { ancho, alto, rotacion });
    res.json({ ...estructura, ancho, alto, rotacion });
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const remove = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id))
    return res.status(400).json({ error: 'El parámetro "id" debe ser un entero válido.' });

  try {
    const estructura = await Estructura.getById(id);
    if (!estructura)
      return res.status(404).json({ error: `Estructura con id ${id} no encontrada.` });

    await Estructura.remove(id);
    res.json({ message: `Estructura eliminada correctamente.` });
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

module.exports = { getAllBySalon, create, updatePosicion, update, remove };
