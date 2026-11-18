// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"disableJavaScriptEvaluation":true,"disableJavaScriptFileLoading":true,"disableCSSFileLoading":true,"disableIframePageLoading":true}}
import { describe, expect, test } from 'vitest';
import { htmlToInline, inlineToHtml, type RichInline } from './richtext';
import { legacyBlockToV2, v2BlockToLegacy, type LegacyBlock } from './convert';

const br = { newline: 'br' } as const;
const canonical = (html: string) => inlineToHtml(htmlToInline(html), br);

describe('HTML e inline enriquecido', () => {
  test('ida y vuelta de negrita, cursiva, subrayado, tachado, color y enlaces', () => {
    const html = '<strong>Negrita</strong> <em>Cursiva</em> <u>Subrayado</u> <del>Tachado</del> '
      + '<span style="color:#A1B2C3"><b>Color</b></span> <font color="#AbC">Corto</font> '
      + '<a href="https://example.com/?a=1&amp;b=2"><i>Web</i></a> <a href="mailto:a@example.com">Correo</a>';
    const content = htmlToInline(html);
    expect(content).toContainEqual({ type: 'text', text: 'Color', styles: { bold: true, hexColor: '#a1b2c3' } });
    const generated = inlineToHtml(content, br);
    expect(generated).toBe('<b>Negrita</b> <i>Cursiva</i> <u>Subrayado</u> <s>Tachado</s> '
      + '<span style="color:#a1b2c3"><b>Color</b></span> <span style="color:#abc">Corto</span> '
      + '<a href="https://example.com/?a=1&amp;b=2"><i>Web</i></a> <a href="mailto:a@example.com">Correo</a>');
    expect(htmlToInline(generated)).toEqual(content);
  });

  test('interpreta todos los alias de marcas y conserva estilos heredados', () => {
    expect(canonical('<b><em><u><strike>Uno</strike><s>Dos</s></u></em></b>'))
      .toBe('<s><u><i><b>UnoDos</b></i></u></s>');
  });

  test('br y fin de párrafo, div y li producen saltos sin recortar texto', () => {
    const content = htmlToInline(' A<br>B<p>C</p><div>D</div><ul><li>E</li><li>F</li></ul> ');
    expect(inlineToHtml(content, { newline: '\n' })).toBe(' A\nBC\nD\nE\nF\n ');
    expect(inlineToHtml(content, br)).toBe(' A<br>BC<br>D<br>E<br>F<br> ');
  });

  test('recorta saltos de los extremos de párrafos y conserva los intermedios', () => {
    expect(htmlToInline('<p>Hola</p>')).toEqual([{ type: 'text', text: 'Hola', styles: {} }]);
    expect(htmlToInline('<p>a</p><p>b</p>')).toEqual([{ type: 'text', text: 'a\nb', styles: {} }]);
    expect(htmlToInline('<div><br>Hola<br></div>')).toEqual([{ type: 'text', text: 'Hola', styles: {} }]);
    expect(htmlToInline('<li>Hola</li>')).toEqual([{ type: 'text', text: 'Hola', styles: {} }]);
    expect(inlineToHtml(htmlToInline('\n<p>a</p><p></p><p>b</p>\n'), { newline: '\n' })).toBe('a\n\nb');
  });

  test('elimina tramos vacíos en los extremos, incluidos enlaces, y mantiene estilos y espacios', () => {
    expect(htmlToInline('<b><br></b><a href="https://example.com"><br></a>'
      + '<p><b>Hola</b> <i>mundo</i></p><i><br></i><a href="https://example.com"><br></a>'))
      .toEqual([
        { type: 'text', text: 'Hola', styles: { bold: true } },
        { type: 'text', text: ' ', styles: {} },
        { type: 'text', text: 'mundo', styles: { italic: true } },
      ]);
    expect(htmlToInline('<a href="https://example.com">\nHola\n</a>')).toEqual([
      { type: 'link', href: 'https://example.com', content: [{ type: 'text', text: 'Hola', styles: {} }] },
    ]);
    expect(htmlToInline('<p> Hola </p>')).toEqual([{ type: 'text', text: ' Hola ', styles: {} }]);
    expect(htmlToInline('<p><br></p><b>\n</b>')).toEqual([]);
  });

  test('escapa texto y atributos sin reinterpretar entidades como HTML', () => {
    expect(canonical('&lt;img onerror=x&gt; &amp; &quot;'))
      .toBe('&lt;img onerror=x&gt; &amp; &quot;');
    expect(inlineToHtml([{ type: 'link', href: 'https://example.com/"onclick="x', content: '<b>&' }], br))
      .toBe('<a href="https://example.com/&quot;onclick=&quot;x">&lt;b&gt;&amp;</a>');
  });
});

