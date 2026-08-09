const fs = require('fs');
const path = require('path');
const winston = require('winston');

// logs/ vive junto al proyecto (fuera de src/) y no se versiona (ver .gitignore: *.log).
const LOGS_DIR = path.join(__dirname, '..', '..', 'logs');
fs.mkdirSync(LOGS_DIR, { recursive: true });

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB por archivo
const MAX_FILES = 5; // hasta 5 archivos rotados por transporte (~25 MB máximo cada uno)

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Todo lo que sea 'error' (fallas de negocio, excepciones no controladas) queda separado
    // para poder revisar rápido "qué se rompió" sin filtrar entre logs normales.
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'error.log'),
      level: 'error',
      maxsize: MAX_FILE_SIZE,
      maxFiles: MAX_FILES,
    }),
    // Registro combinado: todo nivel 'info' o más severo (incluye el acceso a la API).
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'combined.log'),
      maxsize: MAX_FILE_SIZE,
      maxFiles: MAX_FILES,
    }),
  ],
});

// En desarrollo (o si no hay proceso administrador de logs) también se imprime por consola,
// legible y en color, en vez del JSON crudo que usan los archivos.
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ level, message, timestamp, stack }) =>
        `${timestamp} ${level}: ${stack || message}`
      )
    ),
  }));
}

// Para errores que van seguidos de un process.exit(): winston escribe a archivo de forma
// asíncrona, así que un exit() inmediato después de logger.error() puede cortar la escritura a
// mitad de camino. logFatal espera a que termine de volcarse antes de resolver.
logger.logFatal = (message, meta) =>
  new Promise((resolve) => {
    logger.on('finish', resolve);
    logger.error(message, meta);
    logger.end();
  });

module.exports = logger;
