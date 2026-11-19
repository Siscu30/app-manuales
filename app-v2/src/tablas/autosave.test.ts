import { afterEach, expect, test, vi } from 'vitest';
import { Autosave } from './autosave';
import type { Document } from './model';
afterEach(() => { vi.useRealTimers(); });
const doc = (titulo: string): Document => ({ titulo, contenido: { extension: 'intacta', rows: [], columns: [] } });
test('cargar no escribe; debounce 1,2 segundos coalesce snapshots', async () => {
  vi.useFakeTimers(); const write = vi.fn().mockResolvedValue(undefined), status = vi.fn();
  const queue = new Autosave('Original', write, () => true, status);
  await vi.advanceTimersByTimeAsync(2000); expect(write).not.toHaveBeenCalled();
  queue.change(doc('A')); await vi.advanceTimersByTimeAsync(1000); queue.change(doc('B'));
  await vi.advanceTimersByTimeAsync(1199); expect(write).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); expect(write).toHaveBeenCalledTimes(1); expect(write.mock.calls[0][0]).toMatchObject({ titulo: 'B', contenido: doc('B').contenido });
  expect(status).toHaveBeenLastCalledWith('saved'); expect(queue.dirty).toBe(false);
});
test('guardados siempre en serie y deshacer un título ya guardado lo persiste', async () => {
  let release!: () => void;
  const write = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; })).mockResolvedValue(undefined);
  const status = vi.fn(), queue = new Autosave('Original', write, () => true, status);
  queue.change(doc('Renombrado')); const first = queue.flush(); await Promise.resolve();
  queue.change(doc('Original')); const second = queue.flush(); await Promise.resolve();
  expect(write).toHaveBeenCalledTimes(1); expect(queue.dirty).toBe(true);
  release(); await first; await second;
  expect(write.mock.calls.map(call => call[0].titulo)).toEqual(['Renombrado', 'Original']); expect(queue.dirty).toBe(false);
});
test('error de red conserva snapshot y permite reintentar sin romper la cola', async () => {
  const write = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined), status = vi.fn();
  const queue = new Autosave('Original', write, () => true, status);
  queue.change(doc('Nuevo')); expect(await queue.flush()).toBe(false); expect(queue.dirty).toBe(true); expect(status).toHaveBeenLastCalledWith('error');
  expect(await queue.flush()).toBe(true); expect(write).toHaveBeenCalledTimes(2); expect(queue.dirty).toBe(false);
});
test('solo lectura no programa guardados; revocar permiso también bloquea trabajos en cola', async () => {
  const write = vi.fn().mockResolvedValue(undefined); let allowed = false;
  const queue = new Autosave('Original', write, () => allowed, vi.fn());
  queue.change(doc('No')); await queue.flush(); expect(write).not.toHaveBeenCalled();
  allowed = true; queue.change(doc('Pendiente')); const flushing = queue.flush(); allowed = false;
  expect(await flushing).toBe(false); expect(write).not.toHaveBeenCalled(); expect(queue.dirty).toBe(true);
  allowed = true; await queue.flush(); expect(write).toHaveBeenCalledTimes(1);
});
test('un guardado antiguo no marca guardados cambios pendientes más recientes', async () => {
  let release!: () => void;
  const write = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; })).mockResolvedValue(undefined), status = vi.fn();
  const queue = new Autosave('A', write, () => true, status);
  queue.change(doc('B')); const first = queue.flush(); await Promise.resolve(); queue.change(doc('C'));
  release(); await first; expect(status).toHaveBeenLastCalledWith('pending');
  await queue.flush(); expect(write.mock.calls[1][0].titulo).toBe('C');
});
test('navegar espera también las ediciones nuevas durante el guardado', async () => {
  let release!: () => void;
  const write = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; })).mockResolvedValue(undefined);
  const queue = new Autosave('A', write, () => true, vi.fn());
  queue.change(doc('B')); const leaving = queue.settle(); await Promise.resolve(); queue.change(doc('C'));
  release(); expect(await leaving).toBe(true); expect(write).toHaveBeenCalledTimes(2); expect(queue.dirty).toBe(false);
});
