import { createColumn, type Contenido, type ColumnType } from './model';

export function demoContenido(count = 12): Contenido {
  const types: ColumnType[] = ['texto', 'estado-ciclico', 'select', 'checkbox', 'fecha', 'badge', 'enlace'];
  const columns = types.map((type, i) => createColumn(`c${i}`, type));
  columns[0].label = 'Equipo'; columns[2].opciones = ['Norte', 'Sur']; columns[2].label = 'Zona';
  columns[0].headerColor = 'red;background:url(javascript:alert(1))';
  return {
    schemaVersion: 2, columns,
    rows: Array.from({ length: count }, (_, i) => ({ id: `r${i}`, values: { c0: `Detector ${i + 1}`, c1: i % 3, c2: i % 2 ? 'Norte' : 'Sur', c3: i % 2 === 0, c4: '2026-11-19', c5: i % 3, c6: i === 0 ? 'javascript:alert(1)' : 'https://example.com/equipos' } })),
    reglas: [{ id: 'pendientes', alcance: 'fila', prioridad: 1, logica: 'AND', condiciones: [{ colId: 'c1', comparador: '=', valor: 'No' }], colorFondo: '#FEF3C7', colorTexto: '#78350F' }],
    legend: '', extensionDesconocida: { conservar: true },
  };
}
