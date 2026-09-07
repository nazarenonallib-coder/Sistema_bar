# Facturación electrónica — Documentación técnica

> Este documento describe **cómo está implementado** el sistema de facturación (fiscal y no
> fiscal) en este repositorio: arquitectura, flujo de datos, modelo de base de datos, manejo
> de errores y todos los módulos que participan en emitir y entregar un comprobante al
> cliente. No incluye valores reales de configuración (CUIT, certificados, claves, secretos):
> solo nombres de variables de entorno y su propósito. Para los trámites administrativos que
> el dueño del negocio debe hacer ante ARCA (alta de punto de venta, certificado digital,
> etc.), ver la sección "AFIP / ARCA — Integración de Facturación Electrónica" en `CLAUDE.md`
> — ese documento cubre la Fase 0 (trámites); este documento cubre la implementación en código.

## 1. Visión general

El sistema genera **dos familias de comprobantes** distintas, que conviven en el mismo flujo
de cierre de cuenta pero tienen naturaleza y validez completamente distintas:

| | Factura fiscal (ARCA) | Ticket / comanda interna |
|---|---|---|
| Módulo | `src/services/afipService.js` + `src/afip/*` | `src/services/ticketService.js` |
| Validez | Comprobante homologado, con CAE | Ninguna — impreso como "Comprobante interno, no válido como factura" |
| Origen del dato | Fila en tabla `facturas`, aprobada por ARCA | Datos de `pedidos`/`mesas` directamente |
| Obligatoriedad | Opcional al cerrar cuenta (checkbox "Emitir factura") | El ticket de cuenta siempre se puede pedir; la comanda es de cocina |
| Formato de salida | PDF térmico 80mm vía `pdfkit`, con QR y CAE | PDF térmico 80mm vía `pdfkit`, sin QR fiscal |

Ambos comparten el mismo ancho de página térmica (80mm) porque se imprimen en la misma
impresora de mostrador del local — ver `ANCHO`/`MM_TO_PT` repetido en
`facturaPdfService.js` y `ticketService.js`.

El disparador de todo el flujo fiscal es el **cierre de cuenta de una mesa**
(`POST /api/mesas/:id/cerrar`, controlador `cerrarCuenta` en `src/controllers/mesaController.js`).
Facturar es una opción explícita en ese momento: si el body no trae `tipo_comprobante`, la
cuenta se cierra igual, sin tocar la tabla `facturas` ni llamar a ARCA. Esto es deliberado:
un corte de servicio de ARCA no debe poder trabar la operación del local.

## 2. Arquitectura de la integración ARCA (WSAA + WSFEv1)

El servicio usado es **WSFEv1** (Factura Electrónica sin detalle de ítems, RG 4.291), con
autenticación previa vía **WSAA**. El flujo completo, con los módulos involucrados:

```
mesaController.cerrarCuenta
  └─ (dentro de la transacción de cierre)
     Factura.create(...)                         → fila en `facturas`, estado 'pendiente'
  └─ (fuera de la transacción, try/catch propio)
     afipService.emitirFactura(...)
       ├─ validarTipoComprobante()                → chequea condición IVA del emisor
       ├─ calcularImportes()                       → neto/IVA según tipo de comprobante
       ├─ GET_LOCK('afip_ptovta_<PV>', 10)          → lock MySQL por punto de venta
       ├─ wsfeClient.compUltimoAutorizado(PV, tipo) → FECompUltimoAutorizado (SOAP)
       │    └─ taCache.getTA('wsfe')                → lee/renueva Ticket de Acceso
       │         └─ wsaaClient.login('wsfe')         → WSAA (solo si no hay TA vigente en cache)
       ├─ wsfeClient.solicitarCAE(detalle)          → FECAESolicitar (SOAP)
       └─ RELEASE_LOCK(...)
     Factura.updateResultado(id, resultado)        → vuelca CAE/estado sobre la fila ya creada
```

### 2.1 WSAA — autenticación (`src/afip/wsaaClient.js`)

WSAA requiere un **TRA** (Ticket de Requerimiento de Acceso), un XML mínimo con un
`uniqueId`, ventana de validez (`generationTime`/`expirationTime` ±10 minutos respecto al
momento de la llamada) y el nombre del servicio (`wsfe`). Ese XML se firma como **CMS/PKCS#7**
usando el certificado y la clave privada configurados (`AFIP_CERT_PATH` / `AFIP_KEY_PATH`).

