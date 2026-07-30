require('dotenv').config();
const path = require('path');
const express = require('express');
const pool             = require('./config/db');
const authRoutes       = require('./routes/authRoutes');
const productoRoutes   = require('./routes/productoRoutes');
const insumoRoutes     = require('./routes/insumoRoutes');
const mesaRoutes       = require('./routes/mesaRoutes');
const pedidoRoutes     = require('./routes/pedidoRoutes');
const salonRoutes      = require('./routes/salonRoutes');
const estructuraRoutes = require('./routes/estructuraRoutes');
const sillaRoutes      = require('./routes/sillaRoutes');
const facturaRoutes    = require('./routes/facturaRoutes');
const requireAuth      = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/api', (req, res) => {
  res.json({
    api: 'Sistema Chepola',
    version: '1.0.0',
    endpoints: {
      health:   'GET  /health',
      login:    'POST /api/auth/login',
      listar:   'GET  /api/productos',
      buscar:   'GET  /api/productos/:id_o_nombre',
      crear:    'POST /api/productos',
      actualizar: 'PUT  /api/productos/:id',
      eliminar:        'DELETE /api/productos/:id',
      listar_insumos:  'GET    /api/insumos',
      crear_insumo:    'POST   /api/insumos',
      actualizar_insumo: 'PUT  /api/insumos/:id',
      eliminar_insumo: 'DELETE /api/insumos/:id',
      receta_producto: 'GET    /api/productos/:id/insumos',
      agregar_insumo_receta: 'POST   /api/productos/:id/insumos',
      editar_insumo_receta:  'PUT    /api/productos/:id/insumos/:insumoProductoId',
      quitar_insumo_receta:  'DELETE /api/productos/:id/insumos/:insumoProductoId',
      listar_mesas:    'GET    /api/mesas',
      crear_mesa:      'POST   /api/mesas',
      pedidos_activos: 'GET    /api/mesas/:id/pedidos-activos',
      mover_mesa:      'PATCH  /api/mesas/:id/posicion',
      cerrar_cuenta:   'POST   /api/mesas/:id/cerrar',
      ticket_cuenta:   'GET    /api/mesas/:id/ticket',
      abrir_pedido:    'POST   /api/pedidos',
      agregar_prod:    'POST   /api/pedidos/:id/productos',
      ticket_pedido:   'GET    /api/pedidos/:id/ticket',
      listar_salones:  'GET    /api/salones',
      crear_salon:     'POST   /api/salones',
      listar_estructuras: 'GET  /api/estructuras?salon_id=',
      combinar_mesas:  'POST   /api/mesas/combinar',
      separar_grupo:   'POST   /api/mesas/grupos/:grupoId/separar',
      agregar_silla:   'POST   /api/mesas/:id/sillas',
      mover_silla:     'PATCH  /api/sillas/:id/posicion',
      eliminar_silla:  'DELETE /api/sillas/:id',
      factura_config:   'GET    /api/facturas/config',
      factura_historial: 'GET   /api/facturas',
      factura_detalle:  'GET    /api/facturas/:id',
      factura_pdf:      'GET    /api/facturas/:id/pdf',
      factura_reintentar: 'POST  /api/facturas/:id/reintentar',
      factura_estado_afip: 'GET  /api/facturas/estado-afip',
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api', requireAuth);

app.use('/api/productos',   productoRoutes);
app.use('/api/insumos',     insumoRoutes);
app.use('/api/mesas',       mesaRoutes);
app.use('/api/pedidos',     pedidoRoutes);
app.use('/api/salones',     salonRoutes);
app.use('/api/estructuras', estructuraRoutes);
app.use('/api/sillas',      sillaRoutes);
app.use('/api/facturas',    facturaRoutes);

// Sirve el build del frontend (mismo origen que la API, sin CORS). Se genera con
// `npm run build` dentro de frontend/ y no se versiona (frontend/dist está en .gitignore).
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

app.get(/^\/(?!api|health).*/, (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: `Ruta ${req.method} ${req.path} no encontrada.` });
});

pool.ensureDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error(`No se pudo verificar/crear la base de datos: [${err.code}] ${err.message}`);
    process.exit(1);
  });

module.exports = app;
