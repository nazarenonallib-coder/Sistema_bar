# Proyecto: Sistema de Gestión para Cafetería Local

## Contexto del negocio
Cafetería local con 2 usuarios: el dueño y un empleado, sin diferenciación de roles ni permisos.
Necesita reemplazar la operación manual por un sistema simple que permita operar el día a día sin dificultad.

## Objetivo del sistema
Permitir operar el negocio de forma simple, cubriendo:
- Gestión de mesas y sus cuentas (abrir, sumar pedidos, cerrar cuenta)
- Carta de productos con precios editables por el dueño
- Registro del método de pago utilizado por cuenta (efectivo, tarjeta, etc.)
- Emisión de factura electrónica homologada (AFIP, con CAE) - A/B/C

## Alcance del MVP (lo imprescindible)
1. **Mesas y cuentas**: alta/cierre de mesas, agregar productos a una cuenta abierta, ver total acumulado.
2. **Carta de productos**: CRUD de productos con precio, editable en cualquier momento por el dueño/empleado. Control de stock simplificado a "disponible / no disponible" (sin manejo de insumos ni recetas por ahora).
3. **Carga de pedidos**: se realiza desde una PC/notebook en el mostrador (NO se carga desde la mesa). El mozo anota en papel y luego transcribe. No es mobile-first, pero conviene mantener diseño responsive por si en el futuro se quiere cargar desde tablet.
4. **Pagos**: registrar el método de pago usado al cerrar cada cuenta, para fines de reporte.
5. **Facturación electrónica (AFIP)**: emisión de comprobantes homologados con CAE (factura A/B/C según corresponda). Es el módulo más sensible técnicamente.
6. **Insumos y recetas**: CRUD de insumos (nombre, unidad de medida, costo unitario opcional,
   stock, disponible sí/no) y relación producto→insumos ("café con leche" consume "café molido" y
   "leche" en ciertas cantidades). Igual que con productos, el stock de un insumo solo se fija al
   crearlo y no se puede editar a mano desde la pestaña de Insumos: al cerrar una cuenta/pedido se
   descuenta automáticamente según la receta del producto vendido.

## Fuera de alcance (por ahora)
- Diferenciación de PERMISOS entre roles: existe login y un campo `rol` en la base (ver
  "Decisiones de escalabilidad aplicadas"), pero hoy ambos roles pueden hacer las mismas acciones
- Carga de pedidos desde celular/tablet en la mesa
- Integración con pasarelas de pago (Mercado Pago, etc.) más allá de registrar el método
- Costeo automático de productos a partir del costo de sus insumos (el costo unitario del insumo
  se guarda, pero todavía no se usa para calcular el costo/margen de un producto)

## Decisiones de escalabilidad aplicadas
Con 2 usuarios y una sola sucursal, no tiene sentido sobre-diseñar el sistema. Estas son las
únicas decisiones que se tomaron hoy para no tener que reescribir cosas más adelante:
- **Login con usuario/contraseña (JWT)**: toda la API (salvo `/api/auth/login` y `/health`) exige
  un token. Hay una tabla `users` con un campo `rol` ('admin' | 'empleado'), pero por ahora es solo
  informativo: ningún endpoint todavía chequea el rol para permitir o negar una acción. Sirve para
  no tener que migrar el esquema el día que se quiera diferenciar permisos.
- **Historial paginado**: `GET /api/pedidos/historial` devuelve páginas (`page`/`limit`, default
  20), no la tabla completa. Se agregaron índices en `pedidos(estado, fecha_cierre)` y
  `pedidos(mesa_id, sesion_apertura)` para que esa consulta no se degrade con más volumen.
- **Explícitamente NO se hizo**: nada de multi-sucursal/multi-tenant (no es una prioridad del
  cliente) ni un sistema de permisos real (no hay todavía ninguna acción que deba estar
  restringida a un solo rol).

## Stack tecnológico
- **Backend**: Node.js
- **Frontend**: React
- **Base de datos**: MySQL
- **Hosting**: Hostinger
- Desarrollo asistido por Claude Code (sin equipo adicional)

## Riesgos / bloqueantes a resolver ANTES o EN PARALELO al desarrollo
- ⚠️ **Estado AFIP desconocido**: no se sabe si la cafetería ya está inscripta y habilitada para facturación electrónica (certificado digital / clave fiscal nivel 3). Esto es un trámite administrativo del cliente, NO de código, y bloquea poder probar el módulo de facturación en un entorno real. Debe verificarse cuanto antes y tratarse como tarea de "Fase 0", en paralelo al desarrollo del resto del sistema, para no frenar el proyecto completo.
- El módulo de facturación electrónica AFIP suele requerir homologación primero en entorno de testing (WSFEv1 / homologación) antes de pasar a producción.

## Prioridades del cliente
- "Cuanto antes mejor" (sin fecha límite estricta, pero urgencia alta)
- Lo más importante en este momento: control de precios de la carta

## Versionado del sistema
El sistema usa un único número de versión `MAJOR.MINOR.PATCH`, arrancando en **1.0.0**. No es
semver estándar (no indica compatibilidad hacia atrás): cada posición identifica qué capa cambió.

