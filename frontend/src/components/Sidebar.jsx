const NAV = [
  {
    id: 'mesas',
    label: 'Panel de Mesas',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <rect x="3" y="8" width="18" height="3" rx="1" />
        <path d="M5 11v6M19 11v6M8 17h8" />
      </svg>
    ),
  },
  {
    id: 'productos',
    label: 'Gestión de Productos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 12v.01" />
      </svg>
    ),
  },
  {
    id: 'insumos',
    label: 'Gestión de Insumos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path d="M4 4h5l1 4h9l-2 8H8L5 6" />
        <circle cx="9" cy="19" r="1.5" />
        <circle cx="17" cy="19" r="1.5" />
      </svg>
    ),
  },
  {
    id: 'historial',
    label: 'Historial de Pedidos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v5l3.5 3.5" />
      </svg>
    ),
  },
]

export default function Sidebar({ vista, setVista, usuario, onLogout }) {
  return (
    <aside className="w-56 bg-slate-900 flex flex-col shrink-0 h-screen">
      {/* Brand */}
      <div className="px-5 py-6 border-b border-slate-700">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Sistema</p>
        <h1 className="text-xl font-black text-white">Chapola</h1>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(item => (
          <button
            key={item.id}
            onClick={() => setVista(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
              ${vista === item.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-700">
        <p className="text-sm text-white font-semibold truncate">{usuario?.username}</p>
        <p className="text-xs text-slate-500 capitalize mb-2">{usuario?.rol}</p>
        <button onClick={onLogout} className="text-xs text-slate-400 hover:text-white transition">
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
