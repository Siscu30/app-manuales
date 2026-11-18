/** Subconjunto inline compatible con BlockNote, incluido el estilo propio hexColor. */
export interface InlineText {
  type: 'text';
  text: string;
  styles: Record<string, boolean | string>;
}
export interface InlineLink {
  type: 'link';
  href: string;
  content: InlineText[] | string;
}
export type RichInline = InlineText | InlineLink;

export function validHexColor(value: unknown): string | undefined {
  return typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)
    ? value.toLowerCase() : undefined;
}

export function safeHref(value: string): string | undefined {
  const href = value.trim();
  if (Array.from(href).some((c) => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127)) return;
  if (!/^(https?:\/\/|mailto:)/i.test(href)) return;
  try {
    const url = new URL(href);
    if (url.protocol === 'mailto:' || ((url.protocol === 'http:' || url.protocol === 'https:') && url.hostname)) return href;
  } catch { /* Un enlace mal formado se conserva solo como texto. */ }
}

const MARKS = { bold: 'b', italic: 'i', underline: 'u', strike: 's' } as const;
function cleanStyles(styles: InlineText['styles']): InlineText['styles'] {
  const clean: InlineText['styles'] = {};
  for (const key of Object.keys(MARKS)) if (styles[key] === true) clean[key] = true;
  const color = validHexColor(styles.hexColor);
  if (color) clean.hexColor = color;
  return clean;
}

type Run = InlineText & { href?: string };
function append(runs: Run[], text: string, styles: InlineText['styles'], href?: string) {
  if (!text) return;
  const clean = cleanStyles(styles);
  const last = runs[runs.length - 1];
  if (last && last.href === href && JSON.stringify(last.styles) === JSON.stringify(clean)) last.text += text;
  else runs.push({ type: 'text', text, styles: clean, ...(href ? { href } : {}) });
}

/** Se analiza un documento inerte; nunca se monta HTML antiguo en el DOM de la app. */
export function htmlToInline(html: string): RichInline[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const runs: Run[] = [];
  function walk(node: Node, styles: InlineText['styles'], href?: string) {
    if (node.nodeType === 3) { append(runs, node.textContent ?? '', styles, href); return; }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (['script', 'style', 'img', 'iframe', 'object', 'embed', 'template', 'noscript'].includes(tag)) return;
    const next = { ...styles };
    if (tag === 'b' || tag === 'strong') next.bold = true;
    if (tag === 'i' || tag === 'em') next.italic = true;
    if (tag === 'u') next.underline = true;
    if (['s', 'strike', 'del'].includes(tag)) next.strike = true;
    let color: string | undefined;
    if (tag === 'span') {
      for (const declaration of (el.getAttribute('style') ?? '').split(';')) {
        const match = /^\s*color\s*:\s*(#[\da-f]{3}(?:[\da-f]{3})?)\s*$/i.exec(declaration);
        if (match) color = validHexColor(match[1]);
      }
    } else if (tag === 'font') color = validHexColor(el.getAttribute('color'));
    if (color) next.hexColor = color;
    const link = tag === 'a' ? safeHref(el.getAttribute('href') ?? '') : href;
    if (tag === 'br') append(runs, '\n', next, link);
    else {
      for (const child of el.childNodes) walk(child, next, link);
      if (['p', 'div', 'li'].includes(tag)) append(runs, '\n', next, link);
    }
  }
  for (const child of doc.body.childNodes) walk(child, {});
  // Los cierres de bloque aportan separadores, pero no líneas vacías en los extremos.
  while (runs.length) {
    runs[0].text = runs[0].text.replace(/^\n+/, '');
    if (runs[0].text) break;
    runs.shift();
  }
  while (runs.length) {
    const last = runs[runs.length - 1];
    last.text = last.text.replace(/\n+$/, '');
    if (last.text) break;
    runs.pop();
  }
  const content: RichInline[] = [];
  for (const { href, ...text } of runs) {
    const last = content[content.length - 1];
    if (!href) content.push(text);
    else if (last?.type === 'link' && last.href === href && Array.isArray(last.content)) last.content.push(text);
    else content.push({ type: 'link', href, content: [text] });
  }
  return content;
}

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Solo se emiten etiquetas y atributos conocidos, nunca HTML suministrado por el usuario. */
export function inlineToHtml(
  content: readonly RichInline[] | string | undefined,
  opts: { newline: 'br' | '\n' },
): string {
  const runs: Run[] = [];
  if (typeof content === 'string') append(runs, content, {});
  else for (const item of content ?? []) {
    if (item.type === 'text') append(runs, item.text, item.styles);
    else if (item.type === 'link') {
      const href = safeHref(item.href);
      if (typeof item.content === 'string') append(runs, item.content, {}, href);
      else for (const text of item.content) append(runs, text.text, text.styles, href);
    }
  }
  // La fusión de tramos equivalentes evita detectar cambios por cómo el editor los divide.
  return runs.map(({ text, styles, href }) => {
    // La app antigua renderiza cada línea de alerta por separado: cerrar sus marcas
    // antes del salto evita perder el formato o el enlace de la línea siguiente.
    return text.split('\n').map((line) => {
      if (!line) return '';
      let html = escape(line);
      for (const [key, tag] of Object.entries(MARKS)) if (styles[key]) html = `<${tag}>${html}</${tag}>`;
      if (styles.hexColor) html = `<span style="color:${styles.hexColor}">${html}</span>`;
      return href ? `<a href="${escape(href)}">${html}</a>` : html;
    }).join(opts.newline === 'br' ? '<br>' : '\n');
  }).join('');
}
