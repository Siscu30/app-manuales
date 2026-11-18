// Preferencias de tema: valores permitidos (lista blanca), resolución del modo automático y
// aplicación al documento. Nunca se escribe en el DOM un valor que no esté en la lista.
export const ESTILOS = ['obra', 'atlas', 'cuaderno'] as const;
export const MODOS = ['light', 'dark', 'auto'] as const;
export type Estilo = (typeof ESTILOS)[number];
export type Modo = (typeof MODOS)[number];
export interface Prefs { estilo: Estilo; modo: Modo }

export const DEFAULT_PREFS: Prefs = { estilo: 'obra', modo: 'auto' };
export const ESTILO_LABEL: Record<Estilo, string> = { obra: 'Obra', atlas: 'Atlas', cuaderno: 'Cuaderno' };
export const MODO_LABEL: Record<Modo, string> = { light: 'Claro', dark: 'Oscuro', auto: 'Automático' };

export function sanitizePrefs(raw: unknown): Prefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const estilo = ESTILOS.includes(r.estilo as Estilo) ? (r.estilo as Estilo) : DEFAULT_PREFS.estilo;
  const modo = MODOS.includes(r.modo as Modo) ? (r.modo as Modo) : DEFAULT_PREFS.modo;
  return { estilo, modo };
}

// user_prefs.prefs lo comparten las dos apps: se sustituye solo `tema` y se conserva lo demás.
export function mergePrefsTema(remote: unknown, tema: Prefs): Record<string, unknown> {
  const base = remote && typeof remote === 'object' && !Array.isArray(remote) ? (remote as Record<string, unknown>) : {};
  return { ...base, tema: sanitizePrefs(tema) };
}

export function resolveModo(modo: Modo, systemDark: boolean): 'light' | 'dark' {
  return modo === 'auto' ? (systemDark ? 'dark' : 'light') : modo;
}

export function applyPrefs(p: Prefs, systemDark: boolean, el: HTMLElement = document.documentElement) {
  const safe = sanitizePrefs(p);
  el.dataset.style = safe.estilo;
  el.dataset.mode = resolveModo(safe.modo, systemDark);
}
