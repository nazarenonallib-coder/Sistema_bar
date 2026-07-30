import { useCallback, useRef, useState } from 'react'

// Reemplazo de window.confirm basado en promesas: se usa igual que antes
// (`if (!(await confirm('...'))) return`) pero muestra un modal propio de la app
// en lugar del diálogo nativo del navegador.
export default function useConfirm() {
  const [confirmState, setConfirmState] = useState(null)
  const resolveRef = useRef(null)

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setConfirmState({ message, ...options })
    })
  }, [])

  const resolveConfirm = useCallback((result) => {
    setConfirmState(null)
    resolveRef.current?.(result)
    resolveRef.current = null
  }, [])

  return { confirm, confirmState, resolveConfirm }
}
