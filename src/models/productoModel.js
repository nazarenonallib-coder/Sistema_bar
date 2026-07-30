const pool = require('../config/db');

const getAll = async () => {
  const [rows] = await pool.query('SELECT * FROM productos ORDER BY id ASC');
  return rows;
};

const getById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM productos WHERE id = ?', [id]);
  return rows[0] || null;
};

const getByNombre = async (nombre) => {
  const [rows] = await pool.query(
    'SELECT * FROM productos WHERE nombre LIKE ?',
    [`%${nombre}%`]
  );
  return rows;
};

const create = async ({ nombre, precio, descripcion, stock }) => {
  const [result] = await pool.query(
    'INSERT INTO productos (nombre, precio, descripcion, stock) VALUES (?, ?, ?, ?)',
    [nombre, precio, descripcion ?? null, stock ?? 0]
  );
  const [newRow] = await pool.query('SELECT * FROM productos WHERE id = ?', [result.insertId]);
  return newRow[0];
};

// El stock no se edita a mano: solo cambia al crear el producto o al cerrar pedidos (ver decrementarStock)
const update = async (id, { nombre, precio, descripcion }) => {
  const [result] = await pool.query(
    'UPDATE productos SET nombre = ?, precio = ?, descripcion = ? WHERE id = ?',
    [nombre, precio, descripcion ?? null, id]
  );
  return result.affectedRows;
};

// Descuenta stock según lo consumido en una lista de items { producto_id, cantidad } (se suman por producto).
// Nunca baja de 0 (GREATEST) para no dejar valores negativos si hay descuadres.
const decrementarStock = async (items, conn) => {
  const cantidadPorProducto = new Map();
  for (const { producto_id, cantidad } of items) {
    cantidadPorProducto.set(producto_id, (cantidadPorProducto.get(producto_id) || 0) + cantidad);
  }
  for (const [producto_id, cantidad] of cantidadPorProducto) {
    await conn.query(
      'UPDATE productos SET stock = GREATEST(stock - ?, 0) WHERE id = ?',
      [cantidad, producto_id]
    );
  }
};

const remove = async (id) => {
  try {
    const [result] = await pool.query('DELETE FROM productos WHERE id = ?', [id]);
    return result.affectedRows;
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      const error = new Error('El producto tiene pedidos asociados y no puede eliminarse.');
      error.code = 'PRODUCTO_CON_PEDIDOS';
      throw error;
    }
    throw err;
  }
};

module.exports = { getAll, getById, getByNombre, create, update, decrementarStock, remove };
