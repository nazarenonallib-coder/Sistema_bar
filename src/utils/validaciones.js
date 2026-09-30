// Validaciones de parámetros de query compartidas por los controllers.

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Fecha 'YYYY-MM-DD' que además existe en el calendario. Con solo el regex, '2026-13-01' pasaba la
// validación y llegaba a MySQL, que respondía con un error y el endpoint devolvía 500 en vez de
// 400. Hay dos casos a cubrir: new Date('2026-13-01') da Invalid Date, pero '2026-02-30' no falla
// (rola al 2 de marzo), así que hay que comparar la fecha reconstruida con el texto original.
const esFechaISO = (valor) => {
  if (typeof valor !== 'string' || !FECHA_REGEX.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
};

module.exports = { FECHA_REGEX, esFechaISO };
