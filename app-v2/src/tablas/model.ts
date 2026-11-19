// El documento ES el JSON legacy. No se migra ni se rellenan claves al cargar.
// Cada operación copia únicamente los objetos que modifica (historial con referencias compartidas).
export interface State { value?: string; icon?: string; bg?: string; color?: string; [key: string]: unknown }
export interface Column { id: string; type: string; label?: string; align?: string; headerColor?: string; headerTextColor?: string; states?: State[]; opciones?: string[]; [key: string]: unknown }
export interface Row { id: string; values: Record<string, unknown>; [key: string]: unknown }
export interface Condition { colId: string; comparador: string; valor?: unknown; [key: string]: unknown }
export interface Rule { id?: string; prioridad?: number; alcance?: string; colId?: string | null; logica?: string; condiciones?: Condition[]; colorFondo?: string; colorTexto?: string; [key: string]: unknown }
export interface Contenido { columns?: Column[]; rows?: Row[]; reglas?: Rule[]; [key: string]: unknown }
export interface Document { titulo: string; contenido: Contenido }

export const TYPE_LABELS = { texto: 'Texto', 'estado-ciclico': 'Estado cíclico', select: 'Lista desplegable', checkbox: 'Casilla', fecha: 'Fecha', badge: 'Insignia', enlace: 'Enlace' } as const;
export type ColumnType = keyof typeof TYPE_LABELS;
export function typeLabel(type: string) { return Object.prototype.hasOwnProperty.call(TYPE_LABELS, type) ? TYPE_LABELS[type as ColumnType] : 'Texto'; }

function record(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
export function loadContenido(v: unknown): Contenido {
  if (!record(v)) throw new Error('El contenido de esta tabla no tiene un formato compatible.');
  if (v.columns !== undefined && (!Array.isArray(v.columns) || !v.columns.every(c => record(c) && typeof c.id === 'string' && typeof c.type === 'string'))) throw new Error('Columnas no compatibles.');
  if (Array.isArray(v.columns) && v.columns.some(c => (c.label !== undefined && typeof c.label !== 'string') || (c.opciones !== undefined && (!Array.isArray(c.opciones) || !c.opciones.every((o: unknown) => typeof o === 'string'))) || (c.states !== undefined && (!Array.isArray(c.states) || !c.states.every((s: unknown) => record(s) && (s.value === undefined || typeof s.value === 'string')))))) throw new Error('Configuración de columnas no compatible.');
  if (v.rows !== undefined && (!Array.isArray(v.rows) || !v.rows.every(r => record(r) && typeof r.id === 'string' && record(r.values)))) throw new Error('Filas no compatibles.');
  if (v.reglas !== undefined && (!Array.isArray(v.reglas) || !v.reglas.every(r => record(r) && (r.condiciones === undefined || (Array.isArray(r.condiciones) && r.condiciones.every(record)))))) throw new Error('Reglas no compatibles.');
  // También detecta IDs duplicados: react-data-grid requiere claves únicas.
  for (const list of [v.columns, v.rows]) if (Array.isArray(list) && new Set(list.map(x => x.id)).size !== list.length) throw new Error('Hay identificadores duplicados en la tabla.');
  return v as Contenido;
}
export function saveContenido(c: Contenido): Contenido { return c; }
export function updatePayload(doc: Document, originalTitle: string, now: string) {
  return { contenido: saveContenido(doc.contenido), updated_at: now, ...(doc.titulo !== originalTitle ? { titulo: doc.titulo } : {}) };
}

export function setCell(c: Contenido, rowId: string, colId: string, value: unknown): Contenido {
  if (!(c.columns ?? []).some(col => col.id === colId)) return c;
  const row = c.rows?.find(r => r.id === rowId);
  if (!row || Object.is(row.values[colId], value)) return c;
  return { ...c, rows: c.rows!.map(r => r === row ? { ...r, values: { ...r.values, [colId]: value } } : r) };
}
export function defaultValue(col: Column) { return col.type === 'checkbox' ? false : col.type === 'badge' || col.type === 'estado-ciclico' ? 0 : ''; }
export function addRow(c: Contenido, id: string): Contenido {
  return { ...c, rows: [...c.rows ?? [], { id, values: Object.fromEntries((c.columns ?? []).map(col => [col.id, defaultValue(col)])) }] };
}
export function removeRow(c: Contenido, id: string): Contenido { return c.rows?.some(r => r.id === id) ? { ...c, rows: c.rows.filter(r => r.id !== id) } : c; }
export function createColumn(id: string, type: ColumnType): Column {
  const col: Column = { id, type, label: typeLabel(type), align: ['checkbox', 'estado-ciclico', 'badge'].includes(type) ? 'center' : 'left', headerColor: '#1B3A4B', headerTextColor: '#ffffff' };
  if (type === 'select') col.opciones = ['Opción 1', 'Opción 2'];
  if (type === 'badge' || type === 'estado-ciclico') col.states = (type === 'badge' ? ['Alta', 'Media', 'Baja'] : ['Sí', 'No', '—']).map(value => ({ value, icon: '', bg: '#F1F5F9', color: '#334155' }));
  return col;
}
export function addColumn(c: Contenido, column: Column): Contenido { return { ...c, columns: [...c.columns ?? [], column] }; }
export function editColumn(c: Contenido, id: string, patch: Partial<Column>): Contenido {
  const states = patch.states;
  return {
    ...c, columns: (c.columns ?? []).map(col => col.id === id ? { ...col, ...patch, id } : col),
    ...(states && c.rows && { rows: c.rows.map(row => Number(row.values[id] || 0) >= states.length ? { ...row, values: { ...row.values, [id]: 0 } } : row) }),
  };
}
export function removeColumn(c: Contenido, id: string): Contenido {
  if (!c.columns?.some(col => col.id === id)) return c;
  return {
    ...c, columns: c.columns.filter(col => col.id !== id),
    ...(c.rows && { rows: c.rows.map(row => { const values = { ...row.values }; delete values[id]; return { ...row, values }; }) }),
    ...(c.reglas && { reglas: c.reglas.map(rule => ({ ...rule, condiciones: (rule.condiciones ?? []).filter(cond => cond.colId !== id) })).filter(rule => !(rule.alcance === 'celda' && rule.colId === id) && rule.condiciones.length > 0) }),
  };
}
function move<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return items;
  const next = items.slice(); next.splice(to, 0, next.splice(from, 1)[0]); return next;
}
export function moveRow(c: Contenido, from: number, to: number): Contenido { const rows = move(c.rows ?? [], from, to); return rows === c.rows ? c : { ...c, rows }; }
export function moveColumn(c: Contenido, from: number, to: number): Contenido { const columns = move(c.columns ?? [], from, to); return columns === c.columns ? c : { ...c, columns }; }

