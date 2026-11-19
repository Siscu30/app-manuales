import { expect, test } from 'vitest';
import { colorStyle, contrast, safeHex, safeUrl } from './safety';
test.each(['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///etc/passwd', 'ftp://example.com', '//example.com', '/relative', 'https:\n//example.com', 'https://', 'mailto:'])('bloquea %s', url => { expect(safeUrl(url)).toBe(''); });
test.each(['http://example.com', 'https://example.com/a?q=1', 'mailto:persona@example.com', 'HTTPS://example.com'])('permite %s', url => { expect(safeUrl(url)).toBe(url); });
test.each(['red;background:url(x)', 'var(--bad)', '#abcd', '#12345', '#12345678', 'red', null])('color fuera de whitelist %s', value => { expect(safeHex(value)).toBeUndefined(); expect(colorStyle(value, '#fff')).toEqual({}); });
test('hex seguros y contraste AA incluso con colores persistidos de poco contraste', () => {
  expect(safeHex('#abc')).toBe('#abc');
  for (const bg of ['#fff', '#000', '#abc', '#123456', '#FEF3C7', '#ff6a13']) {
    const style = colorStyle(bg, bg); expect(contrast(style.backgroundColor!, style.color!)).toBeGreaterThanOrEqual(4.5);
  }
  expect(colorStyle('#ffffff', '#000000')).toEqual({ backgroundColor: '#ffffff', color: '#000000' });
});
