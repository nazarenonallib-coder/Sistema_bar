const pool = require('../config/db');

const getAll = async () => {
  const [rows] = await pool.query('SELECT * FROM salones ORDER BY orden ASC, id ASC');
  return rows;
};

const getById = async (id, conn = pool) => {
  const [rows] = await conn.query('SELECT * FROM salones WHERE id = ?', [id]);
  return rows[0] || null;
};

const create = async (nombre, color_fondo) => {
  const [maxRow] = await pool.query('SELECT COALESCE(MAX(orden), -1) AS maxOrden FROM salones');
  const orden = maxRow[0].maxOrden + 1;
  const [result] = await pool.query(
    'INSERT INTO salones (nombre, color_fondo, orden) VALUES (?, ?, ?)',
    [nombre, color_fondo ?? '#f9fafb', orden]
  );
  return getById(result.insertId);
};

const update = async (id, { nombre, color_fondo }) => {
  const [result] = await pool.query(
    'UPDATE salones SET nombre = ?, color_fondo = ? WHERE id = ?',
    [nombre, color_fondo, id]
  );
  return result.affectedRows;
};

const hasMesas = async (id) => {
  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM mesas WHERE salon_id = ?', [id]);
  return rows[0].total > 0;
};

const hasEstructuras = async (id) => {
  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM estructuras WHERE salon_id = ?', [id]);
  return rows[0].total > 0;
};

const remove = async (id) => {
  const [result] = await pool.query('DELETE FROM salones WHERE id = ?', [id]);
  return result.affectedRows;
};

module.exports = { getAll, getById, create, update, hasMesas, hasEstructuras, remove };
