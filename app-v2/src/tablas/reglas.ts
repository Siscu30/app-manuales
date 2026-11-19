// Port del motor de app.js: mismas comparaciones, prioridades y valores de retorno.
import type { Column, Contenido, Row } from "./model";

export function _tiSafeUrl(url: unknown) {
  const v = String(url || '').trim();
  if (!v) return '';
  if (/^\s*(javascript|data|vbscript):/i.test(v)) return '';
  return v;
}

export function _tiSafeHexColor(hex: unknown, fallback?: string) {
  const v = String(hex || '').trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : (fallback || '#2563EB');
}

export function _tiCellCompareValue(col: Column, row: Pick<Row, "values">) {
  const val = row.values[col.id];
  if (col.type === 'estado-ciclico' || col.type === 'badge') {
    const idx = (val || 0) as number;
    const st = col.states && col.states[idx];
    return st ? (st.value || '') : '';
  }
  if (col.type === 'checkbox') return val ? 'true' : 'false';
  return val == null ? '' : val;
}

export function _tiCompare(comparador: string, actual: unknown, valor: unknown) {
  const a = actual == null ? '' : actual;
  const v = valor == null ? '' : valor;
  // Fechas ISO (YYYY-MM-DD, lo que produce <input type=date>) parsean con parseFloat
  // como solo el año (corta en el primer '-'), lo que hace que fechas distintas del
  // mismo año comparen como iguales. Para esas, la comparación de texto ya es correcta
  // (orden lexicográfico ISO == orden cronológico), así que se excluyen del atajo numérico.
  const isDateLike = (s: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(s));
  const av = parseFloat(String(a)), vv = parseFloat(String(v));
  const bothNumeric = !isDateLike(a) && !isDateLike(v) && !isNaN(av) && !isNaN(vv) && a !== '' && v !== '';
  switch (comparador) {
    case '=': return String(a).toLowerCase() === String(v).toLowerCase();
    case '!=': return String(a).toLowerCase() !== String(v).toLowerCase();
    case 'contiene': return String(a).toLowerCase().indexOf(String(v).toLowerCase()) !== -1;
    case '>': return bothNumeric ? av > vv : String(a) > String(v);
    case '<': return bothNumeric ? av < vv : String(a) < String(v);
    case 'vacio': return a === '';
    case 'novacio': return a !== '';
    default: return false;
  }
}

export function evaluarCeldaColor(contenido: Contenido, rowId: string, colId: string) {
  const row = (contenido.rows || []).find(r => r.id === rowId);
  if (!row) return null;
  const cols = contenido.columns || [];
  const reglas = (contenido.reglas || []).slice().sort((a, b) => (a.prioridad || 0) - (b.prioridad || 0));
  for (const regla of reglas) {
    if (regla.alcance === 'celda' && regla.colId !== colId) continue;
    const conds = regla.condiciones || [];
    if (!conds.length) continue;
    const results = conds.map(c => {
      const col = cols.find(x => x.id === c.colId);
      return col ? _tiCompare(c.comparador, _tiCellCompareValue(col, row), c.valor) : false;
    });
    const isMatch = regla.logica === 'OR' ? results.some(Boolean) : results.every(Boolean);
    if (isMatch) return { colorFondo: regla.colorFondo, colorTexto: regla.colorTexto };
  }
  return null;
}

export function evaluarFilaColor(contenido: Contenido, rowId: string) {
  const row = (contenido.rows || []).find(r => r.id === rowId);
  if (!row) return null;
  const cols = contenido.columns || [];
  const reglas = (contenido.reglas || []).slice().sort((a, b) => (a.prioridad || 0) - (b.prioridad || 0));
  for (const regla of reglas) {
    if (regla.alcance !== 'fila') continue;
    const conds = regla.condiciones || [];
    if (!conds.length) continue;
    const results = conds.map(c => {
      const col = cols.find(x => x.id === c.colId);
      return col ? _tiCompare(c.comparador, _tiCellCompareValue(col, row), c.valor) : false;
    });
    const isMatch = regla.logica === 'OR' ? results.some(Boolean) : results.every(Boolean);
    if (isMatch) return { colorFondo: regla.colorFondo, colorTexto: regla.colorTexto };
  }
  return null;
}
