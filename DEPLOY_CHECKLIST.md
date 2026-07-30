# Checklist de deploy a Hostinger

Contexto: hosting compartido/Cloud de Hostinger (panel hPanel → "Node.js App" / Passenger, no
VPS). Condición fiscal ya resuelta; falta el resto de la Fase 0 de AFIP (alta del punto de venta
para Web Services y certificado de producción).

## Fase 0 — Trámites pendientes (bloquean producción, no son de código)
- [ ] Confirmar en ARCA que el Punto de Venta está dado de alta para **Web Services** (no solo
  para facturación manual): "Administración de Puntos de Venta y Domicilios" (RI) o "Registro
  Único Tributario" (Monotributo) → anotar el número de PdV.
- [ ] Generar el **certificado de producción** (se hace desde "Administración de Certificados
  Digitales" en ARCA, no desde WSASS) y guardar `cert.pem` / `private_key.key` de producción en
  un lugar seguro (gestor de contraseñas, no el repo). Hoy `certs/produccion/` está vacía.
- [ ] Confirmar tipo de comprobante a emitir (A/B/C) según la condición fiscal ya resuelta, y que
  coincide con lo configurado en el código.

## 1. Preparar el hosting en Hostinger
- [X] Contratar/verificar el plan (Hosting compartido/Cloud con soporte "Node.js App" en hPanel).
- [X] Verificar versión de Node.js disponible en hPanel y que coincide con la usada en desarrollo.
- [X] Crear la base de datos MySQL desde hPanel (usuario, contraseña, nombre de BD) y anotar el
  host interno que da Hostinger (normalmente `localhost` o uno específico).
- [X] Configurar el dominio/subdominio: dominio principal para el frontend, subdominio (ej.
  `api.tudominio.com`) para el backend si se sirven por separado.
- [ ] Activar SSL (Let's Encrypt gratuito de hPanel) para dominio y subdominio.

## 2. Migrar la base de datos
- [X] Revisar los scripts en `database/` y `src/config/schema.sql` y determinar el orden correcto
  de aplicación (no hay migration framework: hacerlo a mano, con cuidado).
- [X] Aplicar `schema.sql` base primero, luego los `migracion_*.sql`/`alter_*.sql` en orden
  cronológico, y `crear_users.sql` al final (o donde corresponda).
- [X] Verificar que quedaron creados los índices `pedidos(estado, fecha_cierre)` y
  `pedidos(mesa_id, sesion_apertura)`.
- [X] Cargar un usuario admin real (no el de prueba de desarrollo).

## 3. Variables de entorno de producción
- [X] Crear el `.env` de producción (subir por hPanel/SFTP, nunca por git): `DB_HOST/USER/
  PASSWORD/NAME/PORT` apuntando a la MySQL de Hostinger.
- [X] `JWT_SECRET` nuevo y fuerte, distinto al de desarrollo/homologación.
- [X] `AFIP_ENTORNO=produccion`, CUIT real, punto de venta real, rutas a los certificados de
  producción.
- [X] Configurar CxORS en el backend para aceptar el dominio real del frontend.

## 4. Subir y construir el código
- [X] Subir el código del backend al hosting (git, SFTP, o el deploy integrado de hPanel).
- [ ] Subir los certificados de producción a `certs/produccion/` **directo al servidor**, nunca
  vía repositorio.
- [ ] Correr `npm install` (backend) en el servidor/hPanel.
- [ ] Generar el build del frontend: `npm run build` dentro de `frontend/`, y definir cómo se
  sirve `dist/` (sitio estático en el dominio principal, o servido por el propio Express).
- [ ] Configurar en el panel "Node.js App" el entry point (`src/server.js`) y las variables de
  entorno de producción (verificar si hPanel las carga por su propio formulario en vez de leer
  `.env` directamente).

## 5. Probar antes de aceptar clientes reales
- [ ] Login con el usuario admin real.
- [ ] Abrir una mesa, cargar un pedido, cerrar cuenta con un método de pago.
- [ ] Emitir **una factura de prueba en homologación primero** para validar que WSAA/WSFE
  responden desde el servidor de Hostinger (el hosting compartido puede tener restricciones de
  salida distintas al entorno de desarrollo).
- [ ] Recién después, emitir **una factura real de bajo monto en producción** y verificar que
  vuelve el CAE y la fecha de vencimiento, y que se guardan en la BD.
- [ ] Revisar `GET /api/pedidos/historial` paginado con datos reales.

## 6. Seguridad y backups
- [ ] Confirmar que `.env` y `certs/` no quedan accesibles públicamente por URL (probar
  `tudominio.com/.env` y `tudominio.com/certs/...` deben dar 404/403).
- [ ] Verificar que Hostinger tiene backups automáticos de la BD en el plan contratado; si no,
  programar un backup manual periódico.
- [ ] Guardar copia segura (fuera del servidor) de los certificados de producción y el `.env` de
  producción — si se pierden, hay que rehacer el trámite de certificado en ARCA.
