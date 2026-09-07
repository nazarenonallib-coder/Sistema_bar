const logger = require('../utils/logger');

// Red de seguridad: los controladores ya capturan sus propios errores, pero cualquier excepción
// sincrónica en un middleware, o un error pasado explícitamente con next(err), termina acá en vez
// de tumbar el proceso sin dejar rastro.
const errorHandler = (err, req, res, next) => {
  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });

  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
};

module.exports = errorHandler;
