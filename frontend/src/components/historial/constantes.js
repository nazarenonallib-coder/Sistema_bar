// Opciones y etiquetas del historial, compartidas por la barra de filtros y por los modales de
// exportación (el modal de reporte tiene que mostrar los filtros aplicados con las mismas
// etiquetas que la pantalla).

export const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta_debito', label: 'Tarjeta débito' },
  { value: 'tarjeta_credito', label: 'Tarjeta crédito' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'otro', label: 'Otro' },
]

export const ESTADOS_FACTURA = [
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'rechazada', label: 'Rechazada' },
  { value: 'error', label: 'Error ARCA' },
]

export const CON_FACTURA = [
  { value: 'si', label: 'Con factura ARCA' },
  { value: 'no', label: 'Sin factura (solo ticket)' },
]

export const FILTROS_VACIOS = {
  desde: '', hasta: '', numero_mesa: '', metodo_pago: '', estado_factura: '', con_factura: '',
}

const labelDe = (opciones, value) => opciones.find((o) => o.value === value)?.label || value

export const metodoPagoLabel = (value) => labelDe(METODOS_PAGO, value)
export const estadoFacturaLabel = (value) => labelDe(ESTADOS_FACTURA, value)
export const conFacturaLabel = (value) => labelDe(CON_FACTURA, value)

// Formatos de descarga de los reportes. El `value` viaja tal cual al backend como ?formato= (ver
// FORMATOS en src/services/reporteService.js) y la `ext` arma el nombre del archivo que se guarda.
export const FORMATOS = [
  { value: 'csv', label: 'CSV', ext: 'csv', hint: 'Texto liviano, abre en Excel o Google Sheets.' },
  { value: 'xlsx', label: 'Excel', ext: 'xlsx', hint: 'Planilla con el resumen en una hoja aparte y los montos con formato.' },
  { value: 'pdf', label: 'PDF', ext: 'pdf', hint: 'Listo para imprimir o archivar, con el resumen arriba.' },
  { value: 'json', label: 'JSON', ext: 'json', hint: 'Datos crudos, para respaldo o para pasarlos a otro sistema.' },
]

export const formatoPorValue = (value) => FORMATOS.find((f) => f.value === value) || FORMATOS[0]