La firma se hace con la librería **`node-forge`** (JS puro), no invocando al binario
`openssl` del sistema operativo — decisión explícita en el código para no depender de que el
hosting tenga `openssl` disponible en el `PATH`. El resultado (`loginCmsAsync` vía SOAP)
devuelve un XML `loginTicketResponse` del que se extraen `token`, `sign` y `expirationTime`
con regex simples (no hay parser XML completo, porque la estructura es fija y conocida).

### 2.2 Cache del Ticket de Acceso (`src/afip/taCache.js`)

El TA que devuelve WSAA es válido ~12 horas, y **WSAA rechaza pedir un TA nuevo** si el
anterior todavía está vigente (fault "ya posee un TA válido"). Por eso el TA se cachea:

- **Persistencia en tabla** (`afip_token_cache`), no en memoria del proceso: sobrevive a
  reinicios de Node (deploys, crashes, reinicio del hosting).
- **Margen de renovación de 10 minutos**: si al TA cacheado le quedan menos de 10 minutos de
  vida, se pide uno nuevo antes de que expire en medio de una operación.
- **Deduplicación de logins concurrentes**: una variable de módulo (`loginEnCurso`) guarda la
  promesa del login en curso, para que si dos requests llegan casi al mismo tiempo con el TA
  vencido, no disparen dos logins a WSAA en paralelo (uno fallaría con el fault mencionado
  arriba). A la escala de este proyecto (2 usuarios, cierres de a uno) alcanza con este
  mecanismo simple; no hace falta un lock distribuido.

### 2.3 WSFEv1 — facturación (`src/afip/wsfeClient.js`)

El cliente SOAP se crea una sola vez contra el WSDL publicado y se reutiliza (`clientPromise`
memoizado). Se usan tres operaciones del servicio:

| Método SOAP | Uso en este proyecto | Requiere auth |
|---|---|---|
| `FEDummy` | Chequeo de salud/conectividad (`GET /api/facturas/estado-afip`) | No |
| `FECompUltimoAutorizado` | Obtener el último número de comprobante autorizado para un punto de venta + tipo, para calcular el próximo (`+1`) | Sí (Token/Sign/Cuit) |
| `FECAESolicitar` | Pedir el CAE de un comprobante ya armado | Sí |

No se usa el servicio "con detalle de ítems" (WSFEv1 permite comprobantes con o sin detalle):
una cafetería no necesita declarar cada producto vendido ante ARCA con código propio, solo el
total, neto e IVA discriminado — por eso el payload de `FECAESolicitar` no lleva un array de
ítems, solo los importes agregados.

### 2.4 Concurrencia en la numeración de comprobantes

Entre "consultar el último autorizado" y "pedir el CAE" hay una ventana en la que, si dos
cierres de cuenta ocurrieran casi simultáneamente, ambos podrían leer el mismo "último
número" y pedir el mismo próximo número, lo cual ARCA rechazaría (o peor, generaría un
conflicto de numeración). Para evitarlo, `afipService.emitirFactura` toma un
**lock de aplicación a nivel de MySQL** (`GET_LOCK('afip_ptovta_<puntoVenta>', 10)` /
`RELEASE_LOCK`) que serializa las emisiones **por punto de venta** — dos puntos de venta
distintos podrían facturar en paralelo sin bloquearse entre sí, pero eso no aplica hoy porque
el sistema usa un único punto de venta (`AFIP_PUNTO_VENTA`).

## 3. Reglas de negocio fiscales implementadas

### 3.1 Condición IVA del emisor → tipos de comprobante habilitados

`AFIP_CONDICION_IVA_EMISOR` (`monotributista` | `responsable_inscripto`) determina qué tipos
de comprobante son legales de emitir. Esta regla vive en un único lugar
(`TIPOS_VALIDOS_POR_CONDICION` en `afipService.js`) y se usa en dos puntos:

- **Frontend**: `GET /api/facturas/config` devuelve la lista de tipos válidos según la
  condición configurada, para que `CierreCuentaModal.jsx` solo ofrezca botones de comprobantes
  legales.
- **Backend**: `mesaController.cerrarCuenta` y `afipService.validarTipoComprobante` vuelven a
  validar el tipo recibido contra la misma tabla, **antes** de tocar ARCA — si no es válido,
  se corta con un `400` sin llegar a hacer ninguna llamada SOAP.

