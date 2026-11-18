import { BlockNoteSchema, defaultBlockSpecs, insertOrUpdateBlockForSlashMenu } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import type { DefaultReactSuggestionItem } from '@blocknote/react';

// Bloques propios del editor nuevo. Todo el texto se pinta como texto (React escapa): ningún
// valor de la base de datos se inserta como HTML.

const ALERTA_LABEL: Record<string, string> = { info: 'Información', advertencia: 'Advertencia', peligro: 'Peligro', exito: 'Correcto' };

export const Paso = createReactBlockSpec(
  { type: 'paso', propSchema: { descripcion: { default: '' }, legacy: { default: '' } }, content: 'inline' },
  {
    render: ({ block, editor, contentRef }) => (
      <div className="bk-paso">
        {/* La numeración la pone un contador CSS: se recalcula sola al arrastrar o borrar pasos. */}
        <span className="bk-paso-n" aria-hidden="true" />
        <div className="bk-paso-body">
          <div className="bk-paso-title" ref={contentRef} />
          <textarea
            className="bk-paso-desc" rows={1} placeholder="Describe el paso…" aria-label="Descripción del paso"
            value={block.props.descripcion} readOnly={!editor.isEditable}
            onChange={(e) => editor.updateBlock(block, { props: { descripcion: e.target.value } })}
          />
        </div>
      </div>
    ),
  },
);

export const Alerta = createReactBlockSpec(
  {
    type: 'alerta',
    propSchema: { tipo: { default: 'info', values: ['info', 'advertencia', 'peligro', 'exito'] as const }, legacy: { default: '' } },
    content: 'inline',
  },
  {
    render: ({ block, editor, contentRef }) => (
      <div className={`bk-alerta t-${block.props.tipo}`}>
        <select
          className="bk-alerta-tipo" aria-label="Tipo de alerta" value={block.props.tipo} disabled={!editor.isEditable}
          onChange={(e) => editor.updateBlock(block, { props: { tipo: e.target.value as typeof block.props.tipo } })}
        >
          {Object.entries(ALERTA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <div className="bk-alerta-text" ref={contentRef} />
      </div>
    ),
  },
);

const LEGADO_LABEL: Record<string, string> = {
  imagen: 'Imagen', tabla: 'Tabla', lista: 'Lista', separador: 'Separador', video: 'Vídeo', enlace: 'Enlace',
  flujos: 'Flujo de decisiones', codigo: 'Código', icono: 'Icono', pagina: 'Página',
};

function resumenLegado(tipo: string, legacy: string): string {
  try {
    const b = JSON.parse(legacy) as Record<string, unknown>;
    const pick = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : '');
    if (tipo === 'pagina') return pick('nombre') || pick('titulo');
    if (tipo === 'tabla' && Array.isArray(b.filas)) return `${(b.columnas as unknown[] | undefined)?.length ?? 0} columnas, ${b.filas.length} filas`;
    if (tipo === 'lista' && Array.isArray(b.items)) return `${b.items.length} elementos`;
    if (tipo === 'flujos' && Array.isArray(b.filas)) return `${b.filas.length} condiciones`;
    return pick('caption') || pick('titulo') || pick('url') || pick('label') || pick('language');
  } catch { return ''; }
}

// Bloques de la app actual que este editor aún no edita: se conservan intactos y se pueden mover.
export const Legado = createReactBlockSpec(
  { type: 'legado', propSchema: { tipo: { default: '' }, legacy: { default: '' } }, content: 'none' },
  {
    render: ({ block }) => {
      const tipo = block.props.tipo;
      const res = resumenLegado(tipo, block.props.legacy);
      return tipo === 'pagina'
        ? <div className="bk-pagina"><span>Página</span><strong>{res || 'Sin nombre'}</strong></div>
        : (
          <div className="bk-legado" title="Este bloque se edita todavía en la app actual">
            <strong>{LEGADO_LABEL[tipo] ?? tipo}</strong>
            {res && <span>{res}</span>}
            <small>Se conserva tal cual. Puedes moverlo; se edita en la app actual.</small>
          </div>
        );
    },
  },
);

export const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, paso: Paso(), alerta: Alerta(), legado: Legado() },
});
export type ManualEditor = typeof schema.BlockNoteEditor;

export function customSlashItems(editor: ManualEditor): DefaultReactSuggestionItem[] {
  return [
    {
      title: 'Paso', subtext: 'Paso numerado con descripción', aliases: ['paso', 'step'], group: 'Manual',
      icon: <span className="slash-ico">1</span>,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: 'paso' }),
    },
    {
      title: 'Alerta', subtext: 'Aviso de información, advertencia o peligro', aliases: ['alerta', 'aviso', 'warning'], group: 'Manual',
      icon: <span className="slash-ico">!</span>,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: 'alerta', props: { tipo: 'advertencia' } }),
    },
  ];
}
