import { getToken } from '../api'

// Descarga el PDF del ticket (comprobante interno) como blob para poder imprimirlo o guardarlo,
// sin depender de la cabecera Content-Disposition que devuelve el servidor.
const fetchTicketBlob = async (ticketUrl) => {
  const token = getToken()
  const res = await fetch(ticketUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    let mensaje = `Error ${res.status}`
    try {
      const data = await res.json()
      mensaje = data.error || mensaje
    } catch { /* la respuesta no era JSON */ }
    throw new Error(mensaje)
  }
  return res.blob()
}

// Carga el PDF en un iframe oculto y dispara el diálogo de impresión del navegador.
export const imprimirTicket = async (ticketUrl) => {
  const blob = await fetchTicketBlob(ticketUrl)
  const url = URL.createObjectURL(blob)

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = 'none'
  iframe.src = url

  iframe.onload = () => {
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
  }

  document.body.appendChild(iframe)
  // Deja tiempo a que se abra el diálogo de impresión antes de liberar los recursos
  setTimeout(() => {
    document.body.removeChild(iframe)
    URL.revokeObjectURL(url)
  }, 60000)
}

// Descarga cualquier archivo servido por la API (ticket o factura en PDF, reporte en
// csv/xlsx/pdf/json) con el nombre indicado.
export const descargarArchivo = async (ticketUrl, filename) => {
  const blob = await fetchTicketBlob(ticketUrl)
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
