import { updatePayload, type Document } from './model';
export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';
export type Writer = (payload: ReturnType<typeof updatePayload>) => Promise<void>;

// Una sola cola por tabla: captura snapshots inmutables, debounce 1,2 s y reintento explícito.
export class Autosave {
  private timer?: ReturnType<typeof setTimeout>;
  private chain: Promise<boolean> = Promise.resolve(true);
  private pending?: Document;
  private running = 0;
  private savedTitle: string;
  private revision = 0;
  constructor(title: string, private write: Writer, private allowed: () => boolean, private status: (s: SaveStatus) => void) { this.savedTitle = title; }
  get dirty() { return !!this.pending || this.running > 0; }
  change(doc: Document) {
    if (!this.allowed()) return;
    this.pending = doc; this.revision++; this.status('pending');
    clearTimeout(this.timer); this.timer = setTimeout(() => { void this.flush(); }, 1200);
  }
  flush(): Promise<boolean> {
    clearTimeout(this.timer);
    if (!this.pending) return this.chain;
    if (!this.allowed()) return Promise.resolve(false);
    const doc = this.pending, revision = this.revision;
    this.pending = undefined; this.running++;
    this.chain = this.chain.then(async () => {
      if (!this.allowed()) { this.pending ??= doc; return false; }
      if (revision === this.revision) this.status('saving');
      try {
        await this.write(updatePayload(doc, this.savedTitle, new Date().toISOString()));
        this.savedTitle = doc.titulo;
        if (revision === this.revision) this.status('saved');
        return true;
      } catch {
        if (revision === this.revision) { this.pending = doc; this.status('error'); }
        return false;
      }
    }).finally(() => { this.running--; });
    return this.chain;
  }
  async settle(): Promise<boolean> {
    // La navegación espera también cambios hechos durante el guardado anterior.
    while (this.dirty) if (!await this.flush()) return false;
    return true;
  }
  cancelTimer() { clearTimeout(this.timer); }
}
