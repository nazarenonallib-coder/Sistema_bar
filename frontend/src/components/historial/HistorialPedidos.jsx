import { useState, useEffect, useCallback } from 'react'
import * as api from '../../api'
import Spinner from '../Spinner'
import DetallePedidoModal from './DetallePedidoModal'
import ReporteVentasModal from './ReporteVentasModal'
import { descargarTicket } from '../../utils/ticket'

const formatHora = (fecha) =>
  fecha ? new Date(fecha).toLocaleString('es-AR', { hour12: false }) : '—'

const TIPO_COMPROBANTE_LABEL = { 1: 'A', 6: 'B', 11: 'C' }

const comprobanteLabel = (p) => {
  if (!p.factura_id) return '—'
  const tipo = TIPO_COMPROBANTE_LABEL[p.tipo_comprobante] || '?'
  if (p.factura_estado === 'aprobada') return `Fact. ${tipo} · ${String(p.factura_numero).padStart(8, '0')}`
  if (p.factura_estado === 'rechazada') return 'Rechazada'
  if (p.factura_estado === 'error') return 'Error ARCA'
  return 'Pendiente'
}

const comprobanteClase = (p) => {
  if (p.factura_estado === 'aprobada') return 'bg-emerald-50 text-emerald-600'
  if (p.factura_estado === 'rechazada' || p.factura_estado === 'error') return 'bg-rose-50 text-rose-600'
  if (p.factura_estado === 'pendiente') return 'bg-amber-50 text-amber-600'
  return 'bg-gray-50 text-gray-400'
}

const LIMIT = 20

const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta_debito', label: 'Tarjeta débito' },
  { value: 'tarjeta_credito', label: 'Tarjeta crédito' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'otro', label: 'Otro' },
]

const ESTADOS_FACTURA = [
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'rechazada', label: 'Rechazada' },
  { value: 'error', label: 'Error ARCA' },
]

const FILTROS_VACIOS = { desde: '', hasta: '', numero_mesa: '', metodo_pago: '', estado_factura: '', con_factura: '' }