| Condición IVA emisor | Comprobantes permitidos |
|---|---|
| `monotributista` | Solo Factura C (código 11) — nunca discrimina IVA |
| `responsable_inscripto` | Factura A (código 1, a otro Responsable Inscripto) y Factura B (código 6, a consumidor final/monotributo) |

### 3.2 Cálculo de importes (`calcularImportes` en `afipService.js`)

Los precios de la carta se cargan **con IVA incluido**. A partir del total de la cuenta:

- **Factura C** (monotributista): no discrimina IVA. `impNeto = impTotal`, `impIva = 0`.
- **Factura A/B** (responsable inscripto): se discrimina la alícuota general configurada
  (`AFIP_IVA_ALICUOTA_PORCENTAJE`, típicamente 21%) hacia atrás desde el total:
  `impNeto = total / (1 + alicuota)`, `impIva = total - impNeto`, redondeado a centavos.

### 3.3 Validación del documento del receptor

- `DocTipo` (80=CUIT, 96=DNI, 99=Consumidor Final) y `DocNro` son obligatorios cuando se
  factura.
- **Regla replicada del comportamiento de ARCA** (su error 10015): si `DocTipo` no es 99
  (Consumidor Final), `DocNro` debe ser un entero mayor a 0. Esto se valida en
  `mesaController.cerrarCuenta` antes de llegar a tocar ARCA, para dar un error claro e
  inmediato en vez de un rechazo genérico del web service.
- **Factura A** exige receptor identificado (no puede emitirse a Consumidor Final): tanto el
  frontend (`CierreCuentaModal.jsx`, efecto que fuerza `docTipo=80` y
  `condicionIvaReceptorId` a Responsable Inscripto cuando se elige tipo 1) como la validación
  de negocio asumen que si se factura A, hay CUIT del receptor.

### 3.4 Tipos de comprobante soportados

| Código ARCA | Comprobante | Implementado |
|---|---|---|
| 1 | Factura A | Sí |
| 6 | Factura B | Sí |
| 11 | Factura C | Sí |
| 2/7/12 | Notas de Crédito A/B/C | No (fuera de alcance del MVP) |
| 3/8/13 | Notas de Débito A/B/C | No (fuera de alcance del MVP) |

No hay flujo de anulación/nota de crédito: si una factura ya aprobada necesita corregirse, hoy
eso queda fuera del sistema (proceso manual del dueño ante ARCA).

## 4. Modelo de datos

Definido en `database/migracion_facturacion.sql` y extendido en
`database/alter_facturas_domicilio_receptor.sql`.

### 4.1 Tabla `facturas`

Una fila por **cuenta cerrada que se decidió facturar** — se identifica de forma única por
`(mesa_id, sesion_apertura)`, el mismo par de columnas que usa `pedidoModel.js` para agrupar
todas las sillas de una misma sesión de mesa. La `UNIQUE KEY uq_facturas_sesion` sobre ese par
evita que un reintento de cierre genere una segunda factura para la misma cuenta.

Columnas relevantes:

- **Datos del comprobante**: `tipo_comprobante`, `punto_venta`, `numero` (NULL hasta que ARCA
  lo asigna), `doc_tipo`, `doc_nro`, `condicion_iva_receptor_id`, `receptor_nombre` y
  `domicilio_receptor` (ambos opcionales, solo para mostrar en el PDF/registro interno — ARCA
  no los exige para Consumidor Final).
- **Importes**: `importe_neto`, `importe_iva`, `importe_total`, `moneda` (siempre `'PES'` hoy).
- **Resultado de ARCA**: `cae`, `cae_vencimiento`, `estado`
  (`pendiente` | `aprobada` | `rechazada` | `error`), `observaciones` (texto crudo de
  errores/observaciones de ARCA, para debug).
- **Trazabilidad**: `entorno` (`homologacion` | `producción`, tomado de `AFIP_ENTORNO` en el
  momento de creación — así una factura hecha en homologación queda marcada como tal aunque
  después el sistema pase a producción), `metodo_pago`, `creado_por` (FK a `users`),
  `fecha_emision`, `fecha_cae`.
- **Índices**: `idx_facturas_estado_fecha (estado, fecha_emision)` — pensado para listar
  rápido facturas pendientes/con error sin escanear toda la tabla a medida que crece.

