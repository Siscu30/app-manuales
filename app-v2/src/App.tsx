import { lazy, Suspense, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { motion } from 'motion/react';
import { sb } from './lib/supabase';
import { estadoInfo } from './lib/estado';
import { useThemePrefs } from './theme/useThemePrefs';
import { ThemePicker } from './components/ThemePicker';
import { Login } from './components/Login';

// El editor (BlockNote) pesa bastante: se descarga solo al abrir un manual.
const EditorManual = lazy(() => import('./manual/EditorManual').then((m) => ({ default: m.EditorManual })));

interface ManualRow { id: string; titulo: string | null; empresa: string | null; estado: string | null; updated_at: string | null }

// Modo demostración SOLO en desarrollo (?demo): datos de ejemplo, sin sesión ni red. Vite lo
// elimina de la compilación de producción porque import.meta.env.DEV es false.
const DEMO = import.meta.env.DEV && new URLSearchParams(location.search).has('demo');
const DEMO_ROWS: ManualRow[] = [
  { id: '1', titulo: 'Central AX PRO: instalación', empresa: 'Seguridad Norte', estado: 'publicado', updated_at: '2026-11-18T10:00:00Z' },
  { id: '2', titulo: 'Detector PIR exterior: ajuste de zona', empresa: 'Seguridad Norte', estado: 'en_revision', updated_at: '2026-11-17T09:00:00Z' },
  { id: '3', titulo: 'Cámara IP: alta en el NVR', empresa: null, estado: 'borrador', updated_at: '2026-11-15T12:00:00Z' },
  { id: '4', titulo: 'Checklist de puesta en marcha', empresa: 'Instalaciones Sur', estado: 'publicado', updated_at: '2026-11-04T08:00:00Z' },
  { id: '5', titulo: 'Mantenimiento anual de baterías', empresa: null, estado: 'x"><img src=x onerror=alert(1)>', updated_at: '2026-10-20T08:00:00Z' },
];

const fecha =new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const { prefs, update, mode } = useThemePrefs(DEMO ? null : session?.user.id ?? null);

  useEffect(() => {
    if (DEMO) { setSession({ user: { id: 'demo' } } as Session); return; }
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Rol solo desde el servidor (get_my_role). Sin rol o con error: solo lectura (restrictivo por defecto).
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    if (DEMO) { setRole('editor'); return; }
    if (!session) { setRole(null); return; }
    sb.rpc('get_my_role').then(({ data, error }) => setRole(error ? null : (data as string | null)));
  }, [session]);
  const canWrite = role === 'admin' || role === 'editor';

  // Ruta mínima por hash: #manual-<id> abre el editor; cualquier otro valor, la lista.
  const [route, setRoute] = useState(() => location.hash);
  useEffect(() => {
    const on = () => setRoute(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const manualId = route.startsWith('#manual-') ? decodeURIComponent(route.slice(8)) : null;

  if (session === undefined) return null;
  if (!session) return <Login />;

  return (
    <div className="shell">
      <nav className="side" aria-label="Secciones">
        <div className="logo"><i aria-hidden="true" />Manualia</div>
        <a className={`nav${manualId ? '' : ' on'}`} href="#manuales" aria-current={manualId ? undefined : 'page'}>Mis manuales</a>
        <a className="nav" href="../index.html">Tablas <small>en la app actual</small></a>
        <a className="nav" href="../index.html">Plantillas <small>próximamente</small></a>
        <div className="side-foot">
          <p className="side-label">Apariencia</p>
          <ThemePicker prefs={prefs} onChange={update} />
          <button className="btn ghost" onClick={() => sb.auth.signOut()}>Cerrar sesión</button>
        </div>
      </nav>
      {manualId
        ? (
          <Suspense fallback={<main className="main"><p className="muted">Cargando el editor…</p></main>}>
            <EditorManual key={manualId} id={manualId} demo={DEMO} canWrite={canWrite} mode={mode} onBack={() => { location.hash = 'manuales'; }} />
          </Suspense>
        )
        : <Inicio />}
    </div>
  );
}

function Inicio() {
  const [rows, setRows] = useState<ManualRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (DEMO) { setRows(DEMO_ROWS); return; }
    sb.from('manuales').select('id,titulo,empresa,estado,updated_at').order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError('No se pudieron cargar los manuales. Comprueba la conexión y recarga la página.');
        else setRows((data ?? []) as ManualRow[]);
      });
  }, []);

  return (
    <main className="main">
      <header className="bar">
        <h1>Mis manuales</h1>
        <div className="row">
          <a className="btn ghost" href="../index.html">Abrir la app actual</a>
          <PopButton>Nuevo manual</PopButton>
        </div>
      </header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {rows === null && !error && <p className="muted">Cargando manuales…</p>}
      {rows?.length === 0 && <div className="empty"><h2>Aún no hay manuales</h2><p className="muted">Crea el primero con «Nuevo manual» o importa un Word o PDF.</p></div>}
      {rows && rows.length > 0 && (
        <ul className="cards">
          {rows.map((m) => {
            const st = estadoInfo(m.estado);
            return (
              <li key={m.id} className="card">
                <div className="thumb" aria-hidden="true"><b /></div>
                <h2><a className="card-link" href={`#manual-${encodeURIComponent(m.id)}`}>{m.titulo || 'Sin título'}</a></h2>
                <span className={`pill ${st.tono}`}>{st.label}</span>
                <div className="meta">
                  {m.empresa && <span>{m.empresa}</span>}
                  {m.updated_at && <span>{fecha.format(new Date(m.updated_at))}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

// Botón principal con respuesta física: se hunde al pulsar y rebota al soltar (muelle corto).
function PopButton({ children }: { children: React.ReactNode }) {
  return (
    <motion.button className="btn" whileTap={{ scale: 0.94 }} whileHover={{ y: -1 }}
      transition={{ type: 'spring', stiffness: 600, damping: 22 }}>
      {children}
    </motion.button>
  );
}
