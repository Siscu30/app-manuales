// Conversión entre el formato de bloques de la app actual (manuales.contenido) y el del editor
// nuevo (BlockNote, guardado en manuales.contenido_v2).
//
// Garantía: legado → v2 → legado devuelve EXACTAMENTE lo mismo si no se ha editado nada.
// Cada bloque v2 nacido de uno antiguo guarda el original en props.legacy (JSON). Al volver,
// si el texto no ha cambiado se restaura el original tal cual (con su HTML, colores e iconos);
// si ha cambiado, se actualiza solo ese campo de texto, escapado.
// Los tipos que el editor nuevo aún no edita (imagen, vídeo, enlace, flujos, código, icono, tabla,
// lista, separador) viajan intactos en un bloque «legado» de solo lectura.

export type LegacyBlock = { id?: string; type: string; [k: string]: unknown };
export type LegacyContenido =
  | LegacyBlock[]
  | { blocks?: LegacyBlock[]; pages?: { id: string; blocks?: LegacyBlock[]; [k: string]: unknown }[]; [k: string]: unknown };

type Inline = { type: 'text'; text: string; styles: Record<string, never> };
export interface V2Block {
  id?: string;
  type: string;
  props: Record<string, string | number | boolean>;
  content?: Inline[] | AnyInline[];
  children?: V2Block[];
}
export interface ContenidoV2 {
  version: 1;
  blocks: V2Block[];
  /** Claves del contenido antiguo que no son bloques (mediaLibrary, textBank, trash, activePage…). */
  extras: Record<string, unknown>;
  /** true si el contenido antiguo usaba páginas: los marcadores «pagina» separan cada página. */
  paged: boolean;
}

const ENT: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

/** HTML → texto plano. Solo produce texto: nunca se inserta como HTML. */
export function htmlToText(html: unknown): string {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENT[m])
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const text = (t: string): Inline[] => (t ? [{ type: 'text', text: t, styles: {} }] : []);
// El editor también produce enlaces ({ type: 'link', content: [...] }): se toma su texto.
type AnyInline = { type?: string; text?: string; content?: AnyInline[] | string };
const inlineToText = (c?: AnyInline[] | string): string =>
  typeof c === 'string' ? c : (c ?? []).map((i) => (typeof i.text === 'string' ? i.text : inlineToText(i.content))).join('');

// Campo de texto principal de cada tipo editable.
const TEXT_FIELD: Record<string, string> = { titulo: 'titulo', subtitulo: 'texto', texto: 'html', alerta: 'texto', paso: 'titulo' };
const ALERTA_TIPOS = ['info', 'advertencia', 'peligro', 'exito'];

export function legacyBlockToV2(b: LegacyBlock): V2Block {
  const legacy = JSON.stringify(b);
  const field = TEXT_FIELD[b.type];
  const t = field ? htmlToText(b[field]) : '';
  switch (b.type) {
    case 'titulo': return { type: 'heading', props: { level: 2, legacy }, content: text(t) };
    case 'subtitulo': return { type: 'heading', props: { level: 3, legacy }, content: text(t) };
    case 'texto': return { type: 'paragraph', props: { legacy }, content: text(t) };
    case 'alerta': {
      const tipo = ALERTA_TIPOS.includes(String(b.tipo)) ? String(b.tipo) : 'info';
      return { type: 'alerta', props: { tipo, legacy }, content: text(t) };
    }
    case 'paso': return { type: 'paso', props: { descripcion: htmlToText(b.descripcion), legacy }, content: text(t) };
    default: return { type: 'legado', props: { tipo: String(b.type), legacy } };
  }
}

function parseLegacy(v: unknown): LegacyBlock | null {
  if (typeof v !== 'string' || !v) return null;
  try { const o = JSON.parse(v); return o && typeof o === 'object' && typeof o.type === 'string' ? o : null; } catch { return null; }
}

let _seq = 0;
const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `v2-${Date.now().toString(36)}-${_seq++}`);

