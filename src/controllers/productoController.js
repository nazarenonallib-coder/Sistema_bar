const Producto = require('../models/productoModel');
const Insumo = require('../models/insumoModel');
const logger = require('../utils/logger');

const validarCampos = ({ nombre, precio }) => {
  const errores = [];

  if (nombre === undefined || nombre === null) {
    errores.push('El campo "nombre" es obligatorio.');
  } else if (typeof nombre !== 'string' || nombre.trim() === '') {
    errores.push('El campo "nombre" no puede estar vacío.');
  }

  if (precio === undefined || precio === null) {
    errores.push('El campo "precio" es obligatorio.');
  } else if (typeof precio !== 'number' || isNaN(precio) || precio < 0) {
    errores.push('El campo "precio" debe ser un número mayor o igual a cero.');
  }

  return errores;
};

const getAll = async (req, res) => {
  try {
    const productos = await Producto.getAll();
    res.json(productos);
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

// GET /api/productos/:identifier — resuelve por ID (numérico) o por nombre (texto)
const getOne = async (req, res) => {
  const { identifier } = req.params;

  try {
    if (/^\d+$/.test(identifier)) {
      const id = parseInt(identifier, 10);
      const producto = await Producto.getById(id);
      if (!producto) {
        return res.status(404).json({ error: `Producto con id ${id} no encontrado.` });
      }
      return res.json(producto);
    }

    const productos = await Producto.getByNombre(identifier);
    if (!productos.length) {
      return res.status(404).json({ error: `No se encontraron productos con nombre "${identifier}".` });
    }
    return res.json(productos);
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const create = async (req, res) => {
  const { nombre, precio, descripcion, stock } = req.body;

  const errores = validarCampos({ nombre, precio });
  if (errores.length) return res.status(400).json({ errores });

  if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) {
    return res.status(400).json({ errores: ['El campo "stock" debe ser un entero mayor o igual a cero.'] });
  }

  try {
    const nuevo = await Producto.create({
      nombre: nombre.trim(),
      precio,
      descripcion: descripcion?.trim() ?? null,
      stock: stock ?? 0,
    });
    res.status(201).json(nuevo);
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

// El stock no se recibe acá: se fija al crear el producto y luego solo se descuenta
// automáticamente al cerrar cuentas (ver mesaController.cerrarCuenta).
const update = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'El parámetro "id" debe ser un número entero válido.' });

  const { nombre, precio, descripcion } = req.body;

  const errores = validarCampos({ nombre, precio });
  if (errores.length) return res.status(400).json({ errores });

  try {
    const afectados = await Producto.update(id, {
      nombre: nombre.trim(),
      precio,
      descripcion: descripcion?.trim() ?? null,
    });

    if (!afectados) return res.status(404).json({ error: `Producto con id ${id} no encontrado.` });

    const actualizado = await Producto.getById(id);
    res.json(actualizado);
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const remove = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'El parámetro "id" debe ser un número entero válido.' });

  try {
    const afectados = await Producto.remove(id);
    if (!afectados) return res.status(404).json({ error: `Producto con id ${id} no encontrado.` });

    res.status(200).json({ message: `Producto con id ${id} eliminado correctamente.` });
  } catch (err) {
    if (err.code === 'PRODUCTO_CON_PEDIDOS') {
      return res.status(409).json({
        error: 'Este producto ya fue usado en pedidos y no se puede eliminar. Marcalo como "no disponible" (stock 0) en su lugar.',
      });
    }
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

// --- Receta: insumos que consume este producto (producto_insumos) ---

const getInsumosDeProducto = async (req, res) => {
  const producto_id = parseInt(req.params.id, 10);
  if (isNaN(producto_id)) return res.status(400).json({ error: 'El parámetro "id" debe ser un número entero válido.' });

  try {
    const producto = await Producto.getById(producto_id);
    if (!producto) return res.status(404).json({ error: `Producto con id ${producto_id} no encontrado.` });

    const insumos = await Insumo.getByProducto(producto_id);
    res.json(insumos);
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const addInsumoAProducto = async (req, res) => {
  const producto_id = parseInt(req.params.id, 10);
  if (isNaN(producto_id)) return res.status(400).json({ error: 'El parámetro "id" debe ser un número entero válido.' });

  const { insumo_id, cantidad_consumida } = req.body;
  if (!Number.isInteger(insumo_id) || insumo_id <= 0)
    return res.status(400).json({ error: 'El campo "insumo_id" debe ser un entero positivo.' });
  if (typeof cantidad_consumida !== 'number' || isNaN(cantidad_consumida) || cantidad_consumida <= 0)
    return res.status(400).json({ error: 'El campo "cantidad_consumida" debe ser un número mayor a cero.' });

  try {
    const producto = await Producto.getById(producto_id);
    if (!producto) return res.status(404).json({ error: `Producto con id ${producto_id} no encontrado.` });

    const insumo = await Insumo.getById(insumo_id);
    if (!insumo) return res.status(404).json({ error: `Insumo con id ${insumo_id} no encontrado.` });

    const linea = await Insumo.addToProducto(producto_id, insumo_id, cantidad_consumida);
    res.status(201).json(linea);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Ese insumo ya está en la receta de este producto. Editá la cantidad en su lugar.' });
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const updateInsumoDeProducto = async (req, res) => {
  const producto_id = parseInt(req.params.id, 10);
  const linea_id = parseInt(req.params.insumoProductoId, 10);
  if (isNaN(producto_id) || isNaN(linea_id))
    return res.status(400).json({ error: 'Los parámetros "id" e "insumoProductoId" deben ser enteros válidos.' });

  const { cantidad_consumida } = req.body;
  if (typeof cantidad_consumida !== 'number' || isNaN(cantidad_consumida) || cantidad_consumida <= 0)
    return res.status(400).json({ error: 'El campo "cantidad_consumida" debe ser un número mayor a cero.' });

  try {
    const linea = await Insumo.getLinea(linea_id);
    if (!linea || linea.producto_id !== producto_id)
      return res.status(404).json({ error: `Insumo con id de línea ${linea_id} no encontrado en la receta de este producto.` });

    await Insumo.updateCantidad(linea_id, cantidad_consumida);
    res.json({ ...linea, cantidad_consumida });
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

const removeInsumoDeProducto = async (req, res) => {
  const producto_id = parseInt(req.params.id, 10);
  const linea_id = parseInt(req.params.insumoProductoId, 10);
  if (isNaN(producto_id) || isNaN(linea_id))
    return res.status(400).json({ error: 'Los parámetros "id" e "insumoProductoId" deben ser enteros válidos.' });

  try {
    const linea = await Insumo.getLinea(linea_id);
    if (!linea || linea.producto_id !== producto_id)
      return res.status(404).json({ error: `Insumo con id de línea ${linea_id} no encontrado en la receta de este producto.` });

    await Insumo.removeFromProducto(linea_id);
    res.json({ message: 'Insumo quitado de la receta.', producto_id, id: linea_id });
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

module.exports = {
  getAll, getOne, create, update, remove,
  getInsumosDeProducto, addInsumoAProducto, updateInsumoDeProducto, removeInsumoDeProducto,
};
