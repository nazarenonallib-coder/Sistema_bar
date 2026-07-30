import { useState, useEffect, useCallback } from 'react'
import * as api from '../../api'
import Spinner from '../Spinner'
import ProductoModal from './ProductoModal'

export default function ProductoTabla({ addToast, confirm, onProductosChange }) {
  const [productos, setProductos] = useState([])
  const [insumos, setInsumos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalProducto, setModalProducto] = useState(undefined) // undefined=closed, null=new, obj=edit

  const fetchProductos = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getProductos()
      setProductos(data)
      onProductosChange?.()
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast, onProductosChange])

  const fetchInsumos = useCallback(async () => {
    try {
      setInsumos(await api.getInsumos())
    } catch {
      // silencioso: el editor de receta simplemente no tendrá sugerencias
    }
  }, [])

  useEffect(() => { fetchProductos() }, [fetchProductos])
  useEffect(() => { fetchInsumos() }, [fetchInsumos])

  const handleDelete = async (p) => {
    if (!(await confirm(`¿Eliminar "${p.nombre}"?`, { title: 'Eliminar producto' }))) return
    try {
      await api.deleteProducto(p.id)
      addToast('Producto eliminado.')
      fetchProductos()
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Productos</h1>
        <button
          onClick={() => setModalProducto(null)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition flex items-center gap-2"
        >
          <span className="text-lg leading-none">+</span> Nuevo Producto
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : productos.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-3">📦</p>
            <p>No hay productos registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3 w-10">#</th>
                  <th className="text-left px-5 py-3">Nombre</th>
                  <th className="text-left px-5 py-3">Descripción</th>
                  <th className="text-right px-5 py-3">Precio</th>
                  <th className="text-right px-5 py-3">Stock</th>
                  <th className="text-right px-5 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {productos.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 text-gray-400">{p.id}</td>
                    <td className="px-5 py-3.5 font-semibold text-gray-800">{p.nombre}</td>
                    <td className="px-5 py-3.5 text-gray-500 max-w-xs truncate">{p.descripcion ?? '—'}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-gray-800">
                      ${Number(p.precio).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                        ${p.stock > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setModalProducto(p)}
                          className="px-3 py-1 rounded-lg border border-indigo-200 text-indigo-600 text-xs font-semibold hover:bg-indigo-50 transition"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
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

      {modalProducto !== undefined && (
        <ProductoModal
          producto={modalProducto}
          insumos={insumos}
          onClose={() => setModalProducto(undefined)}
          onSaved={fetchProductos}
          addToast={addToast}
          confirm={confirm}
        />
      )}
    </div>
  )
}
