// @vitest-environment happy-dom
import { BlockNoteEditor, type PartialBlock } from '@blocknote/core';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { legacyToV2, v2ToLegacy, type LegacyBlock, type V2Block } from './convert';
import { schema, type ManualEditor } from './schema';

type EditorBlock = PartialBlock<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>;

let editor: ManualEditor;
beforeEach(() => { editor = BlockNoteEditor.create({ schema }); });
afterEach(() => { editor._tiptapEditor.destroy(); });

test('preserves untouched legacy blocks through the editor document', () => {
  const blocks: LegacyBlock[] = [
    { id: 'texto', type: 'texto', html: '<p>Usa <strong>guantes</strong> &amp; gafas.</p>', v: 1, order: 0, blockBgColor: '#abcdef' },
    { id: 'titulo', type: 'titulo', titulo: '<strong>Montaje</strong>', emoji: '📋', subtitulo: 'Antes de empezar', blockBgColor: '#12355b', order: 1, v: 2 },
    { id: 'subtitulo', type: 'subtitulo', texto: 'Prepara <em>las herramientas</em>', order: 2, blockBgColor: '#64748b' },
    { id: 'paso', type: 'paso', titulo: 'Marca <strong>los taladros</strong>', descripcion: 'Usa <b>nivel</b>', order: 3, storagePath: 'img/paso.png' },
    { id: 'alerta', type: 'alerta', tipo: 'peligro', texto: 'Corta <strong>230 V</strong>\nUsa guantes', icon: 'bolt', order: 4 },
  ];
  editor.replaceBlocks(editor.document, legacyToV2(blocks).blocks as EditorBlock[]);

  expect(v2ToLegacy({
    version: 1,
    blocks: editor.document as unknown as V2Block[],
    extras: {},
    paged: false,
  })).toEqual(blocks);
});

test('new paragraphs and headings keep default props with empty legacy', () => {
  expect(editor.document[0]).toMatchObject({
    type: 'paragraph',
    props: { legacy: '', backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
  });
  editor.insertBlocks([{ type: 'heading' }], editor.document[0], 'after');
  expect(editor.document[1]).toMatchObject({
    type: 'heading',
    props: { legacy: '', level: 1, backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
  });
});

test('paragraphs and headings retain HTML parsing and clipboard serialization', () => {
  const parsed = editor.tryParseHTMLToBlocks(
    '<p style="text-align: center; color: red; background-color: blue">Usa <strong>guantes</strong></p>'
    + '<h2>Montaje <em>seguro</em></h2><h3>Herramientas</h3>',
  );
  expect(parsed).toMatchObject([
    { type: 'paragraph', props: { legacy: '', textAlignment: 'center', textColor: 'red', backgroundColor: 'blue' }, content: [
      { type: 'text', text: 'Usa ', styles: {} },
      { type: 'text', text: 'guantes', styles: { bold: true } },
    ] },
    { type: 'heading', props: { legacy: '', level: 2 }, content: [
      { type: 'text', text: 'Montaje ', styles: {} },
      { type: 'text', text: 'seguro', styles: { italic: true } },
    ] },
    { type: 'heading', props: { legacy: '', level: 3 } },
  ]);
  editor.replaceBlocks(editor.document, parsed);
  for (const block of editor.document) {
    editor.updateBlock(block, { props: { legacy: JSON.stringify({ id: block.id, type: 'texto', html: '<strong>Original</strong>' }) } });
  }
  const snapshot = editor.document.map(({ type, props, content }) => ({ type, props, content }));

  // El HTML interno es el formato que usa BlockNote para copiar y pegar sin pérdidas.
  const clipboardHTML = editor.blocksToFullHTML();
  const pasted = editor.tryParseHTMLToBlocks(clipboardHTML);
  editor.replaceBlocks(editor.document, pasted);
  expect(editor.document.map(({ type, props, content }) => ({ type, props, content }))).toEqual(snapshot);

  const externalHTML = new DOMParser().parseFromString(editor.blocksToHTMLLossy(), 'text/html');
  expect(externalHTML.querySelector('p')?.textContent).toBe('Usa guantes');
  expect(externalHTML.querySelector('h2')?.textContent).toBe('Montaje seguro');
  expect(externalHTML.querySelector('h3')?.textContent).toBe('Herramientas');
});
