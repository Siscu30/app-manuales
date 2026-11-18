// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { htmlToText, legacyToV2, v2BlockToLegacy, v2ToLegacy, type LegacyBlock } from './convert';

// Un bloque de cada uno de los 14 tipos de la app actual, con formato, colores e iconos.
const TODOS: LegacyBlock[] = [
  { id: 'a1', type: 'titulo', emoji: '📋', titulo: '<b>Montaje</b> en pared', subtitulo: 'Paso previo', blockBgColor: '#12355b' },
  { id: 'a2', type: 'subtitulo', texto: 'Antes de <i>empezar</i>', blockBgColor: '#64748b' },
  { id: 'a3', type: 'alerta', tipo: 'peligro', texto: 'Corta 230 V\nUsa guantes', icon: 'bolt' },
  { id: 'a4', type: 'paso', titulo: 'Marca los taladros', descripcion: 'Usa <b>nivel</b>', storagePath: 'img/x.png', caption: 'Foto' },
  { id: 'a5', type: 'imagen', storagePath: 'img/y.png', caption: 'Vista', width: '60%' },
  { id: 'a6', type: 'tabla', columnas: ['A', 'B'], filas: [['1', '2']], align: ['left', 'right'] },
  { id: 'a7', type: 'lista', items: [{ icono: 'check', texto: 'Uno' }] },
  { id: 'a8', type: 'separador' },
  { id: 'a9', type: 'texto', html: '<p>Hola <span style="color:red">rojo</span> &amp; más</p>' },
  { id: 'a10', type: 'video', url: 'https://youtu.be/x', titulo: 'Demo', caption: '', videoType: 'link', src: '' },
  { id: 'a11', type: 'enlace', url: 'https://ejemplo.com', titulo: 'Web', descripcion: '' },
  { id: 'a12', type: 'flujos', filas: [{ condicion: 'Si', accion: 'Entonces' }], align: ['left', 'left'] },
  { id: 'a13', type: 'codigo', language: 'bash', code: 'ls -la' },
  { id: 'a14', type: 'icono', iconKey: 'star', size: 48, color: '#2563EB', label: '', align: 'center' },
];

describe('ida y vuelta sin cambios', () => {
  test('array simple con los 14 tipos queda idéntico', () => {
    expect(v2ToLegacy(legacyToV2(TODOS))).toEqual(TODOS);
  });
  test('objeto con extras (medios, banco de textos, papelera)', () => {
    const c = { blocks: TODOS.slice(0, 3), mediaLibrary: [{ path: 'm.png' }], textBank: ['t'], trash: [] };
    expect(v2ToLegacy(legacyToV2(c))).toEqual(c);
  });
  test('formato con páginas', () => {
    const p1 = { id: 'p1', nombre: 'Intro', blocks: TODOS.slice(0, 4) };
    const p2 = { id: 'p2', nombre: 'Anexo', blocks: TODOS.slice(4) };
    const c = { blocks: p2.blocks, pages: [p1, p2], activePage: 'p2', mediaLibrary: [], textBank: [], trash: [] };
    expect(v2ToLegacy(legacyToV2(c))).toEqual(c);
  });
  test('no modifica la entrada', () => {
    const copia = structuredClone(TODOS);
    legacyToV2(TODOS);
    expect(TODOS).toEqual(copia);
  });
});

describe('ediciones', () => {
  test('texto editado se guarda escapado y conserva el resto de campos', () => {
    const v2 = legacyToV2([TODOS[0]]).blocks[0];
    v2.content = [{ type: 'text', text: 'Nuevo <script>', styles: {} }];
    expect(v2BlockToLegacy(v2)).toEqual({ ...TODOS[0], titulo: 'Nuevo &lt;script&gt;' });
  });
  test('cambiar el tipo de alerta', () => {
    const v2 = legacyToV2([TODOS[2]]).blocks[0];
    v2.props.tipo = 'exito';
    expect(v2BlockToLegacy(v2)).toMatchObject({ id: 'a3', tipo: 'exito', texto: TODOS[2].texto, icon: 'bolt' });
  });
  test('tipo de alerta desconocido cae a info', () => {
    const v2 = legacyToV2([TODOS[2]]).blocks[0];
    v2.props.tipo = '"><img onerror=x>';
    expect(v2BlockToLegacy(v2)?.tipo).toBe('info');
  });
  test('bloque nuevo creado en el editor', () => {
    const l = v2BlockToLegacy({ type: 'paso', props: { descripcion: 'Atornilla' }, content: [{ type: 'text', text: 'Fijar', styles: {} }] });
    expect(l).toMatchObject({ type: 'paso', titulo: 'Fijar', descripcion: 'Atornilla' });
    expect(typeof l?.id).toBe('string');
  });
  test('enlaces, estilos y bloques anidados que produce el editor', () => {
    const doc = {
      version: 1 as const, extras: {}, paged: false,
      blocks: [{
        type: 'paragraph', props: { textColor: 'default', textAlignment: 'left' },
        content: [{ type: 'text', text: 'Ver ', styles: { bold: true } }, { type: 'link', href: 'https://x', content: [{ type: 'text', text: 'manual', styles: {} }] }],
        children: [{ type: 'alerta', props: { tipo: 'peligro' }, content: [{ type: 'text', text: 'Ojo', styles: {} }], children: [] }],
      }],
    };
    const out = v2ToLegacy(doc as never) as LegacyBlock[];
    expect(out.map((b) => [b.type, b.html ?? b.texto])).toEqual([['texto', '<b>Ver </b><a href="https://x">manual</a>'], ['alerta', 'Ojo']]);
  });
  test('tipos que la app antigua no conoce se descartan al volver', () => {
    expect(v2BlockToLegacy({ type: 'checkListItem', props: {}, content: [] })).toBeNull();
  });
});

test('htmlToText solo devuelve texto', () => {
  expect(htmlToText('<img src=x onerror=alert(1)>Hola<br>mundo &lt;b&gt;')).toBe('Hola\nmundo <b>');
  expect(htmlToText(null)).toBe('');
});
