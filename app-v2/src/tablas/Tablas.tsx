import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { estadoInfo } from '../lib/estado';
import './tablas.css';

interface TableRow { id: string; titulo: string | null; estado: string | null; updated_at: string | null }
export function Tablas({ demo }: { demo: boolean }) {
  const [rows, setRows] = useState<TableRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (demo) { setRows([{ id: 'demo', titulo: 'Revisión de equipos', estado: 'borrador', updated_at: null }]); return; }
    sb.from('tablas_interactivas').select('id,titulo,estado,updated_at').neq('estado', 'papelera').order('updated_at', { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      if (error) setError('No se pudieron cargar las tablas. Recarga la página para reintentar.');
      else setRows(data ?? []);
    });
    return () => { active = false; };
  }, [demo]);
  return <main className="main">
    <header className="bar"><h1>Tablas</h1><a className="btn ghost" href="../index.html">Abrir la app actual</a></header>
    <p className="muted">Edita tus tablas compartidas. Los cambios se guardan automáticamente.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!rows && !error && <p role="status">Cargando tablas…</p>}
    {rows?.length === 0 && <div className="empty"><h2>Aún no hay tablas</h2><p>Crea una tabla en la app actual y podrás editarla aquí.</p></div>}
    <ul className="table-list">{rows?.map(row => {
      const state = estadoInfo(row.estado), date = row.updated_at ? new Date(row.updated_at) : null;
      return <li key={row.id}><a href={`#tabla-${encodeURIComponent(row.id)}`}><strong>{row.titulo || 'Sin título'}</strong><span className={`pill ${state.tono}`}>{state.label}</span><span className="muted">{date && !Number.isNaN(date.valueOf()) ? date.toLocaleDateString('es-ES') : 'Abrir tabla'}</span></a></li>;
    })}</ul>
  </main>;
}