- **MAJOR** (primer número): cambios en la base de datos — esquema, migraciones, cualquier script
  en `database/*.sql` (`ALTER TABLE`, tabla nueva, columna nueva, índice nuevo, etc.).
- **MINOR** (segundo número): cambios en el backend (Node.js: `src/controllers`, `src/models`,
  `src/services`, `src/routes`, `src/middleware`) que NO tocan el esquema de la base de datos.
- **PATCH** (tercer número): cambios en el frontend (React, `frontend/src`) que no tocan backend
  ni base de datos.

Reglas:
- Subir un número más significativo reinicia los de la derecha a 0 (ej: un cambio de base de
  datos lleva 1.3.7 → 2.0.0, no 2.3.7).
- Si un cambio toca más de una capa a la vez (ej: una migración nueva + el endpoint que la usa),
  se sube el número de la capa más significativa involucrada — en ese ejemplo, MAJOR, porque
  incluye base de datos.
- La versión vive en el campo `"version"` de `package.json` (raíz del repo); `frontend/package.json`
  se mantiene igual a ese mismo número por consistencia, aunque no se lee de ahí en tiempo de
  ejecución. El backend expone ese valor en `GET /api` y `GET /health` (leído directo de
  `package.json`, no hardcodeado).
- Cada vez que se haga un cambio que corresponda a una de estas categorías, hay que actualizar
  `package.json` (raíz) como parte del mismo commit.


# AFIP / ARCA — Integración de Facturación Electrónica
> Investigado sobre documentación oficial de ARCA (arca.gov.ar / afip.gob.ar) — Julio 2026

---

## 1. Contexto: qué servicio usar

El web service correcto para este proyecto es **WSFEv1** (Web Service de Factura Electrónica V1, RG N° 4.291).
Cubre comprobantes A, B y C **sin detalle de ítem** (que es nuestro caso: una cafetería no necesita detallar cada ítem con código de producto).
La autenticación previa a cualquier llamada la maneja un servicio separado: **WSAA** (Web Service de Autenticación y Autorización).

Flujo de cada llamada:
WSAA (token de acceso) → WSFEv1 (autorización de comprobante) → respuesta con CAE

---

## 2. Qué tipo de comprobante emite la cafetería

Esto depende de la condición fiscal del dueño. Hay que verificarlo antes de arrancar el módulo:

| Condición fiscal | Comprobante que emite | Cómo registrar el PdV en ARCA |
|---|---|---|
| **Monotributista** | Solo **C** | Registro Único Tributario → "Factura electrónica – Monotributo – Web Services" |
| **Responsable Inscripto** | **A** (a RI), **B** (a consumidor final / monotributo) | Servicio REAR/RECE/RFI → "RECE para aplicativo y web services" |

**Acción inmediata para el cliente:** verificar en ARCA con su clave fiscal qué condición tiene y si ya tiene puntos de venta dados de alta para Web Services.

---

## 3. Pasos administrativos (cliente, no código) — FASE 0

Estos son los pasos que el dueño de la cafetería debe completar. Son trámites de clave fiscal, no de desarrollo.

### 3.1 Requisitos previos
- CUIT con estado administrativo **activo sin limitaciones**
- Clave Fiscal nivel **3 como mínimo**
- Al menos una actividad económica declarada en el Sistema Registral (CLAE)

### 3.2 Dar de alta el Punto de Venta para Web Services
Desde ARCA con clave fiscal:
- Ingresar al servicio **"Administración de Puntos de Venta y Domicilios"** (o "Registro Único Tributario" si es monotributista)
- Agregar un nuevo punto de venta (ej: 0002)
- Seleccionar sistema de facturación:
  - Si es **Monotributista**: "Factura electrónica – Monotributo – Web Services"
  - Si es **Responsable Inscripto**: "RECE para aplicativo y web services"
- Asociar un domicilio
- **Tomar nota del número de punto de venta** — lo vamos a necesitar en el código

### 3.3 Obtener el Certificado Digital (entorno de homologación — para desarrollo)
Para poder desarrollar y probar sin esperar el alta completa en producción:

**Paso 1:** Ingresar a ARCA con clave fiscal de **persona física** (no la CUIT de la empresa/persona jurídica)

**Paso 2:** En el Administrador de Relaciones de Clave Fiscal → Adherir Servicio → seleccionar **WSASS** (Autogestión de Certificados para Web Services de Homologación)

**Paso 3:** Cerrar sesión y volver a entrar. WSASS ahora aparece en los servicios habilitados.

**Paso 4:** Generar la clave privada y el CSR (Certificate Signing Request) con OpenSSL:
```bash
# Generar clave privada
openssl genrsa -out private_key.key 2048

# Generar CSR (reemplazar TU_CUIT con los 11 dígitos sin guiones)
openssl req -new -key private_key.key \
  -subj "/C=AR/O=NOMBRE_EMPRESA/CN=NOMBRE_SISTEMA/serialNumber=CUIT TU_CUIT" \
  -out pedido.csr
```
> ⚠️ El formato `serialNumber=CUIT TU_CUIT` (con la palabra "CUIT" y un espacio antes de los dígitos) es obligatorio exactamente así.

