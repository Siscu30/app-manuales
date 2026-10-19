// Pruebas de las funciones puras de Tablas Interactivas (motor de reglas y validadores).
// app.js es un script de navegador sin módulos, así que las funciones se extraen de su
// código fuente: así se prueba exactamente lo que se despliega, sin duplicarlo.
// Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// Devuelve el código de una función de primer nivel: desde "function nombre(" hasta la
// primera llave de cierre en la columna 0.
function extract(name) {
  const start = SRC.indexOf(`\nfunction ${name}(`);
  assert.ok(start !== -1, `No se encontró la función ${name} en app.js`);
  const end = SRC.indexOf('\n}', start + 1);
  return SRC.slice(start + 1, end + 2);
}

const NAMES = ['_tiSafeUrl', '_tiSafeHexColor', '_tiCellCompareValue', '_tiCompare', 'evaluarCeldaColor', 'evaluarFilaColor'];
const fns = new Function(NAMES.map(extract).join('\n') + `\nreturn { ${NAMES.join(', ')} };`)();
const { _tiSafeUrl, _tiSafeHexColor, _tiCellCompareValue, _tiCompare, evaluarCeldaColor, evaluarFilaColor } = fns;

test('_tiSafeUrl bloquea esquemas peligrosos y conserva enlaces normales', () => {
  assert.equal(_tiSafeUrl('https://ejemplo.com/a'), 'https://ejemplo.com/a');
  assert.equal(_tiSafeUrl('javascript:alert(1)'), '');
  assert.equal(_tiSafeUrl('  JavaScript:alert(1)'), '');
  assert.equal(_tiSafeUrl('data:text/html,x'), '');
  assert.equal(_tiSafeUrl('vbscript:x'), '');
  assert.equal(_tiSafeUrl(null), '');
});

test('_tiSafeHexColor solo admite hex y usa el valor por defecto en lo demás', () => {
  assert.equal(_tiSafeHexColor('#abc'), '#abc');
  assert.equal(_tiSafeHexColor('#AABBCC'), '#AABBCC');
  assert.equal(_tiSafeHexColor('red;background:url(x)'), '#2563EB');
  assert.equal(_tiSafeHexColor('', '#000000'), '#000000');
});

test('_tiCompare: fechas ISO del mismo año se comparan bien (regresión parseFloat)', () => {
  assert.equal(_tiCompare('>', '2026-07-25', '2026-03-15'), true);
  assert.equal(_tiCompare('<', '2026-07-25', '2026-03-15'), false);
  assert.equal(_tiCompare('>', '2026-03-15', '2025-12-31'), true);
});

test('_tiCompare: números, texto, contiene y vacío', () => {
  assert.equal(_tiCompare('>', '10', '9'), true);           // numérico, no lexicográfico
  assert.equal(_tiCompare('=', 'Sí', 'sí'), true);          // sin distinguir mayúsculas
  assert.equal(_tiCompare('!=', 'a', 'b'), true);
  assert.equal(_tiCompare('contiene', 'Texto editado', 'EDIT'), true);
  assert.equal(_tiCompare('vacio', '', ''), true);
  assert.equal(_tiCompare('novacio', null, ''), false);
  assert.equal(_tiCompare('desconocido', 'a', 'a'), false);
});

test('_tiCellCompareValue resuelve estados, insignias y casillas', () => {
  const st = { id: 'e', type: 'estado-ciclico', states: [{ value: 'Sí' }, { value: 'No' }] };
  assert.equal(_tiCellCompareValue(st, { values: { e: 1 } }), 'No');
  assert.equal(_tiCellCompareValue(st, { values: {} }), 'Sí');
  assert.equal(_tiCellCompareValue({ id: 'c', type: 'checkbox' }, { values: { c: true } }), 'true');
  assert.equal(_tiCellCompareValue({ id: 't', type: 'texto' }, { values: {} }), '');
});

// Tabla de ejemplo: columna de texto + casilla, dos filas.
const contenido = {
  columns: [{ id: 'txt', type: 'texto' }, { id: 'chk', type: 'checkbox' }],
  rows: [
    { id: 'r0', values: { txt: 'Texto editado', chk: true } },
    { id: 'r1', values: { txt: 'Otro', chk: false } },
  ],
  reglas: [
    { id: 'celda', alcance: 'celda', colId: 'chk', logica: 'AND', prioridad: 0,
      condiciones: [{ colId: 'chk', comparador: '=', valor: 'true' }], colorFondo: '#f00', colorTexto: '#fff' },
    { id: 'fila', alcance: 'fila', logica: 'AND', prioridad: 1,
      condiciones: [{ colId: 'txt', comparador: 'contiene', valor: 'editado' }, { colId: 'chk', comparador: '=', valor: 'true' }],
      colorFondo: '#0f0', colorTexto: '#000' },
  ],
};

test('evaluarCeldaColor: prioridad global, alcance celda vs fila', () => {
  // La regla de celda (prioridad 0) gana en su propia columna...
  assert.deepEqual(evaluarCeldaColor(contenido, 'r0', 'chk'), { colorFondo: '#f00', colorTexto: '#fff' });
  // ...y en las demás columnas alcanza la regla de fila.
  assert.deepEqual(evaluarCeldaColor(contenido, 'r0', 'txt'), { colorFondo: '#0f0', colorTexto: '#000' });
  // AND con una condición falsa: sin color.
  assert.equal(evaluarCeldaColor(contenido, 'r1', 'txt'), null);
  assert.equal(evaluarCeldaColor(contenido, 'no-existe', 'txt'), null);
});

test('evaluarCeldaColor: lógica OR', () => {
  const c = { ...contenido, reglas: [{ alcance: 'fila', logica: 'OR', prioridad: 0, colorFondo: '#00f',
    condiciones: [{ colId: 'txt', comparador: '=', valor: 'nada' }, { colId: 'txt', comparador: '=', valor: 'Otro' }] }] };
  assert.equal(evaluarCeldaColor(c, 'r1', 'chk')?.colorFondo, '#00f');
  assert.equal(evaluarCeldaColor(c, 'r0', 'chk'), null);
});

test('evaluarFilaColor solo considera reglas de alcance fila', () => {
  assert.deepEqual(evaluarFilaColor(contenido, 'r0'), { colorFondo: '#0f0', colorTexto: '#000' });
  const soloCelda = { ...contenido, reglas: [contenido.reglas[0]] };
  assert.equal(evaluarFilaColor(soloCelda, 'r0'), null);
});
