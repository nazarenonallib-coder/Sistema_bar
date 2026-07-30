const Salon = require('../models/salonModel');

const validarNombre = (nombre) =>
  typeof nombre === 'string' && nombre.trim() !== '';

const getAll = async (req, res) => {
  try {
    res.json(await Salon.getAll());
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const create = async (req, res) => {
  const { nombre, color_fondo } = req.body;

  if (!validarNombre(nombre))
    return res.status(400).json({ error: 'El campo "nombre" es obligatorio.' });

  try {
    const salon = await Salon.create(nombre.trim(), color_fondo);
    res.status(201).json(salon);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const update = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id))
    return res.status(400).json({ error: 'El parámetro "id" debe ser un entero válido.' });

  const { nombre, color_fondo } = req.body;
  if (!validarNombre(nombre))
    return res.status(400).json({ error: 'El campo "nombre" es obligatorio.' });

  try {
    const salon = await Salon.getById(id);
    if (!salon)
      return res.status(404).json({ error: `Salón con id ${id} no encontrado.` });

    await Salon.update(id, { nombre: nombre.trim(), color_fondo: color_fondo ?? salon.color_fondo });
    res.json(await Salon.getById(id));
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const remove = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id))
    return res.status(400).json({ error: 'El parámetro "id" debe ser un entero válido.' });

  try {
    const salon = await Salon.getById(id);
    if (!salon)
      return res.status(404).json({ error: `Salón con id ${id} no encontrado.` });

    if (await Salon.hasMesas(id))
      return res.status(400).json({ error: `No se puede eliminar el salón "${salon.nombre}": todavía tiene mesas. Eliminá o movés sus mesas primero.` });
    if (await Salon.hasEstructuras(id))
      return res.status(400).json({ error: `No se puede eliminar el salón "${salon.nombre}": todavía tiene estructuras. Eliminalas primero.` });

    await Salon.remove(id);
    res.json({ message: `Salón "${salon.nombre}" eliminado correctamente.` });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

module.exports = { getAll, create, update, remove };
