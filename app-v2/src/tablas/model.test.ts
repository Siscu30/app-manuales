import { describe, expect, test } from 'vitest';
import { addColumn, addRow, coerceCell, createColumn, editColumn, history, loadContenido, moveColumn, moveRow, parseTSV, pasteRange, push, redo, removeColumn, removeRow, saveContenido, setCell, typeLabel, undo, updatePayload, type Contenido } from './model';

const fixture: Contenido = {
  schemaVersion: 2, extension: { futuro: [1, null, false] }, legend: '<b>Legado intacto</b>',
  highlightRule: { enabled: true, columnIds: ['t'], matchValue: 'Sí' },
  columns: [{ id: 't', type: 'texto', label: 'Texto', extra: { width: 91 } }, { id: 's', type: 'badge', states: [{ value: 'Alta', icon: 'custom', extension: true }, { value: 'Baja' }] }],
  rows: [{ id: 'a', extra: { conservar: true }, values: { t: 'Uno', s: 1, desconocida: { x: 1 } } }, { id: 'b', values: { t: 'Dos' } }],
  reglas: [{ id: 'r', extension: 'conservar', alcance: 'fila', condiciones: [{ colId: 't', comparador: '=', valor: 'Uno', extra: 2 }, { colId: 's', comparador: '=', valor: 'Alta' }] }, { id: 'cell', alcance: 'celda', colId: 't', condiciones: [{ colId: 's', comparador: '=', valor: 'Baja' }] }],
};
const fresh = () => JSON.parse(JSON.stringify(fixture)) as Contenido;

test.each([fixture, {}, { extension: { arbitrary: [null, 1] } }, { columns: [], rows: [], reglas: [] }])('load → save conserva exactamente el JSON, incluidas claves ausentes', value => {
  const before = JSON.stringify(value);
  expect(saveContenido(loadContenido(value))).toEqual(value);
  expect(JSON.stringify(value)).toBe(before);
});
test('rechaza documentos incompatibles sin intentar convertirlos ni sobrescribirlos', () => {
  for (const value of [null, [], { columns: {} }, { rows: [{ id: 'r' }] }, { reglas: [null] }, { columns: [{ id: 'x', type: 'texto' }, { id: 'x', type: 'texto' }] }]) expect(() => loadContenido(value)).toThrow();
});
test('setCell conserva todas las extensiones y comparte filas no modificadas', () => {
  const c = fresh(), before = fresh(), changed = setCell(c, 'a', 't', 'Editado');
  expect(c).toEqual(before); expect(changed.rows?.[0]).toEqual({ ...c.rows![0], values: { ...c.rows![0].values, t: 'Editado' } });
  expect(changed.rows?.[1]).toBe(c.rows?.[1]); expect(changed.reglas).toBe(c.reglas); expect(changed.extension).toBe(c.extension);
  expect(setCell(c, 'a', 't', 'Uno')).toBe(c); expect(setCell(c, 'missing', 't', '')).toBe(c); expect(setCell(c, 'a', 'missing', '')).toBe(c);
});
test('añade y elimina filas sin modificar otras claves', () => {
  const c = fresh(), next = addRow(c, 'new');
  expect(next.rows?.[2]).toEqual({ id: 'new', values: { t: '', s: 0 } });
  expect(removeRow(next, 'new')).toEqual(c); expect(removeRow(c, 'missing')).toBe(c);
  expect(addRow({ columns: [createColumn('c', 'checkbox')] }, 'r').rows?.[0].values.c).toBe(false);
});
test('añade, configura y reordena columnas conservando campos desconocidos', () => {
  const c = fresh();
  const next = addColumn(c, createColumn('new', 'select'));
  expect(next.columns?.[2].opciones).toEqual(['Opción 1', 'Opción 2']);
  const changed = editColumn(next, 't', { label: 'Nuevo nombre' });
  expect(changed.columns?.[0]).toEqual({ ...c.columns![0], label: 'Nuevo nombre' });
  expect(changed.rows).toBe(c.rows); expect(changed.reglas).toBe(c.reglas);
  expect(moveColumn(changed, 0, 2).columns?.map(col => col.id)).toEqual(['s', 'new', 't']);
  expect(moveColumn(c, 0, -1)).toBe(c);
});
test('eliminar columna limpia valores y referencias de reglas, mantiene extensiones', () => {
  const c = fresh(), changed = removeColumn(c, 't');
  expect(changed.columns?.map(col => col.id)).toEqual(['s']);
  expect(changed.rows?.[0]).toEqual({ id: 'a', extra: { conservar: true }, values: { s: 1, desconocida: { x: 1 } } });
  expect(changed.reglas).toEqual([{ ...c.reglas![0], condiciones: [c.reglas![0].condiciones![1]] }]);
  expect(changed.extension).toBe(c.extension); expect(c).toEqual(fixture);
  expect(removeColumn(c, 's').reglas).toHaveLength(1); expect(removeColumn(c, 'missing')).toBe(c);
});
test('reducir estados conserva extensiones y reinicia índices fuera de rango', () => {
  const c = fresh();
  const changed = editColumn(c, 's', { states: [{ ...c.columns![1].states![0], value: 'Nueva' }] });
  expect(changed.rows?.[0].values.s).toBe(0); expect(changed.rows?.[0].extra).toEqual({ conservar: true });
  expect(changed.columns?.[1].states?.[0]).toMatchObject({ icon: 'custom', extension: true });
  expect(changed.rows?.[1]).toBe(c.rows?.[1]); expect(changed.reglas).toBe(c.reglas);
});
test('mover filas conserva valores, reglas y campos extras; límites no cambian nada', () => {
  const c = fresh(), changed = moveRow(c, 0, 1);
  expect(changed.rows).toEqual([c.rows![1], c.rows![0]]); expect(changed.reglas).toBe(c.reglas);
  expect(moveRow(c, 0, 0)).toBe(c); expect(moveRow(c, 0, 5)).toBe(c);
});
test.each(['texto', 'estado-ciclico', 'select', 'checkbox', 'fecha', 'badge', 'enlace'] as const)('crea el tipo legacy %s', type => { expect(createColumn('id', type)).toMatchObject({ id: 'id', type }); });
test('nombres de tipo solo salen de la lista blanca', () => { expect(typeLabel('__proto__')).toBe('Texto'); expect(typeLabel('estado-ciclico')).toBe('Estado cíclico'); });

