const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const logger = require('../utils/logger');

const JWT_EXPIRES_IN = '12h';

const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || typeof username !== 'string')
    return res.status(400).json({ error: 'El campo "username" es obligatorio.' });
  if (!password || typeof password !== 'string')
    return res.status(400).json({ error: 'El campo "password" es obligatorio.' });

  try {
    const user = await User.getByUsername(username.trim());
    const valido = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!valido)
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });

    const token = jwt.sign(
      { sub: user.id, username: user.username, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({ token, usuario: { id: user.id, username: user.username, rol: user.rol } });
  } catch (err) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
};

module.exports = { login };
