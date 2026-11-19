import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { DataGrid, type Column as GridColumn, type RenderEditCellContentProps } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { sb } from '../lib/supabase';
import { estadoInfo } from '../lib/estado';
import { addColumn, addRow, createColumn, editColumn, history, loadContenido, moveColumn, moveRow, pasteRange, push, redo, removeColumn, removeRow, setCell, TYPE_LABELS, typeLabel, undo, type Column, type ColumnType, type Contenido, type Document, type Row } from './model';
import { evaluarCeldaColor, evaluarFilaColor, _tiCellCompareValue } from './reglas';
import { colorStyle, safeHex, safeUrl } from './safety';
import { Autosave, type SaveStatus } from './autosave';
import { demoContenido } from './demo';
import './tablas.css';

interface Props { id: string; demo: boolean; canWrite: boolean; registerGuard: (guard: (() => Promise<boolean>) | null) => void }
interface Loaded { doc: Document; estado: string | null }
const makeId = () => crypto.randomUUID();
const rowKey = (row: Row) => row.id;

export function EditorTabla(props: Props) {
  const { id, demo } = props;
  const [loaded, setLoaded] = useState<Loaded | null>(null), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (demo) { setLoaded({ doc: { titulo: 'Revisión de equipos', contenido: demoContenido(new URLSearchParams(location.search).get('rows') === '2000' ? 2000 : 12) }, estado: 'borrador' }); return; }
    sb.from('tablas_interactivas').select('titulo,estado,contenido').eq('id', id).single().then(({ data, error }) => {
      if (!active) return;
      if (error || !data) { setError('No se pudo abrir la tabla. Comprueba la conexión y vuelve a intentarlo.'); return; }
      try { setLoaded({ doc: { titulo: data.titulo ?? '', contenido: loadContenido(data.contenido) }, estado: data.estado }); }
      catch (err) { setError(err instanceof Error ? err.message : 'Formato no compatible.'); }
    });
    return () => { active = false; };
  }, [id, demo]);
  if (error) return <main className="main"><a href="#tablas">Volver a Tablas</a><p className="form-error" role="alert">{error}</p></main>;
  if (!loaded) return <main className="main"><p role="status">Abriendo la tabla…</p></main>;
  return <LoadedEditor {...props} loaded={loaded} />;
}