El **estado `pendiente`** es intencional: la fila se crea dentro de la misma transacción que
cierra la cuenta, *antes* de llamar a ARCA, para no perder el método de pago ni la
trazabilidad de la venta si la llamada a ARCA falla después (ver sección 5).

### 4.2 Tabla `afip_token_cache`

Cachea el TA de WSAA por `(servicio, entorno)` — hoy solo se usa `servicio='wsfe'`, pero el
esquema admite otros servicios ARCA a futuro sin migración. `UNIQUE KEY` sobre ese par asegura
que el `INSERT ... ON DUPLICATE KEY UPDATE` de `taCache.guardarCache` actualice siempre la
misma fila en vez de acumular históricos.

## 5. Manejo de fallas y reintentos

El cierre de cuenta separa deliberadamente dos fases con distinta tolerancia a fallas:

1. **Dentro de la transacción de base de datos** (`mesaController.cerrarCuenta`): se cierran
   los pedidos, se descuenta stock de productos/insumos, se marca la mesa con
   `ticket_pendiente = true`, y si corresponde, se crea la fila `facturas` en estado
   `pendiente`. Si algo de esto falla, se hace rollback completo — la cuenta no queda a medio
   cerrar.
2. **Fuera de la transacción**, en su propio `try/catch`: la llamada real a
   `afipService.emitirFactura`. Si ARCA está caído, devuelve un error, o rechaza el
   comprobante, **la cuenta ya quedó cerrada de todas formas** (no hay ni debe haber rollback
   de la venta por una falla de un tercero externo). La fila `facturas` pasa a estado `error`
   con el mensaje de ARCA guardado en `observaciones`.

Una factura en estado `error` (o `rechazada`) puede reintentarse desde el historial con
**`POST /api/facturas/:id/reintentar`** (`facturaController.reintentar`). Ese endpoint:

- No vuelve a tocar `pedidos` ni descuenta stock — eso ya ocurrió de forma irreversible al
  cerrar la cuenta.
- Vuelve a llamar a `afipService.emitirFactura` con los mismos datos guardados en la fila, y
  actualiza el resultado con `Factura.updateResultado`.
- Si ARCA vuelve a rechazar, devuelve `502` con el detalle, dejando la factura en `error` para
  un próximo reintento.

`GET /api/facturas/estado-afip` expone `afipService.estadoServicio()` (que llama a
`wsfeClient.dummy()`, es decir `FEDummy`) como chequeo de salud del servicio ARCA, sin
necesidad de autenticarse ni de haber facturado nada — útil para que el frontend muestre un
aviso si ARCA está caído antes de que el mostrador intente cerrar una cuenta.

## 6. Comprobante impreso — PDF fiscal (`src/services/facturaPdfService.js`)

Genera el PDF de una factura ya aprobada (con CAE), en el mismo formato térmico 80mm que el
resto de los comprobantes del sistema, usando `pdfkit`. Se invoca en dos puntos:

- **Al cerrar la cuenta** (implícito en el flujo del frontend, inmediatamente después de que
  `cerrarCuenta` devuelve la factura ya resuelta): copia marcada `ORIGINAL`.
- **Reimpresión desde el historial** (`GET /api/facturas/:id/pdf`,
  `facturaController.getPdf`): copia marcada `DUPLICADO`, porque cualquier impresión que no
  sea inmediatamente posterior al cierre se asume una reimpresión de archivo.

Contenido del PDF: encabezado con nombre del negocio y datos fiscales del emisor
(`AFIP_RAZON_SOCIAL`, CUIT, condición IVA, domicilio comercial, Ingresos Brutos, inicio de
actividades — todos opcionales salvo el CUIT), tipo y número de comprobante, datos del
receptor, el detalle de ítems de la cuenta (obtenidos por separado vía
`Pedido.getPedidosSesion` + `Pedido.getItemsByPedidoIds`, ya que la tabla `facturas` no
duplica el detalle de productos), importes (neto, IVA si corresponde, total), CAE y su
vencimiento, y el **QR obligatorio**.

### 6.1 QR obligatorio (RG 4892)

