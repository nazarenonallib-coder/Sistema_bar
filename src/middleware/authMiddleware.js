const jwt = require('jsonwebtoken');

// Exige un token válido (emitido por /api/auth/login) en todas las rutas donde se monta.
// No diferencia por rol: cualquier usuario logueado puede hacer cualquier acción, por ahora.
const requireAuth = (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');

  if (scheme !== 'Bearer' || !token)
    return res.status(401).json({ error: 'No autenticado. Iniciá sesión.' });

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada. Iniciá sesión de nuevo.' });
  }
};

module.exports = requireAuth;
