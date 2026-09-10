import { useState, useEffect, useCallback } from 'react'
import * as api from '../../api'
import Spinner from '../Spinner'

const hoyISO = () => new Date().toISOString().slice(0, 10)

const TIPOS = [
  { value: 'dia', label: 'Día (por hora)' },
  { value: 'semana', label: 'Semana (por día)' },
  { value: 'mes', label: 'Mes (por día)' },
]

// Barras simples en HTML/CSS (sin librería de gráficos): una sola serie de magnitud, un solo
// color, con tooltip al pasar el mouse. Ver skill de dataviz — para una sola serie no hace
// falta leyenda (el título ya la nombra).
export default function GraficosVentas({ addToast }) {
  const [tipo, setTipo] = useState('dia')
  const [fecha, setFecha] = useState(hoyISO())
  const [modo, setModo] = useState('monto') // 'monto' | 'porcentaje'
  const [datos, setDatos] = useState([])
  const [totalPeriodo, setTotalPeriodo] = useState(0)
  const [rango, setRango] = useState({ desde: '', hasta: '' })
  const [loading, setLoading] = useState(true)
  const [hoverIdx, setHoverIdx] = useState(null)

  const fetchDatos = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getEstadisticasVentas(tipo, fecha)
      setDatos(data.datos)
      setTotalPeriodo(data.total_periodo)
      setRango({ desde: data.desde, hasta: data.hasta })
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [tipo, fecha, addToast])

  useEffect(() => { fetchDatos() }, [fetchDatos])

  const valores = datos.map(d => (modo === 'monto' ? d.total : d.porcentaje))
  const max = Math.max(1, ...valores)

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-5 mb-4">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="font-bold text-gray-800 mb-1">
            Ventas {tipo === 'dia' ? 'por hora' : 'por día'}
          </h2>
          <p className="text-xs text-gray-400">
            {rango.desde === rango.hasta ? rango.desde : `${rango.desde} a ${rango.hasta}`}
            {' · '}Total del período:{' '}
            <span className="font-semibold text-gray-600">${totalPeriodo.toFixed(2)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm"
          >
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm"
          />
          <div className="flex rounded-lg border overflow-hidden text-sm">
            <button
              onClick={() => setModo('monto')}
              className={`px-3 py-1.5 font-semibold transition ${
                modo === 'monto' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              $ Monto
            </button>
            <button
              onClick={() => setModo('porcentaje')}
              className={`px-3 py-1.5 font-semibold transition ${
                modo === 'porcentaje' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              % Porcentaje
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : totalPeriodo === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No hay ventas registradas en este período.</div>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: Math.max(datos.length * 28, 480) }}>
            <div className="flex items-end gap-0.5 h-48 border-b border-gray-200">
              {datos.map((d, i) => {
                const valor = modo === 'monto' ? d.total : d.porcentaje
                const alturaPct = max > 0 ? (valor / max) * 100 : 0
                return (
                  <div
                    key={d.clave}
                    className="relative flex-1 flex flex-col justify-end h-full"
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                  >
                    {hoverIdx === i && (
                      <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 pointer-events-none">
                        ${d.total.toFixed(2)} · {d.porcentaje}%
                      </div>
                    )}
                    <div
                      className={`w-full rounded-t transition-colors ${hoverIdx === i ? 'bg-indigo-700' : 'bg-indigo-500'}`}
                      style={{ height: `${valor > 0 ? Math.max(alturaPct, 2) : 0}%` }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="flex gap-0.5 mt-1">
              {datos.map(d => (
                <div key={d.clave} className="flex-1 text-center text-[10px] text-gray-400 whitespace-nowrap">
                  {d.etiqueta}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