describe('lista blanca de entrada y salida', () => {
  test('descarta scripts, estilos, imágenes, iframes y atributos de eventos', () => {
    expect(canonical('<script>alert(1)</script><style>body{color:red}</style>'
      + '<img src=x onerror="alert(1)"><iframe srcdoc="">oculto</iframe>'
      + '<b onclick="alert(1)">Seguro</b><section data-x="1"> visible</section>'))
      .toBe('<b>Seguro</b> visible');
  });

  test.each(['javascript:alert(1)', 'data:text/html,mal', '//example.com', '/local', 'ftp://example.com',
    'java&#115;cript:alert(1)', 'java&#10;script:alert(1)', 'https://', 'https://exa&#10;mple.com'])(
  'descarta el enlace peligroso o no admitido %s conservando su texto y formato', (href) => {
    expect(canonical(`<a href="${href}" onclick="mal()"><b>Texto</b></a>`)).toBe('<b>Texto</b>');
  });

  test.each(['red', '#12', '#1234', '#12345678', 'rgb(1,2,3)', 'var(--color)',
    'url(https://example.com)', 'expression(alert(1))', '#abc url(x)', '#abc!important'])(
  'ignora colores que no sean hex RGB: %s', (color) => {
    expect(canonical(`<span style="color:${color}">Texto</span><font color="${color}">Fuente</font>`))
      .toBe('TextoFuente');
  });

  test('solo extrae el color hex de style, sin copiar url(), expresiones ni otros estilos', () => {
    expect(canonical('<span style="background:url(javascript:x);color:#123; width:expression(x)">Texto</span>'))
      .toBe('<span style="color:#123">Texto</span>');
  });

  test('valida también los estilos y enlaces que vienen directamente del editor', () => {
    const content: RichInline[] = [
      { type: 'text', text: '<img onerror=x>', styles: { hexColor: 'url(x)', bold: true, textColor: 'red' } },
      { type: 'link', href: 'javascript:alert(1)', content: [{ type: 'text', text: 'Seguro', styles: { italic: true } }] },
      { type: 'link', href: 'data:text/html,x', content: 'Datos' },
    ];
    expect(inlineToHtml(content, br)).toBe('<b>&lt;img onerror=x&gt;</b><i>Seguro</i>Datos');
  });
});

describe('conservación al convertir bloques', () => {
  test.each(['<p>Hola</p>', '<p>a</p><p>b</p>', '\n<div><b>Hola</b><br></div>\n', '<li>Hola</li>'])(
    'conserva el HTML original exacto tras recortar saltos: %s', (html) => {
      const original = { type: 'texto', html };
      expect(v2BlockToLegacy(legacyBlockToV2(original))).toEqual(original);
    },
  );

  test.each([
    ['titulo', 'titulo'], ['subtitulo', 'texto'], ['texto', 'html'], ['alerta', 'texto'], ['paso', 'titulo'],
  ])('editar una palabra en %s conserva el formato del resto', (type, field) => {
    const original: LegacyBlock = { type, [field]: 'Hola <b>mundo</b> <span style="color:#abc">color</span> '
      + '<a href="https://example.com"><i>enlace</i></a>', tipo: 'info', descripcion: 'Texto plano' };
    const block = legacyBlockToV2(original);
    expect(v2BlockToLegacy(block)).toEqual(original);
    const first = block.content![0];
    if (first.type !== 'text') throw new Error('Se esperaba texto');
    first.text = 'Adiós ';
    expect(v2BlockToLegacy(block)).toEqual({ ...original, [field]: 'Adiós <b>mundo</b> '
      + '<span style="color:#abc">color</span> <a href="https://example.com"><i>enlace</i></a>' });
  });

  test('un cambio solo de formato se guarda aunque el texto sea idéntico', () => {
    const block = legacyBlockToV2({ type: 'texto', html: '<b>Texto</b>' });
    block.content = htmlToInline('<i>Texto</i>');
    expect(v2BlockToLegacy(block)?.html).toBe('<i>Texto</i>');
  });

  test('conserva el original exacto aunque el editor reagrupe tramos equivalentes', () => {
    const original = { type: 'texto', html: '<strong>A</strong><b>B</b><span style="color: red">C</span>' };
    const block = legacyBlockToV2(original);
    block.content = [
      { type: 'text', text: 'A', styles: { bold: true } },
      { type: 'text', text: 'B', styles: { bold: true } },
      { type: 'text', text: 'C', styles: {} },
    ];
    expect(v2BlockToLegacy(block)).toEqual(original);
  });

  test('alerta guarda saltos como newline; el resto usa br', () => {
    const original = { type: 'alerta', tipo: 'peligro', texto: '<b>Ojo</b>\nSegunda' };
    const block = legacyBlockToV2(original);
    expect(v2BlockToLegacy(block)).toEqual(original);
    block.content = htmlToInline('<b>Cuidado</b><br>Segunda<br>Tercera');
    expect(v2BlockToLegacy(block)?.texto).toBe('<b>Cuidado</b>\nSegunda\nTercera');
    expect(v2BlockToLegacy({ ...block, type: 'paragraph', props: {} })?.html)
      .toBe('<b>Cuidado</b><br>Segunda<br>Tercera');
  });

  test('cada línea de alerta tiene marcas y enlaces completos para el render antiguo', () => {
    const content = htmlToInline('<a href="https://example.com"><b>Uno\nDos</b></a>');
    const html = inlineToHtml(content, { newline: '\n' });
    expect(html).toBe('<a href="https://example.com"><b>Uno</b></a>\n<a href="https://example.com"><b>Dos</b></a>');
    expect(inlineToHtml(htmlToInline(html), { newline: '\n' })).toBe(html);
  });
});
