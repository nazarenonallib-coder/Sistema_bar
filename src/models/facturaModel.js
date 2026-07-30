const pool = require('../config/db');

const create = async (data, conn = pool) => {
  const [result] = await conn.query(
    `INSERT INTO facturas
       (mesa_id, sesion_apertura, metodo_pago, tipo_comprobante, punto_venta, doc_tipo, doc_nro,
        condicion_iva_receptor_id, receptor_nombre, importe_total, entorno, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.mesa_id, data.sesion_apertura, data.metodo_pago, data.tipo_comprobante,
      data.punto_venta, data.doc_tipo, data.doc_nro, data.condicion_iva_receptor_id,
      data.receptor_nombre ?? null, data.importe_total, data.entorno, data.creado_por ?? null,
    ]
  );
  const [rows] = await conn.query('SELECT * FROM facturas WHERE id = ?', [result.insertId]);
  return rows[0];
};

// Vuelca el resultado de afipService.emitirFactura (o del reintento) sobre la fila ya creada.
const updateResultado = async (id, { estado, numero, cae, caeVencimiento, importeNeto, importeIva, importeTotal, observaciones }, conn = pool) => {
  await conn.query(
    `UPDATE facturas
     SET estado = ?, numero = ?, cae = ?, cae_vencimiento = ?, importe_neto = ?, importe_iva = ?,
         importe_total = ?, observaciones = ?, fecha_cae = NOW()
     WHERE id = ?`,
    [
      estado, numero ?? null, cae ?? null, caeVencimiento ?? null,
      importeNeto ?? 0, importeIva ?? 0, importeTotal, observaciones ?? null, id,
    ]
  );
};

const getBySesion = async (mesa_id, sesion_apertura, conn = pool) => {
  const [rows] = await conn.query(
    'SELECT * FROM facturas WHERE mesa_id = ? AND sesion_apertura = ?',
    [mesa_id, sesion_apertura]
  );
  return rows[0] || null;
};

const getById = async (id, conn = pool) => {
  const [rows] = await conn.query('SELECT * FROM facturas WHERE id = ?', [id]);
  return rows[0] || null;
};

// Paginado, mismo patrón que Pedido.getHistorial: con más uso la tabla crece indefinidamente.
const getHistorial = async (page, limit) => {
  const offset = (page - 1) * limit;
  const [rows] = await pool.query(
    `SELECT f.*, m.numero_mesa
     FROM facturas f
     JOIN mesas m ON f.mesa_id = m.id
     ORDER BY f.fecha_emision DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM facturas');
  return { rows, total };
};

module.exports = { create, updateResultado, getBySesion, getById, getHistorial };
