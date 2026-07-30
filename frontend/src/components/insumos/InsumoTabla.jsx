import { useState, useEffect, useCallback } from 'react'
import * as api from '../../api'
import Spinner from '../Spinner'
import InsumoModal from './InsumoModal'

export default function InsumoTabla({ addToast, confirm }) {
  const [insumos, setInsumos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalInsumo, setModalInsumo] = useState(undefined) // undefined=closed, null=new, obj=edit

  const fetchInsumos = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getInsumos()
      setInsumos(data)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { fetchInsumos() }, [fetchInsumos])

  const handleDelete = async (i) => {
    if (!(await confirm(`¿Eliminar "${i.nombre}"?`, { title: 'Eliminar insumo' }))) return
    try {
      await api.deleteInsumo(i.id)
      addToast('Insumo eliminado.')
      fetchInsumos()
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Insumos</h1>
        <button
          onClick={() => setModalInsumo(null)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition flex items-center gap-2"
        >
          <span className="text-lg leading-none">+</span> Nuevo Insumo
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : insumos.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-3">🧺</p>
            <p>No hay insumos registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3 w-10">#</th>
                  <th className="text-left px-5 py-3">Nombre</th>
                  <th className="text-left px-5 py-3">Unidad</th>
                  <th className="text-right px-5 py-3">Costo unitario</th>
                  <th className="text-right px-5 py-3">Stock</th>
                  <th className="text-center px-5 py-3">Disponible</th>
                  <th className="text-right px-5 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {insumos.map(i => (
                  <tr key={i.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 text-gray-400">{i.id}</td>
                    <td className="px-5 py-3.5 font-semibold text-gray-800">{i.nombre}</td>
                    <td className="px-5 py-3.5 text-gray-500">{i.unidad}</td>
                    <td className="px-5 py-3.5 text-right text-gray-700">
                      {i.costo_unitario != null ? `$${Number(i.costo_unitario).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                        ${Number(i.stock) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                        {Number(i.stock)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                        ${i.disponible ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {i.disponible ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setModalInsumo(i)}
                          className="px-3 py-1 rounded-lg border border-indigo-200 text-indigo-600 text-xs font-semibold hover:bg-indigo-50 transition"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(i)}
                          className="px-3 py-1 rounded-lg border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50 transition"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalInsumo !== undefined && (
        <InsumoModal
          insumo={modalInsumo}
          onClose={() => setModalInsumo(undefined)}
          onSaved={fetchInsumos}
          addToast={addToast}
        />
      )}
    </div>
  )
}