`armarUrlQr` arma el payload JSON exigido por la normativa (versión, fecha, CUIT del emisor,
punto de venta, tipo y número de comprobante, importe, moneda, cotización, tipo/número de
documento del receptor, tipo y código de autorización), lo codifica en Base64 y arma la URL
`https://www.afip.gob.ar/fe/qr/?p=<base64>`. El código ya trae una nota explícita para
**reconfirmar el esquema exacto contra la especificación vigente antes de pasar a
producción**, porque la documentación de ARCA se está migrando de dominio (afip.gob.ar →
arca.gob.ar) y el payload/URL podrían cambiar aunque los web services SOAP no se muevan.

## 7. Sistemas adyacentes no fiscales (`src/services/ticketService.js`)

No hablan con ARCA ni tocan la tabla `facturas`; generan comprobantes puramente internos,
todos explícitamente rotulados "Comprobante interno, no válido como factura":

- **`generarTicketPedido`**: ticket de una silla/pedido individual.
- **`generarTicketCuenta`**: ticket consolidado de toda la cuenta de una mesa (todas las
  sillas de la sesión), con subtotal por silla y total general — este es el que se usa para
  entregarle al cliente cuando **no** se emitió factura fiscal (o además de ella, como
  detalle de ítems, ya que la factura ARCA no lleva el detalle producto por producto).
- **`generarComandaMesa`**: comanda para cocina/barra — sin precios ni totales, se puede pedir
  en cualquier momento con la cuenta todavía abierta (a diferencia de los tickets, que
  requieren que los pedidos ya estén cerrados).

Por qué existen ambos sistemas en paralelo: facturar es **opcional** al cerrar una cuenta,
pero el local igual necesita entregar algún comprobante de lo consumido — el ticket interno
cubre ese caso. Y aun cuando sí se factura, la factura ARCA (sin detalle de ítems) no
reemplaza la utilidad de un ticket con el detalle línea por línea para el cliente.

## 8. Configuración por entorno

Toda la configuración de ARCA se centraliza en `src/config/afipConfig.js` — es la **única
fuente de verdad**: ningún otro módulo del sistema de facturación debe leer `process.env`
directamente (esto está indicado como convención explícita en el propio archivo). Pasar de
homologación a producción, o de un CUIT/cliente a otro, es exclusivamente cambiar estas
variables de entorno, sin tocar código.

| Variable | Propósito |
|---|---|
| `AFIP_ENTORNO` | `homologacion` (default) o `produccion` — determina qué URLs de WSAA/WSFE se usan |
| `AFIP_CUIT` | CUIT del emisor (sin guiones) |
| `AFIP_PUNTO_VENTA` | Punto de venta dado de alta en ARCA para Web Services |
| `AFIP_CONDICION_IVA_EMISOR` | `monotributista` (default) o `responsable_inscripto` — gatea qué tipos de comprobante se ofrecen (ver sección 3.1) |
| `AFIP_CERT_PATH` / `AFIP_KEY_PATH` | Rutas a los archivos de certificado (`.pem`) y clave privada usados para firmar el TRA ante WSAA — **nunca se versionan** |
| `AFIP_IVA_ALICUOTA_ID` | Código ARCA de la alícuota de IVA general (default `5` = 21%) |
| `AFIP_IVA_ALICUOTA_PORCENTAJE` | Porcentaje correspondiente, usado para discriminar neto/IVA en Factura A/B |
| `AFIP_RAZON_SOCIAL` | Razón social del emisor, impresa en el encabezado del PDF |
| `AFIP_DOMICILIO_COMERCIAL` | Domicilio comercial, impreso en el PDF |
| `AFIP_INICIO_ACTIVIDADES` | Fecha de inicio de actividades, impresa en el PDF |
| `AFIP_INGRESOS_BRUTOS` | Número de Ingresos Brutos (o "Exento"), impreso en el PDF |

Ver `.env.example` en la raíz del repo para el listado completo con comentarios — ese archivo
nunca contiene valores reales, solo la lista de variables esperadas.

### 8.1 URLs de los web services (públicas, no sensibles)

| Entorno | WSAA | WSFEv1 |
|---|---|---|
| Homologación | `https://wsaahomo.afip.gov.ar/ws/services/LoginCms` | `https://wswhomo.afip.gov.ar/wsfev1/service.asmx` |
| Producción | `https://wsaa.afip.gov.ar/ws/services/LoginCms` | `https://servicios1.afip.gov.ar/wsfev1/service.asmx` |

Estas URLs están hardcodeadas en `afipConfig.js` (no son variables de entorno) porque son
fijas por entorno y no cambian entre clientes/CUIT.