**Paso 5:** En WSASS → "Nuevo Certificado" → subir el contenido del `pedido.csr` → el sistema devuelve un certificado X.509 en formato PEM. Guardarlo como `cert.pem`.

**Paso 6:** En WSASS → "Crear Autorización a Servicio" → asociar el certificado al servicio **wsfe** (Facturación Electrónica).

**Paso 7:** Guardar los archivos resultantes de forma segura:
- `private_key.key` — clave privada (nunca commitear al repositorio)
- `cert.pem` — certificado (nunca commitear al repositorio)

> Para el entorno de **producción** el proceso es similar pero se hace desde el servicio "Administración de Certificados Digitales" en ARCA (no WSASS), y el certificado tiene vigencia determinada (hay que renovarlo antes de que venza).

---

## 4. Integración técnica — Stack Node.js / TypeScript

### 4.1 Librería recomendada: `@afipsdk/afip.js`
La más usada del ecosistema Node.js para ARCA. +193 stars en GitHub, +100k descargas, actualizada en 2026, soporta TypeScript.

```bash
npm install @afipsdk/afip.js
```

Repositorio oficial: https://github.com/AfipSDK/afip.js
Documentación: https://docs.afipsdk.com

**Alternativa moderna (TypeScript-native):** `@arcasdk/core`
Más nueva, tipado completo, sin dependencias pesadas. Vale evaluar si se quiere una librería más limpia.
Sitio: https://www.afipts.com

### 4.2 Inicialización básica (homologación)

```typescript
import Afip from '@afipsdk/afip.js';

const afip = new Afip({
  CUIT: TU_CUIT,           // número sin guiones
  cert: 'cert.pem',        // path al archivo .pem
  key: 'private_key.key',  // path a la clave privada
  production: false,       // false = homologación, true = producción
});
```

> 💡 Durante desarrollo puro, afip.js permite usar el CUIT de prueba `20409378472` sin certificado propio para pruebas rápidas.

### 4.3 Emitir una factura (ejemplo simplificado)

```typescript
// Obtener el último número de comprobante emitido
const lastVoucher = await afip.ElectronicBilling.getLastVoucher(
  PUNTO_DE_VENTA,   // número de punto de venta dado de alta en ARCA
  TIPO_COMPROBANTE  // 6 = Factura B, 11 = Factura C, 1 = Factura A
);

const voucherNumber = lastVoucher + 1;

// Crear el comprobante
const result = await afip.ElectronicBilling.createVoucher({
  CantReg: 1,                          // cantidad de comprobantes
  PtoVta: PUNTO_DE_VENTA,
  CbteTipo: TIPO_COMPROBANTE,          // ver tabla de tipos abajo
  Concepto: 1,                         // 1=Productos, 2=Servicios, 3=Productos y Servicios
  DocTipo: 99,                         // 99=Consumidor final (sin CUIT)
  DocNro: 0,                           // 0 si es consumidor final
  CbteDesde: voucherNumber,
  CbteHasta: voucherNumber,
  CbteFch: new Date().toISOString().slice(0,10).replace(/-/g,''), // yyyyMMdd
  ImpTotal: TOTAL,                     // total del comprobante
  ImpTotConc: 0,
  ImpNeto: TOTAL_NETO,
  ImpOpEx: 0,
  ImpIVA: TOTAL_IVA,
  ImpTrib: 0,
  MonId: 'PES',                        // Pesos argentinos
  MonCotiz: 1,
  Iva: [
    {
      Id: 5,                           // 5 = 21%, 4 = 10.5%, 3 = 0%
      BaseImp: TOTAL_NETO,
      Importe: TOTAL_IVA,
    }
  ],
});

// result.CAE → código de autorización electrónico
// result.CAEFchVto → fecha de vencimiento del CAE (guardar en BD)
```

### 4.4 Tipos de comprobante más comunes

| Código | Tipo |
|---|---|
| 1 | Factura A |
| 6 | Factura B |
| 11 | Factura C (Monotributo / Exentos) |
| 3 | Nota de Débito A |
| 8 | Nota de Débito B |
| 13 | Nota de Débito C |
| 2 | Nota de Crédito A |
| 7 | Nota de Crédito B |
| 12 | Nota de Crédito C |

### 4.5 URLs de los servicios

| Entorno | WSAA (autenticación) | WSFEv1 (facturación) |
|---|---|---|
| **Homologación** | https://wsaahomo.afip.gov.ar/ws/services/LoginCms | https://wswhomo.afip.gov.ar/wsfev1/service.asmx |
| **Producción** | https://wsaa.afip.gov.ar/ws/services/LoginCms | https://servicios1.afip.gov.ar/wsfev1/service.asmx |

---

## 5. Datos a guardar en la BD por cada comprobante

Al emitir correctamente, ARCA devuelve estos datos que hay que persistir: