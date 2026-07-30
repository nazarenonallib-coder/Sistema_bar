import { useState, useEffect, useRef } from 'react'

const GRID_STEP = 10
const snap = (value) => Math.max(0, Math.round(value / GRID_STEP) * GRID_STEP)
const DRAG_THRESHOLD = 4

const ESTILOS = {
  ventana:   { bg: 'bg-sky-200',   border: 'border-sky-400',   label: 'Ventana' },
  puerta:    { bg: 'bg-amber-700', border: 'border-amber-900', label: 'Puerta' },
  mostrador: { bg: 'bg-slate-700', border: 'border-slate-900', label: 'Mostrador' },
  columna:   { bg: 'bg-gray-400',  border: 'border-gray-600',  label: 'Columna' },
}

const MIN_LADO = 20
const MAX_LADO = 400

// Elemento del mapa (ventana/puerta/mostrador/columna), arrastrable y redimensionable sólo en modo edición.
// Mismo patrón de drag que MesaCard.
export default function EstructuraItem({ estructura, editMode, onMove, onRotate, onResize, onDelete }) {
  const [pos, setPos] = useState({ x: estructura.pos_x, y: estructura.pos_y })
  const [tamano, setTamano] = useState({ ancho: estructura.ancho, alto: estructura.alto })
  const dragRef = useRef(null)
  const resizeRef = useRef(null)

  useEffect(() => {
    if (!dragRef.current) setPos({ x: estructura.pos_x, y: estructura.pos_y })
  }, [estructura.pos_x, estructura.pos_y])

  useEffect(() => {
    if (!resizeRef.current) setTamano({ ancho: estructura.ancho, alto: estructura.alto })
  }, [estructura.ancho, estructura.alto])

  const handlePointerDown = (e) => {
    if (!editMode || e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, moved: false, curX: pos.x, curY: pos.y }
  }

  const handlePointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) d.moved = true
    if (d.moved) {
      d.curX = Math.max(0, d.origX + dx)
      d.curY = Math.max(0, d.origY + dy)
      setPos({ x: d.curX, y: d.curY })
    }
  }

  const handlePointerUp = () => {
    const d = dragRef.current
    dragRef.current = null
    if (!d || !d.moved) return
    const snapped = { x: snap(d.curX), y: snap(d.curY) }
    setPos(snapped)
    onMove(snapped.x, snapped.y)
  }

  const handleResizeDown = (e) => {
    if (!editMode) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    resizeRef.current = {
      startX: e.clientX, startY: e.clientY,
      origAncho: tamano.ancho, origAlto: tamano.alto,
      curAncho: tamano.ancho, curAlto: tamano.alto,
    }
  }

  const handleResizeMove = (e) => {
    e.stopPropagation()
    const r = resizeRef.current
    if (!r) return
    const dx = e.clientX - r.startX
    const dy = e.clientY - r.startY
    r.curAncho = Math.min(MAX_LADO, Math.max(MIN_LADO, r.origAncho + dx))
    r.curAlto  = Math.min(MAX_LADO, Math.max(MIN_LADO, r.origAlto + dy))
    setTamano({ ancho: r.curAncho, alto: r.curAlto })
  }

  const handleResizeUp = (e) => {
    e.stopPropagation()
    const r = resizeRef.current
    resizeRef.current = null
    if (!r) return
    const snapped = {
      ancho: Math.min(MAX_LADO, Math.max(MIN_LADO, snap(r.curAncho))),
      alto:  Math.min(MAX_LADO, Math.max(MIN_LADO, snap(r.curAlto))),
    }
    setTamano(snapped)
    onResize(snapped.ancho, snapped.alto)
  }

  const { bg, border, label } = ESTILOS[estructura.tipo]

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: 'absolute', left: pos.x, top: pos.y,
        width: tamano.ancho, height: tamano.alto,
        transform: `rotate(${estructura.rotacion}deg)`,
        touchAction: 'none',
      }}
      className={`group border-2 ${bg} ${border} rounded-md flex items-center justify-center select-none
        ${editMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
      title={label}
    >
      <span className="text-[10px] font-bold text-white/90 uppercase tracking-wide truncate px-1">
        {label}
      </span>

      {editMode && (
        <div className="absolute -top-3 -right-3 hidden group-hover:flex gap-1">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onRotate() }}
            title="Girar 90°"
            className="w-5 h-5 rounded-full bg-slate-600 text-white text-[10px] flex items-center justify-center"
          >
            ⟳
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            title="Eliminar"
            className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center"
          >
            ✕
          </button>
        </div>
      )}

      {editMode && (
        <div
          onPointerDown={handleResizeDown}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          style={{ touchAction: 'none' }}
          className="absolute -bottom-1 -right-1 w-4 h-4 bg-white border-2 border-gray-500 rounded-sm
            cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity"
          title="Redimensionar"
        />
      )}
    </div>
  )
}
