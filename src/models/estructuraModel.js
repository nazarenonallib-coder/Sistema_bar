const pool = require('../config/db');

const TIPOS_VALIDOS = ['ventana', 'puerta', 'mostrador', 'columna'];

const DEFAULTS = {
  ventana:   { ancho: 100, alto: 20 },
  puerta:    { ancho: 60,  alto: 20 },
  mostrador: { ancho: 160, alto: 40 },
  columna:   { ancho: 40,  alto: 40 },
};

const getAllBySalon = async (salon_id) => {
  const [rows] = await pool.query(
    'SELECT * FROM estructuras WHERE salon_id = ? ORDER BY id ASC',
    [salon_id]
  );
  return rows;
};

const getById = async (id, conn = pool) => {
  const [rows] = await conn.query('SELECT * FROM estructuras WHERE id = ?', [id]);
  return rows[0] || null;
};

const create = async (salon_id, tipo, pos_x = 0, pos_y = 0) => {
  const { ancho, alto } = DEFAULTS[tipo];
  const [result] = await pool.query(
    'INSERT INTO estructuras (salon_id, tipo, pos_x, pos_y, ancho, alto) VALUES (?, ?, ?, ?, ?, ?)',
    [salon_id, tipo, pos_x, pos_y, ancho, alto]
  );
  return getById(result.insertId);
};

const updatePosicion = async (id, pos_x, pos_y) => {
  const [result] = await pool.query(
    'UPDATE estructuras SET pos_x = ?, pos_y = ? WHERE id = ?',
    [pos_x, pos_y, id]
  );
  return result.affectedRows;
};

const update = async (id, { ancho, alto, rotacion }) => {
  const [result] = await pool.query(
    'UPDATE estructuras SET ancho = ?, alto = ?, rotacion = ? WHERE id = ?',
    [ancho, alto, rotacion, id]
  );
  return result.affectedRows;
};

const remove = async (id) => {
  const [result] = await pool.query('DELETE FROM estructuras WHERE id = ?', [id]);
  return result.affectedRows;
};

module.exports = { TIPOS_VALIDOS, getAllBySalon, getById, create, updatePosicion, update, remove };
