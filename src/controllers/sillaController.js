const Mesa = require('../models/mesaModel');
const Silla = require('../models/sillaModel');

// Posición inicial de una silla nueva: pegada al borde superior de la mesa, escalonada para que
// no quede tapando a las anteriores. El dueño la reacomoda arrastrándola en modo edición.
const posicionInicial = (mesa, cantidadExistente) => {
  const ancho = mesa.tamano ?? 96;
  const pos_x = Math.min(ancho - 10, 20 + (cantidadExistente % 5) * 20);
  const pos_y = -14;
  return { pos_x, pos_y };
};

const create = async (req, res) => {
  const mesa_id = parseInt(req.params.id, 10);
  if (isNaN(mesa_id))
    return res.status(400).json({ error: 'El parámetro "id" de la mesa debe ser un entero válido.' });

  try {
    const mesa = await Mesa.getById(mesa_id);
    if (!mesa)
      return res.status(404).json({ error: `Mesa con id ${mesa_id} no encontrada.` });

    const existentes = await Silla.getByMesa(mesa_id);
    const { pos_x, pos_y } = posicionInicial(mesa, existentes.length);

    const silla = await Silla.create(mesa_id, pos_x, pos_y);
    res.status(201).json(silla);
  } catch (err) {
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
    const silla = await Silla.getById(id);
    if (!silla)
      return res.status(404).json({ error: `Silla con id ${id} no encontrada.` });

    await Silla.updatePosicion(id, pos_x, pos_y);
    res.json({ ...silla, pos_x, pos_y });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const remove = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id))
    return res.status(400).json({ error: 'El parámetro "id" debe ser un entero válido.' });

  try {
    const silla = await Silla.getById(id);
    if (!silla)
      return res.status(404).json({ error: `Silla con id ${id} no encontrada.` });

    await Silla.remove(id);
    res.json({ message: 'Silla eliminada correctamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

module.exports = { create, updatePosicion, remove };
