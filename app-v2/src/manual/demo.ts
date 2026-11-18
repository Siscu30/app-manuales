import type { LegacyBlock } from './convert';

// Manual de ejemplo en el formato de la app actual, para el modo ?demo (solo desarrollo).
export const DEMO_MANUAL: LegacyBlock[] = [
  { id: 'd1', type: 'titulo', emoji: '🔧', titulo: 'Montaje en pared', subtitulo: '' },
  { id: 'd2', type: 'texto', html: 'Fija la base a 1,5 m del suelo, lejos de fuentes de calor y fuera del alcance directo desde la puerta de entrada.' },
  { id: 'd3', type: 'alerta', tipo: 'advertencia', texto: 'Corta la alimentación de 230 V antes de abrir la tapa. La batería de respaldo mantiene la placa activa.' },
  { id: 'd4', type: 'paso', titulo: 'Marca los taladros', descripcion: 'Usa la plantilla de cartón incluida y un nivel.' },
  { id: 'd5', type: 'paso', titulo: 'Pasa el cable por el pasamuros', descripcion: 'Deja 20 cm de holgura para la regleta de zonas.' },
  { id: 'd6', type: 'paso', titulo: 'Atornilla la base', descripcion: 'Tacos de 6 mm. Comprueba que el tamper trasero queda presionado.' },
  { id: 'd7', type: 'imagen', storagePath: 'demo/base.png', caption: 'Base con el tamper trasero', width: '80%' },
  { id: 'd8', type: 'tabla', columnas: ['Modelo', 'Consumo (mA)'], filas: [['SR-200', '35'], ['SR-310', '120']], align: ['left', 'right'] },
];
