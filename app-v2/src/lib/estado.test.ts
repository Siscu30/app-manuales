import { expect, test } from 'vitest';
import { estadoInfo } from './estado';

test('estadoInfo traduce los estados conocidos', () => {
  expect(estadoInfo('en_revision')).toEqual({ tono: 'warn', label: 'En revisión' });
  expect(estadoInfo(null).label).toBe('Borrador');
});

test('estadoInfo nunca devuelve el valor crudo', () => {
  expect(estadoInfo('x"><img src=x onerror=alert(1)>').label).toBe('Estado desconocido');
  expect(estadoInfo('__proto__').label).toBe('Estado desconocido');
  expect(estadoInfo('toString').label).toBe('Estado desconocido');
});
