const TOKEN_KEY   = 'chepola_token'
const USUARIO_KEY = 'chepola_usuario'

export const getToken   = () => localStorage.getItem(TOKEN_KEY)
export const setToken   = (token) => localStorage.setItem(TOKEN_KEY, token)
export const getUsuario = () => {
  try { return JSON.parse(localStorage.getItem(USUARIO_KEY)) } catch { return null }
}
export const setUsuario = (usuario) => localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario))
export const logout = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USUARIO_KEY)
}

const request = async (path, options = {}) => {
  const { body, ...rest } = options
  const token = getToken()
  const res = await fetch(`/api${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })

  // Sesión vencida o inválida: se desloguea y se recarga para mostrar el login de nuevo.
  // El propio login puede devolver 401 (credenciales incorrectas) y ese caso no debe disparar esto.
  if (res.status === 401 && path !== '/auth/login') {
    logout()
    window.location.reload()
    throw new Error('Sesión expirada.')
  }

  const data = await res.json()
  if (!res.ok) {
    const msg =
      data.error ||
      (Array.isArray(data.errores) ? data.errores.join(' ') : null) ||
      `Error ${res.status}`
    throw new Error(msg)
  }
  return data
}

// Auth
export const login = (username, password) => request('/auth/login', { method: 'POST', body: { username, password } })

// Productos
export const getProductos  = ()          => request('/productos')
export const createProducto = (body)     => request('/productos',     { method: 'POST',   body })
export const updateProducto = (id, body) => request(`/productos/${id}`, { method: 'PUT',  body })
export const deleteProducto = (id)       => request(`/productos/${id}`, { method: 'DELETE' })

// Insumos
export const getInsumos    = ()          => request('/insumos')
export const createInsumo  = (body)      => request('/insumos',     { method: 'POST',   body })
export const updateInsumo  = (id, body)  => request(`/insumos/${id}`, { method: 'PUT',  body })
export const deleteInsumo  = (id)        => request(`/insumos/${id}`, { method: 'DELETE' })

// Receta (insumos que consume un producto)
export const getInsumosDeProducto = (producto_id) => request(`/productos/${producto_id}/insumos`)
export const addInsumoAProducto   = (producto_id, insumo_id, cantidad_consumida) =>
  request(`/productos/${producto_id}/insumos`, { method: 'POST', body: { insumo_id, cantidad_consumida } })
export const updateInsumoDeProducto = (producto_id, id, cantidad_consumida) =>
  request(`/productos/${producto_id}/insumos/${id}`, { method: 'PUT', body: { cantidad_consumida } })
export const eliminarInsumoDeProducto = (producto_id, id) =>
  request(`/productos/${producto_id}/insumos/${id}`, { method: 'DELETE' })

// Mesas
export const getMesas         = (salon_id) => request(`/mesas?salon_id=${salon_id}`)
export const createMesa       = (body) => request('/mesas',           { method: 'POST', body })
export const deleteMesa       = (id)   => request(`/mesas/${id}`,     { method: 'DELETE' })
export const getPedidosActivosMesa = (id) => request(`/mesas/${id}/pedidos-activos`)
export const updateMesaPosicion = (id, pos_x, pos_y) =>
  request(`/mesas/${id}/posicion`, { method: 'PATCH', body: { pos_x, pos_y } })
export const updateMesaColor  = (id, color_libre, color_ocupado) =>
  request(`/mesas/${id}/color`, { method: 'PATCH', body: { color_libre, color_ocupado } })
export const updateMesaTamano = (id, tamano) =>
  request(`/mesas/${id}/tamano`, { method: 'PATCH', body: { tamano } })
export const cerrarCuenta     = (id, body) => request(`/mesas/${id}/cerrar`, { method: 'POST', body })
export const confirmarTicketMesa = (id) => request(`/mesas/${id}/confirmar-ticket`, { method: 'POST' })
export const combinarMesas    = (body) => request('/mesas/combinar', { method: 'POST', body })
export const separarGrupo     = (grupoId) => request(`/mesas/grupos/${grupoId}/separar`, { method: 'POST' })

// Sillas (dibujo fijo alrededor de cada mesa, independiente de los pedidos)
export const crearSilla    = (mesa_id) => request(`/mesas/${mesa_id}/sillas`, { method: 'POST' })
export const moverSilla    = (id, pos_x, pos_y) =>
  request(`/sillas/${id}/posicion`, { method: 'PATCH', body: { pos_x, pos_y } })
export const eliminarSilla = (id) => request(`/sillas/${id}`, { method: 'DELETE' })

// Salones
export const getSalones   = ()          => request('/salones')
export const createSalon  = (body)      => request('/salones',     { method: 'POST', body })
export const updateSalon  = (id, body)  => request(`/salones/${id}`, { method: 'PUT', body })
export const deleteSalon  = (id)        => request(`/salones/${id}`, { method: 'DELETE' })

// Estructuras
export const getEstructuras = (salon_id) => request(`/estructuras?salon_id=${salon_id}`)
export const createEstructura = (body)   => request('/estructuras', { method: 'POST', body })
export const updateEstructuraPosicion = (id, pos_x, pos_y) =>
  request(`/estructuras/${id}/posicion`, { method: 'PATCH', body: { pos_x, pos_y } })
export const updateEstructura = (id, body) => request(`/estructuras/${id}`, { method: 'PUT', body })
export const deleteEstructura = (id)     => request(`/estructuras/${id}`, { method: 'DELETE' })

// Pedidos
export const abrirPedido      = (mesa_id)             => request('/pedidos', { method: 'POST', body: { mesa_id } })
export const addProductosPedido = (pedido_id, productos) =>
  request(`/pedidos/${pedido_id}/productos`, { method: 'POST', body: { productos } })
export const cerrarPedidoIndividual = (pedido_id) => request(`/pedidos/${pedido_id}/cerrar`, { method: 'POST' })
export const eliminarPedido         = (pedido_id) => request(`/pedidos/${pedido_id}`, { method: 'DELETE' })
export const eliminarItemPedido     = (pedido_id, item_id) =>
  request(`/pedidos/${pedido_id}/productos/${item_id}`, { method: 'DELETE' })
export const marcarItemEntregado = (pedido_id, item_id, entregado) =>
  request(`/pedidos/${pedido_id}/productos/${item_id}/entregado`, { method: 'PATCH', body: { entregado } })
export const marcarPedidoEntregado = (pedido_id, entregado) =>
  request(`/pedidos/${pedido_id}/entregado`, { method: 'PATCH', body: { entregado } })
export const getHistorialPedidos = (page = 1, limit = 20, filtros = {}) => {
  const params = new URLSearchParams({ page, limit })
  Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v) })
  return request(`/pedidos/historial?${params}`)
}
export const getPedido           = (id) => request(`/pedidos/${id}`)

// Facturación (ARCA / ex AFIP)
export const getFacturaConfig     = ()       => request('/facturas/config')
export const getHistorialFacturas = (page = 1, limit = 20) => request(`/facturas?page=${page}&limit=${limit}`)
export const getFactura           = (id)     => request(`/facturas/${id}`)
export const reintentarFactura    = (id)     => request(`/facturas/${id}/reintentar`, { method: 'POST' })
export const getEstadoAfip        = ()       => request('/facturas/estado-afip')
