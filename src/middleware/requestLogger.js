const logger = require('../utils/logger');

// Registra cada request con su status y duración. Sirve para detectar errores que un controlador
// ya "maneja" devolviendo 4xx/5xx (por ejemplo, una validación que falla seguido, o ARCA
// devolviendo 401 reiteradamente) y que de otra forma no dejarían rastro en los logs.
const requestLogger = (req, res, next) => {
  const inicio = Date.now();

  res.on('finish', () => {
    const duracionMs = Date.now() - inicio;
    const mensaje = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duracionMs}ms`;
    const meta = { usuario: req.usuario?.sub ?? null, ip: req.ip };

    if (res.statusCode >= 500) logger.error(mensaje, meta);
    else if (res.statusCode >= 400) logger.warn(mensaje, meta);
    else logger.info(mensaje, meta);
  });

  next();
};

module.exports = requestLogger;
