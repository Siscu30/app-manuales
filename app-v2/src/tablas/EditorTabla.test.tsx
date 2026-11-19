// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EditorTabla } from './EditorTabla';
import { demoContenido } from './demo';
import type { Contenido } from './model';

const db = vi.hoisted(() => ({ contenido: {} as unknown, writes: [] as Record<string, unknown>[], error: false, from: vi.fn() }));
vi.mock('../lib/supabase', () => ({ sb: { from: db.from } }));
let host: HTMLDivElement, root: Root;
let guard: (() => Promise<boolean>) | null;
const registerGuard = (next: typeof guard) => { guard = next; };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', undefined);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1400);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(500);
  // happy-dom 15 no implementa el selector de ámbito & usado por react-data-grid.
  const querySelector = Element.prototype.querySelector;
  vi.spyOn(Element.prototype, 'querySelector').mockImplementation(function (this: Element, selector: string) { return querySelector.call(this, selector.replace(/^&/, ':scope')); });
  db.contenido = demoContenido(); db.writes = []; db.error = false; guard = null;
  db.from.mockImplementation((table: string) => {
    expect(table).toBe('tablas_interactivas');
    const query = { select: () => query, eq: () => query, single: async () => ({ data: { titulo: 'Revisión', estado: 'publicado', contenido: db.contenido }, error: null }) };
    return { ...query, update: (payload: Record<string, unknown>) => ({ eq: async (key: string, id: string) => { expect([key, id]).toEqual(['id', 'test']); db.writes.push(payload); return { error: db.error ? new Error('offline') : null }; } }) };
  });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

