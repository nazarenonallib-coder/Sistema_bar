require('dotenv').config();
const mysql = require('mysql2/promise');

const connectionConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 3306,
};

async function ensureDatabase() {
  const connection = await mysql.createConnection(connectionConfig);
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

const pool = mysql.createPool({
  ...connectionConfig,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool.ensureDatabase = ensureDatabase;

module.exports = pool;