// TSV de Excel: comillas dobles, tabuladores y saltos de línea dentro de celdas.
export function parseTSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  const input = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"' && (quoted || cell === '')) {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && (ch === '\t' || ch === '\n')) {
      row.push(cell); cell = '';
      if (ch === '\n') { rows.push(row); row = []; }
    } else cell += ch;
  }
  if (cell !== '' || row.length || !rows.length || !input.endsWith('\n')) { row.push(cell); rows.push(row); }
  return rows;
}
export function coerceCell(col: Column, text: string): unknown {
  const value = text.trim();
  if (col.type === 'checkbox') return /^(true|1|sí|si|yes|x|☑)$/i.test(value);
  if (col.type === 'badge' || col.type === 'estado-ciclico') {
    const idx = (col.states ?? []).findIndex(st => (st.value ?? '').toLocaleLowerCase() === value.toLocaleLowerCase());
    if (idx >= 0) return idx;
    const n = Number(value); return /^\d+$/.test(value) && n < (col.states?.length ?? 0) ? n : 0;
  }
  if (col.type === 'select') return (col.opciones ?? []).find(o => o.toLocaleLowerCase() === value.toLocaleLowerCase()) ?? '';
  if (col.type === 'fecha') {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const eu = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
    const date = iso ? value : eu ? `${eu[3]}-${eu[2].padStart(2, '0')}-${eu[1].padStart(2, '0')}` : '';
    return date && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date : '';
  }
  return text;
}
export function pasteRange(c: Contenido, startRow: number, startColumn: number, text: string, makeId: () => string): Contenido {
  const columns = c.columns ?? [];
  if (startRow < 0 || startRow > (c.rows?.length ?? 0) || startColumn < 0 || startColumn >= columns.length) return c;
  const range = parseTSV(text), rows = [...c.rows ?? []];
  for (let i = 0; i < range.length; i++) {
    const at = startRow + i;
    const row = rows[at] ?? { id: makeId(), values: Object.fromEntries(columns.map(col => [col.id, defaultValue(col)])) };
    const values = { ...row.values };
    range[i].forEach((value, offset) => { const col = columns[startColumn + offset]; if (col) values[col.id] = coerceCell(col, value); });
    rows[at] = { ...row, values };
  }
  return { ...c, rows };
}

export interface History<T> { past: T[]; present: T; future: T[] }
export function history<T>(present: T): History<T> { return { past: [], present, future: [] }; }
export function push<T>(h: History<T>, present: T): History<T> { return present === h.present ? h : { past: [...h.past, h.present].slice(-100), present, future: [] }; }
export function undo<T>(h: History<T>): History<T> { return h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h; }
export function redo<T>(h: History<T>): History<T> { return h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h; }
