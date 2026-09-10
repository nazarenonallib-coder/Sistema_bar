require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const connectionConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 3306,
};

// Crea la base de datos (DB_NAME) si no existe y, si es la primera vez (todavía no tiene la
// tabla "users"), le aplica el esquema completo de database/schema.sql. Esto permite levantar
// una instalación nueva del sistema (ej. para otro bar) con solo apuntar DB_NAME a un nombre
// nuevo en el .env: no hace falta correr ningún script a mano contra MySQL.
async function ensureDatabase() {
  const admin = await mysql.createConnection(connectionConfig);
  try {
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await admin.end();
  }

  const connection = await mysql.createConnection({
    ...connectionConfig,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });
  try {
    const [[{ total }]] = await connection.query(
      `SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'`,
      [process.env.DB_NAME]
    );
    if (total === 0) {
      const schemaSql = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema.sql'), 'utf8');
      await connection.query(schemaSql);
    }
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
