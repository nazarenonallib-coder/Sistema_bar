import { useState, useCallback, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ProductoTabla from './components/productos/ProductoTabla'
import InsumoTabla from './components/insumos/InsumoTabla'
import MesaGrid from './components/mesas/MesaGrid'
import HistorialPedidos from './components/historial/HistorialPedidos'
import ToastContainer from './components/ToastContainer'
import ConfirmDialog from './components/ConfirmDialog'
import Login from './components/Login'
import useConfirm from './hooks/useConfirm'
import * as api from './api'

export default function App() {
  const [vista, setVista]         = useState('mesas')
  const [productos, setProductos] = useState([])
  const [toasts, setToasts]       = useState([])
  const [usuario, setUsuario]     = useState(api.getUsuario())
  const { confirm, confirmState, resolveConfirm } = useConfirm()

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const fetchProductos = useCallback(async () => {
    try {
      const data = await api.getProductos()
      setProductos(data)
    } catch {
      // silent – MesaGrid dropdown will be empty; ProductoTabla shows its own error
    }
  }, [])

  useEffect(() => { if (usuario) fetchProductos() }, [usuario, fetchProductos])

  const handleLogout = () => {
    api.logout()
    setUsuario(null)
  }

  if (!usuario) {
    return <Login onLogin={setUsuario} />
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar vista={vista} setVista={setVista} usuario={usuario} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        {vista === 'productos' && <ProductoTabla addToast={addToast} confirm={confirm} onProductosChange={fetchProductos} />}
        {vista === 'insumos' && <InsumoTabla addToast={addToast} confirm={confirm} />}
        {vista === 'mesas' && <MesaGrid addToast={addToast} confirm={confirm} productos={productos} />}
        {vista === 'historial' && <HistorialPedidos addToast={addToast} />}
      </main>

      <ToastContainer toasts={toasts} />
      <ConfirmDialog state={confirmState} onResolve={resolveConfirm} />
    </div>
  )
}