function LoadedEditor({ id, demo, canWrite, registerGuard, loaded }: Props & { loaded: Loaded }) {
  const [h, setHistory] = useState(() => history(loaded.doc));
  const historyRef = useRef(h), allowed = useRef(canWrite), mounted = useRef(true);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [position, setPosition] = useState({ rowIdx: -1, idx: -1 });
  const [newType, setNewType] = useState<ColumnType>('texto');
  const [savingBack, setSavingBack] = useState(false);
  const [autosave] = useState(() => new Autosave(loaded.doc.titulo, async payload => {
    if (demo) return;
    // Escritura aditiva: nunca estado, color, autor ni otras columnas de la tabla.
    const { error } = await sb.from('tablas_interactivas').update(payload).eq('id', id);
    if (error) throw error;
  }, () => allowed.current, next => { if (mounted.current) setStatus(next); }));
  useLayoutEffect(() => { allowed.current = canWrite; }, [canWrite]);
  useEffect(() => {
    mounted.current = true;
    registerGuard(() => autosave.settle());
    const beforeUnload = (event: BeforeUnloadEvent) => { if (autosave.dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      mounted.current = false; registerGuard(null); window.removeEventListener('beforeunload', beforeUnload);
      autosave.cancelTimer(); void autosave.flush();
    };
  }, [autosave, registerGuard]);

  const apply = useCallback((op: (doc: Document) => Document, direction?: 'undo' | 'redo') => {
    if (!allowed.current) return;
    const previous = historyRef.current;
    const next = direction === 'undo' ? undo(previous) : direction === 'redo' ? redo(previous) : push(previous, op(previous.present));
    if (next === previous) return;
    historyRef.current = next; setHistory(next); autosave.change(next.present);
  }, [autosave]);
  const edit = useCallback((op: (c: Contenido) => Contenido) => apply(doc => {
    const contenido = op(doc.contenido); return contenido === doc.contenido ? doc : { ...doc, contenido };
  }), [apply]);
  const doc = h.present, contenido = doc.contenido, cols = contenido.columns ?? [], rows = contenido.rows ?? [];
  const selectedColumn = cols[position.idx], selectedRow = rows[position.rowIdx];

  const gridColumns = useMemo<GridColumn<Row>[]>(() => (contenido.columns ?? []).map(col => ({
    key: col.id, name: col.label || 'Columna', width: 180, minWidth: 100, resizable: true, draggable: canWrite, editable: canWrite,
    cellClass: 'ti-grid-cell', headerCellClass: 'ti-grid-header',
    renderHeaderCell: () => <div className="ti-header" style={colorStyle(col.headerColor, col.headerTextColor)}><strong>{col.label || 'Columna'}</strong><small>{typeLabel(col.type)}</small></div>,
    renderCell: ({ row, tabIndex }) => {
      // Solo la fila actual: evita búsquedas lineales entre miles de filas por cada celda visible.
      const context = { ...contenido, rows: [row] };
      const rule = evaluarCeldaColor(context, row.id, col.id), accent = evaluarFilaColor(context, row.id);
      const state = col.type === 'badge' || col.type === 'estado-ciclico' ? col.states?.[(row.values[col.id] || 0) as number] : undefined;
      const style: CSSProperties = {
        ...colorStyle(rule?.colorFondo ?? state?.bg, rule?.colorTexto ?? state?.color),
        textAlign: col.align === 'center' || col.align === 'right' ? col.align : 'left',
        borderInlineStartColor: safeHex(accent?.colorTexto) ?? safeHex(accent?.colorFondo),
      };
      const value = String(_tiCellCompareValue(col, row) ?? '');
      const url = col.type === 'enlace' ? safeUrl(row.values[col.id]) : '';
      return <div className="ti-cell-content" style={style}>
        {col.type === 'checkbox' ? <input type="checkbox" aria-label={col.label || 'Casilla'} tabIndex={tabIndex} checked={!!row.values[col.id]} disabled={!canWrite} onChange={e => edit(c => setCell(c, row.id, col.id, e.target.checked))} />
          : col.type === 'estado-ciclico' ? <button className="ti-cycle" tabIndex={tabIndex} disabled={!canWrite || !col.states?.length} title="Pasar al siguiente estado" onClick={() => edit(c => setCell(c, row.id, col.id, (Number(row.values[col.id] || 0) + 1) % (col.states?.length || 1)))}>{value || '—'}</button>
            : <span>{value}</span>}
        {url && <a className="ti-open-link" tabIndex={tabIndex} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir enlace ${col.label || ''}`}>↗</a>}
        {col.type === 'enlace' && value && !url && <span className="ti-blocked" title="Solo se permiten enlaces http, https o mailto"> (enlace bloqueado)</span>}
      </div>;
    },
    renderEditCell: p => <CellEditor {...p} col={col} />,
  })), [contenido, canWrite, edit]);

  const st = estadoInfo(loaded.estado);
  const statusText = { idle: 'Sin cambios', pending: 'Cambios sin guardar…', saving: 'Guardando…', saved: demo ? 'Guardado en la demo (sin conexión)' : 'Guardado', error: 'No se pudo guardar. Conservamos los cambios en esta pantalla.' }[status];
  return <main className="main ti-main" onKeyDown={e => {
    if (!canWrite || !(e.ctrlKey || e.metaKey) || e.altKey || (e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable="true"]'))) return;
    const key = e.key.toLowerCase();
    if (key === 'z' || key === 'y') { e.preventDefault(); apply(d => d, key === 'y' || e.shiftKey ? 'redo' : 'undo'); }
  }}>
    <header className="bar">
      <div className="editor-head"><button className="btn ghost" disabled={savingBack} onClick={async () => { setSavingBack(true); const ok = await autosave.settle(); setSavingBack(false); if (ok) location.hash = 'tablas'; }}>Tablas</button><h1>{doc.titulo || 'Sin título'}</h1><span className={`pill ${st.tono}`}>{st.label}</span></div>
      <div className="row"><p className={`save-status s-${status}`} role="status">{canWrite ? statusText : 'Solo lectura: tu rol no permite editar.'}</p>{status === 'error' && canWrite && <button className="btn ghost" onClick={() => void autosave.flush()}>Reintentar guardado</button>}</div>
    </header>
    {demo && <p className="ti-demo">Demostración local · URL y color maliciosos en la primera fila y cabecera. <a href="?demo&rows=2000#tabla-demo">Probar 2000 filas</a></p>}
    <div className="ti-toolbar" role="group" aria-label="Edición de tabla">
      <label>Título <input aria-label="Título de la tabla" value={doc.titulo} readOnly={!canWrite} onChange={e => apply(d => ({ ...d, titulo: e.target.value }))} /></label>
      <button className="btn ghost" disabled={!canWrite || !h.past.length} onClick={() => apply(d => d, 'undo')}>Deshacer</button>
      <button className="btn ghost" disabled={!canWrite || !h.future.length} onClick={() => apply(d => d, 'redo')}>Rehacer</button>
      <button className="btn" disabled={!canWrite} onClick={() => edit(c => addRow(c, makeId()))}>Añadir fila</button>
      <label>Tipo <select aria-label="Tipo de nueva columna" value={newType} disabled={!canWrite} onChange={e => setNewType(e.target.value as ColumnType)}>{Object.entries(TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <button className="btn ghost" disabled={!canWrite} onClick={() => edit(c => addColumn(c, createColumn(makeId(), newType)))}>Añadir columna</button>
    </div>
    <p id="ti-help" className="muted ti-help">Flechas y Tab para navegar · Enter o doble clic para editar · Esc para cancelar · Pega un rango de Excel desde una celda · Ctrl+Z / Ctrl+Y para deshacer y rehacer</p>
    <div onPasteCapture={e => {
        // Captura antes del editor interno: una sola transacción, incluidas filas nuevas.
        if (!canWrite || !selectedColumn || position.rowIdx < 0) return;
        const text = e.clipboardData.getData('text/plain');
        if (e.target instanceof Element && e.target.closest('input,textarea') && !/[\t\r\n]/.test(text)) return;
        e.preventDefault(); e.stopPropagation(); edit(c => pasteRange(c, position.rowIdx, position.idx, text, makeId));
      }}>
    <DataGrid<Row> className="ti-grid" aria-label="Tabla interactiva" aria-description="Flechas y Tab para navegar. Enter para editar, Escape para cancelar. Pega un rango de Excel. Ctrl+Z para deshacer y Ctrl+Y para rehacer." columns={gridColumns} rows={rows} getRowKey={rowKey} rowHeight={40} headerRowHeight={56}
      onRowsChange={next => edit(c => ({ ...c, rows: next }))}
      onActivePositionChange={p => setPosition({ rowIdx: p.rowIdx, idx: p.column?.idx ?? -1 })}
      onColumnsReorder={(source, target) => edit(c => moveColumn(c, cols.findIndex(col => col.id === source), cols.findIndex(col => col.id === target)))}
      onCellKeyDown={(args, event) => {
        if (!canWrite || args.mode !== 'ACTIVE' || !args.column) return;
        if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault(); event.preventGridDefault(); const col = cols[args.column.idx];
          edit(c => setCell(c, args.row.id, col.id, col.type === 'checkbox' ? false : ['badge', 'estado-ciclico'].includes(col.type) ? 0 : ''));
        }
      }}
    />
    </div>
    <div className="ti-selection" role="group" aria-label="Fila y columna seleccionadas">
      <span>{rows.length} filas · {cols.length} columnas · {contenido.reglas?.length ?? 0} reglas</span>
      {selectedRow && <><strong>Fila {position.rowIdx + 1}</strong><button className="btn ghost" disabled={!canWrite || position.rowIdx <= 0} onClick={() => { edit(c => moveRow(c, position.rowIdx, position.rowIdx - 1)); setPosition(p => ({ ...p, rowIdx: p.rowIdx - 1 })); }}>Subir fila</button><button className="btn ghost" disabled={!canWrite || position.rowIdx >= rows.length - 1} onClick={() => { edit(c => moveRow(c, position.rowIdx, position.rowIdx + 1)); setPosition(p => ({ ...p, rowIdx: p.rowIdx + 1 })); }}>Bajar fila</button><button className="btn ghost" disabled={!canWrite} onClick={() => edit(c => removeRow(c, selectedRow.id))}>Eliminar fila</button></>}
    </div>
    {selectedColumn && <section className="ti-column-config" aria-label="Configurar columna">
      <div className="row"><h2>{selectedColumn.label || 'Columna'}</h2><button className="btn ghost" disabled={!canWrite || position.idx <= 0} onClick={() => { edit(c => moveColumn(c, position.idx, position.idx - 1)); setPosition(p => ({ ...p, idx: p.idx - 1 })); }}>Mover a la izquierda</button><button className="btn ghost" disabled={!canWrite || position.idx >= cols.length - 1} onClick={() => { edit(c => moveColumn(c, position.idx, position.idx + 1)); setPosition(p => ({ ...p, idx: p.idx + 1 })); }}>Mover a la derecha</button><button className="btn ghost" disabled={!canWrite} onClick={() => edit(c => removeColumn(c, selectedColumn.id))}>Eliminar columna</button></div>
      <ColumnConfig key={selectedColumn.id} col={selectedColumn} canWrite={canWrite} onSave={patch => edit(c => editColumn(c, selectedColumn.id, patch))} />
    </section>}
  </main>;
}

function CellEditor({ col, row, onRowChange, onClose }: RenderEditCellContentProps<Row> & { col: Column }) {
  const ref = useRef<HTMLInputElement | HTMLSelectElement>(null);
  useEffect(() => { ref.current?.focus(); if (ref.current instanceof HTMLInputElement && ref.current.type === 'text') ref.current.select(); }, []);
  const change = (value: unknown, commit = false) => onRowChange({ ...row, values: { ...row.values, [col.id]: value } }, commit);
  const value = row.values[col.id];
  if (col.type === 'badge' || col.type === 'estado-ciclico' || col.type === 'select') {
    const indexed = col.type !== 'select';
    return <select ref={el => { ref.current = el; }} className="ti-input" aria-label={col.label || 'Valor'} value={String(value ?? (indexed ? 0 : ''))} onChange={e => change(indexed ? Number(e.target.value) : e.target.value, true)} onKeyDown={e => { if (e.key === 'Escape') onClose(false); }}>
      {!indexed && <option value="">—</option>}{indexed ? col.states?.map((s, i) => <option key={i} value={i}>{s.value}</option>) : col.opciones?.map((s, i) => <option key={i} value={s}>{s}</option>)}
    </select>;
  }
  return <input ref={el => { ref.current = el; }} className="ti-input" aria-label={col.label || 'Valor'} type={col.type === 'fecha' ? 'date' : col.type === 'checkbox' ? 'checkbox' : 'text'} value={col.type === 'checkbox' ? undefined : String(value ?? '')} checked={col.type === 'checkbox' ? !!value : undefined} onChange={e => change(col.type === 'checkbox' ? e.target.checked : e.target.value)} />;
}

function ColumnConfig({ col, canWrite, onSave }: { col: Column; canWrite: boolean; onSave: (patch: Partial<Column>) => void }) {
  const [label, setLabel] = useState(col.label ?? ''), [options, setOptions] = useState((col.type === 'select' ? col.opciones : col.states?.map(s => s.value ?? ''))?.join('\n') ?? '');
  useEffect(() => { setLabel(col.label ?? ''); setOptions((col.type === 'select' ? col.opciones : col.states?.map(s => s.value ?? ''))?.join('\n') ?? ''); }, [col]);
  const hasOptions = ['select', 'badge', 'estado-ciclico'].includes(col.type);
  return <form className="ti-column-form" onSubmit={e => {
    e.preventDefault(); if (!canWrite) return;
    const patch: Partial<Column> = { label };
    if (hasOptions) {
      const values = options.split('\n').filter(Boolean);
      if (!values.length) return;
      if (col.type === 'select') patch.opciones = values;
      else patch.states = values.map((value, i) => ({ ...col.states?.[i], value }));
    }
    onSave(patch);
  }}>
    <label>Nombre de columna <input value={label} readOnly={!canWrite} onChange={e => setLabel(e.target.value)} /></label>
    {hasOptions && <label>Opciones (una por línea)<textarea value={options} readOnly={!canWrite} onChange={e => setOptions(e.target.value)} /></label>}
    <button className="btn ghost" disabled={!canWrite}>Aplicar configuración</button>
  </form>;
}
