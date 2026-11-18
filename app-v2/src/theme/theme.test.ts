import { describe, expect, test } from 'vitest';
import { mergePrefsTema, resolveModo, sanitizePrefs } from './theme';

describe('mergePrefsTema', () => {
  test('conserva las claves de la app actual y sustituye solo el tema', () => {
    const remote = { sidebar: { a: true }, blockOrder: ['titulo'], tema: { estilo: 'obra', modo: 'auto' } };
    expect(mergePrefsTema(remote, { estilo: 'atlas', modo: 'dark' })).toEqual({
      sidebar: { a: true }, blockOrder: ['titulo'], tema: { estilo: 'atlas', modo: 'dark' },
    });
  });
  test('tolera prefs vacío o con forma inesperada', () => {
    expect(mergePrefsTema(null, { estilo: 'obra', modo: 'auto' })).toEqual({ tema: { estilo: 'obra', modo: 'auto' } });
    expect(mergePrefsTema([1, 2], { estilo: 'obra', modo: 'auto' })).toEqual({ tema: { estilo: 'obra', modo: 'auto' } });
  });
});

describe('sanitizePrefs', () => {
  test('acepta valores válidos', () => {
    expect(sanitizePrefs({ estilo: 'cuaderno', modo: 'dark' })).toEqual({ estilo: 'cuaderno', modo: 'dark' });
  });
  test('descarta valores fuera de la lista blanca', () => {
    expect(sanitizePrefs({ estilo: '"><img src=x onerror=alert(1)>', modo: '__proto__' })).toEqual({ estilo: 'obra', modo: 'auto' });
    expect(sanitizePrefs(null)).toEqual({ estilo: 'obra', modo: 'auto' });
  });
});

describe('resolveModo', () => {
  test('automático sigue al sistema', () => {
    expect(resolveModo('auto', true)).toBe('dark');
    expect(resolveModo('auto', false)).toBe('light');
  });
  test('claro y oscuro son fijos', () => {
    expect(resolveModo('light', true)).toBe('light');
    expect(resolveModo('dark', false)).toBe('dark');
  });
});
