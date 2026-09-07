import { useState } from 'react'
import { descargarTicket } from '../../utils/ticket'

const hoyISO = () => new Date().toISOString().slice(0, 10)

// Descarga un CSV con las ventas ya facturadas (CAE aprobado) en el rango de fechas elegido, para
// que el dueño se lo pase al contador. Reutiliza descargarTicket porque, más allá del nombre, esa
// función solo hace fetch-con-token + guardar-blob: sirve igual para cualquier archivo.
export default function ReporteVentasModal({ onClose, addToast }) {
  const [desde, setDesde] = useState(hoyISO())
  const [hasta, setHasta] = useState(hoyISO())
  const [generando, setGenerando] = useState(false)

  const handleGenerar = async () => {
    if (desde && hasta && desde > hasta) {
      addToast('La fecha "desde" no puede ser posterior a "hasta".', 'error')
      return
    }
    setGenerando(true)
    try {
      const params = new URLSearchParams({ desde, hasta })
      await descargarTicket(`/api/facturas/reporte?${params}`, `reporte-ventas-${desde}_a_${hasta}.csv`)
      onClose()
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="animate-fade-in bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="bg-indigo-600 px-6 py-5 text-white flex justify-between items-center">
          <h2 className="font-bold text-lg">Reporte de ventas facturadas</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Se exportan en CSV las ventas con comprobante aprobado por ARCA en el rango elegido.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              max={hasta}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              min={desde}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border text-gray-600 text-sm font-semibold hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleGenerar}
              disabled={generando}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {generando ? 'Generando…' : '⬇ Descargar CSV'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
