// Filtros de presentación. Nunca reescriben los valores almacenados.
export function safeUrl(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!/^(https?:\/\/|mailto:)/i.test(text) || [...text].some(c => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127)) return '';
  try {
    const url = new URL(text);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) && (url.protocol === 'mailto:' ? !!url.pathname : !!url.hostname) ? text : '';
  } catch { return ''; }
}
export function safeHex(value: unknown): string | undefined { return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : undefined; }
function luminance(hex: string): number {
  const full = hex.length === 4 ? hex.slice(1).split('').map(x => x + x).join('') : hex.slice(1);
  const rgb = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
export function contrast(a: string, b: string): number { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
export function colorStyle(background: unknown, foreground: unknown): { backgroundColor?: string; color?: string } {
  const bg = safeHex(background), fg = safeHex(foreground);
  if (!bg) return {};
  const best = contrast(bg, '#000000') >= contrast(bg, '#ffffff') ? '#000000' : '#ffffff';
  return { backgroundColor: bg, color: fg && contrast(bg, fg) >= 4.5 ? fg : best };
}
