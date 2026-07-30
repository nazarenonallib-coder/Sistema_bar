const pool = require('../config/db');

const getByUsername = async (username) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  return rows[0] || null;
};

module.exports = { getByUsername };