async function mount(canWrite = true, demo = false) { await act(async () => root.render(<EditorTabla id="test" demo={demo} canWrite={canWrite} registerGuard={registerGuard} />)); }
function button(name: string) { const el = [...host.querySelectorAll('button')].find(b => b.textContent === name); if (!el) throw new Error(`Botón no encontrado: ${name}`); return el; }
function cell(row = 0, col = 0) { const el = host.querySelectorAll('[role="row"][aria-rowindex]')[row + 1]?.querySelectorAll<HTMLDivElement>('[role="gridcell"]')[col]; if (!el) throw new Error(`Celda no encontrada: ${row}, ${col}`); return el; }
async function click(el: HTMLElement) { await act(async () => { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); el.click(); }); }
async function key(el: HTMLElement, value: string, modifiers: KeyboardEventInit = {}) { await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value, ...modifiers })); }); }
async function paste(el: HTMLElement, text: string) {
  const data = new DataTransfer(); data.setData('text/plain', text);
  await act(async () => { el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data })); });
}
async function input(el: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
async function saved(): Promise<Contenido> { await act(async () => { await vi.advanceTimersByTimeAsync(1200); }); return db.writes[db.writes.length - 1]!.contenido as Contenido; }

test('carga sin escribir; bloquea URL/color maliciosos y aplica colores de reglas', async () => {
  await mount(); expect(db.writes).toHaveLength(0);
  expect(host.querySelector('a[href^="javascript:"]')).toBeNull(); expect(host.textContent).toContain('enlace bloqueado');
  expect(host.querySelector('.ti-header')?.getAttribute('style') ?? '').not.toContain('javascript');
  expect(cell(1, 0).querySelector<HTMLElement>('.ti-cell-content')?.style.backgroundColor).toBe('#FEF3C7');
  expect(cell(0, 0).textContent).toContain('Detector 1');
});
test('pegado rectangular es una transacción, se puede deshacer/rehacer con atajos', async () => {
  await mount(); await click(cell()); await paste(cell(), 'Pegado\tNo\tNorte\ttrue\t20/11/2026\tBaja\thttps://example.com');
  expect(cell().textContent).toContain('Pegado'); expect(cell(0, 1).textContent).toContain('No');
  await key(cell(), 'z', { ctrlKey: true }); expect(cell().textContent).toContain('Detector 1');
  await key(cell(), 'z', { ctrlKey: true, shiftKey: true }); expect(cell().textContent).toContain('Pegado');
  await key(cell(), 'z', { ctrlKey: true }); await key(cell(), 'y', { ctrlKey: true });
  const c = await saved(); expect(c.rows?.[0].values).toEqual({ c0: 'Pegado', c1: 1, c2: 'Norte', c3: true, c4: '2026-11-20', c5: 2, c6: 'https://example.com' });
  expect(Object.keys(db.writes[0]).sort()).toEqual(['contenido', 'updated_at']);
});
test('teclado navega; Enter abre editor, Escape cancela y Tab confirma texto', async () => {
  await mount(); await click(cell()); await key(cell(), 'ArrowRight'); expect(cell(0, 1).getAttribute('aria-selected')).toBe('true');
  await key(cell(0, 1), 'ArrowLeft'); await key(cell(), 'Enter');
  let editor = host.querySelector<HTMLInputElement>('.ti-input')!; expect(editor).not.toBeNull();
  await input(editor, 'Cancelado'); await key(editor, 'Escape'); expect(cell().textContent).toContain('Detector 1');
  await key(cell(), 'Enter'); editor = host.querySelector<HTMLInputElement>('.ti-input')!;
  await input(editor, 'Editado'); await key(editor, 'Tab');
  expect((await saved()).rows?.[0].values.c0).toBe('Editado');
});
test('editores de lista, fecha e insignia conservan los tipos de valores legacy', async () => {
  await mount();
  await click(cell(0, 2)); await key(cell(0, 2), 'Enter');
  await input(host.querySelector<HTMLSelectElement>('.ti-input')!, 'Norte');
  await click(cell(0, 4)); await key(cell(0, 4), 'Enter');
  const date = host.querySelector<HTMLInputElement>('.ti-input')!; expect(date.type).toBe('date');
  await input(date, '2026-12-01'); await key(date, 'Tab');
  await click(cell(0, 5)); await key(cell(0, 5), 'Enter'); await input(host.querySelector<HTMLSelectElement>('.ti-input')!, '2');
  const c = await saved(); expect(c.rows?.[0].values).toMatchObject({ c2: 'Norte', c4: '2026-12-01', c5: 2 });
});
test('añade, mueve y elimina filas/columnas y puede deshacer cambios estructurales', async () => {
  await mount(); await click(button('Añadir fila')); expect(host.textContent).toContain('13 filas');
  await click(cell()); await click(button('Bajar fila')); expect(cell(1).textContent).toContain('Detector 1');
  await click(button('Eliminar fila')); expect(host.textContent).toContain('12 filas');
  await click(button('Deshacer')); expect(host.textContent).toContain('13 filas');
  await click(button('Añadir columna')); expect(host.textContent).toContain('8 columnas');
  await click(cell()); await click(button('Mover a la derecha')); expect(host.querySelectorAll('.ti-header strong')[1].textContent).toBe('Equipo');
  await click(button('Eliminar columna')); expect(host.textContent).toContain('7 columnas');
});
test('solo lectura bloquea editores, pegado, ciclo, casilla, estructura e historial', async () => {
  await mount(false); expect(cell().getAttribute('aria-readonly')).toBe('true');
  await click(cell()); await paste(cell(), 'Bloqueado'); await key(cell(), 'Delete'); await key(cell(), 'Enter');
  expect(host.querySelector('.ti-input')).toBeNull(); expect(cell().textContent).toContain('Detector 1');
  expect(button('Añadir fila').disabled).toBe(true); expect(host.querySelector<HTMLInputElement>('[type=checkbox]')?.disabled).toBe(true);
  await key(cell(), 'z', { ctrlKey: true }); await vi.advanceTimersByTimeAsync(2000); expect(db.writes).toHaveLength(0);
});
test('un error de guardado impide abandonar la tabla hasta reintentar', async () => {
  await mount(); await click(button('Añadir fila')); db.error = true;
  await act(async () => { expect(await guard!()).toBe(false); }); expect(host.textContent).toContain('No se pudo guardar');
  db.error = false; await act(async () => { expect(await guard!()).toBe(true); });
  expect(db.writes).toHaveLength(2); expect(host.textContent).toContain('Guardado');
});
test('demo de 2000 filas usa la cuadrícula real virtualizada, sin consultar Supabase', async () => {
  window.history.replaceState(null, '', '/?demo&rows=2000#tabla-test'); db.from.mockClear();
  const start = performance.now(); await mount(true, true);
  const rendered = host.querySelectorAll('[role="row"]').length;
  expect(host.textContent).toContain('2000 filas'); expect(rendered).toBeLessThan(50); expect(db.from).not.toHaveBeenCalled();
  await click(cell()); await paste(cell(), 'Edición con 2000 filas'); expect(cell().textContent).toContain('Edición con 2000 filas');
  console.info(`Demo 2000 filas (happy-dom, viewport simulado): ${rendered} filas DOM, montaje + edición ${(performance.now() - start).toFixed(1)} ms`);
  window.history.replaceState(null, '', '/');
});