## 9. Seguridad y autenticación de la API

Todos los endpoints de `/api/facturas/*` (y del resto de la API, salvo `/api/auth/login` y
`/health`) requieren un JWT válido, verificado por `src/middleware/authMiddleware.js`
(`requireAuth`, montado globalmente en `src/server.js` antes de las rutas de negocio). El
token se firma/verifica con `JWT_SECRET` (variable de entorno, nunca versionada).

Como está documentado en `CLAUDE.md`, hoy **no hay diferenciación de permisos por rol**: la
tabla `users` tiene un campo `rol` que es puramente informativo, y cualquier usuario logueado
puede emitir, reintentar o consultar facturas — no hay, por ejemplo, una restricción de "solo
el dueño puede reintentar una factura rechazada". Esto es una decisión consciente dado el
tamaño del negocio (2 usuarios), no un descuido.

## 10. Logging y observabilidad

`src/utils/logger.js` configura **winston** con dos transportes a archivo (rotación 5MB × 5
archivos cada uno): `logs/error.log` (solo nivel `error`) y `logs/combined.log` (todo nivel
`info` o más severo). En desarrollo (`NODE_ENV !== 'production'`) también loguea a consola en
color. Los archivos de log no se versionan (`*.log` en `.gitignore`).

Dos middlewares globales complementan esto:

- **`requestLogger`** (`src/middleware/requestLogger.js`): registra cada request con método,
  ruta, status code y duración; usa `warn` para 4xx e `error` para 5xx, para poder ver en
  `combined.log` errores que un controlador ya "manejó" devolviendo un status de error
  (por ejemplo, ARCA devolviendo 401 reiteradamente, o el 502 de un reintento fallido).
- **`errorHandler`** (`src/middleware/errorHandler.js`): red de seguridad final para cualquier
  excepción que no haya sido capturada por un controlador — la loguea y responde `500`
  genérico si la respuesta todavía no se envió.

Específicamente para facturación: cuando ARCA rechaza o falla una emisión (tanto en el cierre
de cuenta como en un reintento), el mensaje de error queda tanto en la columna
`observaciones` de la fila `facturas` (para verlo desde el historial en el frontend) como en
`logs/error.log` con el stack completo (para debug técnico).

## 11. Herramientas de diagnóstico

**`scripts/test-afip-prod.js`** — script de verificación manual de conectividad contra
**producción**, fuera del flujo normal de la aplicación (no lo ejecuta ningún endpoint ni
proceso automático). Se corre manualmente con `node scripts/test-afip-prod.js`. Usa un
archivo de entorno separado (`.env.test_prod`, no versionado) precisamente para poder apuntar
a producción sin tocar ni depender de la configuración/cache de tokens que usa el proceso
principal del servidor (que normalmente corre contra homologación durante desarrollo). Hace
login contra WSAA, un `FEDummy` y un `FECompUltimoAutorizado` de prueba (Factura B), e imprime
el resultado por consola — útil para confirmar el alta del punto de venta y la validez del
certificado antes de habilitar producción en el sistema real.

## 12. Librerías utilizadas

| Librería | Uso |
|---|---|
| `soap` | Cliente SOAP genérico, usado para hablar tanto con WSAA (`wsaaClient.js`) como con WSFEv1 (`wsfeClient.js`) |
| `node-forge` | Firma CMS/PKCS#7 del TRA para WSAA, sin depender del binario `openssl` del sistema |
| `pdfkit` | Generación de todos los PDFs térmicos (facturas fiscales, tickets, comandas) |
| `qrcode` | Generación del código QR obligatorio en el PDF de factura |
| `winston` | Logging estructurado a archivo con rotación |
| `jsonwebtoken` | Emisión/verificación de JWT para autenticación de la API |
| `mysql2` | Cliente de base de datos, incluye el pool usado para `GET_LOCK`/`RELEASE_LOCK` |

## 13. Qué queda fuera de este documento

- Los trámites administrativos ante ARCA (alta de punto de venta, obtención de certificado
  digital, verificación de condición fiscal) — ver la sección "AFIP / ARCA" en `CLAUDE.md`.
- Valores reales de configuración de ningún entorno — están únicamente en archivos `.env`
  locales/del servidor, nunca versionados ni documentados aquí.
- Notas de crédito/débito y anulación de comprobantes — no implementadas (ver sección 3.4).
