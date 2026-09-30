import { FORMATOS, formatoPorValue } from './constantes'

// Selector de formato de descarga, compartido por los dos modales de reporte.
export default function FormatoArchivoSelector({ value, onChange, disabled }) {
  const seleccionado = formatoPorValue(value)

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
        Formato del archivo
      </label>
      <div className="grid grid-cols-4 gap-2">
        {FORMATOS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => onChange(f.value)}
            disabled={disabled}
            aria-pressed={value === f.value}
            className={`px-2 py-1.5 rounded-lg text-sm font-semibold border transition disabled:opacity-50 ${
              value === f.value
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-1.5">{seleccionado.hint}</p>
    </div>
  )
}
