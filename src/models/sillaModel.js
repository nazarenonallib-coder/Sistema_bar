const pool = require('../config/db');

const getByMesa = async (mesa_id, conn = pool) => {
  const [rows] = await conn.query(
    'SELECT * FROM mesa_sillas WHERE mesa_id = ? ORDER BY id ASC',
    [mesa_id]
  );
  return rows;
};

const getByMesas = async (mesaIds, conn = pool) => {
  if (!mesaIds.length) return [];
  const placeholders = mesaIds.map(() => '?').join(',');
  const [rows] = await conn.query(
    `SELECT * FROM mesa_sillas WHERE mesa_id IN (${placeholders}) ORDER BY id ASC`,
    mesaIds
  );
  return rows;
};

const getById = async (id, conn = pool) => {
  const [rows] = await conn.query('SELECT * FROM mesa_sillas WHERE id = ?', [id]);
  return rows[0] || null;
};

const create = async (mesa_id, pos_x, pos_y) => {
  const [result] = await pool.query(
    'INSERT INTO mesa_sillas (mesa_id, pos_x, pos_y) VALUES (?, ?, ?)',
    [mesa_id, pos_x, pos_y]
  );
  return getById(result.insertId);
};

const updatePosicion = async (id, pos_x, pos_y) => {
  const [result] = await pool.query(
    'UPDATE mesa_sillas SET pos_x = ?, pos_y = ? WHERE id = ?',
    [pos_x, pos_y, id]
  );
  return result.affectedRows;
};

const remove = async (id) => {
  const [result] = await pool.query('DELETE FROM mesa_sillas WHERE id = ?', [id]);
  return result.affectedRows;
};

module.exports = { getByMesa, getByMesas, getById, create, updatePosicion, remove };