export default function HistorialPedidos({ addToast }) {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [pedidoIdSeleccionado, setPedidoIdSeleccionado] = useState(null)
  const [descargandoId, setDescargandoId] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [mostrarReporte, setMostrarReporte] = useState(false)
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_VACIOS)

  const hayFiltrosActivos = Object.values(filtrosAplicados).some(Boolean)

  const handleAplicarFiltros = () => {
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      addToast('La fecha "desde" no puede ser posterior a "hasta".', 'error')
      return
    }
    setPage(1)
    setFiltrosAplicados(filtros)
  }

  const handleLimpiarFiltros = () => {
    setFiltros(FILTROS_VACIOS)
    setFiltrosAplicados(FILTROS_VACIOS)
    setPage(1)
  }

  const handleDescargarTicket = async (pedido) => {
    setDescargandoId(pedido.id)
    try {
      if (pedido.factura_id && pedido.factura_estado === 'aprobada') {
        await descargarTicket(`/api/facturas/${pedido.factura_id}/pdf`, `factura-${pedido.factura_numero}.pdf`)
      } else {
        await descargarTicket(`/api/pedidos/${pedido.id}/ticket`, `ticket-pedido-${pedido.id}.pdf`)
      }
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setDescargandoId(null)
    }
  }

  const fetchHistorial = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getHistorialPedidos(page, LIMIT, filtrosAplicados)
      setPedidos(data.pedidos)
      setTotalPaginas(data.total_paginas)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast, page, filtrosAplicados])

  useEffect(() => { fetchHistorial() }, [fetchHistorial])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Historial de Pedidos</h1>
        <button
          onClick={() => setMostrarReporte(true)}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition flex items-center gap-2"
        >
          📊 Reporte de ventas facturadas
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Desde</label>
            <input
              type="date"
              value={filtros.desde}
              max={filtros.hasta || undefined}
              onChange={(e) => setFiltros(f => ({ ...f, desde: e.target.value }))}
              className="border rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Hasta</label>
            <input
              type="date"
              value={filtros.hasta}
              min={filtros.desde || undefined}
              onChange={(e) => setFiltros(f => ({ ...f, hasta: e.target.value }))}
              className="border rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Mesa</label>
            <input
              type="number"
              min="1"
              placeholder="N°"
              value={filtros.numero_mesa}
              onChange={(e) => setFiltros(f => ({ ...f, numero_mesa: e.target.value }))}
              className="border rounded-lg px-3 py-1.5 text-sm w-20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Método de pago</label>
            <select
              value={filtros.metodo_pago}
              onChange={(e) => setFiltros(f => ({ ...f, metodo_pago: e.target.value }))}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">Todos</option>
              {METODOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Facturación ARCA</label>
            <select
              value={filtros.con_factura}
              onChange={(e) => setFiltros(f => ({
                ...f,
                con_factura: e.target.value,
                estado_factura: e.target.value === 'no' ? '' : f.estado_factura,
              }))}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">Todas</option>
              <option value="si">Con factura ARCA</option>
              <option value="no">Sin factura (solo ticket)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Estado comprobante</label>
            <select
              value={filtros.estado_factura}
              disabled={filtros.con_factura === 'no'}
              onChange={(e) => setFiltros(f => ({ ...f, estado_factura: e.target.value }))}
              className="border rounded-lg px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="">Todos</option>
              {ESTADOS_FACTURA.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAplicarFiltros}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
            >
              Filtrar
            </button>
            {hayFiltrosActivos && (
              <button
                onClick={handleLimpiarFiltros}
                className="px-4 py-1.5 rounded-lg border text-gray-600 text-sm font-semibold hover:bg-gray-50 transition"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : pedidos.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-3">🧾</p>
            <p>{hayFiltrosActivos ? 'No hay cuentas cerradas que coincidan con los filtros.' : 'Todavía no hay cuentas cerradas.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3 w-10">#</th>
                  <th className="text-left px-5 py-3">Mesa</th>
                  <th className="text-left px-5 py-3">Apertura mesa</th>
                  <th className="text-left px-5 py-3">Apertura silla</th>
                  <th className="text-left px-5 py-3">Cierre silla</th>
                  <th className="text-left px-5 py-3">Cierre mesa</th>
                  <th className="text-left px-5 py-3">Comprobante</th>
                  <th className="text-right px-5 py-3">Total</th>
                  <th className="text-right px-5 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pedidos.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 text-gray-400">{p.id}</td>
                    <td className="px-5 py-3.5 font-semibold text-gray-800">Mesa {p.numero_mesa}</td>
                    <td className="px-5 py-3.5 text-gray-500">{formatHora(p.sesion_apertura)}</td>
                    <td className="px-5 py-3.5 text-gray-500">{formatHora(p.fecha_creacion)}</td>
                    <td className="px-5 py-3.5 text-gray-500">{formatHora(p.fecha_cierre)}</td>
                    <td className="px-5 py-3.5 text-gray-500">{formatHora(p.hora_cierre_mesa)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${comprobanteClase(p)}`}>
                        {comprobanteLabel(p)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-gray-800">
                      ${Number(p.total).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => setPedidoIdSeleccionado(p.id)}
                        className="px-3 py-1 rounded-lg border border-indigo-200 text-indigo-600 text-xs font-semibold hover:bg-indigo-50 transition"
                      >
                        Ver detalle
                      </button>
                      <button
                        onClick={() => handleDescargarTicket(p)}
                        disabled={descargandoId === p.id}
                        className="px-3 py-1 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition disabled:opacity-50"
                      >
                        {descargandoId === p.id
                          ? 'Descargando…'
                          : p.factura_id && p.factura_estado === 'aprobada' ? '⬇ Factura' : '⬇ Ticket'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && pedidos.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50 text-sm">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded-lg border text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>
            <span className="text-gray-500">Página {page} de {totalPaginas}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPaginas, p + 1))}
              disabled={page >= totalPaginas}
              className="px-3 py-1 rounded-lg border text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {pedidoIdSeleccionado !== null && (
        <DetallePedidoModal
          pedidoId={pedidoIdSeleccionado}
          onClose={() => setPedidoIdSeleccionado(null)}
          addToast={addToast}
        />
      )}

      {mostrarReporte && (
        <ReporteVentasModal onClose={() => setMostrarReporte(false)} addToast={addToast} />
      )}
    </div>
  )
}