describe('pegado de Excel', () => {
  test('TSV conserva vacíos, saltos internos y comillas escapadas', () => {
    expect(parseTSV('a\tb\r\nc\t\r\n')).toEqual([['a', 'b'], ['c', '']]);
    expect(parseTSV('"a\tb"\t"dos\nlineas"\n"una ""cita"""\t')).toEqual([['a\tb', 'dos\nlineas'], ['una "cita"', '']]);
    expect(parseTSV('')).toEqual([['']]); expect(parseTSV('\n\n')).toEqual([[''], ['']]);
  });
  test.each([['sí', true], ['TRUE', true], ['x', true], ['1', true], ['no', false], ['', false]])('casilla %s', (text, expected) => { expect(coerceCell(createColumn('c', 'checkbox'), text as string)).toBe(expected); });
  test('convierte estados e insignias a índices, listas a sus opciones y fecha a ISO', () => {
    expect(coerceCell(createColumn('c', 'estado-ciclico'), 'no')).toBe(1);
    expect(coerceCell(createColumn('c', 'badge'), 'Baja')).toBe(2);
    expect(coerceCell(createColumn('c', 'badge'), '1')).toBe(1);
    expect(coerceCell(createColumn('c', 'badge'), '999')).toBe(0);
    expect(coerceCell(createColumn('c', 'select'), 'opción 2')).toBe('Opción 2');
    expect(coerceCell(createColumn('c', 'select'), 'otra')).toBe('');
    for (const date of ['2026-02-30', '31/02/2026', 'hoy']) expect(coerceCell(createColumn('c', 'fecha'), date)).toBe('');
    expect(coerceCell(createColumn('c', 'fecha'), '5/2/2026')).toBe('2026-02-05');
    expect(coerceCell(createColumn('c', 'fecha'), '2026-11-19')).toBe('2026-11-19');
    expect(coerceCell(createColumn('c', 'enlace'), 'javascript:alert(1)')).toBe('javascript:alert(1)');
    expect(coerceCell(createColumn('c', 'texto'), '  texto  ')).toBe('  texto  ');
  });
  test('rango rectangular extiende filas, respeta offset y limita a columnas existentes', () => {
    const c = fresh(); let id = 0;
    const next = pasteRange(c, 1, 1, 'Alta\tignorada\nBaja\nAlta\n', () => `new${id++}`);
    expect(next.rows).toHaveLength(4); expect(next.rows?.map(r => r.values.s)).toEqual([1, 0, 1, 0]);
    expect(next.rows?.[0]).toBe(c.rows?.[0]); expect(next.rows?.[1].values.t).toBe('Dos');
    expect(next.rows?.[2]).toEqual({ id: 'new0', values: { t: '', s: 1 } });
    expect(next.reglas).toBe(c.reglas); expect(c).toEqual(fixture);
    expect(pasteRange(c, -1, 0, 'x', () => '')).toBe(c); expect(pasteRange(c, 0, 2, 'x', () => '')).toBe(c);
  });
});
test('historial deshace todo el pegado/estructura/título y descarta rehacer tras nueva edición', () => {
  const original = { titulo: 'Tabla', contenido: fresh() };
  let h = history(original);
  const pasted = { ...original, contenido: pasteRange(original.contenido, 0, 0, 'A\tAlta\nB\tBaja', () => 'new') };
  h = push(h, pasted); expect(undo(h).present).toBe(original); expect(redo(undo(h)).present).toBe(pasted);
  h = push(h, { ...pasted, titulo: 'Renombrado' }); expect(undo(h).present.titulo).toBe('Tabla');
  expect(push(undo(h), original).future).toEqual([]); expect(push(h, h.present)).toBe(h);
  for (let i = 0; i < 200; i++) h = push(h, { ...h.present, titulo: String(i) });
  expect(h.past).toHaveLength(100); expect(undo(history(original)).present).toBe(original);
});
test('payload de actualización solo permite contenido, updated_at y título al renombrar', () => {
  const doc = { titulo: 'Tabla', contenido: fresh() };
  expect(updatePayload(doc, 'Tabla', 'now')).toEqual({ contenido: doc.contenido, updated_at: 'now' });
  expect(updatePayload({ ...doc, titulo: 'Nueva' }, 'Tabla', 'now')).toEqual({ contenido: doc.contenido, updated_at: 'now', titulo: 'Nueva' });
  expect(updatePayload(doc, 'Tabla', 'now')).not.toHaveProperty('estado');
});
test('2000 filas: el historial comparte datos intactos al editar una celda', () => {
  const rows = Array.from({ length: 2000 }, (_, i) => ({ id: String(i), values: { t: 'Original' } }));
  const c = { ...fixture, rows };
  const edited = setCell(c, '1999', 't', 'Cambio');
  expect(edited.rows?.filter((r, i) => r === rows[i])).toHaveLength(1999);
  expect(undo(push(history(c), edited)).present).toBe(c);
});
