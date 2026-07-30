export default function ToastContainer({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`animate-slide-in px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium max-w-xs
            ${t.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}
        >
          {t.type === 'error' ? '⚠ ' : '✓ '}{t.message}
        </div>
      ))}
    </div>
  )
}