/** Bloque v2 → bloque antiguo. Devuelve null para tipos que la app antigua no conoce. */
export function v2BlockToLegacy(b: V2Block): LegacyBlock | null {
  const orig = parseLegacy(b.props?.legacy);
  if (b.type === 'legado') return orig;

  const t = inlineToText(b.content);
  const typeFor = (): string | null => {
    if (b.type === 'heading') return Number(b.props.level) <= 2 ? 'titulo' : 'subtitulo';
    if (b.type === 'paragraph') return 'texto';
    if (b.type === 'alerta' || b.type === 'paso') return b.type;
    return null;
  };
  const type = orig?.type && TEXT_FIELD[orig.type] && orig.type === typeFor() ? orig.type : typeFor();
  if (!type) return null;

  const out: LegacyBlock = orig && orig.type === type ? { ...orig } : { id: newId(), type };
  const field = TEXT_FIELD[type];
  // Texto sin cambios: se conserva el HTML original (negritas, colores…). Con cambios: texto escapado.
  if (!(orig && orig.type === type && htmlToText(orig[field]) === t)) out[field] = escapeHtml(t);
  if (type === 'alerta') out.tipo = ALERTA_TIPOS.includes(String(b.props.tipo)) ? String(b.props.tipo) : 'info';
  if (type === 'paso') {
    const d = String(b.props.descripcion ?? '');
    if (!(orig && htmlToText(orig.descripcion) === d)) out.descripcion = escapeHtml(d);
  }
  return out;
}

/** contenido antiguo (array u objeto con páginas) → ContenidoV2. No modifica la entrada. */
export function legacyToV2(contenido: unknown): ContenidoV2 {
  if (Array.isArray(contenido)) return { version: 1, blocks: contenido.map(legacyBlockToV2), extras: {}, paged: false };
  const c = (contenido && typeof contenido === 'object' ? contenido : {}) as Exclude<LegacyContenido, LegacyBlock[]>;
  const { blocks = [], pages, ...extras } = c;
  if (Array.isArray(pages) && pages.length) {
    const out: V2Block[] = [];
    for (const p of pages) {
      const { blocks: pb = [], ...meta } = p;
      out.push({ type: 'legado', props: { tipo: 'pagina', legacy: JSON.stringify({ type: 'pagina', ...meta }) } });
      out.push(...pb.map(legacyBlockToV2));
    }
    // `blocks` en formato con páginas es una copia de la página activa: se reconstruye al volver.
    return { version: 1, blocks: out, extras: { ...extras, _hadBlocks: Array.isArray(c.blocks) }, paged: true };
  }
  return { version: 1, blocks: (blocks as LegacyBlock[]).map(legacyBlockToV2), extras, paged: false };
}

// Los bloques anidados (sangría en el editor) se aplanan: la app antigua no tiene anidación.
const flatten = (bs: V2Block[]): V2Block[] => bs.flatMap((b) => [b, ...flatten(b.children ?? [])]);

/** ContenidoV2 → contenido antiguo con la misma forma que tenía. */
export function v2ToLegacy(input: ContenidoV2): LegacyContenido {
  const v2 = { ...input, blocks: flatten(input.blocks) };
  if (v2.paged) {
    const pages: { id: string; blocks: LegacyBlock[]; [k: string]: unknown }[] = [];
    for (const b of v2.blocks) {
      if (b.type === 'legado' && b.props.tipo === 'pagina') {
        const meta = parseLegacy(b.props.legacy) as Record<string, unknown> | null;
        const { type: _t, ...rest } = meta ?? { type: 'pagina', id: newId() };
        void _t;
        pages.push({ ...(rest as { id: string }), blocks: [] });
        continue;
      }
      if (!pages.length) pages.push({ id: newId(), nombre: 'Página 1', blocks: [] });
      const l = v2BlockToLegacy(b);
      if (l) pages[pages.length - 1].blocks.push(l);
    }
    const { _hadBlocks, ...extras } = v2.extras as Record<string, unknown> & { _hadBlocks?: boolean };
    const active = pages.find((p) => p.id === extras.activePage) ?? pages[0];
    return { ...(_hadBlocks === false ? {} : { blocks: active ? active.blocks : [] }), pages, ...extras };
  }
  const blocks = v2.blocks.map(v2BlockToLegacy).filter((b): b is LegacyBlock => b !== null);
  return Object.keys(v2.extras).length ? { blocks, ...v2.extras } : blocks;
}

export function isContenidoV2(v: unknown): v is ContenidoV2 {
  return !!v && typeof v === 'object' && (v as ContenidoV2).version === 1 && Array.isArray((v as ContenidoV2).blocks);
}
