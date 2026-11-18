import { useCallback, useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { applyPrefs, DEFAULT_PREFS, sanitizePrefs, type Prefs } from './theme';

const LS_KEY = 'manualia-v2-prefs';

function readLocal(): Prefs {
  try { return sanitizePrefs(JSON.parse(localStorage.getItem(LS_KEY) ?? 'null')); } catch { return DEFAULT_PREFS; }
}
function writeLocal(p: Prefs) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* navegador sin almacenamiento */ }
}

// Tema del espacio de trabajo. Se aplica al instante desde localStorage (sin parpadeo) y,
// si hay sesión, se sincroniza con la tabla user_prefs, que manda sobre la copia local.
export function useThemePrefs(userId: string | null) {
  const [prefs, setPrefs] = useState<Prefs>(readLocal);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => { applyPrefs(prefs, systemDark); }, [prefs, systemDark]);

  useEffect(() => {
    if (!userId) return;
    let cancel = false;
    sb.from('user_prefs').select('estilo,modo').eq('user_id', userId).maybeSingle().then(({ data, error }) => {
      if (cancel || error || !data) return; // sin fila o tabla aún no creada: se queda la copia local
      const p = sanitizePrefs(data);
      setPrefs(p);
      writeLocal(p);
    });
    return () => { cancel = true; };
  }, [userId]);

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = sanitizePrefs({ ...prev, ...patch });
      writeLocal(next);
      if (userId) {
        void sb.from('user_prefs')
          .upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() })
          .then(({ error }) => { if (error) console.warn('No se pudo guardar el tema en el perfil:', error.message); });
      }
      return next;
    });
  }, [userId]);

  return { prefs, update };
}
