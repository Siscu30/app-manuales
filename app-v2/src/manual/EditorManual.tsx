import { useEffect, useMemo, useRef, useState } from 'react';
import { filterSuggestionItems } from '@blocknote/core';
import { es } from '@blocknote/core/locales';
import { SuggestionMenuController, getDefaultReactSlashMenuItems, useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { sb } from '../lib/supabase';
import { estadoInfo } from '../lib/estado';
import { isContenidoV2, legacyToV2, type ContenidoV2, type V2Block } from './convert';
import { customSlashItems, schema, type ManualEditor } from './schema';
import { DEMO_MANUAL } from './demo';

interface Props { id: string; demo: boolean; canWrite: boolean; mode: 'light' | 'dark'; onBack: () => void }
interface Loaded { titulo: string; estado: string | null; doc: ContenidoV2; fromV2: boolean }

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export function EditorManual({ id, demo, canWrite, mode, onBack }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (demo) { setLoaded({ titulo: 'Central AX PRO: instalación', estado: 'publicado', doc: legacyToV2(DEMO_MANUAL), fromV2: false }); return; }
    sb.from('manuales').select('titulo,estado,contenido,contenido_v2').eq('id', id).single().then(({ data, error }) => {
      if (error || !data) { setError('No se pudo abrir el manual. Comprueba la conexión y vuelve a intentarlo.'); return; }
      const fromV2 = isContenidoV2(data.contenido_v2);
      // Si no hay versión nueva, se convierte el contenido antiguo SIN modificarlo en la base de datos.
      setLoaded({ titulo: data.titulo ?? 'Sin título', estado: data.estado, doc: fromV2 ? data.contenido_v2 : legacyToV2(data.contenido), fromV2 });
    });
  }, [id, demo]);

  if (error) return <main className="main"><p className="form-error" role="alert">{error}</p><button className="btn ghost" onClick={onBack}>Volver a Mis manuales</button></main>;
  if (!loaded) return <main className="main"><p className="muted">Abriendo el manual…</p></main>;
  return <EditorCargado id={id} demo={demo} canWrite={canWrite} mode={mode} onBack={onBack} loaded={loaded} />;
}

function EditorCargado({ id, demo, canWrite, mode, onBack, loaded }: Props & { loaded: Loaded }) {
  const editor = useCreateBlockNote({
    schema,
    dictionary: es,
    initialContent: loaded.doc.blocks.length ? (loaded.doc.blocks as never) : undefined,
  }) as ManualEditor;

  const [save, setSave] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const chain = useRef<Promise<void>>(Promise.resolve()); // guardados en serie: nunca dos a la vez
  const st = estadoInfo(loaded.estado);

  const persist = useMemo(() => () => {
    chain.current = chain.current.then(async () => {
      setSave('saving');
      const contenido_v2: ContenidoV2 = { ...loaded.doc, blocks: editor.document as unknown as V2Block[] };
      if (demo) { await new Promise((r) => setTimeout(r, 300)); setSave('saved'); setSavedAt(new Date()); return; }
      // Solo se escribe contenido_v2: `contenido` (formato antiguo) y `estado` no se tocan.
      const { error } = await sb.from('manuales').update({ contenido_v2, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) { setSave('error'); return; }
      setSave('saved'); setSavedAt(new Date());
    });
  }, [editor, id, demo, loaded.doc]);

  useEffect(() => {
    const flush = (e: BeforeUnloadEvent) => { if (timer.current) { e.preventDefault(); } };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, []);

  function onChange() {
    if (!canWrite) return;
    setSave('pending');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { timer.current = undefined; persist(); }, 1200);
  }

  const status = {
    idle: loaded.fromV2 ? 'Sin cambios' : 'Convertido desde la app actual. Se guardará como versión nueva al editar.',
    pending: 'Cambios sin guardar…',
    saving: 'Guardando…',
    saved: savedAt ? `Guardado a las ${savedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : 'Guardado',
    error: 'No se pudo guardar. Revisa la conexión; reintentaremos con el próximo cambio.',
  }[save];

  return (
    <main className="main editor-main">
      <header className="bar">
        <div className="editor-head">
          <button className="btn ghost" onClick={() => { if (timer.current) { window.clearTimeout(timer.current); timer.current = undefined; persist(); } onBack(); }}>Mis manuales</button>
          <h1>{loaded.titulo}</h1>
          <span className={`pill ${st.tono}`}>{st.label}</span>
        </div>
        <p className={`save-status s-${save}`} role="status" aria-live="polite">{canWrite ? status : 'Solo lectura: tu rol no permite editar.'}</p>
      </header>
      <div className="doc-sheet">
        <BlockNoteView editor={editor} editable={canWrite} theme={mode} onChange={onChange} slashMenu={false} className="bn-manual">
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (q) => filterSuggestionItems([...customSlashItems(editor), ...getDefaultReactSlashMenuItems(editor)], q)}
          />
        </BlockNoteView>
      </div>
    </main>
  );
}
