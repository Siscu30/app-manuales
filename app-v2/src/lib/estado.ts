// Estado de un manual: solo se muestran valores de la lista blanca (misma regla que _estadoInfo
// en app.js). Un editor puede escribir cualquier texto en `estado`, así que nunca se pinta crudo.
const ESTADOS = {
  borrador: { tono: 'mut', label: 'Borrador' },
  en_revision: { tono: 'warn', label: 'En revisión' },
  publicado: { tono: 'ok', label: 'Publicado' },
} as const;

export type Tono = 'mut' | 'warn' | 'ok';

export function estadoInfo(v: unknown): { tono: Tono; label: string } {
  if (v == null || v === '') return ESTADOS.borrador;
  if (typeof v === 'string' && Object.prototype.hasOwnProperty.call(ESTADOS, v)) {
    return ESTADOS[v as keyof typeof ESTADOS];
  }
  return { tono: 'mut', label: 'Estado desconocido' };
}
