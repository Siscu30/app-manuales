// Fuerza recarga si la página viene del bfcache (pulsar Atrás) para evitar estado congelado
window.addEventListener('pageshow', function(e) { if (e.persisted) window.location.reload(); });

// ═══════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════
const SUPABASE_URL = 'https://tbeqkabdkqffdcufvfof.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZXFrYWJka3FmZmRjdWZ2Zm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NzA3NjYsImV4cCI6MjA5NzM0Njc2Nn0.bPywboiecnWj7XHhWoM1ACG26mId4Naa5CYFSPAwzYg';
const COLORS = [
  {name:'Azul',    hex:'#2563EB'},
  {name:'Verde',   hex:'#16A34A'},
  {name:'Rojo',    hex:'#DC2626'},
  {name:'Morado',  hex:'#7C3AED'},
  {name:'Naranja', hex:'#EA580C'},
  {name:'Gris',    hex:'#4B5563'},
];
const EMOJIS = ['📋','📄','📌','🔧','⚙️','🛠','📊','🖥','🖨','📡','🔑','🔐','📁','💡','🚀','✅','⚡','🔍','📞','🏢'];

// ═══════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
});

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
let STATE = {
  user: null,
  role: null, // 'admin' | 'editor' | 'visualizador' | null (guest)
  manual: { id: null, titulo: 'Nuevo manual', empresa: '', color: '#2563EB', estado: 'borrador' },
  blocks: [],
  isDragging: false,
  dragSrcIdx: null,
  history: [],
  historyIdx: -1,
  selectedBlockId: null,
  editingBlockId: null,
  saveTimer: null,
  pages: [],
  activePage: null,
  mediaLibrary: [],
  isDirty: false,
  autoSaveTimer: null,
};

function uid() { return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)+Date.now().toString(36); }

// ═══════════════════════════════════════════════════════
// ICON LIBRARY (Feather/Lucide, MIT license, inline SVG)
// Format: [key, name, category, svgInnerHTML]
// ═══════════════════════════════════════════════════════
const ICON_LIB = [
  ['check','Correcto','estado','<polyline points="20 6 9 17 4 12"/>'],
  ['check-circle','OK / Completado','estado','<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11"/>'],
  ['x-circle','Error / No','estado','<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'],
  ['alert-triangle','Advertencia','estado','<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'],
  ['alert-circle','Alerta','estado','<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'],
  ['info','Información','estado','<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'],
  ['help-circle','Ayuda / FAQ','estado','<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'],
  ['star','Destacado','estado','<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'],
  ['thumbs-up','Positivo','estado','<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>'],
  ['check-square','Tarea hecha','estado','<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'],
  ['arrow-right','Flecha derecha','accion','<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'],
  ['arrow-left','Flecha izquierda','accion','<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>'],
  ['arrow-up','Flecha arriba','accion','<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>'],
  ['arrow-down','Flecha abajo','accion','<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>'],
  ['chevron-right','Siguiente','accion','<polyline points="9 18 15 12 9 6"/>'],
  ['chevron-down','Desplegar','accion','<polyline points="6 9 12 15 18 9"/>'],
  ['plus','Añadir','accion','<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'],
  ['minus','Quitar','accion','<line x1="5" y1="12" x2="19" y2="12"/>'],
  ['search','Buscar','accion','<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'],
  ['edit','Editar','accion','<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'],
  ['trash','Eliminar','accion','<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'],
  ['download','Descargar','accion','<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'],
  ['upload','Subir','accion','<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'],
  ['copy','Copiar','accion','<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'],
  ['link','Enlace','accion','<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'],
  ['refresh-cw','Actualizar','accion','<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'],
  ['save','Guardar','accion','<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'],
  ['play','Reproducir','accion','<polygon points="5 3 19 12 5 21 5 3"/>'],
  ['user','Usuario','persona','<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'],
  ['users','Grupo','persona','<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'],
  ['phone','Teléfono','persona','<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>'],
  ['mail','Correo electrónico','persona','<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>'],
  ['message-square','Mensaje','persona','<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'],
  ['bell','Notificación','persona','<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'],
  ['file-text','Documento','doc','<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'],
  ['folder','Carpeta','doc','<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'],
  ['book','Libro / Manual','doc','<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'],
  ['clipboard','Portapapeles','doc','<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>'],
  ['printer','Imprimir','doc','<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'],
  ['list','Lista','doc','<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'],
  ['settings','Configuración','sistema','<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>'],
  ['lock','Seguridad','sistema','<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'],
  ['shield','Protección','sistema','<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'],
  ['database','Base de datos','sistema','<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>'],
  ['wifi','WiFi / Red','sistema','<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>'],
  ['key','Contraseña / Clave','sistema','<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>'],
  ['eye','Visibilidad','sistema','<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'],
  ['home','Inicio','negocio','<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'],
  ['briefcase','Trabajo / Empresa','negocio','<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'],
  ['bar-chart','Gráfico barras','negocio','<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="22" y1="20" x2="2" y2="20"/>'],
  ['trending-up','Tendencia alza','negocio','<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>'],
  ['award','Premio / Logro','negocio','<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>'],
  ['target','Objetivo','negocio','<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'],
  ['globe','Internacional','negocio','<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'],
  ['map-pin','Ubicación','negocio','<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'],
  ['clock','Tiempo / Hora','negocio','<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'],
  ['calendar','Fecha / Evento','negocio','<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'],
  ['zap','Urgente / Rápido','especial','<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'],
  ['layers','Proceso / Capas','especial','<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'],
  ['flag','Bandera / Hito','especial','<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>'],
  ['tag','Etiqueta','especial','<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>'],
  ['package','Paquete','especial','<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'],
  ['cpu','Procesador','especial','<rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>'],
  /* ── Estado adicional ── */
  ['heart','Favorito','estado','<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'],
  ['bookmark','Guardar / Marcar','estado','<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'],
  ['thumbs-down','Negativo','estado','<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>'],
  ['x-square','Error cuadrado','estado','<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>'],
  ['shield-check','Verificado','estado','<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>'],
  /* ── Acción adicional ── */
  ['external-link','Abrir externo','accion','<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'],
  ['share','Compartir','accion','<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>'],
  ['filter','Filtrar','accion','<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>'],
  ['send','Enviar','accion','<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>'],
  ['log-in','Entrar','accion','<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>'],
  ['log-out','Salir','accion','<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'],
  ['zoom-in','Ampliar','accion','<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>'],
  ['zoom-out','Reducir','accion','<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>'],
  ['rotate-cw','Rotar derecha','accion','<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>'],
  ['move','Mover','accion','<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>'],
  ['maximize','Maximizar','accion','<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>'],
  /* ── Persona adicional ── */
  ['user-plus','Añadir usuario','persona','<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>'],
  ['user-check','Usuario verificado','persona','<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>'],
  ['at-sign','Mención / Email','persona','<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>'],
  /* ── Documento adicional ── */
  ['file-plus','Nuevo archivo','doc','<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>'],
  ['archive','Archivar','doc','<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>'],
  ['code','Código HTML','doc','<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'],
  ['terminal','Terminal','doc','<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>'],
  ['sliders','Ajustes','doc','<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'],
  /* ── Sistema adicional ── */
  ['monitor','Monitor','sistema','<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'],
  ['smartphone','Móvil','sistema','<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>'],
  ['hard-drive','Disco duro','sistema','<line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/>'],
  ['server','Servidor','sistema','<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>'],
  ['power','Encender','sistema','<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>'],
  ['cloud','Nube','sistema','<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>'],
  ['toggle-right','Activado','sistema','<rect x="1" y="5" width="22" height="14" rx="7" ry="7"/><circle cx="16" cy="12" r="3"/>'],
  ['toggle-left','Desactivado','sistema','<rect x="1" y="5" width="22" height="14" rx="7" ry="7"/><circle cx="8" cy="12" r="3"/>'],
  /* ── Negocio adicional ── */
  ['dollar-sign','Precio / Coste','negocio','<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'],
  ['percent','Porcentaje','negocio','<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>'],
  ['shopping-cart','Carrito','negocio','<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'],
  ['truck','Envío','negocio','<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>'],
  ['activity','Actividad','negocio','<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'],
  ['pie-chart','Gráfico circular','negocio','<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>'],
  ['grid','Cuadrícula','negocio','<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'],
  ['navigation','Navegación','negocio','<polygon points="3 11 22 2 13 21 11 13 3 11"/>'],
  ['compass','Brújula','negocio','<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>'],
  /* ── Especial adicional ── */
  ['sun','Sol / Día','especial','<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'],
  ['moon','Luna / Noche','especial','<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'],
  ['droplet','Agua / Fluido','especial','<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>'],
  ['feather','Ligero / Suave','especial','<path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/>'],
  ['columns','Columnas','especial','<path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"/>'],
  ['life-buoy','Soporte','especial','<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>'],
  ['umbrella','Protección clima','especial','<path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"/>'],
  ['paperclip','Adjunto','especial','<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'],
  ['mic','Micrófono','especial','<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>'],
  ['music','Música','especial','<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'],
  ['image','Imagen','especial','<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'],
  ['video','Vídeo','especial','<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>'],
  ['headphones','Auriculares','especial','<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>'],
];

function iconSVG(key, size, color) {
  const ic = ICON_LIB.find(i => i[0] === key);
  if (!ic) return '';
  const s = size || 20;
  const c = color || 'currentColor';
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0">${ic[3]}</svg>`;
}

let _ipCurCat = 'all', _ipCurSearch = '', _ipCallback = null;

function openIconPicker(cb) {
  _ipCallback = cb;
  _ipCurCat = 'all'; _ipCurSearch = '';
  q('#ip-search').value = '';
  document.querySelectorAll('.ip-cat').forEach(b=>b.classList.toggle('active', b.textContent==='Todos'));
  q('#ip-selected').value = '';
  _ipRender();
  q('#modal-icon-picker').classList.add('open');
}
function openIconPickerForEditor() {
  openIconPicker(function(key) {
    const hi = q('#be-icon');
    const prev = q('#be-icon-preview');
    const colorEl = q('#be-color');
    const color = colorEl ? colorEl.value : undefined;
    const size = prev ? (prev.offsetWidth >= 40 ? 36 : 24) : 24;
    if (hi) hi.value = key;
    if (prev) prev.innerHTML = key ? iconSVG(key, size, color) : '<span style="color:var(--text-muted);font-size:18px">–</span>';
  });
}
function clearEditorIcon() {
  const hi = q('#be-icon'); const prev = q('#be-icon-preview');
  if (hi) hi.value = '';
  if (prev) prev.innerHTML = '<span style="color:var(--text-muted);font-size:18px">–</span>';
}
function closeIconPicker() {
  q('#modal-icon-picker').classList.remove('open');
  _ipCallback = null;
}
function _ipCat(cat, btn) {
  _ipCurCat = cat;
  document.querySelectorAll('.ip-cat').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _ipRender();
}
function _ipFilter() {
  _ipCurSearch = q('#ip-search').value;
  _ipRender();
}
function _ipRender() {
  const sel = q('#ip-selected').value;
  const list = ICON_LIB.filter(ic => {
    const mc = _ipCurCat === 'all' || ic[2] === _ipCurCat;
    const ms = !_ipCurSearch || ic[1].toLowerCase().includes(_ipCurSearch.toLowerCase()) || ic[0].includes(_ipCurSearch.toLowerCase());
    return mc && ms;
  });
  q('#ip-grid').innerHTML = list.map(ic =>
    `<div class="ip-icon${sel===ic[0]?' sel':''}" data-k="${ic[0]}" onclick="_ipSelect('${ic[0]}')" title="${ic[1]}">
      ${iconSVG(ic[0],24)}
      <span>${ic[1]}</span>
    </div>`
  ).join('') || '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text-muted);font-size:13px">Sin resultados</div>';
}
function _ipSelect(key) {
  q('#ip-selected').value = key;
  document.querySelectorAll('#ip-grid .ip-icon').forEach(el=>el.classList.toggle('sel', el.dataset.k===key));
}
function _ipConfirm() {
  const key = q('#ip-selected').value;
  if (!key) { closeIconPicker(); return; }
  if (_ipCallback) _ipCallback(key);
  closeIconPicker();
}
function _icoPreviewColor(val) {
  const cv = q('#be-color-val'); if (cv) cv.textContent = val;
  const prev = q('#be-icon-preview');
  const key = q('#be-icon'); if (!prev || !key || !key.value) return;
  prev.innerHTML = iconSVG(key.value, 36, val);
}

// ═══════════════════════════════════════════════════════
// BLOCK TYPES REGISTRY
// ═══════════════════════════════════════════════════════
const BLOCK_TYPES = {
  titulo: {
    label: 'Título de sección',
    defaultData: () => ({ emoji:'📋', titulo:'Nueva sección', subtitulo:'' }),
    render(b) {
      const bgC = normalizeHex(b.blockBgColor || '#4a4a4a');
      const textC = isLightColor(bgC) ? '#1a1a1a' : '#ffffff';
      const subC = isLightColor(bgC) ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.7)';
      return `<div class="b-titulo block-inner" style="background:${bgC};border-left:none;text-align:center;color:${textC}">
        <span class="b-emoji" onclick="openEmojiPicker('${b.id}')" title="Cambiar emoji">${b.emoji||'📋'}</span>
        <div contenteditable="true" class="b-titulo-t" data-id="${b.id}" data-field="titulo" data-rich="1" data-placeholder="Título de sección" spellcheck="false" onblur="saveInlineEdit(this)" style="color:${textC}">${b.titulo||''}</div>
        <div contenteditable="true" class="subtitulo" data-id="${b.id}" data-field="subtitulo" data-rich="1" data-placeholder="Subtítulo opcional..." spellcheck="false" onblur="saveInlineEdit(this)" style="color:${subC}">${b.subtitulo||''}</div>
      </div>`;
    },
    toTeamsText(b) { return `${b.emoji||'📋'} **${b.titulo||''}**\n${b.subtitulo ? b.subtitulo+'\n' : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`; }
  },
  subtitulo: {
    label: 'Subtítulo',
    defaultData: () => ({ texto:'Subtítulo del tema', blockBgColor:'#64748b' }),
    render(b) {
      const bgC = normalizeHex(b.blockBgColor || '#64748b');
      const textC = isLightColor(bgC) ? '#1a1a1a' : '#ffffff';
      return `<div class="b-subtitulo block-inner" style="background:${bgC};text-align:center;color:${textC}">
        <div contenteditable="true" class="sub-text" data-id="${b.id}" data-field="texto" data-rich="1" data-placeholder="Subtítulo del tema" spellcheck="false" onblur="saveInlineEdit(this)" style="color:${textC}">${b.texto||''}</div>
      </div>`;
    },
    toTeamsText(b) { return `**${(b.texto||'').replace(/<[^>]+>/g,'')}**`; }
  },
  alerta: {
    label: 'Alerta / Aviso',
    defaultData: () => ({ tipo:'info', texto:'Texto de la alerta' }),
    render(b) {
      const icons = {info:'ℹ️', advertencia:'⚠️', peligro:'🚨', exito:'✅'};
      const _aIcon = b.icon ? iconSVG(b.icon,18) : (icons[b.tipo||'info']||'ℹ️');
      const _aItems = (b.texto||'').split('\n').filter(l=>l.trim()).map(l=>`<li>${l}</li>`).join('');
      const TIPOS = [['info','ℹ️'],['advertencia','⚠️'],['peligro','🚨'],['exito','✅']];
      const tipoBtns = TIPOS.map(([t,ic])=>`<span class="alerta-tipo-btn${(b.tipo||'info')===t?' active':''}" onmousedown="event.preventDefault()" onclick="event.stopPropagation();setAlertaTipo('${b.id}','${t}')" title="${t}">${ic}</span>`).join('');
      return `<div class="b-alerta block-inner ${b.tipo||'info'}">
        <span class="alert-icon">${_aIcon}</span>
        <div class="alerta-body">
          <ul contenteditable="true" class="alert-text" data-id="${b.id}" data-field="texto" data-placeholder="Escribe la alerta… (Enter = nuevo punto)" spellcheck="false" onblur="saveInlineEdit(this)">${_aItems}</ul>
          <div class="alerta-tipos">${tipoBtns}</div>
        </div>
      </div>`;
    },
    toTeamsText(b) {
      const icons = {info:'ℹ️', advertencia:'⚠️', peligro:'🚨', exito:'✅'};
      return `${icons[b.tipo||'info']} ${(b.texto||'').replace(/<[^>]+>/g,'')}`;
    }
  },
  paso: {
    label: 'Paso numerado',
    defaultData: () => ({ titulo:'Título del paso', descripcion:'Describe el paso...', storagePath:null, caption:'' }),
    render(b, pasoN) {
      const _annBtn = `<button onmousedown="event.stopPropagation()" onclick="openAnnotationEditor('${b.id}')" style="background:#2563EB;color:#fff;border:none;border-radius:4px;padding:2px 7px;font-size:10px;cursor:pointer;white-space:nowrap;flex-shrink:0;line-height:1.6" title="Anotar imagen">✏️</button>`;
      const _delBtn = `<button onmousedown="event.stopPropagation()" onclick="removeBlockImage('${b.id}')" title="Quitar imagen" style="background:#ef4444;color:#fff;border:none;border-radius:4px;padding:2px 7px;font-size:10px;cursor:pointer;white-space:nowrap;flex-shrink:0;line-height:1.6">✕</button>`;
      const _capRow = `<div style="display:flex;align-items:center;gap:6px;padding:4px 16px;border-top:1px solid var(--border);background:#fafafa"><div class="paso-caption" contenteditable="true" data-id="${b.id}" data-field="caption" data-placeholder="Pie de foto..." onblur="saveInlineEdit(this)" style="flex:1;border:none;padding:2px 0;background:transparent">${esc(b.caption||'')}</div>${_annBtn}${_delBtn}</div>`;
      // b.src takes priority (annotated image), then storagePath (lazy-loaded), then upload prompt
      const imgHTML = b.src
        ? `<div class="b-paso-img-wrap">
             <img src="${b.src}" class="b-paso-img" alt="${esc(b.caption||'')}" onclick="openLightbox(this)">
             ${_capRow}
           </div>`
        : b.storagePath
        ? `<div class="b-paso-img-wrap">
             <img src="" data-path="${b.storagePath}" class="b-paso-img lazy-img" alt="${esc(b.caption||'')}" onclick="openLightbox(this)">
             ${_capRow}
           </div>`
        : `<div class="img-src-actions">
             <label class="paso-upload-btn" title="Subir imagen del equipo">
               📷 <span>Subir</span>
               <input type="file" accept="image/*" style="display:none" onchange="uploadBlockImage(this,'${b.id}')">
             </label>
             <button type="button" class="paso-upload-btn repo-btn" title="Elegir del repositorio del manual" onclick="event.stopPropagation();openMediaPicker('${b.id}')">🗂 <span>Repositorio</span></button>
           </div>`;
      const _descItems = (b.descripcion||'').split('\n').filter(l=>l.trim()).map(l=>`<li>${l}</li>`).join('');
      return `<div class="b-paso block-inner">
        <div class="b-paso-header">
          <div class="paso-num${b.resetStep?' paso-reset':''}" title="${b.resetStep?'Reinicia contador desde 1':'Click para reiniciar contador aqui'}" onclick="event.stopPropagation();toggleResetStep('${b.id}')" style="cursor:pointer;position:relative">${pasoN}${b.resetStep?'<span style="position:absolute;top:-7px;right:-7px;background:#f97316;color:#fff;font-size:8px;border-radius:3px;padding:1px 3px;line-height:1;pointer-events:none">R1</span>':''}</div>
          <div class="paso-body">
            <div contenteditable="true" class="paso-titulo" data-id="${b.id}" data-field="titulo" data-rich="1" data-placeholder="Título del paso" spellcheck="false" onblur="saveInlineEdit(this)">${b.titulo||''}</div>
            <ul contenteditable="true" class="paso-desc-ul" data-id="${b.id}" data-field="descripcion" data-placeholder="Descripción del paso..." spellcheck="false" onblur="saveInlineEdit(this)">${_descItems}</ul>
          </div>
        </div>
        ${imgHTML}
      </div>`;
    },
    toTeamsText(b, pasoN) {
      return `${pasoN}. **${b.titulo||''}**\n   ${b.descripcion||''}${(b.storagePath||b.src) ? `\n   📷 [Imagen: ${b.caption||''}]` : ''}`;
    }
  },
  imagen: {
    label: 'Imagen',
    defaultData: () => ({ storagePath:null, caption:'', width:'100%' }),
    render(b) {
      const _annBtn = `<button onmousedown="event.stopPropagation()" onclick="openAnnotationEditor('${b.id}')" style="background:#2563EB;color:#fff;border:none;border-radius:6px;padding:3px 9px;font-size:11px;cursor:pointer;white-space:nowrap;flex-shrink:0;line-height:1.6">✏️ Anotar</button>`;
      const _delBtn = `<button onmousedown="event.stopPropagation()" onclick="removeBlockImage('${b.id}')" title="Quitar imagen" style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:3px 9px;font-size:11px;cursor:pointer;white-space:nowrap;flex-shrink:0;line-height:1.6">✕ Quitar</button>`;
      const _capRow = `<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;border-top:1px solid var(--border);background:#fafafa"><div class="img-caption" contenteditable="true" data-id="${b.id}" data-field="caption" data-placeholder="Pie de foto..." onblur="saveInlineEdit(this)" style="flex:1;border:none;padding:2px 0;background:transparent">${esc(b.caption||'')}</div>${_annBtn}${_delBtn}</div>`;
      if (b.src) {
        return `<div class="b-imagen block-inner">
          <img src="${b.src}" style="width:${b.width||'100%'};display:block" alt="${esc(b.alt||b.caption||'')}" onclick="openLightbox(this)">
          ${_capRow}
        </div>`;
      }
      if (b.storagePath) {
        return `<div class="b-imagen block-inner">
          <img src="" data-path="${b.storagePath}" class="lazy-img" style="width:${b.width||'100%'}" alt="${esc(b.caption||'')}" onclick="openLightbox(this)">
          ${_capRow}
        </div>`;
      }
      return `<div class="b-imagen block-inner">
        <label class="img-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
          <span>Clic o arrastra una imagen</span>
          <input type="file" accept="image/*" style="display:none" onchange="uploadBlockImage(this,'${b.id}')">
        </label>
        <button type="button" class="img-repo-btn" onclick="event.stopPropagation();openMediaPicker('${b.id}')" title="Elegir del repositorio del manual">🗂 Elegir del repositorio</button>
      </div>`;
    },
    toTeamsText(b) { return `📷 [Imagen: ${b.caption||''}]`; }
  },
  tabla: {
    label: 'Tabla de referencia',
    defaultData: () => ({ columnas:['Columna 1','Columna 2'], filas:[['',''],['','']] }),
    render(b) {
      const headers = (b.columnas||[]).map(c=>`<th>${esc(c)}</th>`).join('');
      const rows = (b.filas||[]).map(row=>`<tr>${(row||[]).map(cell=>`<td>${esc(cell)}</td>`).join('')}</tr>`).join('');
      return `<div class="b-tabla block-inner editable-dbl" title="Doble clic para editar" ondblclick="openBlockEditor('${b.id}')">
        <table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
      </div>`;
    },
    editorHTML(b) {
      const cols = b.columnas||['Columna 1','Columna 2'];
      const rows = b.filas||[['',''],['','']];
      return `<div class="tabla-editor">
        <div class="form-group"><label class="form-label">Columnas (${cols.length})</label>
          <div id="cols-editor">${cols.map((c,i)=>`<input class="form-input" style="margin-bottom:4px" value="${esc(c)}" data-ci="${i}" placeholder="Nombre columna">`).join('')}</div>
          <button class="tabla-add-btn" onclick="addTablaCol()">+ Añadir columna</button>
        </div>
        <div class="form-group"><label class="form-label">Filas</label>
          <table style="width:100%;border-collapse:collapse" id="rows-editor">
            <thead><tr id="rows-header">${cols.map((_,i)=>`<th style="border:1px solid var(--border);padding:4px;font-size:12px">Col ${i+1}</th>`).join('')}</tr></thead>
            <tbody id="rows-body">
              ${rows.map((row,ri)=>`<tr>${cols.map((_,ci)=>`<td style="border:1px solid var(--border);padding:2px"><input class="form-input" style="border:none;padding:6px" value="${esc((row||[])[ci]||'')}" data-ri="${ri}" data-ci="${ci}"></td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
          <button class="tabla-add-btn" onclick="addTablaRow()">+ Añadir fila</button>
        </div>
      </div>`;
    },
    saveEditor(b) {
      const colInputs = document.querySelectorAll('#cols-editor input');
      b.columnas = Array.from(colInputs).map(i=>i.value||'');
      const rowInputs = document.querySelectorAll('#rows-body input');
      const nCols = b.columnas.length;
      const nRows = Math.ceil(rowInputs.length / nCols);
      b.filas = [];
      for(let r=0;r<nRows;r++) {
        b.filas.push(Array.from({length:nCols},(_,c)=>{ const el=rowInputs[r*nCols+c]; return el?el.value:''; }));
      }
    },
    toTeamsText(b) {
      const header = (b.columnas||[]).join(' | ');
      const rows = (b.filas||[]).map(r=>(r||[]).join(' | ')).join('\n');
      return `${header}\n${'─'.repeat(header.length)}\n${rows}`;
    }
  },
  lista: {
    label: 'Lista verificación',
    defaultData: () => ({ items:[{icono:'check',texto:'Elemento 1'},{icono:'cross',texto:'Elemento 2'}] }),
    render(b) {
      const items = (b.items||[]).map(it=>`<div class="lista-item">
        <span class="li-icon">${it.icono==='check'?'✅':'❌'}</span>
        <span class="li-text">${esc(it.texto||'')}</span>
      </div>`).join('');
      return `<div class="b-lista block-inner editable-dbl" title="Doble clic para editar" ondblclick="openBlockEditor('${b.id}')">${items||'<em style="color:var(--text-muted)">Sin elementos</em>'}</div>`;
    },
    editorHTML(b) {
      const items = b.items||[];
      return `<div id="lista-items">
        ${items.map((it,i)=>`<div style="display:flex;gap:8px;margin-bottom:8px" data-li="${i}">
          <select class="form-select" style="width:100px" data-field="icono">
            <option value="check" ${it.icono==='check'?'selected':''}>✅ Check</option>
            <option value="cross" ${it.icono==='cross'?'selected':''}>❌ Cruz</option>
          </select>
          <input class="form-input" style="flex:1" value="${esc(it.texto||'')}" data-field="texto" placeholder="Texto del elemento">
          <button class="btn btn-sm" onclick="this.closest('[data-li]').remove()" style="flex-shrink:0">🗑</button>
        </div>`).join('')}
      </div>
      <button class="btn btn-sm" onclick="addListaItem()" style="margin-top:4px">+ Añadir elemento</button>`;
    },
    saveEditor(b) {
      const rows = document.querySelectorAll('#lista-items [data-li]');
      b.items = Array.from(rows).map(row=>({
        icono: row.querySelector('[data-field="icono"]').value,
        texto: row.querySelector('[data-field="texto"]').value
      }));
    },
    toTeamsText(b) {
      return (b.items||[]).map(it=>`${it.icono==='check'?'✅':'❌'} ${it.texto||''}`).join('\n');
    }
  },
  separador: {
    label: 'Separador',
    defaultData: () => ({}),
    render() { return `<div class="b-separador block-inner"><hr></div>`; },
    toTeamsText() { return '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'; }
  },
  texto: {
    label: 'Texto libre',
    defaultData: () => ({ html:'Escribe aquí tu texto...' }),
    render(b) {
      const hasImg = b.src || b.storagePath;
      const imgTag = b.src
        ? `<img src="${b.src}" class="b-texto-pic" onclick="openLightbox(this)" alt="">`
        : b.storagePath
        ? `<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-path="${b.storagePath}" class="b-texto-pic lazy-img img-skeleton" onclick="openLightbox(this)" alt="">`
        : '';
      const imgArea = hasImg
        ? `<div class="b-texto-imgwrap">${imgTag}<button class="b-texto-imgdel" onmousedown="event.stopPropagation()" onclick="removeBlockImage('${b.id}')" title="Quitar imagen">✕</button></div>`
        : `<label class="b-texto-addimg" title="Añadir imagen">📷 Imagen<input type="file" accept="image/*" style="display:none" onchange="uploadBlockImage(this,'${b.id}')"></label>`;
      return `<div class="b-texto-wrap block-inner">
        <div class="b-texto-edit" contenteditable="true" data-id="${b.id}" data-field="html" onblur="saveInlineEdit(this)" onkeydown="handleTextoKey(event)">${b.html||''}</div>
        ${imgArea}
      </div>`;
    },
    toTeamsText(b) {
      const tmp = document.createElement('div');
      tmp.innerHTML = b.html||'';
      return tmp.textContent||'';
    }
  },
  video: {
    label: 'Vídeo',
    defaultData: () => ({ url:'', titulo:'', caption:'', videoType:'link', src:'' }),
    render(b) {
      if (b.videoType === 'file' && (b.src || b.storagePath)) {
        const _vtag = b.src
          ? `<video controls style="width:100%;border-radius:6px;display:block" src="${b.src}"></video>`
          : `<video controls style="width:100%;border-radius:6px;display:block" class="lazy-video" data-vpath="${b.storagePath}"></video>`;
        return `<div class="b-video block-inner" ondblclick="openBlockEditor('${b.id}')">
          ${_vtag}
          ${b.titulo?`<div class="video-caption">${esc(b.titulo)}</div>`:''}
        </div>`;
      }
      if (b.videoType === 'pdf' && b.url) {
        return `<div class="b-video block-inner video-link" ondblclick="openBlockEditor('${b.id}')">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:28px;flex-shrink:0">📄</span>
            <div><div style="font-weight:600;font-size:14px">${esc(b.titulo||b.url)}</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">${esc(b.url)}</div></div>
          </div>
        </div>`;
      }
      if (!b.url) {
        return `<div class="b-video block-inner" ondblclick="openBlockEditor('${b.id}')">
          <div class="video-placeholder"><span style="font-size:36px">🎬</span><span>Doble clic para añadir un vídeo (YouTube, Vimeo...)</span></div>
        </div>`;
      }
      const embed = getVideoEmbedUrl(b.url);
      if (embed) {
        return `<div class="b-video block-inner" ondblclick="openBlockEditor('${b.id}')">
          <iframe src="${embed}" allowfullscreen></iframe>
          ${b.caption?`<div class="video-caption">${esc(b.caption)}</div>`:''}
        </div>`;
      }
      return `<div class="b-video block-inner video-link" ondblclick="openBlockEditor('${b.id}')">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:28px;flex-shrink:0">🎬</span>
          <div><div style="font-weight:600;font-size:14px">${esc(b.titulo||b.url)}</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">${esc(b.url)}</div></div>
        </div>
      </div>`;
    },
    editorHTML(b) {
      const vt = b.videoType || 'link';
      const tab = (t, icon, label) => `<span id="be-vtab-${t}" style="flex:1;cursor:pointer;text-align:center;padding:8px 4px;border-radius:6px;border:2px solid ${vt===t?'var(--primary)':'var(--border-color)'};font-size:13px;font-weight:${vt===t?600:400};background:${vt===t?'rgba(37,99,235,0.08)':'transparent'}" onclick="switchVideoTab('${t}')">${icon} ${label}</span>`;
      return `<div style="display:flex;gap:6px;margin-bottom:16px">
        ${tab('link','🔗','Enlace')}${tab('file','📹','MP4')}${tab('pdf','📄','PDF')}
      </div>
      <input type="hidden" id="be-vtype" value="${vt}">
      <div id="be-vsec-link" style="display:${vt==='link'?'block':'none'}">
        <div class="form-group"><label class="form-label">URL del vídeo</label>
          <input class="form-input" id="be-url" value="${esc(b.url||'')}" placeholder="https://youtu.be/... o enlace de Teams">
          <p style="font-size:12px;color:var(--text-muted);margin-top:4px">YouTube, Vimeo o cualquier URL de vídeo</p></div>
        <div class="form-group"><label class="form-label">Título (opcional)</label>
          <input class="form-input" id="be-titulo" value="${esc(b.titulo||'')}" placeholder="Nombre del vídeo"></div>
        <div class="form-group"><label class="form-label">Pie de vídeo (opcional)</label>
          <input class="form-input" id="be-caption" value="${esc(b.caption||'')}" placeholder="Descripción breve"></div>
      </div>
      <div id="be-vsec-file" style="display:${vt==='file'?'block':'none'}">
        <div class="form-group"><label class="form-label">Archivo MP4</label>
          <p style="font-size:12px;color:var(--text-muted);margin-bottom:6px">Se sube a tu almacenamiento y se incrusta en el manual al exportar (se ve sin conexión). Máx. 50 MB — usa clips cortos a 720p.</p>
          <div id="be-video-status" style="font-size:12px;margin-bottom:8px">${(b.storagePath&&b.videoType==='file')?'<span style="color:#16a34a">✓ Vídeo subido</span>':(b.src&&b.videoType==='file')?'<span style="color:#16a34a">✓ Vídeo cargado (formato anterior)</span>':''}</div>
          <input type="file" class="form-input" id="be-video-file" accept="video/mp4,video/*" onchange="uploadVideoFile(this)">
          <input type="hidden" id="be-video-storagepath" value="${esc(b.videoType==='file'?b.storagePath||'':'')}">
          <input type="hidden" id="be-video-src" value="${esc(b.videoType==='file'?b.src||'':'')}">
        </div>
        <div class="form-group"><label class="form-label">Título (opcional)</label>
          <input class="form-input" id="be-titulo-file" value="${esc(b.titulo||'')}" placeholder="Nombre del vídeo"></div>
      </div>
      <div id="be-vsec-pdf" style="display:${vt==='pdf'?'block':'none'}">
        <div class="form-group"><label class="form-label">URL del PDF</label>
          <input class="form-input" id="be-pdf-url" value="${esc(b.videoType==='pdf'?b.url||'':'')}" placeholder="https://..."></div>
        <div class="form-group"><label class="form-label">Título</label>
          <input class="form-input" id="be-pdf-titulo" value="${esc(b.videoType==='pdf'?b.titulo||'':'')}"></div>
      </div>`;
    },
    saveEditor(b) {
      const vt = q('#be-vtype')?.value || 'link';
      b.videoType = vt;
      if (vt === 'file') {
        const newPath = q('#be-video-storagepath')?.value;
        const newSrc = q('#be-video-src')?.value;
        if (newPath) { b.storagePath = newPath; b.src = ''; }
        else if (newSrc) { b.src = newSrc; }
        b.titulo = q('#be-titulo-file')?.value.trim() || '';
        b.url = ''; b.caption = '';
      } else if (vt === 'pdf') {
        b.url = q('#be-pdf-url')?.value.trim() || '';
        b.titulo = q('#be-pdf-titulo')?.value.trim() || '';
        b.src = ''; b.caption = '';
      } else {
        b.url = q('#be-url')?.value.trim() || '';
        b.titulo = q('#be-titulo')?.value.trim() || '';
        b.caption = q('#be-caption')?.value.trim() || '';
        b.src = '';
      }
    },
    toTeamsText(b) {
      if (b.videoType==='pdf') return `📄 ${b.titulo||b.url||'PDF'}\n${b.url||''}`;
      if (b.videoType==='file') return `📹 ${b.titulo||'Vídeo MP4'}`;
      return `🎬 ${b.titulo||b.url||'Vídeo'}\n${b.url||''}`;
    }
  },
  enlace: {
    label: 'Enlace / URL',
    defaultData: () => ({ url:'', titulo:'', descripcion:'' }),
    render(b) {
      const title = b.titulo || b.url || 'Enlace';
      return `<div class="b-enlace block-inner" ondblclick="openBlockEditor('${b.id}')">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <span style="font-size:22px;flex-shrink:0;margin-top:1px">🔗</span>
          <div style="flex:1;min-width:0">
            <div class="enlace-title">${esc(title)}</div>
            ${b.url?`<div class="enlace-url">${esc(b.url)}</div>`:''}
            ${b.descripcion?`<div class="enlace-desc">${esc(b.descripcion)}</div>`:''}
          </div>
          ${b.url?`<a href="${esc(b.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="btn btn-sm" style="flex-shrink:0">Abrir →</a>`:''}
        </div>
      </div>`;
    },
    editorHTML(b) {
      return `<div class="form-group"><label class="form-label">URL</label>
        <input class="form-input" id="be-url" value="${esc(b.url||'')}" placeholder="https://..."></div>
        <div class="form-group"><label class="form-label">Título</label>
        <input class="form-input" id="be-titulo" value="${esc(b.titulo||'')}" placeholder="Nombre del enlace"></div>
        <div class="form-group"><label class="form-label">Descripción (opcional)</label>
        <textarea class="form-textarea" id="be-desc">${esc(b.descripcion||'')}</textarea></div>`;
    },
    saveEditor(b) { b.url=q('#be-url').value.trim(); b.titulo=q('#be-titulo').value.trim(); b.descripcion=q('#be-desc').value.trim(); },
    toTeamsText(b) { return `🔗 ${b.titulo||b.url||'Enlace'} → ${b.url||''}`; }
  },
  flujos: {
    label: 'Tabla de flujos',
    defaultData: () => ({ filas:[{condicion:'Condición de ejemplo',accion:'Acción a tomar'},{condicion:'',accion:''}] }),
    render(b) {
      const rows = (b.filas||[]).map(r=>`<tr><td>${esc(r.condicion||'')}</td><td>${esc(r.accion||'')}</td></tr>`).join('');
      return `<div class="b-flujos block-inner" ondblclick="openBlockEditor('${b.id}')">
        <table><thead><tr><th>Condición</th><th>Acción</th></tr></thead><tbody>${rows}</tbody></table>
      </div>`;
    },
    editorHTML(b) {
      const rows = b.filas||[];
      return `<div id="flujos-rows">
        ${rows.map((r,i)=>`<div style="display:grid;grid-template-columns:1fr 1fr 32px;gap:6px;margin-bottom:6px" data-ri="${i}">
          <input class="form-input" value="${esc(r.condicion||'')}" placeholder="Condición" data-field="condicion">
          <input class="form-input" value="${esc(r.accion||'')}" placeholder="Acción" data-field="accion">
          <button class="btn btn-sm" onclick="this.closest('[data-ri]').remove()">🗑</button>
        </div>`).join('')}
      </div>
      <button class="btn btn-sm" onclick="addFlujoRow()" style="margin-top:4px">+ Añadir fila</button>`;
    },
    saveEditor(b) {
      const rows = document.querySelectorAll('#flujos-rows [data-ri]');
      b.filas = Array.from(rows).map(row=>({
        condicion: row.querySelector('[data-field="condicion"]').value,
        accion: row.querySelector('[data-field="accion"]').value
      }));
    },
    toTeamsText(b) {
      const header = 'Condición | Acción';
      return header + '\n' + (b.filas||[]).map(r=>`${r.condicion||''} | ${r.accion||''}`).join('\n');
    }
  },
  codigo: {
    label: 'Código',
    defaultData: () => ({ language:'javascript', code:'' }),
    render(b) {
      const lang = b.language || 'javascript';
      return `<div class="b-codigo block-inner" ondblclick="openBlockEditor('${b.id}')">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#1e293b;border-radius:8px 8px 0 0">
          <span style="font-size:11px;color:#94a3b8;font-family:monospace;letter-spacing:.5px">${esc(lang)}</span>
          <span style="font-size:16px">💻</span>
        </div>
        <pre style="margin:0;padding:14px;background:#0f172a;border-radius:0 0 8px 8px;overflow-x:auto;font-size:13px;line-height:1.6;color:#e2e8f0;font-family:'Fira Code',Consolas,monospace;white-space:pre-wrap;word-break:break-all">${esc(b.code||'// Tu código aquí')}</pre>
      </div>`;
    },
    editorHTML(b) {
      const langs = ['javascript','typescript','python','bash','sql','html','css','json','xml','yaml','php','java','csharp','go','rust','other'];
      return `<div class="form-group"><label class="form-label">Lenguaje</label>
        <select class="form-input" id="be-lang">
          ${langs.map(l=>`<option value="${l}"${(b.language||'javascript')===l?' selected':''}>${l}</option>`).join('')}
        </select></div>
        <div class="form-group"><label class="form-label">Código</label>
        <textarea class="form-textarea" id="be-code" rows="10" style="font-family:monospace;font-size:13px">${esc(b.code||'')}</textarea></div>`;
    },
    saveEditor(b) { b.language = q('#be-lang').value; b.code = q('#be-code').value; },
    toTeamsText(b) { return '\`\`\`' + (b.language||'') + '\n' + (b.code||'') + '\n\`\`\`'; }
  },
  icono: {
    label: 'Icono',
    defaultData: () => ({ iconKey:'star', size:48, color:'#2563EB', label:'', align:'center' }),
    render(b) {
      if (!b.iconKey) return `<div class="b-icono block-inner" ondblclick="openBlockEditor('${b.id}')"><span style="color:var(--text-muted);font-size:13px">Sin icono — doble clic para configurar</span></div>`;
      const svgEl = iconSVG(b.iconKey, b.size||48, b.color||'#2563EB');
      const labelEl = b.label ? `<div style="margin-top:8px;font-size:13px;color:var(--text-muted)">${esc(b.label)}</div>` : '';
      return `<div class="b-icono block-inner" ondblclick="openBlockEditor('${b.id}')" style="text-align:${b.align||'center'};padding:16px">${svgEl}${labelEl}</div>`;
    },
    editorHTML(b) {
      const _ip = b.iconKey ? iconSVG(b.iconKey,36,b.color||'#2563EB') : '<span style="color:var(--text-muted);font-size:24px">–</span>';
      return `<div class="form-group"><label class="form-label">Icono</label>
        <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg);border-radius:6px;border:1px solid var(--border)">
          <div id="be-icon-preview" style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${_ip}</div>
          <button type="button" onmousedown="event.preventDefault();openIconPickerForEditor()" style="padding:6px 14px;font-size:13px;cursor:pointer;border:none;border-radius:6px;background:var(--primary);color:#fff;font-family:inherit;font-weight:600">Elegir icono</button>
          <input type="hidden" id="be-icon" value="${b.iconKey||''}">
        </div></div>
        <div class="form-group"><label class="form-label">Color</label>
          <div style="display:flex;align-items:center;gap:10px">
            <input type="color" id="be-color" value="${b.color||'#2563EB'}" style="width:44px;height:32px;padding:2px;border:1px solid var(--border);border-radius:4px;cursor:pointer;background:none" oninput="_icoPreviewColor(this.value)">
            <span id="be-color-val" style="font-size:13px;color:var(--text-muted)">${b.color||'#2563EB'}</span>
          </div></div>
        <div class="form-group"><label class="form-label">Tamaño</label>
          <select class="form-select" id="be-size">
            ${[24,32,48,64,96,128].map(s=>`<option value="${s}" ${(b.size||48)===s?'selected':''}>${s}px</option>`).join('')}
          </select></div>
        <div class="form-group"><label class="form-label">Etiqueta (opcional)</label>
          <input class="form-input" id="be-label" value="${esc(b.label||'')}" placeholder="Texto bajo el icono..."></div>
        <div class="form-group"><label class="form-label">Alineación</label>
          <select class="form-select" id="be-align">
            <option value="left" ${(b.align||'center')==='left'?'selected':''}>Izquierda</option>
            <option value="center" ${(b.align||'center')==='center'?'selected':''}>Centro</option>
            <option value="right" ${(b.align||'center')==='right'?'selected':''}>Derecha</option>
          </select></div>`;
    },
    saveEditor(b) {
      b.iconKey = q('#be-icon').value||null;
      b.size = parseInt(q('#be-size').value)||48;
      b.color = q('#be-color').value||'#2563EB';
      b.label = q('#be-label').value||'';
      b.align = q('#be-align').value||'center';
    },
    toTeamsText(b) { return `[Icono: ${b.iconKey||'?'}${b.label?' - '+b.label:''}]`; }
  }
};

// ═══════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════
function q(sel){ return document.querySelector(sel); }
function esc(str){ const d=document.createElement('div');d.textContent=str;return d.innerHTML; }
// Quita scripts, iframes, atributos on* y URLs javascript: de HTML enriquecido
function sanitizeRichHtml(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html || '';
  tpl.content.querySelectorAll('script,style,iframe,object,embed,link,meta,form').forEach(n=>n.remove());
  tpl.content.querySelectorAll('*').forEach(el=>{
    [...el.attributes].forEach(a=>{
      const n=a.name.toLowerCase(), v=String(a.value||'');
      if (n.startsWith('on') || ((n==='href'||n==='src'||n==='xlink:href') && /^\s*javascript:/i.test(v))) el.removeAttribute(a.name);
    });
  });
  return tpl.innerHTML;
}
document.addEventListener('paste', ev => {
  const ce = ev.target && ev.target.closest ? ev.target.closest('[contenteditable="true"]') : null;
  if (!ce) return;
  const html = ev.clipboardData && ev.clipboardData.getData('text/html');
  if (!html) return;
  ev.preventDefault();
  document.execCommand('insertHTML', false, sanitizeRichHtml(html));
});
function getVideoEmbedUrl(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}
function notify(msg, duration=2500) {
  const n=q('#notif'); n.textContent=msg; n.classList.add('show');
  setTimeout(()=>n.classList.remove('show'), duration);
}
function setSaveStatus(txt){ q('#save-status').textContent=txt; }
function openModal(id){ q('#'+id).classList.remove('hidden'); }
function closeModal(id){ q('#'+id).classList.add('hidden'); }
function setLoading(v){ q('#loading').classList.toggle('hidden',!v); }

// ═══════════════════════════════════════════════════════
// COLOR PICKER
// ═══════════════════════════════════════════════════════
function renderColorPicker() {
  const cp = q('#color-picker');
  cp.innerHTML = COLORS.map(c=>`<div class="color-dot ${c.hex===STATE.manual.color?'active':''}" style="background:${c.hex}" title="${c.name}" onclick="setColor('${c.hex}')"></div>`).join('');
}
function setColor(hex) {
  STATE.manual.color = hex;
  document.documentElement.style.setProperty('--primary', hex);
  document.documentElement.style.setProperty('--primary-dark', shadeColor(hex,-15));
  document.documentElement.style.setProperty('--primary-light', hexToLight(hex));
  renderColorPicker();
  scheduleLocalSave();
}
function shadeColor(hex,pct){
  let n=parseInt(hex.slice(1),16),r=(n>>16)+pct,g=((n>>8)&0xFF)+pct,b=(n&0xFF)+pct;
  return '#'+(0x1000000+Math.max(0,Math.min(255,r))*0x10000+Math.max(0,Math.min(255,g))*0x100+Math.max(0,Math.min(255,b))).toString(16).slice(1);
}
function hexToLight(hex){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},0.08)`;
}

// ═══════════════════════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════════════════════
function render() {
  const canvas = q('#canvas');
  migrateLegacyBlocks(STATE.blocks);
  (STATE.pages||[]).forEach(p => migrateLegacyBlocks(p.blocks)); // páginas inactivas también, para exports
  if (!STATE.blocks.length) {
    canvas.innerHTML = `<div id="canvas-empty">
      <div class="ec-icon">📄</div>
      <p>Tu manual está vacío</p>
      <span>Haz clic en un bloque del panel izquierdo para añadirlo</span>
    </div>`;
    return;
  }
  let pasoN = 0;
  canvas.innerHTML = STATE.blocks.map((b,i) => {
    if (b.type === 'paso') { if (b.resetStep) pasoN = 0; pasoN++; }
    const def = BLOCK_TYPES[b.type];
    if (!def) return '';
    const blockHTML = def.render(b, pasoN);
    return `<div class="block-wrap ${STATE.selectedBlockId===b.id?'selected':''}" data-idx="${i}" data-id="${b.id}"
        draggable="true"
        ondragstart="onDragStart(event,${i})"
        ondragover="onDragOver(event,${i})"
        ondragend="onDragEnd(event)"
        ondrop="onDrop(event,${i})"
        onclick="selectBlock('${b.id}')">
      ${blockHTML}
      <div class="block-bar">
        <button title="Subir" onclick="moveBlock(${i},-1,event)">↑</button>
        <button title="Bajar" onclick="moveBlock(${i},1,event)">↓</button>
        <button title="Color personalizado" onclick="openBlockColorPicker('${b.id}',event)" style="position:relative">🎨</button>
        ${(b.type==='imagen'||b.type==='paso')&&(b.src||b.storagePath)?`<button title="Anotar imagen" onclick="openAnnotationEditor('${b.id}');event.stopPropagation()" style="color:#2563EB">✏️</button>`:''}
        ${def.editorHTML?`<button title="Editar" onclick="openBlockEditor('${b.id}',event)">✏</button>`:''}
        <button class="del" title="Eliminar" onclick="deleteBlock('${b.id}',event)">🗑</button>
      </div>
    </div>`;
  }).join('');
  applyBlockColors();
  // Load lazy images
  loadLazyImages();
  updateStats();
}
// Re-render de un solo bloque; cae a render() completo si no es seguro (pasos renumeran)
function renderBlock(id) {
  const b = STATE.blocks.find(x=>x.id===id);
  const wrap = document.querySelector(`.block-wrap[data-id="${id}"]`);
  const def = b && BLOCK_TYPES[b.type];
  if (!b || !wrap || !def || b.type === 'paso') { render(); return; }
  const inner = wrap.querySelector('.block-inner');
  const tmp = document.createElement('div');
  tmp.innerHTML = def.render(b, 0);
  if (!inner || !tmp.firstElementChild) { render(); return; }
  inner.replaceWith(tmp.firstElementChild);
  applyBlockColors();
  loadLazyImages();
}
function updateStats() {
  const el = q('#stats-indicator');
  if (!el) return;
  const blocks = STATE.blocks.length;
  let words = 0;
  STATE.blocks.forEach(b => {
    const parts = [b.titulo||'', b.subtitulo||'', b.descripcion||'', b.texto||'', b.caption||''];
    if (b.html) { const tmp = document.createElement('div'); tmp.innerHTML = b.html; parts.push(tmp.textContent); }
    if (b.items) b.items.forEach(it => parts.push(it.texto||''));
    if (b.code) parts.push(b.code);
    words += parts.join(' ').trim().split(/\s+/).filter(w => w.length > 0).length;
  });
  const pages = STATE.pages && STATE.pages.length > 0 ? STATE.pages.length : 1;
  el.textContent = `${blocks} bloq · ${words} pal · ${pages} pág`;
}

function isLightColor(hex) {
  const c = String(hex||'').replace('#','');
  const r = parseInt(c.substring(0,2),16);
  const g = parseInt(c.substring(2,4),16);
  const b = parseInt(c.substring(4,6),16);
  return (r*299 + g*587 + b*114) / 1000 > 128;
}
function normalizeHex(color) {
  if (!color) return '';
  const c = String(color).trim();
  return c.startsWith('#') ? c : '#' + c;
}

function applyBlockColors() {
  STATE.blocks.forEach(b => {
    if (!b.blockBorderColor && !b.blockBgColor) return;
    const inner = document.querySelector(`[data-id="${b.id}"] .block-inner`);
    if (!inner) return;
    if (b.blockBgColor) {
      inner.style.backgroundColor = normalizeHex(b.blockBgColor);
      if (b.type === 'titulo' || b.type === 'subtitulo') {
        inner.style.borderLeft = 'none';
        const light = isLightColor(b.blockBgColor);
        inner.style.color = light ? '#1a1a1a' : '#ffffff';
        inner.querySelectorAll('.b-titulo-t, .sub-text').forEach(el => { el.style.color = light ? '#1a1a1a' : '#ffffff'; });
        const sub = inner.querySelector('.subtitulo');
        if (sub) sub.style.color = light ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.7)';
      }
    }
    if (b.blockBorderColor && b.type !== 'titulo') {
      const cls = inner.className;
      if (cls.includes('b-alerta') || cls.includes('b-callout')) {
        inner.style.borderLeftColor = b.blockBorderColor;
      }
      inner.style.borderColor = b.blockBorderColor;
    }
  });
}

const BLOCK_PALETTE = ['#FFFFFF','#F8FAFC','#E2E8F0','#CBD5E1','#94A3B8','#64748B','#475569','#334155','#1E293B','#0F172A','#FEE2E2','#FCA5A5','#EF4444','#DC2626','#B91C1C','#FFEDD5','#FDBA74','#F97316','#EA580C','#C2410C','#FEF9C3','#FDE047','#EAB308','#CA8A04','#A16207','#DCFCE7','#86EFAC','#22C55E','#16A34A','#15803D','#CFFAFE','#67E8F9','#06B6D4','#0891B2','#0E7490','#DBEAFE','#93C5FD','#3B82F6','#2563EB','#1D4ED8','#E0E7FF','#A5B4FC','#6366F1','#4F46E5','#4338CA','#F3E8FF','#D8B4FE','#A855F7','#9333EA','#7E22CE','#FCE7F3','#F9A8D4','#EC4899','#DB2777','#BE185D','#F5F5F4','#D6D3D1','#78716C','#57534E','#292524'];
function openBlockColorPicker(blockId, ev) {
  if (ev) ev.stopPropagation();
  document.querySelectorAll('.block-color-popup').forEach(p=>p.remove());
  const block = STATE.blocks.find(b=>b.id===blockId);
  if (!block) return;
  const btn = ev.currentTarget;
  const popup = document.createElement('div');
  popup.className = 'block-color-popup';
  const sw = BLOCK_PALETTE.map(c=>`<span class="bcp-sw" style="background:${c}" title="${c}" onclick="setBlockBg('${blockId}','${c}')"></span>`).join('');
  popup.innerHTML = `
    <label>Color de fondo del bloque</label>
    <div class="bcp-grid">${sw}</div>
    <div class="color-row" style="margin-top:8px">
      <span style="font-size:11px;color:var(--text-muted);flex:1">Personalizado</span>
      <input type="color" id="bcp-bg" value="${block.blockBgColor||'#ffffff'}" oninput="setBlockBg('${blockId}',this.value)">
      <button class="reset-btn" onclick="clearBlockColor('${blockId}','bg')">Quitar</button>
    </div>
    <label style="margin-top:8px">Borde / acento</label>
    <div class="color-row">
      <input type="color" id="bcp-border" value="${block.blockBorderColor||'#2563EB'}" oninput="setBlockBorder('${blockId}',this.value)">
      <span style="font-size:11px;flex:1;color:var(--text-muted)">${block.blockBorderColor||'Por defecto'}</span>
      <button class="reset-btn" onclick="clearBlockColor('${blockId}','border')">Quitar</button>
    </div>
    <div style="text-align:right;margin-top:8px"><button class="btn btn-sm" onclick="this.closest('.block-color-popup').remove()">Cerrar</button></div>`;
  btn.style.position = 'relative';
  btn.appendChild(popup);
  setTimeout(()=>document.addEventListener('click', function handler(e){
    if(!popup.contains(e.target)){popup.remove();document.removeEventListener('click',handler);}
  }), 10);
}
function setBlockBg(blockId, color) {
  const block = STATE.blocks.find(b=>b.id===blockId);
  if (!block) return;
  block.blockBgColor = color;
  applyBlockColors();
  scheduleLocalSave();
}
function setBlockBorder(blockId, color) {
  const block = STATE.blocks.find(b=>b.id===blockId);
  if (!block) return;
  block.blockBorderColor = color;
  applyBlockColors();
  scheduleLocalSave();
}

function saveBlockColors(blockId) {
  const block = STATE.blocks.find(b=>b.id===blockId);
  if (!block) return;
  const bInput = document.getElementById('bcp-border');
  const bgInput = document.getElementById('bcp-bg');
  if (bInput) block.blockBorderColor = bInput.value;
  if (bgInput) block.blockBgColor = bgInput.value;
  document.querySelectorAll('.block-color-popup').forEach(p=>p.remove());
  applyBlockColors();
  scheduleLocalSave();
}

function clearBlockColor(blockId, which) {
  const block = STATE.blocks.find(b=>b.id===blockId);
  if (!block) return;
  if (which==='border') delete block.blockBorderColor;
  if (which==='bg') delete block.blockBgColor;
  document.querySelectorAll('.block-color-popup').forEach(p=>p.remove());
  applyBlockColors();
  scheduleLocalSave();
}

async function loadLazyImages() {
  const imgs = document.querySelectorAll('.lazy-img[data-path]');
  for (const img of imgs) {
    if (img.dataset.lazyDone) continue;
    const path = img.getAttribute('data-path');
    if (!path) continue;
    try {
      const { data, error } = await sb.storage.from('manual-images').createSignedUrl(path, 3600);
      if (!error && data?.signedUrl) { img.src = data.signedUrl; img.dataset.lazyDone = '1'; img.classList.remove('img-skeleton'); }
    } catch(e) { console.warn('lazy-img:', e); }
  }
  // Lazy-load de vídeos guardados en Storage (mismo bucket privado, vía URL firmada)
  const vids = document.querySelectorAll('.lazy-video[data-vpath]');
  for (const vid of vids) {
    if (vid.src && vid.src !== window.location.href) continue;
    const path = vid.getAttribute('data-vpath');
    if (!path) continue;
    try {
      const { data, error } = await sb.storage.from('manual-images').createSignedUrl(path, 3600);
      if (!error && data?.signedUrl) vid.src = data.signedUrl;
    } catch(e) {}
  }
}

// ═══════════════════════════════════════════════════════
// BLOCK OPERATIONS
// ═══════════════════════════════════════════════════════
function addBlock(type) {
  const def = BLOCK_TYPES[type];
  if (!def) return;
  const block = { id: uid(), type, order: STATE.blocks.length, ...def.defaultData() };
  pushHistory();
  STATE.blocks.push(block);
  render();
  scheduleLocalSave();
  // Scroll to new block
  setTimeout(()=>{
    const el = document.querySelector(`[data-id="${block.id}"]`);
    if (el) el.scrollIntoView({behavior:'smooth',block:'nearest'});
  }, 100);
}

function deleteBlock(id, ev) {
  if (ev) ev.stopPropagation();
  if (!confirm('¿Eliminar este bloque?')) return;
  pushHistory();
  STATE.blocks = STATE.blocks.filter(b=>b.id!==id);
  if (STATE.selectedBlockId === id) STATE.selectedBlockId = null;
  render();
  scheduleLocalSave();
  notifyUndo('🗑 Bloque eliminado');
}
// Restaura el snapshot tomado justo antes de la ultima accion destructiva
function undoLastAction() {
  if (STATE.history.length) {
    STATE.blocks = JSON.parse(STATE.history[STATE.historyIdx]);
    render(); scheduleLocalSave();
  }
  q('#notif').classList.remove('show');
}
function notifyUndo(msg) {
  const n = q('#notif');
  n.innerHTML = esc(msg) + ' <button onclick="undoLastAction()" style="margin-left:8px;background:none;border:1px solid rgba(255,255,255,.45);color:#fff;border-radius:5px;padding:2px 8px;cursor:pointer;font-family:inherit;font-size:12px">Deshacer</button>';
  n.classList.add('show');
  clearTimeout(n._t); n._t = setTimeout(()=>n.classList.remove('show'), 5000);
}

function moveBlock(idx, dir, ev) {
  if (ev) ev.stopPropagation();
  const to = idx + dir;
  if (to < 0 || to >= STATE.blocks.length) return;
  pushHistory();
  [STATE.blocks[idx], STATE.blocks[to]] = [STATE.blocks[to], STATE.blocks[idx]];
  render();
  scheduleLocalSave();
}

function selectBlock(id) {
  STATE.selectedBlockId = id;
  document.querySelectorAll('#canvas .block-wrap').forEach(w => {
    w.classList.toggle('selected', w.dataset.id === id);
  });
}

function saveInlineEdit(el) {
  const id = el.dataset.id, field = el.dataset.field;
  if (!id || !field) return;
  const block = STATE.blocks.find(b=>b.id===id);
  if (!block) return;
  if (el.tagName === 'UL' || el.tagName === 'OL') {
    block[field] = [...el.querySelectorAll('li')].map(li => sanitizeRichHtml(li.innerHTML).trim()).filter(Boolean).join('\n');
  } else {
    block[field] = (field === 'html' || el.dataset.rich) ? sanitizeRichHtml(el.innerHTML) : el.textContent;
  }
  scheduleLocalSave();
}

function handleTextoKey(ev) {
  if (ev.ctrlKey && ev.key === 'b') { ev.preventDefault(); document.execCommand('bold'); }
  if (ev.ctrlKey && ev.key === 'i') { ev.preventDefault(); document.execCommand('italic'); }
}

// Cambia el tipo (color/icono) de una alerta desde sus botones inline
function setAlertaTipo(id, tipo) {
  const b = STATE.blocks.find(x => x.id === id);
  if (!b) return;
  b.tipo = tipo;
  renderBlock(b.id);
  scheduleLocalSave();
}

// Migrador generico por version de esquema (b.v). v1->v2: callout se fusiona en alerta.
const SCHEMA_VERSION = 2;
function migrateLegacyBlocks(blocks) {
  if (!Array.isArray(blocks)) return blocks;
  const map = { tip:'exito', warning:'advertencia', important:'info' };
  for (const b of blocks) {
    if (!b) continue;
    const v = b.v || 1;
    if (v < 2 && b.type === 'callout') { b.type = 'alerta'; b.tipo = map[b.tipo] || 'info'; }
    // migraciones futuras: if (v < 3) { ... }
    b.v = SCHEMA_VERSION;
  }
  return blocks;
}

// ═══════════════════════════════════════════════════════
// BLOCK EDITOR MODAL
// ═══════════════════════════════════════════════════════
let _editingId = null;
function openBlockEditor(id, ev) {
  if (ev) ev.stopPropagation();
  const block = STATE.blocks.find(b=>b.id===id);
  if (!block) return;
  const def = BLOCK_TYPES[block.type];
  if (!def?.editorHTML) return; // simple blocks use inline edit
  _editingId = id;
  q('#block-editor-title').textContent = 'Editar: ' + def.label;
  q('#block-editor-body').innerHTML = def.editorHTML(block);
  openModal('modal-block-editor');
}
function saveBlockEditor() {
  if (!_editingId) return;
  const block = STATE.blocks.find(b=>b.id===_editingId);
  if (!block) return;
  const def = BLOCK_TYPES[block.type];
  if (def?.saveEditor) { pushHistory(); def.saveEditor(block); render(); scheduleLocalSave(); }
  closeModal('modal-block-editor');
  _editingId = null;
}

// Editor helpers
function addTablaCol() {
  const n = document.querySelectorAll('#cols-editor input').length;
  const inp = document.createElement('input');
  inp.className='form-input'; inp.style.marginBottom='4px';
  inp.placeholder='Nombre columna'; inp.setAttribute('data-ci', n);
  q('#cols-editor').appendChild(inp);
  // add cell to each row
  document.querySelectorAll('#rows-body tr').forEach((tr,ri)=>{
    const td=document.createElement('td');
    td.style='border:1px solid var(--border);padding:2px';
    const inp2=document.createElement('input');
    inp2.className='form-input'; inp2.style='border:none;padding:6px';
    inp2.setAttribute('data-ri',ri); inp2.setAttribute('data-ci',n);
    td.appendChild(inp2); tr.appendChild(td);
  });
}
function addTablaRow() {
  const nCols = document.querySelectorAll('#cols-editor input').length;
  const ri = document.querySelectorAll('#rows-body tr').length;
  const tr=document.createElement('tr');
  tr.setAttribute('data-ri',ri);
  for(let c=0;c<nCols;c++){
    const td=document.createElement('td');
    td.style='border:1px solid var(--border);padding:2px';
    const inp=document.createElement('input');
    inp.className='form-input'; inp.style='border:none;padding:6px';
    inp.setAttribute('data-ri',ri); inp.setAttribute('data-ci',c);
    td.appendChild(inp); tr.appendChild(td);
  }
  q('#rows-body').appendChild(tr);
}
function addListaItem() {
  const n = document.querySelectorAll('#lista-items [data-li]').length;
  const div=document.createElement('div');
  div.style='display:flex;gap:8px;margin-bottom:8px';
  div.setAttribute('data-li',n);
  div.innerHTML=`<select class="form-select" style="width:100px" data-field="icono"><option value="check">✅ Check</option><option value="cross">❌ Cruz</option></select><input class="form-input" style="flex:1" data-field="texto" placeholder="Texto del elemento"><button class="btn btn-sm" onclick="this.closest('[data-li]').remove()">🗑</button>`;
  q('#lista-items').appendChild(div);
}
function addFlujoRow() {
  const n = document.querySelectorAll('#flujos-rows [data-ri]').length;
  const div=document.createElement('div');
  div.style='display:grid;grid-template-columns:1fr 1fr 32px;gap:6px;margin-bottom:6px';
  div.setAttribute('data-ri',n);
  div.innerHTML=`<input class="form-input" placeholder="Condición" data-field="condicion"><input class="form-input" placeholder="Acción" data-field="accion"><button class="btn btn-sm" onclick="this.closest('[data-ri]').remove()">🗑</button>`;
  q('#flujos-rows').appendChild(div);
}

// ═══════════════════════════════════════════════════════
// EMOJI PICKER
// ═══════════════════════════════════════════════════════
function openEmojiPicker(blockId) {
  const existing = q('#emoji-picker-popup');
  if (existing) existing.remove();
  const popup = document.createElement('div');
  popup.id = 'emoji-picker-popup';
  popup.style = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px;z-index:600;box-shadow:var(--shadow-md)';
  popup.innerHTML = `<p style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Selecciona un emoji</p>
    <div class="emoji-picker">${EMOJIS.map(e=>`<button class="ep-btn" onclick="setBlockEmoji('${blockId}','${e}',this)">${e}</button>`).join('')}</div>
    <button class="btn btn-sm" style="margin-top:8px;width:100%" onclick="q('#emoji-picker-popup').remove()">Cerrar</button>`;
  document.body.appendChild(popup);
}
function setBlockEmoji(blockId, emoji) {
  const block = STATE.blocks.find(b=>b.id===blockId);
  if (block) { block.emoji = emoji; renderBlock(blockId); scheduleLocalSave(); }
  const p = q('#emoji-picker-popup'); if (p) p.remove();
}

// ═══════════════════════════════════════════════════════
// IMAGE UPLOAD
// ═══════════════════════════════════════════════════════
async function resizeImage(file) {
  return new Promise(resolve=>{
    const img=new Image(), url=URL.createObjectURL(file);
    img.onload=()=>{
      const MAX_W=1280; let w=img.width,h=img.height;
      if(w>MAX_W){h=Math.round(h*MAX_W/w);w=MAX_W;}
      const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
      const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0,w,h);
      // check transparency
      let hasAlpha=false;
      try{const d=ctx.getImageData(0,0,Math.min(w,50),Math.min(h,50)).data;for(let i=3;i<d.length;i+=4)if(d[i]<255){hasAlpha=true;break;}}catch(e){}
      const mime=hasAlpha?'image/png':'image/jpeg', q=hasAlpha?1:.85;
      canvas.toBlob(b=>{URL.revokeObjectURL(url);resolve(b);},mime,q);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);resolve(file);};
    img.src=url;
  });
}

async function uploadBlockImage(input, blockId) {
  const file = input.files[0]; if (!file) return;
  if (!STATE.user) { notify('⚠️ Guarda el manual primero para subir imágenes'); return; }
  const block = STATE.blocks.find(b=>b.id===blockId); if (!block) return;

  const wrap = document.querySelector(`[data-id="${blockId}"]`);
  if (wrap) wrap.classList.add('img-uploading');
  setSaveStatus('Procesando imagen...');

  try {
    // Step 1: resize
    const blob = await resizeImage(file);
    const safeBlob = blob || file;

    // Step 2: ALWAYS convert to data URL from original file — guarantees correct MIME type
    const dataUrl = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = e => resolve(e.target.result);
      fr.onerror = () => reject(new Error('No se pudo leer el archivo'));
      fr.readAsDataURL(file);
    });

    // Step 3: show image right now
    block.src = dataUrl;
    if (wrap) wrap.classList.remove('img-uploading');
    render();
    scheduleLocalSave();
    setSaveStatus('');
    notify('✅ Imagen añadida');

    // Step 4: also upload to Supabase Storage silently (for cross-device sync)
    try {
      const ext = file.type === 'image/png' ? 'png' : 'jpg';
      const manualId = STATE.manual.id || 'guest';
      const storagePath = `${STATE.user.id}/${manualId}/${blockId}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from('manual-images').upload(storagePath, safeBlob, { contentType: safeBlob.type, upsert: true });
      if (!upErr) { block.storagePath = storagePath; delete block.src; renderBlock(blockId); scheduleLocalSave(); }
      else { console.warn('Storage upload:', upErr); notify('⚠️ Imagen guardada solo en este equipo (fallo al subir a la nube)', 4000); }
    } catch(e) { console.warn('Storage upload:', e); notify('⚠️ Imagen guardada solo en este equipo (fallo al subir a la nube)', 4000); }

  } catch(e) {
    if (wrap) wrap.classList.remove('img-uploading');
    setSaveStatus('');
    render();
    notify('❌ Error al cargar imagen: ' + (e.message || e));
  }
}

// Sube un MP4 a Supabase Storage (no base64 en la BD). Se incrusta en el HTML al exportar → se ve offline.
async function uploadVideoFile(input) {
  const file = input.files[0]; if (!file) return;
  if (!STATE.user) { notify('⚠️ Inicia sesión para subir vídeos'); input.value = ''; return; }
  const statusEl = document.getElementById('be-video-status');
  const MAX = 50 * 1024 * 1024;
  if (file.size > MAX) {
    if (statusEl) statusEl.innerHTML = `<span style="color:#dc2626">El vídeo pesa ${(file.size/1048576).toFixed(0)} MB. Máximo 50 MB — comprímelo (720p, H.264).</span>`;
    input.value = ''; return;
  }
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--text-muted)">⏳ Subiendo vídeo… no cierres esta ventana</span>';
  try {
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    const manualId = STATE.manual.id || 'guest';
    const blockId = _editingId || ('v' + Date.now());
    const storagePath = `${STATE.user.id}/${manualId}/videos/${blockId}/${Date.now()}.${ext}`;
    const { error } = await sb.storage.from('manual-images').upload(storagePath, file, { contentType: file.type || 'video/mp4', upsert: true });
    if (error) throw error;
    const hp = document.getElementById('be-video-storagepath'); if (hp) hp.value = storagePath;
    const hs = document.getElementById('be-video-src'); if (hs) hs.value = '';
    if (statusEl) statusEl.innerHTML = `<span style="color:#16a34a">✓ Vídeo subido (${(file.size/1048576).toFixed(1)} MB). Pulsa Guardar para aplicar.</span>`;
  } catch(e) {
    if (statusEl) statusEl.innerHTML = `<span style="color:#dc2626">❌ Error al subir: ${esc(e.message || e)}</span>`;
    input.value = '';
  }
}

function openLightbox(imgEl) {
  const src = imgEl.src || imgEl.getAttribute('data-src');
  if (!src || src === window.location.href) return;
  const ov = document.getElementById('lightbox-overlay');
  const li = document.getElementById('lightbox-img');
  li.src = src;
  li.classList.remove('lb-zoomed');
  ov.classList.remove('lb-zoomed');
  ov.classList.add('active');
  document.addEventListener('keydown', _lightboxKey);
}
function closeLightbox() {
  const ov = document.getElementById('lightbox-overlay');
  ov.classList.remove('active', 'lb-zoomed');
  const li = document.getElementById('lightbox-img');
  li.classList.remove('lb-zoomed');
  li.src = '';
  document.removeEventListener('keydown', _lightboxKey);
}
function toggleLightboxZoom(e) {
  e.stopPropagation();
  const ov = document.getElementById('lightbox-overlay');
  const li = document.getElementById('lightbox-img');
  const zooming = !li.classList.contains('lb-zoomed');
  li.classList.toggle('lb-zoomed');
  ov.classList.toggle('lb-zoomed');
  if (zooming) { ov.scrollTop = 0; ov.scrollLeft = 0; }
  const hint = document.getElementById('lightbox-hint');
  if (hint) hint.style.display = zooming ? 'none' : '';
}
function _lightboxKey(e) { if (e.key === 'Escape') closeLightbox(); }
function removeBlockImage(blockId) {
  const block = STATE.blocks.find(b => b.id === blockId);
  if (!block) return;
  delete block.src;
  block.storagePath = null;
  render();
  if (typeof _recomputeMediaUsage === 'function') _recomputeMediaUsage(); // queda "sin usar" en el repositorio
  scheduleLocalSave();
}
// Reinicia la numeración de pasos desde este bloque (clic en el número). Debe ser global para el onclick inline.
function toggleResetStep(id) { const b = STATE.blocks.find(x => x.id === id); if (!b) return; b.resetStep = !b.resetStep; pushHistory(); render(); scheduleLocalSave(); }

// drop images onto canvas
document.addEventListener('dragover', e=>{ if(e.dataTransfer.types.includes('Files')) e.preventDefault(); });
document.addEventListener('drop', async e=>{
  if (!e.dataTransfer.files.length) return;
  const file = e.dataTransfer.files[0];
  if (!file.type.startsWith('image/')) return;
  e.preventDefault();
  // Find target block
  const el = e.target.closest('[data-id]');
  if (el) {
    const id = el.getAttribute('data-id');
    const block = STATE.blocks.find(b=>b.id===id);
    if (block && (block.type==='imagen'||block.type==='paso')) {
      // fake file input
      const fakeInput = {files:[file]};
      await uploadBlockImage(fakeInput, id);
      return;
    }
  }
  // Create new imagen block
  addBlock('imagen');
  const newBlock = STATE.blocks[STATE.blocks.length-1];
  const fakeInput = {files:[file]};
  setTimeout(()=>uploadBlockImage(fakeInput, newBlock.id), 100);
});

// ═══════════════════════════════════════════════════════
// DRAG & DROP REORDER
// ═══════════════════════════════════════════════════════
function onDragStart(ev, idx) {
  if (STATE.isDragging) return;
  // Only drag if from the block-wrap itself (not a child input/contenteditable)
  if (ev.target.closest('[contenteditable]')) { ev.preventDefault(); return; }
  STATE.isDragging = true;
  STATE.dragSrcIdx = idx;
  ev.dataTransfer.effectAllowed = 'move';
  ev.dataTransfer.setData('text/plain', idx);
  ev.currentTarget.style.opacity = '.4';
}
function onDragOver(ev, idx) {
  if (!STATE.isDragging) return;
  ev.preventDefault();
  ev.dataTransfer.dropEffect = 'move';
  // Clear all indicators
  document.querySelectorAll('.block-wrap').forEach(el=>el.classList.remove('drag-over-top','drag-over-bottom'));
  const rect = ev.currentTarget.getBoundingClientRect();
  const mid = rect.top + rect.height/2;
  ev.currentTarget.classList.add(ev.clientY < mid ? 'drag-over-top' : 'drag-over-bottom');
}
function onDrop(ev, toIdx) {
  ev.preventDefault();
  const fromIdx = STATE.dragSrcIdx;
  if (fromIdx === null || fromIdx === toIdx) { onDragEnd(ev); return; }
  document.querySelectorAll('.block-wrap').forEach(el=>el.classList.remove('drag-over-top','drag-over-bottom'));
  pushHistory();
  const [moved] = STATE.blocks.splice(fromIdx, 1);
  const insertAt = fromIdx < toIdx ? toIdx - 1 : toIdx; // compensate for removal
  // Determine if dropping above or below
  const wrap = document.querySelector(`[data-idx="${toIdx}"]`);
  let finalIdx = toIdx;
  if (wrap) {
    const rect = wrap.getBoundingClientRect();
    if (ev.clientY > rect.top + rect.height/2) finalIdx = insertAt + 1;
    else finalIdx = insertAt;
  }
  STATE.blocks.splice(Math.max(0, Math.min(STATE.blocks.length, finalIdx < fromIdx ? toIdx : toIdx)), 0, moved);
  onDragEnd(ev);
  render();
  scheduleLocalSave();
}
function onDragEnd(ev) {
  STATE.isDragging = false;
  STATE.dragSrcIdx = null;
  document.querySelectorAll('.block-wrap').forEach(el=>{ el.style.opacity=''; el.classList.remove('drag-over-top','drag-over-bottom'); });
}

// Palette drag to canvas
q('#sidebar').addEventListener('dragstart', ev=>{
  const btn = ev.target.closest('[data-type]');
  if (!btn) return;
  ev.dataTransfer.setData('palette-type', btn.dataset.type);
  ev.dataTransfer.effectAllowed = 'copy';
});
q('#canvas-wrap').addEventListener('dragover', ev=>{
  if (ev.dataTransfer.types.includes('palette-type')) ev.preventDefault();
});
q('#canvas-wrap').addEventListener('drop', ev=>{
  const type = ev.dataTransfer.getData('palette-type');
  if (type) { ev.preventDefault(); addBlock(type); }
});

// ═══════════════════════════════════════════════════════
// UNDO / REDO
// ═══════════════════════════════════════════════════════
const MAX_HISTORY = 50;
function pushHistory() {
  const snap = JSON.stringify(STATE.blocks);
  if (STATE.history[STATE.historyIdx] === snap) return; // sin cambios: no duplicar
  STATE.history = STATE.history.slice(0, STATE.historyIdx + 1);
  STATE.history.push(snap);
  if (STATE.history.length > MAX_HISTORY) STATE.history.shift();
  STATE.historyIdx = STATE.history.length - 1;
}
document.addEventListener('keydown', ev=>{
  if ((ev.ctrlKey||ev.metaKey) && ev.key==='z' && !ev.shiftKey) {
    ev.preventDefault();
    if (STATE.historyIdx > 0) {
      STATE.historyIdx--;
      STATE.blocks = JSON.parse(STATE.history[STATE.historyIdx]);
      render(); scheduleLocalSave();
    }
  }
  if ((ev.ctrlKey||ev.metaKey) && (ev.key==='y'||(ev.shiftKey&&ev.key==='z'))) {
    ev.preventDefault();
    if (STATE.historyIdx < STATE.history.length - 1) {
      STATE.historyIdx++;
      STATE.blocks = JSON.parse(STATE.history[STATE.historyIdx]);
      render(); scheduleLocalSave();
    }
  }
  const _tag = (ev.target.tagName||'').toLowerCase();
  const _typing = _tag==='input' || _tag==='textarea' || _tag==='select' || ev.target.isContentEditable;
  if ((ev.ctrlKey||ev.metaKey) && ev.key==='s') { ev.preventDefault(); guardar(); }
  if ((ev.ctrlKey||ev.metaKey) && ev.key==='d' && !_typing) { ev.preventDefault(); duplicateSelectedBlock(); }
  if (ev.key==='Delete' && !_typing && STATE.selectedBlockId) { ev.preventDefault(); deleteBlock(STATE.selectedBlockId); }
  if ((ev.ctrlKey||ev.metaKey) && ev.key==='f' && !_typing) { ev.preventDefault(); openGlobalSearch(); }
  if (ev.key==='Escape') { const gs=document.getElementById('global-search'); if (gs) gs.remove(); }
});

function filterBlockBtns(qtext) {
  const t = (qtext||'').toLowerCase().trim();
  document.querySelectorAll('#sid-chips-bloques .block-btn').forEach(btn=>{
    btn.style.display = !t || btn.textContent.toLowerCase().includes(t) ? '' : 'none';
  });
}
// ── Buscador global del manual (Ctrl+F): busca en todas las páginas ──
function _blockText(b) {
  const parts = [b.titulo, b.subtitulo, b.descripcion, b.texto, b.caption, b.code, b.url];
  if (b.html) { const t = document.createElement('div'); t.innerHTML = b.html; parts.push(t.textContent); }
  if (b.items) b.items.forEach(it => parts.push(it.texto));
  if (b.columnas) parts.push(b.columnas.join(' '));
  if (b.filas) b.filas.forEach(r => parts.push((r||[]).join(' ')));
  const t2 = document.createElement('div'); t2.innerHTML = parts.filter(Boolean).join(' ');
  return t2.textContent || '';
}
function openGlobalSearch() {
  let panel = document.getElementById('global-search');
  if (panel) { panel.querySelector('input').focus(); return; }
  panel = document.createElement('div');
  panel.id = 'global-search';
  panel.setAttribute('role','search');
  panel.style.cssText = 'position:fixed;top:60px;right:20px;z-index:3500;background:var(--surface);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow-lg);padding:10px;width:340px;max-width:calc(100vw - 40px)';
  panel.innerHTML = '<div style="display:flex;gap:6px;align-items:center">' +
    '<input type="text" placeholder="Buscar en el manual…" aria-label="Buscar en el manual" style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-family:inherit;font-size:13px" oninput="_gsSearch(this.value)">' +
    '<button onclick="document.getElementById(\'global-search\').remove()" style="border:none;background:none;cursor:pointer;font-size:16px;color:var(--text-muted)" aria-label="Cerrar buscador">×</button></div>' +
    '<div id="gs-results" style="max-height:320px;overflow-y:auto;margin-top:6px"></div>';
  document.body.appendChild(panel);
  panel.querySelector('input').focus();
}
function _gsSearch(term) {
  const box = document.getElementById('gs-results');
  if (!box) return;
  const t = (term||'').toLowerCase().trim();
  if (t.length < 2) { box.innerHTML = ''; return; }
  // Sincroniza la página activa antes de recorrer todas
  if (STATE.activePage && STATE.pages.length) {
    const cur = STATE.pages.find(p => p.id === STATE.activePage);
    if (cur) cur.blocks = [...STATE.blocks];
  }
  const scopes = STATE.pages.length
    ? STATE.pages.map(pg => ({ pid: pg.id, ptitle: pg.title, blocks: pg.blocks || [] }))
    : [{ pid: null, ptitle: '', blocks: STATE.blocks }];
  const hits = [];
  scopes.forEach(sc => sc.blocks.forEach(b => {
    const txt = _blockText(b);
    const i = txt.toLowerCase().indexOf(t);
    if (i >= 0 && hits.length < 30) hits.push({ pid: sc.pid, ptitle: sc.ptitle, bid: b.id, type: b.type, snippet: txt.slice(Math.max(0, i-25), i+45) });
  }));
  box.innerHTML = hits.length
    ? hits.map(h => '<div onclick="_gsGo(\'' + (h.pid||'') + '\',\'' + h.bid + '\')" style="padding:7px 9px;border-radius:7px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border)" onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'\'">' +
        (h.ptitle ? '<span style="color:var(--primary);font-weight:600">' + esc(h.ptitle) + '</span> · ' : '') +
        '<span style="color:var(--text-muted)">' + esc(h.type) + '</span><br>…' + esc(h.snippet) + '…</div>').join('')
    : '<div style="padding:8px;font-size:12px;color:var(--text-muted)">Sin resultados</div>';
}
function _gsGo(pid, bid) {
  if (pid && STATE.activePage !== pid) switchPage(pid);
  setTimeout(() => {
    const el = document.querySelector('.block-wrap[data-id="' + bid + '"]');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); selectBlock(bid); }
  }, 60);
}
function duplicateSelectedBlock() {
  const b = STATE.blocks.find(x=>x.id===STATE.selectedBlockId);
  if (!b) { notify('Selecciona un bloque primero'); return; }
  pushHistory();
  const copy = JSON.parse(JSON.stringify(b)); copy.id = uid();
  STATE.blocks.splice(STATE.blocks.indexOf(b)+1, 0, copy);
  render(); scheduleLocalSave(); notify('📋 Bloque duplicado (Ctrl+D)');
}

// ═══════════════════════════════════════════════════════
// LOCAL SAVE
// ═══════════════════════════════════════════════════════
function scheduleLocalSave() {
  if (STATE.isDragging) return;
  STATE.isDirty = true;
  setSaveStatus('⚠ Sin guardar');
  clearTimeout(STATE.saveTimer);
  STATE.saveTimer = setTimeout(localSave, 800);
}
function startAutoSave() {
  if (STATE.autoSaveTimer) clearInterval(STATE.autoSaveTimer);
  STATE.autoSaveTimer = setInterval(async () => {
    if (STATE.isDirty && STATE.user && STATE.manual.id) {
      let ok = await guardar();
      if (!ok) ok = await guardar(); // reintento unico
      if (!ok) setSaveStatus('⚠ Sin sincronizar — reintento en 1 min');
    }
  }, 60000);
}
function localSave() {
  if (STATE.isDragging) return;
  // Sync active page before saving
  if (STATE.activePage && STATE.pages.length > 0) {
    const cur = STATE.pages.find(p => p.id === STATE.activePage);
    if (cur) cur.blocks = [...STATE.blocks];
  }
  const data = {
    manual: STATE.manual,
    blocks: STATE.blocks,
    pages: STATE.pages,
    activePage: STATE.activePage,
    mediaLibrary: STATE.mediaLibrary,
    titulo: q('#manual-titulo').value,
    empresa: q('#manual-empresa').value
  };
  try { localStorage.setItem('manual_draft_' + (STATE.manual.id||'guest'), JSON.stringify(data)); }
  catch(e) {
    console.warn('localSave:', e);
    if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
      notify('\u26a0\ufe0f Sin espacio local: guarda en la nube (\ud83d\udcbe) para liberar las imagenes incrustadas', 5000);
    }
  }
  if (STATE.manual.id) { try { localStorage.setItem('last_manual_id', STATE.manual.id); } catch(e){} }
}
function loadLocalDraft(id) {
  try {
    const raw = localStorage.getItem('manual_draft_' + (id||'guest'));
    return raw ? JSON.parse(raw) : null;
  } catch(e){ return null; }
}

// Listen for other tabs
window.addEventListener('storage', ev=>{
  if (!STATE.manual.id) return;
  if (ev.key === 'manual_draft_' + STATE.manual.id) {
    notify('⚠️ Manual modificado en otra pestaña', 4000);
  }
});

// ═══════════════════════════════════════════════════════
// SUPABASE SYNC
// ═══════════════════════════════════════════════════════
async function guardar() {
  // Auth gate
  if (!STATE.user) { openAuthModal('Guarda el manual para sincronizar en la nube'); return; }
  if (STATE.role === 'visualizador') { notify('⚠️ Los visualizadores no pueden guardar'); return; }

  STATE.manual.titulo = q('#manual-titulo').value || 'Sin título';
  STATE.manual.empresa = q('#manual-empresa').value || '';

  const btn = q('#btn-guardar');
  const _prevManualId = STATE.manual.id;
  btn.textContent = '⏳ Guardando...'; btn.disabled = true;
  setSaveStatus('');

  try {
    // Sync active page blocks before save
    if (STATE.activePage && STATE.pages.length > 0) {
      const cur = STATE.pages.find(p => p.id === STATE.activePage);
      if (cur) cur.blocks = [...STATE.blocks];
    }
    // Build contenido — multi-page format when pages exist, plain array otherwise (retrocompatible)
    const contenido = (STATE.pages.length > 0)
      ? { blocks: STATE.blocks, pages: STATE.pages, activePage: STATE.activePage, mediaLibrary: STATE.mediaLibrary }
      : ((STATE.mediaLibrary && STATE.mediaLibrary.length)
          ? { blocks: STATE.blocks, mediaLibrary: STATE.mediaLibrary }
          : STATE.blocks);
    const manualData = {
      titulo: STATE.manual.titulo,
      empresa: STATE.manual.empresa,
      color: STATE.manual.color,
      contenido,
      estado: STATE.role === 'admin' ? 'publicado' : (STATE.manual.estado || 'borrador'),
      updated_at: new Date().toISOString(),
      user_id: STATE.user.id,
      created_by: STATE.manual.createdBy || STATE.user.id
    };

    let result;
    if (STATE.manual.id) {
      result = await sb.from('manuales').update(manualData).eq('id', STATE.manual.id).select().single();
    } else {
      result = await sb.from('manuales').insert(manualData).select().single();
    }
    if (result.error) throw result.error;

    const _wasNew = !_prevManualId;
    STATE.manual.id = result.data.id;
    STATE.manual.estado = result.data.estado;
    if (_wasNew) { const _all = STATE.pages.length ? STATE.pages.flatMap(p=>p.blocks||[]) : STATE.blocks; if (_all.some(b=>b._pendingBase64)) setTimeout(()=>uploadImportedImages(_all), 200); }
    try { localStorage.setItem('last_manual_id', STATE.manual.id); } catch(e){}
    localSave();
    setSaveStatus('✓ Guardado');
    STATE.isDirty = false;
    saveVersion();
    notify('✅ Manual guardado');
    updateRevisionBanner();
    return true;
  } catch(e) {
    setSaveStatus('⚠ Solo guardado local');
    notify('❌ Error al guardar: ' + (e.message||e), 4000);
    localSave();
    return false;
  } finally {
    btn.textContent = '💾 Guardar'; btn.disabled = false;
  }
}

async function openMisManuals() {
  if (!STATE.user) { openAuthModal('Accede para ver tus manuales guardados'); return; }
  openManualesPanel();
}

function openManualesPanel() {
  if (!STATE.user) { openAuthModal('Accede para ver tus manuales guardados'); return; }
  document.getElementById('manuales-panel').style.display = 'block';
  document.body.style.overflow = 'hidden';
  loadManualesPanel('activos');
}

function closeManualesPanel() {
  document.getElementById('manuales-panel').style.display = 'none';
  document.body.style.overflow = '';
}

function switchManualesTab(tab) {
  document.querySelectorAll('.mp2-tab').forEach(t => t.classList.remove('active'));
  const tabEl = document.getElementById('mp2-tab-' + tab);
  if (tabEl) tabEl.classList.add('active');
  loadManualesPanel(tab);
}

async function loadManualesPanel(tab) {
  const list = document.getElementById('mp2-list');
  if (!list) return;
  list.innerHTML = '<div class="mp2-empty">Cargando...</div>';
  try {
    let query = sb.from('manuales').select('id,titulo,empresa,estado,updated_at,created_by');
    if (tab === 'papelera') {
      query = query.eq('estado', 'papelera');
    } else {
      query = query.neq('estado', 'papelera').neq('estado', 'plantilla');
    }
    const { data, error } = await query.order('updated_at', { ascending: false });
    if (error) throw error;
    if (!data.length) {
      list.innerHTML = `<div class="mp2-empty">${tab === 'papelera' ? '🗑 La papelera está vacía' : '📄 No tienes manuales guardados.<br><br><button class="btn btn-primary" onclick="closeManualesPanel()">Crear manual</button>'}</div>`;
      return;
    }
    list.innerHTML = data.map(m => {
      const isActive = STATE.manual.id === m.id;
      const dateStr = new Date(m.updated_at).toLocaleString('es', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
      if (tab === 'papelera') {
        return `<div class="mp2-card">
          <div class="mp2-card-info">
            <div class="mp2-card-title">${esc(m.titulo||'Sin título')}</div>
            <div class="mp2-card-sub">Eliminado · ${dateStr}</div>
          </div>
          <div class="mp2-card-actions">
            <button class="btn" onclick="restoreManual('${m.id}')">♻️ Restaurar</button>
            <button class="btn" style="color:#dc2626" onclick="permanentDeleteManual('${m.id}','${esc(m.titulo||'Sin título')}')">🗑 Eliminar definitivamente</button>
          </div>
        </div>`;
      }
      return `<div class="mp2-card${isActive?' current':''}">
        <div class="mp2-card-info" onclick="loadManual('${m.id}');closeManualesPanel()">
          <div class="mp2-card-title">${isActive?'▶ ':''}${esc(m.titulo||'Sin título')}</div>
          <div class="mp2-card-sub">
            ${esc(m.empresa||'')}${m.empresa?' · ':''}${dateStr}
            <span class="badge ${m.estado||'borrador'}">${m.estado||'borrador'}</span>
          </div>
        </div>
        <div class="mp2-card-actions">
          <button class="btn" style="font-size:12px" onclick="openVersionHistoryFor('${m.id}')">🕐 Versiones</button>
          <button class="btn" style="font-size:12px;color:#dc2626" onclick="softDeleteManual('${m.id}','${esc(m.titulo||'Sin título')}')">🗑</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    list.innerHTML = `<div class="mp2-empty" style="color:#dc2626">Error: ${e.message}</div>`;
  }
}

async function softDeleteManual(id, titulo) {
  if (!confirm(`¿Mover "${titulo}" a la papelera?`)) return;
  try {
    const { error } = await sb.from('manuales').update({ estado: 'papelera' }).eq('id', id);
    if (error) throw error;
    if (STATE.manual.id === id) {
      STATE.manual = { id:null, titulo:'Nuevo manual', empresa:'', color:'#2563EB', estado:'borrador' };
      STATE.blocks = []; STATE.pages = []; STATE.activePage = null; STATE.isDirty = false;
      try { localStorage.removeItem('last_manual_id'); } catch(e){}
      q('#manual-titulo').value = 'Nuevo manual';
      q('#manual-empresa').value = '';
      setColor('#2563EB'); render(); renderPagesPanel(); setSaveStatus('');
    }
    notify('🗑 Movido a la papelera');
    loadManualesPanel('activos');
  } catch(e) { notify('❌ Error: ' + (e.message||e), 4000); }
}

async function restoreManual(id) {
  try {
    const { error } = await sb.from('manuales').update({ estado: 'borrador' }).eq('id', id);
    if (error) throw error;
    notify('✅ Manual restaurado');
    loadManualesPanel('papelera');
  } catch(e) { notify('❌ Error: ' + (e.message||e), 4000); }
}

async function permanentDeleteManual(id, titulo) {
  if (!confirm(`¿Eliminar definitivamente "${titulo}"?\n\nEsta acción NO se puede deshacer.`)) return;
  if (!confirm('⚠️ Última advertencia — todos los datos se borrarán para siempre. ¿Continuar?')) return;
  try {
    const { error } = await sb.from('manuales').delete().eq('id', id);
    if (error) throw error;
    notify('🗑 Manual eliminado definitivamente');
    loadManualesPanel('papelera');
  } catch(e) { notify('❌ Error: ' + (e.message||e), 4000); }
}

async function loadManual(id) {
  closeModal('modal-manuales');
  if (STATE.isDirty && STATE.user && STATE.blocks.length) await guardar();
  setSaveStatus('Cargando...');
  try {
    const { data, error } = await sb.from('manuales').select('*').eq('id',id).single();
    if (error) throw error;
    STATE.manual = { id:data.id, titulo:data.titulo, empresa:data.empresa||'', color:data.color||'#2563EB', estado:data.estado||'borrador', createdBy:data.created_by };
    if (!Array.isArray(data.contenido) && data.contenido?.pages) {
      STATE.blocks = data.contenido.blocks || [];
      STATE.pages = data.contenido.pages || [];
      STATE.activePage = data.contenido.activePage || null;
      STATE.mediaLibrary = data.contenido.mediaLibrary || [];
    } else {
      STATE.blocks = Array.isArray(data.contenido) ? data.contenido : (data.contenido.blocks || []);
      STATE.mediaLibrary = (!Array.isArray(data.contenido) && data.contenido.mediaLibrary) || [];
      STATE.pages = [];
      STATE.activePage = null;
    }
    pushHistory();
    q('#manual-titulo').value = data.titulo||'';
    q('#manual-empresa').value = data.empresa||'';
    setColor(data.color||'#2563EB');
    render();
    renderPagesPanel();
    setSaveStatus('');
    updateRevisionBanner();
    notify('📂 Manual cargado');
  } catch(e) { setSaveStatus(''); notify('❌ Error al cargar: '+(e.message||e), 4000); }
}

async function nuevoManual() {
  if (STATE.blocks.length) {
    if (STATE.isDirty && STATE.user) {
      await guardar();
      if (!confirm('¿Crear un manual nuevo?')) return;
    } else if (!confirm('¿Empezar un manual nuevo? Los cambios no guardados se perderán.')) return;
  }
  STATE.manual = { id:null, titulo:'Nuevo manual', empresa:'', color:'#2563EB', estado:'borrador' };
  STATE.blocks = [];
  STATE.pages = [];
  STATE.activePage = null;
  STATE.mediaLibrary = [];
  STATE.history = [];
  STATE.historyIdx = -1;
  STATE.isDirty = false;
  try { localStorage.removeItem('last_manual_id'); } catch(e){}
  q('#manual-titulo').value = 'Nuevo manual';
  q('#manual-empresa').value = '';
  setColor('#2563EB');
  render();
  renderPagesPanel();
  setSaveStatus('');
}

// ═══════════════════════════════════════════════════════
// REVISION WORKFLOW (admin/editor)
// ═══════════════════════════════════════════════════════
function updateRevisionBanner() {
  const banner = q('#revision-banner');
  const estado = STATE.manual.estado;
  if (!STATE.user || !estado || estado==='borrador') { banner.classList.remove('show'); return; }
  banner.classList.add('show');
  q('#revision-comment').textContent = STATE.manual.revisionComment ? ' · ' + STATE.manual.revisionComment : '';
  const adminBtns = q('#revision-admin-btns');
  if (STATE.role==='admin' && estado==='en_revision') {
    adminBtns.innerHTML = `<button class="btn btn-primary btn-sm" onclick="publishManual()">Publicar</button>
      <button class="btn btn-sm" onclick="rejectManual()" style="margin-left:6px">Rechazar</button>`;
  } else { adminBtns.innerHTML=''; }
}
async function enviarRevision() {
  if (!STATE.manual.id) { notify('Guarda el manual primero'); return; }
  const { error } = await sb.from('manuales').update({estado:'en_revision'}).eq('id',STATE.manual.id);
  if (error) { notify('❌ '+error.message); return; }
  STATE.manual.estado = 'en_revision';
  updateRevisionBanner();
  notify('✅ Enviado a revisión');
}
async function publishManual() {
  if (!STATE.manual.id) return;
  const { error } = await sb.from('manuales').update({estado:'publicado'}).eq('id',STATE.manual.id);
  if (error) { notify('❌ '+error.message); return; }
  STATE.manual.estado = 'publicado';
  updateRevisionBanner();
  notify('✅ Manual publicado');
}
async function rejectManual() {
  const comment = prompt('Motivo del rechazo (opcional):');
  const { error } = await sb.from('manuales').update({estado:'rechazado', revision_comment:comment||null}).eq('id',STATE.manual.id);
  if (error) { notify('❌ '+error.message); return; }
  STATE.manual.estado = 'rechazado';
  STATE.manual.revisionComment = comment||'';
  updateRevisionBanner();
  notify('Manual rechazado con comentario');
}

// ═══════════════════════════════════════════════════════
// EXPORT HTML
// ═══════════════════════════════════════════════════════
async function exportHTML(preview) {
  // Multi-page export when pages exist
  if (STATE.pages.length > 0) {
    if (STATE.activePage) {
      const cur = STATE.pages.find(p => p.id === STATE.activePage);
      if (cur) cur.blocks = [...STATE.blocks];
    }
    await exportHTMLMultipage(preview);
    return;
  }

  if (!STATE.blocks.length) { notify('El manual está vacío'); return; }
  if (!navigator.onLine && STATE.blocks.some(b=>b.storagePath)) {
    notify('⚠️ Necesitas conexión para exportar con imágenes'); return;
  }

  const prog = q('#export-progress'); prog.classList.add('show');
  const bar = q('#export-bar'); const msg = q('#export-msg');
  // Only fetch from storage blocks that have no local src (annotated images already in block.src)
  const imgBlocks = STATE.blocks.filter(b=>b.storagePath && !b.src);
  let done = 0;

  const imgCache = {};
  for (const block of imgBlocks) {
    msg.textContent = `Descargando imagen ${done+1} de ${imgBlocks.length}...`;
    bar.style.width = Math.round((done/Math.max(imgBlocks.length,1))*80) + '%';
    try {
      const { data, error } = await sb.storage.from('manual-images').download(block.storagePath);
      if (!error && data) {
        imgCache[block.storagePath] = await blobToBase64(data);
      }
    } catch(e) { /* continue with broken img */ }
    done++;
  }

  msg.textContent = 'Generando HTML...';
  bar.style.width = '90%';

  const titulo = q('#manual-titulo').value || 'Manual';
  const empresa = q('#manual-empresa').value || '';
  const color = STATE.manual.color || '#2563EB';

  let pasoN = 0;
  const body = STATE.blocks.map(b=>{
    const def = BLOCK_TYPES[b.type];
    if (!def) return '';
    if (b.type==='paso') { if (b.resetStep) pasoN = 0; pasoN++; }
    const bCopy = {...b};
    // Only use storage download if no local src (preserves annotations)
    if (!bCopy.src && bCopy.storagePath && imgCache[bCopy.storagePath]) bCopy.src = imgCache[bCopy.storagePath];
    return renderBlockForExport(bCopy, pasoN);
  }).join('\n');

  const html = buildExportHTML(titulo, empresa, color, body);

  bar.style.width = '100%';
  setTimeout(()=>{
    prog.classList.remove('show');
    if (preview) { _showHtmlPreview(html, titulo); return; }
    const blob = new Blob([html], {type:'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (titulo.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g,'').trim() || 'manual') + '.html';
    a.click();
    URL.revokeObjectURL(url);
    const size = (blob.size/1024/1024).toFixed(1);
    notify(`✅ Exportado: ${size} MB`);
  }, 400);
}

// ── Previsualizador HTML/PDF: muestra el manual generado en un iframe ────────
let _pvHtml = '', _pvTitle = '';
function _showHtmlPreview(html, titulo) {
  _pvHtml = html; _pvTitle = titulo || 'Manual';
  let modal = document.getElementById('preview-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'preview-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:4000;background:rgba(15,23,42,.7);display:flex;flex-direction:column';
    modal.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:9px 14px;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0">
        <strong style="flex:1;color:var(--ui-text);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">👁 Vista previa — <span id="pv-title"></span></strong>
        <button class="btn btn-sm" onclick="_pvPrint()">🖨 Imprimir / PDF</button>
        <button class="btn btn-sm" onclick="_pvDownload()">⬇ Descargar HTML</button>
        <button class="btn btn-sm" onclick="document.getElementById('preview-modal').style.display='none'">✕ Cerrar</button>
      </div>
      <iframe id="pv-frame" style="flex:1;width:100%;border:none;background:#fff"></iframe>`;
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  document.getElementById('pv-title').textContent = _pvTitle;
  document.getElementById('pv-frame').srcdoc = html;
}
function _pvDownload() {
  const blob = new Blob([_pvHtml], {type:'text/html;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = (_pvTitle.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g,'').trim()||'manual') + '.html';
  a.click(); URL.revokeObjectURL(url);
}
function _pvPrint() {
  const f = document.getElementById('pv-frame');
  if (f && f.contentWindow) { f.contentWindow.focus(); f.contentWindow.print(); }
}

function blobToBase64(blob) {
  return new Promise(res=>{ const fr=new FileReader(); fr.onload=e=>res(e.target.result); fr.readAsDataURL(blob); });
}

function renderBlockForExport(b, pasoN) {
  const color = STATE.manual.color || '#2563EB';
  const imgTag = src => src ? `<img src="${src}" class="lb-img" onclick="_lbOpen(this.src)" style="width:100%;display:block" alt="">` : '';
  const blockStyle = (b.blockBorderColor || b.blockBgColor)
    ? ` data-custom-colors="1"` : '';
  const wrapStyle = b.blockBgColor ? `background:${b.blockBgColor};` : '';
  const borderAccent = b.blockBorderColor || color;

  switch(b.type) {
    case 'subtitulo': {
      const _sBg = normalizeHex(b.blockBgColor || '#64748b');
      const _sTxt = isLightColor(_sBg) ? '#1a1a1a' : '#ffffff';
      return `<div style="padding:11px 20px 9px;background:${_sBg};border-radius:8px;margin-bottom:12px;text-align:center"><div style="font-weight:700;font-size:17px;color:${_sTxt}">${b.texto||''}</div></div>`;
    }
    case 'titulo': {
      const _bgC = normalizeHex(b.blockBgColor || '#4a4a4a');
      const _txtC = isLightColor(_bgC) ? '#1a1a1a' : '#ffffff';
      const _subC = isLightColor(_bgC) ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.7)';
      return `<div style="padding:20px 24px 16px;background:${_bgC};border-left:none;border-radius:8px;margin-bottom:12px;text-align:center;color:${_txtC}"><h2 style="font-size:22px;font-weight:700;margin:0;text-align:center;color:${_txtC}">${b.titulo||''}</h2>${b.subtitulo?`<p style="margin-top:4px;text-align:center;color:${_subC}">${b.subtitulo}</p>`:''}</div>`;
    }
    case 'alerta': {
      const styles={info:'background:#eff6ff;border-left:4px solid #3b82f6',advertencia:'background:#fefce8;border-left:4px solid #eab308',peligro:'background:#fef2f2;border-left:4px solid #ef4444',exito:'background:#f0fdf4;border-left:4px solid #22c55e'};
      const icons={info:'ℹ️',advertencia:'⚠️',peligro:'🚨',exito:'✅'};
      const _aiIcon = b.icon ? iconSVG(b.icon,18,'#374151') : icons[b.tipo||'info'];
      const _aiLines = (b.texto||'').split('\n').filter(l=>l.trim());
      const _aiHtml = _aiLines.length > 0
        ? `<ul style="margin:0;padding-left:16px">${_aiLines.map(l=>`<li style="font-size:14px;line-height:1.6">${l}</li>`).join('')}</ul>`
        : '';
      return `<div style="padding:12px 16px;border-radius:8px;display:flex;gap:10px;align-items:flex-start;${styles[b.tipo||'info']||styles.info};margin-bottom:12px"><span style="font-size:18px;flex-shrink:0;display:flex;align-items:center;padding-top:2px">${_aiIcon}</span><div>${_aiHtml}</div></div>`;
    }
    case 'paso': {
      const _dLines = (b.descripcion||'').split('\n').filter(l=>l.trim());
      const _dHtml = _dLines.length > 0
        ? `<ul style="list-style:disc;padding-left:18px;margin-top:4px;color:#374151">${_dLines.map(l=>`<li style="font-size:14px;line-height:1.6">${l}</li>`).join('')}</ul>`
        : '';
      return `<div style="background:${wrapStyle?b.blockBgColor:'#fff'};border-radius:8px;border:1px solid ${b.blockBorderColor||'#e2e8f0'};overflow:hidden;margin-bottom:12px"><div style="display:flex;gap:12px;padding:16px"><div style="width:32px;height:32px;border-radius:50%;background:${borderAccent};color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${pasoN}</div><div style="flex:1">${`<div style="font-weight:600;font-size:15px">${b.titulo||''}</div>`}${_dHtml}</div></div>${b.src?`${imgTag(b.src)}<div style="font-size:12px;color:#64748b;padding:6px 16px;border-top:1px solid #e2e8f0;background:#fafafa">${esc(b.caption||'')}</div>`:''}</div>`;
    }
    case 'imagen': return `<div style="background:#fff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:12px">${imgTag(b.src)}<div style="font-size:12px;color:#64748b;padding:6px 12px;border-top:1px solid #e2e8f0;background:#fafafa">${esc(b.caption||'')}</div></div>`;
    case 'tabla': {
      const headers=(b.columnas||[]).map(c=>`<th style="background:#f8fafc;font-weight:600;padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0">${esc(c)}</th>`).join('');
      const rows=(b.filas||[]).map(row=>`<tr>${(row||[]).map(cell=>`<td style="padding:9px 12px;border-bottom:1px solid #e2e8f0">${esc(cell)}</td>`).join('')}</tr>`).join('');
      return `<div style="background:#fff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:12px"><table style="width:100%;border-collapse:collapse"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    case 'callout': {
      const styles={tip:'background:#f0fdf4;border:1px solid #bbf7d0',warning:'background:#fefce8;border:1px solid #fef08a',important:'background:#eff6ff;border:1px solid #bfdbfe'};
      const icons={tip:'💡',warning:'⚠️',important:'📌'};
      const _caIcon = b.icon ? iconSVG(b.icon,18,'#374151') : icons[b.tipo||'tip'];
      const _caLines = (b.texto||'').split('\n').filter(l=>l.trim());
      const _caHtml = _caLines.length > 0
        ? `<ul style="margin:0;padding-left:16px">${_caLines.map(l=>`<li style="font-size:14px;line-height:1.6">${esc(l)}</li>`).join('')}</ul>`
        : '';
      return `<div style="padding:14px 16px;border-radius:8px;display:flex;gap:10px;align-items:flex-start;${styles[b.tipo||'tip']||styles.tip};margin-bottom:12px"><span style="font-size:18px;flex-shrink:0;display:flex;align-items:center;padding-top:2px">${_caIcon}</span><div>${_caHtml}</div></div>`;
    }
    case 'lista': return `<div style="background:#fff;border-radius:8px;border:1px solid #e2e8f0;padding:12px 16px;margin-bottom:12px">${(b.items||[]).map(it=>`<div style="display:flex;gap:10px;padding:5px 0"><span style="font-size:16px">${it.icono==='check'?'✅':'❌'}</span><span>${esc(it.texto||'')}</span></div>`).join('')}</div>`;
    case 'separador': return `<div style="padding:8px 0;margin-bottom:12px"><hr style="border:none;border-top:2px solid #e2e8f0"></div>`;
    case 'texto': {
      const _tImg = b.src ? `<img src="${b.src}" style="width:100%;display:block;border-radius:6px;margin-top:10px" alt="">` : '';
      return `<div style="padding:12px 16px;background:#fff;border-radius:8px;font-size:14px;line-height:1.6;margin-bottom:12px">${b.html||''}${_tImg}</div>`;
    }
    case 'flujos': {
      const rows=(b.filas||[]).map(r=>`<tr><td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;font-weight:500">${esc(r.condicion||'')}</td><td style="padding:9px 12px;border-bottom:1px solid #e2e8f0">${esc(r.accion||'')}</td></tr>`).join('');
      return `<div style="background:#fff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:12px"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="background:#f8fafc;font-weight:600;padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;border-right:1px solid #e2e8f0;width:45%">Condición</th><th style="background:#f8fafc;font-weight:600;padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Acción</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    case 'video': {
      if (b.videoType === 'file' && b.src) return `<div style="background:#fff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:12px;padding:12px"><video controls style="width:100%;border-radius:6px"><source src="${b.src}" type="video/mp4"></video>${b.titulo?`<div style="font-size:12px;color:#64748b;padding:6px 0">${esc(b.titulo)}</div>`:''}</div>`;
      if (b.videoType === 'file' && b.storagePath) return `<div style="background:#fff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:12px;padding:12px"><video controls class="lazy-video" data-vpath="${b.storagePath}" style="width:100%;border-radius:6px"></video>${b.titulo?`<div style="font-size:12px;color:#64748b;padding:6px 0">${esc(b.titulo)}</div>`:''}</div>`;
      if (b.videoType === 'pdf' && b.url) return `<div style="background:#fff;border-radius:8px;border:1px solid #e2e8f0;padding:14px 16px;margin-bottom:12px;display:flex;gap:10px;align-items:center"><span style="font-size:28px">📄</span><div><div style="font-weight:600">${esc(b.titulo||b.url)}</div><a href="${esc(b.url)}" style="font-size:12px;color:#2563eb">${esc(b.url)}</a></div></div>`;
      const embed = getVideoEmbedUrl(b.url);
      if (embed) return `<div style="background:#fff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:12px"><iframe src="${embed}" style="width:100%;display:block;border:none;aspect-ratio:16/9" allowfullscreen></iframe>${b.caption?`<div style="font-size:12px;color:#64748b;padding:6px 12px;border-top:1px solid #e2e8f0;background:#fafafa">${esc(b.caption)}</div>`:''}</div>`;
      if (b.url) return `<div style="background:#fff;border-radius:8px;border:1px solid #e2e8f0;padding:14px 16px;margin-bottom:12px;display:flex;gap:10px;align-items:center"><span style="font-size:28px">🎬</span><div><div style="font-weight:600">${esc(b.titulo||b.url)}</div><a href="${esc(b.url)}" style="font-size:12px;color:#2563eb">${esc(b.url)}</a></div></div>`;
      return '';
    }
    case 'enlace': {
      const title = b.titulo || b.url || 'Enlace';
      return `<div style="background:#fff;border-radius:8px;border:1px solid #e2e8f0;padding:14px 16px;margin-bottom:12px;display:flex;gap:10px;align-items:flex-start"><span style="font-size:22px;flex-shrink:0">🔗</span><div style="flex:1;min-width:0"><div style="font-weight:600;font-size:14px;color:#2563eb">${esc(title)}</div>${b.url?`<div style="font-size:12px;color:#64748b;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><a href="${esc(b.url)}">${esc(b.url)}</a></div>`:''}${b.descripcion?`<div style="font-size:13px;margin-top:6px">${esc(b.descripcion)}</div>`:''}</div></div>`;
    }
    case 'codigo': {
      const lang = esc(b.language||'');
      const code = esc(b.code||'');
      return `<div style="border-radius:8px;overflow:hidden;margin-bottom:12px;font-family:'Fira Code',Consolas,monospace"><div style="background:#1e293b;padding:8px 14px;font-size:11px;color:#94a3b8;letter-spacing:.5px">${lang}</div><pre style="margin:0;padding:14px;background:#0f172a;color:#e2e8f0;font-size:13px;line-height:1.6;overflow-x:auto;white-space:pre-wrap;word-break:break-all">${code}</pre></div>`;
    }
    case 'icono': {
      if (!b.iconKey) return '';
      const svgEl = iconSVG(b.iconKey, b.size||48, b.color||'#2563EB');
      const labelEl = b.label ? `<div style="margin-top:8px;font-size:13px;color:#64748b">${esc(b.label)}</div>` : '';
      return `<div style="text-align:${b.align||'center'};padding:16px;background:#fff;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:12px">${svgEl}${labelEl}</div>`;
    }
    default: return '';
  }
}

async function exportPDF() {
  if (!STATE.blocks.length) { notify('El manual está vacío'); return; }
  setSaveStatus('Generando PDF...');
  const prog = q('#export-progress'); prog.classList.add('show');
  const bar = q('#export-bar'); const msg = q('#export-msg');
  try {
    msg.textContent = 'Cargando librerías...'; bar.style.width = '10%';
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    // Only fetch storage images without a local src (preserves annotations)
    const imgBlocks = STATE.blocks.filter(b => b.storagePath && !b.src && b.type !== 'video');
    const imgCache = {};
    let done = 0;
    for (const block of imgBlocks) {
      msg.textContent = `Descargando imagen ${done+1} de ${imgBlocks.length}...`;
      bar.style.width = Math.round(10 + (done / Math.max(imgBlocks.length,1)) * 40) + '%';
      try {
        const { data, error } = await sb.storage.from('manual-images').download(block.storagePath);
        if (!error && data) imgCache[block.storagePath] = await blobToBase64(data);
      } catch(e) { /* continue */ }
      done++;
    }
    let pasoN = 0;
    const body = STATE.blocks.map(b => {
      const bCopy = {...b};
      if (!bCopy.src && bCopy.storagePath && imgCache[bCopy.storagePath]) bCopy.src = imgCache[bCopy.storagePath];
      if (b.type === 'paso') { if (b.resetStep) pasoN = 0; pasoN++; }
      return renderBlockForExport(bCopy, pasoN);
    }).join('\n');
    const titulo = q('#manual-titulo').value || 'Manual';
    const color = STATE.manual.color || '#2563EB';
    msg.textContent = 'Renderizando...'; bar.style.width = '55%';
    const container = document.createElement('div');
    container.style.cssText = `position:fixed;top:0;left:-9999px;width:794px;background:#f8fafc;padding:32px;font-family:Inter,system-ui,sans-serif;font-size:14px;line-height:1.5;color:#1e293b`;
    container.innerHTML = `<div style="margin-bottom:20px;padding:20px;background:${color};border-radius:8px;color:#fff"><h1 style="margin:0;font-size:24px">${esc(titulo)}</h1></div>` + body;
    document.body.appendChild(container);
    const canvas = await window.html2canvas(container, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#f8fafc' });
    document.body.removeChild(container);
    msg.textContent = 'Generando PDF...'; bar.style.width = '80%';
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    // Pixels per mm based on canvas width vs A4 width
    const pxPerMm = canvas.width / pageW;
    const pageHeightPx = Math.floor(pageH * pxPerMm);
    const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));
    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage();
      const srcY = i * pageHeightPx;
      const srcH = Math.min(pageHeightPx, canvas.height - srcY);
      const sc = document.createElement('canvas');
      sc.width = canvas.width; sc.height = srcH;
      sc.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
      // Last page may be shorter — use actual height in mm to avoid stretching
      const actualHeightMm = srcH / pxPerMm;
      pdf.addImage(sc.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, pageW, actualHeightMm);
    }
    bar.style.width = '100%';
    pdf.save((titulo.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g,'').trim() || 'manual') + '.pdf');
    setTimeout(() => { prog.classList.remove('show'); setSaveStatus(''); }, 500);
    notify('✅ PDF descargado');
  } catch(e) {
    prog.classList.remove('show'); setSaveStatus('');
    notify('❌ Error al generar PDF: ' + (e.message||e), 4000);
  }
}

function switchVideoTab(t) {
  ['link','file','pdf'].forEach(tab => {
    const sec = document.getElementById('be-vsec-' + tab);
    const vtab = document.getElementById('be-vtab-' + tab);
    if (sec) sec.style.display = tab === t ? 'block' : 'none';
    if (vtab) {
      vtab.style.borderColor = tab === t ? 'var(--primary)' : 'var(--border-color)';
      vtab.style.fontWeight = tab === t ? '600' : '400';
      vtab.style.background = tab === t ? 'rgba(37,99,235,0.08)' : 'transparent';
    }
  });
  const vtype = document.getElementById('be-vtype');
  if (vtype) vtype.value = t;
}

function _lbCSS() {
  return `.lb-img{cursor:zoom-in;display:block;width:100%}
.lb-ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.93);z-index:9999;align-items:center;justify-content:center;overflow:auto;padding:16px;box-sizing:border-box;cursor:zoom-out}
.lb-ov.open{display:flex}
.lb-ov.zoomed{align-items:flex-start;cursor:default}
.lb-full{max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);object-fit:contain;border-radius:4px;cursor:zoom-in;flex-shrink:0;box-shadow:0 8px 48px rgba(0,0,0,.7);transition:none}
.lb-full.zoomed{max-width:none;max-height:none;width:auto;height:auto;cursor:zoom-out}
.lb-cls{position:fixed;top:14px;right:18px;background:rgba(255,255,255,.18);color:#fff;border:none;border-radius:50%;width:40px;height:40px;font-size:22px;cursor:pointer;z-index:1}
.lb-cls:hover{background:rgba(255,255,255,.35)}
.lb-hint{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.55);font-size:12px;pointer-events:none;white-space:nowrap}`;
}
function _lbHTML() {
  return `<div class="lb-ov" id="lb-ov" onclick="if(event.target===this)_lbClose()">
  <button class="lb-cls" onclick="_lbClose()">×</button>
  <img class="lb-full" id="lb-img" src="" onclick="_lbZoom()" alt="">
  <div class="lb-hint" id="lb-hint">Clic para ampliar · Esc para cerrar</div>
</div>`;
}
function _lbJS() {
  return `function _lbOpen(src){document.getElementById('lb-ov').classList.add('open');document.getElementById('lb-img').src=src;document.getElementById('lb-img').classList.remove('zoomed');document.getElementById('lb-ov').classList.remove('zoomed');document.addEventListener('keydown',_lbKey);}
function _lbClose(){document.getElementById('lb-ov').classList.remove('open','zoomed');document.getElementById('lb-img').classList.remove('zoomed');document.removeEventListener('keydown',_lbKey);}
function _lbZoom(){const z=document.getElementById('lb-img').classList.toggle('zoomed');document.getElementById('lb-ov').classList.toggle('zoomed',z);document.getElementById('lb-hint').textContent=z?'Clic para reducir · Esc para cerrar':'Clic para ampliar · Esc para cerrar';}
function _lbKey(e){if(e.key==='Escape')_lbClose();}`;
}

function buildExportHTML(titulo, empresa, color, body) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#f8fafc;color:#0f172a;padding:0}
.header{background:${color};color:#fff;padding:32px 40px}
.header h1{font-size:28px;font-weight:700}
.header .empresa{opacity:.85;margin-top:4px}
.content{max-width:800px;margin:0 auto;padding:32px 24px}
@media print{body{background:#fff}.header{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
${_lbCSS()}
</style>
</head>
<body>
<div class="header">
  <h1>${esc(titulo)}</h1>
  ${empresa?`<div class="empresa">${esc(empresa)}</div>`:''}
  <div style="font-size:12px;opacity:.7;margin-top:8px">Generado el ${new Date().toLocaleDateString('es')}</div>
</div>
<div class="content">
${body}
</div>
${_lbHTML()}
<script>${_lbJS()}<\/script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════
// TEAMS COPY
// ═══════════════════════════════════════════════════════
function openTeamsModal() {
  let pasoN = 0;
  const lines = STATE.blocks.map(b=>{
    const def = BLOCK_TYPES[b.type];
    if (!def?.toTeamsText) return '';
    if (b.type==='paso') { if (b.resetStep) pasoN = 0; pasoN++; }
    return def.toTeamsText(b, pasoN);
  }).filter(Boolean);

  const titulo = q('#manual-titulo').value||'Manual';
  const empresa = q('#manual-empresa').value||'';
  const header = `📋 **${titulo}**${empresa?'\n'+empresa:''}\n${'━'.repeat(40)}`;
  q('#teams-text').value = header + '\n\n' + lines.join('\n\n');
  openModal('modal-teams');
}
function copyTeamsText() {
  const txt = q('#teams-text').value;
  navigator.clipboard.writeText(txt).then(()=>notify('✅ Copiado al portapapeles')).catch(()=>{
    q('#teams-text').select(); document.execCommand('copy'); notify('✅ Copiado');
  });
}

// ═══════════════════════════════════════════════════════
// SHARE MENU
// ═══════════════════════════════════════════════════════
function toggleShareMenu() {
  q('#share-menu').classList.toggle('open');
}
document.addEventListener('click', ev=>{
  if (!ev.target.closest('#share-dropdown')) q('#share-menu')?.classList.remove('open');
});

// ═══════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════
function showAuthScreen() { q('#auth-screen').classList.remove('hidden'); }
function hideAuthScreen() { q('#auth-screen').classList.add('hidden'); }
function openAuthModal(msg='') { q('#auth-msg').textContent=msg||''; showAuthScreen(); }

function showMagicLinkForm() {
  const f = q('#magic-link-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

async function loginWithPassword() {
  const email = q('#auth-email').value.trim();
  const pass  = q('#auth-password').value;
  if (!email) { q('#auth-msg').textContent='Introduce tu email'; return; }
  if (!pass)  { q('#auth-msg').textContent='Introduce tu contraseña'; return; }
  q('#auth-msg').textContent = 'Entrando...';
  q('#auth-btn').disabled = true;

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });

  if (error) {
    // If user exists but has no password set → offer to set one via magic link first
    if (error.message?.includes('Invalid login credentials') || error.message?.includes('Email not confirmed')) {
      q('#auth-msg').textContent = '⚠️ Contraseña incorrecta. Usa el enlace por email para acceder la primera vez.';
    } else {
      q('#auth-msg').textContent = '❌ ' + error.message;
    }
    q('#auth-btn').disabled = false;
    return;
  }

  q('#auth-btn').disabled = false;
  q('#auth-msg').textContent = '';
  // handleSession is called by onAuthStateChange → SIGNED_IN
}

async function sendMagicLink() {
  const email = q('#auth-email').value.trim() || 'fparedes3093@protonmail.com';
  q('#auth-msg').textContent = 'Enviando enlace...';
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  });
  if (error) {
    const msg = error.message || '';
    if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many') || msg.toLowerCase().includes('exceeded')) {
      q('#auth-msg').textContent = '⏳ Demasiados intentos. Espera ~1 hora antes de reintentar. Prueba a usar "Restablecer contraseña" en su lugar.';
    } else {
      q('#auth-msg').textContent = '❌ ' + msg;
    }
    return;
  }
  q('#auth-msg').textContent = '✅ Enlace enviado a ' + email + '. Revisa tu bandeja (y spam).';
}

async function sendPasswordReset() {
  const email = q('#auth-email').value.trim();
  if (!email) { q('#auth-msg').textContent = 'Introduce tu email primero'; return; }
  q('#auth-msg').textContent = 'Enviando email de restablecimiento...';
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });
  if (error) {
    const msg = error.message || '';
    if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many') || msg.toLowerCase().includes('exceeded')) {
      q('#auth-msg').textContent = '⏳ Límite de emails alcanzado. Espera ~1 hora e inténtalo de nuevo.';
    } else {
      q('#auth-msg').textContent = '❌ ' + msg;
    }
    return;
  }
  q('#auth-msg').textContent = '✅ Email de restablecimiento enviado a ' + email + '. Revisa tu bandeja y spam, y haz clic en el enlace.';
}

async function logout() {
  if (STATE.isDirty && STATE.user && STATE.blocks.length) await guardar();
  if (!confirm('¿Cerrar sesión?')) return;
  await sb.auth.signOut();
  STATE.user = null; STATE.role = null;
  q('#btn-logout').style.display = 'none';
  q('#btn-cambiar-pass').style.display = 'none';
  q('#role-btns').innerHTML = '';
  q('#sidebar').style.display = '';
  q('#canvas-wrap').style.marginLeft = '';
  q('#app').style.display = '';
  q('#viewer').classList.remove('active');
  showAuthScreen();
}

// ═══════════════════════════════════════════════════════
// ROLES
// ═══════════════════════════════════════════════════════
async function loadUserRole(_userId) {
  // Uses get_my_role() RPC (SECURITY DEFINER) to avoid RLS recursion on user_roles
  const { data, error } = await sb.rpc('get_my_role');
  if (error || !data) return null;
  return data;
}

async function ensureAdminExists(userId) {
  // If no roles exist at all, make this user admin
  const { count } = await sb.from('user_roles').select('*', {count:'exact',head:true});
  if (count === 0) {
    await sb.from('user_roles').insert({ user_id: userId, role: 'admin' });
    return 'admin';
  }
  return null;
}

function applyRoleUI(role) {
  const btns = q('#role-btns');
  btns.innerHTML = '';
  q('#btn-logout').style.display = 'flex';
  q('#btn-cambiar-pass').style.display = 'flex';

  if (role === 'admin') {
    btns.innerHTML = `<button class="tb-btn" onclick="openModal('modal-users')">👥 Usuarios</button><a href="admin.html" class="tb-btn" style="text-decoration:none">⚙️ Admin</a>`;
  }
  if (role === 'editor') {
    btns.innerHTML = `<button class="tb-btn" onclick="enviarRevision()">📤 Enviar revisión</button>`;
  }
  if (role === 'admin' && STATE.manual.id && STATE.manual.estado === 'en_revision') {
    // Already handled by revision banner
  }

  // Sidebar visibility
  q('#sidebar').style.display = role==='visualizador' ? 'none' : '';
  q('#canvas-wrap').style.marginLeft = role==='visualizador' ? '0' : '';

  if (role === 'visualizador') {
    showViewerMode();
  }
}

// ═══════════════════════════════════════════════════════
// VIEWER MODE
// ═══════════════════════════════════════════════════════
async function showViewerMode() {
  q('#app').style.display = 'none';
  q('#viewer').classList.add('active');
  const list = q('#viewer-list');
  list.innerHTML = '<p style="color:var(--text-muted);padding:20px;text-align:center">Cargando manuales...</p>';
  try {
    const { data, error } = await sb.from('manuales').select('id,titulo,empresa,estado,updated_at').eq('estado','publicado').order('updated_at',{ascending:false});
    if (error) throw error;
    if (!data.length) { list.innerHTML='<p style="color:var(--text-muted);padding:40px;text-align:center">No hay manuales publicados aún</p>'; return; }
    list.innerHTML = `<h2 style="font-size:18px;font-weight:700;margin-bottom:16px">Manuales disponibles</h2>` +
      data.map(m=>`<div class="viewer-card" onclick="viewManual('${m.id}')">
        <div><h3>${esc(m.titulo||'Sin título')}</h3><div class="meta">${esc(m.empresa||'')} · ${new Date(m.updated_at).toLocaleDateString('es')}</div></div>
        <span class="badge publicado">publicado</span>
      </div>`).join('');
  } catch(e) { list.innerHTML=`<p style="color:#dc2626;padding:20px">${e.message}</p>`; }
}

async function viewManual(id) {
  q('#viewer-list').style.display='none';
  const view = q('#manual-view');
  view.innerHTML='<p style="text-align:center;padding:40px;color:var(--text-muted)">Cargando...</p>';
  try {
    const { data, error } = await sb.from('manuales').select('*').eq('id',id).single();
    if (error) throw error;
    const blocks = Array.isArray(data.contenido)?data.contenido:[];
    let pasoN=0;
    const tempState = {...STATE};
    STATE.manual = {id:data.id, titulo:data.titulo, empresa:data.empresa||'', color:data.color||'#2563EB'};
    const bodyHTML = blocks.map(b=>{
      if(b.type==='paso') { if (b.resetStep) pasoN = 0; pasoN++; }
      return renderBlockForExport(b, pasoN);
    }).join('');
    view.innerHTML=`<button onclick="q('#viewer-list').style.display='';q('#manual-view').innerHTML=''" style="margin-bottom:20px" class="btn">← Volver</button>
      <div style="background:${data.color||'#2563EB'};color:#fff;padding:24px;border-radius:12px;margin-bottom:24px">
        <h1 style="font-size:24px;font-weight:700">${esc(data.titulo||'')}</h1>
        ${data.empresa?`<div style="opacity:.85;margin-top:4px">${esc(data.empresa)}</div>`:''}
      </div>
      ${bodyHTML}`;
    loadLazyImages();
    STATE.manual = tempState.manual;
  } catch(e) { view.innerHTML=`<p style="color:#dc2626;padding:20px">${e.message}</p>`; }
}

// ═══════════════════════════════════════════════════════
// USER MANAGEMENT (admin)
// ═══════════════════════════════════════════════════════
async function inviteUser() {
  const email = q('#invite-email').value.trim();
  const role = q('#invite-role').value;
  if (!email) { notify('Introduce un email'); return; }

  // Send magic link + create role (role created after first login via trigger or manual)
  // For simplicity: store pending invitation in a separate approach
  // We use signInWithOtp to invite, then admin must assign role after user logs in
  const { error } = await sb.auth.signInWithOtp({ email, options:{emailRedirectTo: window.location.origin + window.location.pathname} });
  if (error) { notify('❌ '+error.message); return; }

  // Store the intended role (we'll apply it when user first logs in)
  localStorage.setItem('pending_role_'+email, role);
  notify(`✅ Invitación enviada a ${email} como ${role}`);
  q('#invite-email').value='';
  loadUsersList();
}

async function loadUsersList() {
  const list = q('#users-list');
  list.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Cargando...</div>';

  const [rolesRes, manualesRes] = await Promise.all([
    sb.from('user_roles').select('user_id,role,created_at'),
    sb.from('manuales').select('id,titulo,empresa,estado,updated_at').eq('estado','en_revision').order('updated_at',{ascending:false})
  ]);

  let html = '';

  // Pending review section
  if (!manualesRes.error && manualesRes.data?.length) {
    html += `<p style="font-size:12px;font-weight:600;color:#ca8a04;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">⏳ En revisión (${manualesRes.data.length})</p>`;
    html += manualesRes.data.map(m=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid #fef08a;background:#fefce8;border-radius:6px;margin-bottom:6px">
      <div><div style="font-size:13px;font-weight:500">${esc(m.titulo||'Sin título')}</div><div style="font-size:12px;color:var(--text-muted)">${esc(m.empresa||'')} · ${new Date(m.updated_at).toLocaleDateString('es')}</div></div>
      <div style="display:flex;gap:4px">
        <button class="btn btn-primary btn-sm" onclick="adminPublish('${m.id}')">Publicar</button>
        <button class="btn btn-sm" onclick="adminReject('${m.id}')">Rechazar</button>
      </div>
    </div>`).join('');
    html += '<hr style="margin:12px 0;border-color:var(--border)">';
  }

  if (rolesRes.error || !rolesRes.data?.length) {
    html += '<p style="color:var(--text-muted);font-size:13px">No hay usuarios registrados</p>';
  } else {
    html += `<p style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">Usuarios (${rolesRes.data.length})</p>`;
    html += rolesRes.data.map(u=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
      <div><div style="font-size:13px;font-weight:500">${u.user_id.slice(0,8)}…</div><div style="font-size:12px;color:var(--text-muted)">${new Date(u.created_at).toLocaleDateString('es')}</div></div>
      <select class="form-select" style="font-size:12px;padding:4px" onchange="changeUserRole('${u.user_id}',this.value)">
        ${['admin','editor','visualizador'].map(r=>`<option value="${r}" ${u.role===r?'selected':''}>${r}</option>`).join('')}
      </select>
    </div>`).join('');
  }

  list.innerHTML = html;
}

async function adminPublish(id) {
  const { error } = await sb.from('manuales').update({estado:'publicado'}).eq('id',id);
  if (error) { notify('❌ '+error.message); return; }
  notify('✅ Manual publicado'); loadUsersList();
  if (STATE.manual.id===id) { STATE.manual.estado='publicado'; updateRevisionBanner(); }
}

async function adminReject(id) {
  const comment = prompt('Motivo del rechazo (opcional):');
  const { error } = await sb.from('manuales').update({estado:'rechazado',revision_comment:comment||null}).eq('id',id);
  if (error) { notify('❌ '+error.message); return; }
  notify('Manual rechazado'); loadUsersList();
  if (STATE.manual.id===id) { STATE.manual.estado='rechazado'; STATE.manual.revisionComment=comment||''; updateRevisionBanner(); }
}

async function changeUserRole(userId, role) {
  const { error } = await sb.from('user_roles').update({role}).eq('user_id',userId);
  if (error) notify('❌ '+error.message);
  else notify('✅ Rol actualizado');
}

q('#modal-users').addEventListener('click', ev=>{
  if(ev.target===q('#modal-users')) closeModal('modal-users');
});
// Load users when modal opens
const origOpenModal=openModal;
// Override to load users list when modal-users opens
document.addEventListener('click', ev=>{
  if(ev.target.closest('[onclick*="modal-users"]')) setTimeout(loadUsersList,100);
});

// ═══════════════════════════════════════════════════════
// TOUCH DETECTION
// ═══════════════════════════════════════════════════════
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  q('#touch-warning').style.display = 'block';
  // Disable draggable on block-wraps (set after render via mutation observer)
  document.addEventListener('render-done', ()=>{
    document.querySelectorAll('.block-wrap').forEach(el=>el.removeAttribute('draggable'));
  });
}

// ═══════════════════════════════════════════════════════
// SET PASSWORD FLOW
// ═══════════════════════════════════════════════════════
function offerSetPassword() {
  // Only offer once per session
  if (sessionStorage.getItem('password_offered')) return;
  sessionStorage.setItem('password_offered', '1');
  showSetPasswordModal();
}

function showSetPasswordModal(required = false) {
  const existing = q('#modal-set-password');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'modal-set-password';
  modal.className = 'modal-backdrop';
  modal.dataset.required = required ? '1' : '';
  modal.innerHTML = `
    <div class="modal modal-sm">
      <div class="modal-header">
        <h3>🔑 ${required ? 'Establece tu contraseña' : 'Crear contraseña'}</h3>
      </div>
      <div class="modal-body">
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
          ${required
            ? 'Introduce la nueva contraseña para tu cuenta.'
            : 'Has entrado con un enlace de email. Crea una contraseña para acceder directamente la próxima vez.'}
        </p>
        <div class="form-group">
          <label class="form-label">Nueva contraseña</label>
          <input type="password" id="new-pass-1" class="form-input" placeholder="Mínimo 8 caracteres" autocomplete="new-password">
        </div>
        <div class="form-group">
          <label class="form-label">Repite la contraseña</label>
          <input type="password" id="new-pass-2" class="form-input" placeholder="Repite la contraseña" autocomplete="new-password">
        </div>
        <p id="set-pass-msg" style="font-size:13px;color:#dc2626;min-height:18px"></p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="saveNewPassword()">Guardar contraseña</button>
        ${required ? '' : '<button class="btn" onclick="document.getElementById(\'modal-set-password\').remove()">Ahora no</button>'}
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => q('#new-pass-1')?.focus(), 100);
}

async function saveNewPassword() {
  const p1 = q('#new-pass-1').value;
  const p2 = q('#new-pass-2').value;
  const msg = q('#set-pass-msg');
  const isRequired = !!q('#modal-set-password')?.dataset.required;
  if (p1.length < 8) { msg.textContent = 'Mínimo 8 caracteres'; return; }
  if (p1 !== p2)     { msg.textContent = 'Las contraseñas no coinciden'; return; }
  msg.style.color = 'var(--text-muted)';
  msg.textContent = 'Guardando...';
  const { data, error } = await sb.auth.updateUser({ password: p1 });
  if (error) { msg.style.color='#dc2626'; msg.textContent = '❌ ' + error.message; return; }
  q('#modal-set-password').remove();
  notify('✅ Contraseña guardada. Ya puedes entrar con email + contraseña.');
  if (isRequired && data?.user) {
    // Flujo recovery: cargar sesión completa tras guardar contraseña
    const { data: sd } = await sb.auth.getSession();
    if (sd?.session) await handleSession(sd.session);
  }
}

// ═══════════════════════════════════════════════════════
// IMPORT HTML
// ═══════════════════════════════════════════════════════
function triggerImportHTML() {
  q('#import-html-input').value = '';
  q('#import-html-input').click();
}

function importHTMLFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const blocks = parseHTMLToBlocks(e.target.result, file.name);
      if (!blocks.length) { notify('⚠️ No se encontraron bloques reconocibles en el HTML'); return; }
      pushHistory();
      STATE.blocks.push(...blocks);
      // Set title from filename if canvas is empty
      if (STATE.blocks.length === blocks.length) {
        const name = file.name.replace(/\.html?$/i, '').replace(/[-_]/g, ' ');
        q('#manual-titulo').value = name.charAt(0).toUpperCase() + name.slice(1);
      }
      render();
      scheduleLocalSave();
      notify(`✅ Importados ${blocks.length} bloques desde ${file.name}`);
    } catch(err) {
      notify('❌ Error al importar: ' + err.message);
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function parseHTMLToBlocks(html, filename) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blocks = [];

  // Extract title from <title> or <h1> in header
  const docTitle = doc.querySelector('title')?.textContent?.trim();
  const headerEl = doc.querySelector('header, .header, [class*="header"]');
  const h1 = (headerEl || doc.body).querySelector('h1');
  if (h1 || docTitle) {
    const titleText = h1?.textContent?.trim() || docTitle || '';
    const subtitleEl = h1?.nextElementSibling;
    const subtitle = (subtitleEl && ['P','DIV','SPAN'].includes(subtitleEl.tagName))
      ? subtitleEl.textContent.trim() : '';
    if (titleText) {
      blocks.push({ id: uid(), type: 'titulo', order: 0, emoji: '📋', titulo: titleText, subtitulo: subtitle });
      if (h1) h1.remove();
      if (subtitle && subtitleEl) subtitleEl.remove();
    }
  }
  if (headerEl) headerEl.remove();

  // Main content area
  const content = doc.querySelector('.content, main, article, #content, #main, body') || doc.body;

  // Walk top-level children and classify
  const children = Array.from(content.children);
  for (const el of children) {
    const tag = el.tagName;
    const text = el.textContent.trim();
    const cls = (el.className || '').toLowerCase();
    const style = (el.getAttribute('style') || '').toLowerCase();

    if (!text && !el.querySelector('img')) continue;

    // ── H2/H3 → titulo block ──
    if (tag === 'H2' || tag === 'H3') {
      const next = el.nextElementSibling;
      const subtitle = (next && ['P','DIV'].includes(next.tagName) && !next.querySelector('img'))
        ? next.textContent.trim() : '';
      blocks.push({ id: uid(), type: 'titulo', order: 0, emoji: '📌', titulo: text, subtitulo: subtitle });
      if (subtitle && next) next.remove();
      continue;
    }

    // ── IMG or element containing only img → imagen block ──
    const imgs = el.querySelectorAll('img');
    if (tag === 'IMG' || (imgs.length === 1 && text.length < 200)) {
      const img = tag === 'IMG' ? el : imgs[0];
      const src = img.getAttribute('src') || '';
      const caption = img.getAttribute('alt') || el.querySelector('figcaption, .caption')?.textContent?.trim() || '';
      if (src.startsWith('data:image')) {
        // base64 image — extract blob and attach
        blocks.push({ id: uid(), type: 'imagen', order: 0, _importedSrc: src, caption, width: '100%' });
      } else if (src) {
        // external URL — render as texto with <img>
        blocks.push({ id: uid(), type: 'imagen', order: 0, storagePath: null, caption: caption || src, width: '100%', _externalSrc: src });
      }
      continue;
    }

    // ── TABLE → tabla or flujos ──
    if (tag === 'TABLE' || el.querySelector('table')) {
      const table = tag === 'TABLE' ? el : el.querySelector('table');
      const headers = Array.from(table.querySelectorAll('thead th, thead td')).map(th => th.textContent.trim());
      const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
        Array.from(tr.querySelectorAll('td,th')).map(td => td.textContent.trim())
      );
      // Detect flujos pattern (2 cols, first col looks like condition)
      if (headers.length === 2 && rows.length > 0) {
        const lh = headers.map(h => h.toLowerCase());
        if (lh.some(h => h.includes('condic') || h.includes('if ') || h.includes('caso')) ||
            lh.some(h => h.includes('acci') || h.includes('then') || h.includes('result'))) {
          blocks.push({ id: uid(), type: 'flujos', order: 0,
            filas: rows.map(r => ({ condicion: r[0]||'', accion: r[1]||'' })) });
          continue;
        }
      }
      if (headers.length || rows.length) {
        const cols = headers.length ? headers : (rows[0]?.map((_,i) => `Col ${i+1}`) || ['Col 1']);
        const dataRows = headers.length ? rows : rows.slice(1);
        blocks.push({ id: uid(), type: 'tabla', order: 0, columnas: cols, filas: dataRows });
        continue;
      }
    }

    // ── OL/UL → lista or pasos ──
    if (tag === 'OL' || tag === 'UL') {
      const items = Array.from(el.querySelectorAll('li'));
      if (tag === 'OL' && items.length > 0) {
        // numbered list → pasos
        for (const li of items) {
          const strong = li.querySelector('strong, b');
          const titulo = strong?.textContent?.trim() || li.textContent.split('\n')[0].trim().slice(0, 80);
          let desc = '';
          if (strong) { strong.remove(); desc = li.textContent.trim(); }
          blocks.push({ id: uid(), type: 'paso', order: 0, titulo, descripcion: desc, storagePath: null, caption: '' });
        }
        continue;
      }
      // UL → lista
      const liItems = items.map(li => {
        const t = li.textContent.trim();
        const icono = (li.className?.includes('cross') || li.className?.includes('no') || t.startsWith('✗') || t.startsWith('❌')) ? 'cross' : 'check';
        return { icono, texto: t.replace(/^[✓✗✅❌×]\s*/,'') };
      });
      if (liItems.length) {
        blocks.push({ id: uid(), type: 'lista', order: 0, items: liItems });
        continue;
      }
    }

    // ── Alert/callout patterns ──
    const isAlert = cls.includes('alert') || cls.includes('alerta') || cls.includes('warning') ||
                    cls.includes('danger') || cls.includes('success') || cls.includes('info') ||
                    cls.includes('callout') || cls.includes('note') || cls.includes('tip') ||
                    style.includes('border-left') || style.includes('background:#fe') || style.includes('background:#ef');

    if (isAlert) {
      let tipo = 'info';
      if (cls.includes('danger') || cls.includes('peligro') || cls.includes('error')) tipo = 'peligro';
      else if (cls.includes('warn') || cls.includes('advertencia')) tipo = 'advertencia';
      else if (cls.includes('success') || cls.includes('exito') || cls.includes('ok')) tipo = 'exito';
      else if (cls.includes('tip') || cls.includes('note') || cls.includes('important')) {
        const calloutTipo = cls.includes('important') ? 'important' : cls.includes('warn') ? 'warning' : 'tip';
        blocks.push({ id: uid(), type: 'callout', order: 0, tipo: calloutTipo, texto: text });
        continue;
      }
      blocks.push({ id: uid(), type: 'alerta', order: 0, tipo, texto: text });
      continue;
    }

    // ── HR / separator ──
    if (tag === 'HR' || el.querySelector('hr')) {
      blocks.push({ id: uid(), type: 'separador', order: 0 });
      continue;
    }

    // ── Headings h4/h5 → callout important ──
    if (tag === 'H4' || tag === 'H5') {
      blocks.push({ id: uid(), type: 'callout', order: 0, tipo: 'important', texto: text });
      continue;
    }

    // ── Everything else → texto libre ──
    if (text.length > 0) {
      blocks.push({ id: uid(), type: 'texto', order: 0, html: el.innerHTML });
    }
  }

  // Post-process: upload base64 images (async, fire and forget with placeholder)
  for (const b of blocks) {
    if (b._importedSrc) {
      b.storagePath = null;
      b._pendingBase64 = b._importedSrc;
      delete b._importedSrc;
    }
    if (b._externalSrc) {
      // Render external image as html block with <img> tag
      b.html = `<img src="${b._externalSrc}" style="max-width:100%" alt="${esc(b.caption||'')}">`;
      b.type = 'texto';
      delete b._externalSrc;
    }
    b.order = blocks.indexOf(b);
  }

  // Upload pending base64 images after render
  setTimeout(() => uploadPendingBase64Images(blocks), 500);

  return blocks;
}

async function uploadPendingBase64Images(blocks) {
  for (const b of blocks) {
    if (!b._pendingBase64) continue;
    const dataUrl = b._pendingBase64;
    delete b._pendingBase64;
    try {
      // Convert base64 to blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const ext = blob.type === 'image/png' ? 'png' : 'jpg';
      if (STATE.user && STATE.manual.id) {
        const storagePath = `${STATE.user.id}/${STATE.manual.id}/${b.id}/${Date.now()}.${ext}`;
        const { error } = await sb.storage.from('manual-images').upload(storagePath, blob, { contentType: blob.type, upsert: true });
        if (!error) { b.storagePath = storagePath; render(); scheduleLocalSave(); continue; }
      }
      // Fallback: keep as data URL in a texto block (offline/guest)
      b.html = `<img src="${dataUrl}" style="max-width:100%" alt="${esc(b.caption||'')}">`;
      b.type = 'texto';
      render();
    } catch(e) {
      b.html = `<em style="color:var(--text-muted)">[Imagen no pudo cargarse]</em>`;
      b.type = 'texto';
    }
  }
}

// ═══════════════════════════════════════════════════════
// PAGES MODULE
// ═══════════════════════════════════════════════════════
function togglePagesPanel() {
  const panel = document.getElementById('pages-panel-body');
  const arrow = document.getElementById('pages-toggle-arrow');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.textContent = isOpen ? '▶' : '▼';
  saveUserPrefs();
}
function toggleSidSection(id, arrowId) {
  const panel = document.getElementById(id);
  const arrow = document.getElementById(arrowId);
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : '';
  if (arrow) { arrow.textContent = isOpen ? '▶' : '▼'; arrow.style.transform = isOpen ? 'rotate(-90deg)' : ''; }
  saveUserPrefs();
}

// ═══════════════════════════════════════════════════════
// USER PREFS (sidebar layout, cross-device)
// ═══════════════════════════════════════════════════════
const _SIDEBAR_PANELS = [
  { id: 'sid-chips-manuales', arrowId: 'arrow-manuales' },
  { id: 'sid-chips-bloques',  arrowId: 'arrow-bloques' },
  { id: 'sid-fmt-panel',      arrowId: 'arrow-fmt' },
  { id: 'sid-iconos',         arrowId: 'arrow-iconos' },
];
let _prefsTimer = null;

async function loadUserPrefs() {
  if (!STATE.user) return;
  try {
    const { data } = await sb.from('user_prefs').select('prefs').eq('user_id', STATE.user.id).single();
    if (!data?.prefs?.sidebar) return;
    const s = data.prefs.sidebar;
    _SIDEBAR_PANELS.forEach(({ id, arrowId }) => {
      if (s[id] === undefined) return;
      const panel = document.getElementById(id);
      const arrow = document.getElementById(arrowId);
      if (!panel) return;
      const open = s[id];
      panel.style.display = open ? '' : 'none';
      if (arrow) { arrow.textContent = open ? '▼' : '▶'; arrow.style.transform = open ? '' : 'rotate(-90deg)'; }
    });
    if (s['pages-panel'] !== undefined) {
      const panel = document.getElementById('pages-panel-body');
      const arrow = document.getElementById('pages-toggle-arrow');
      if (panel) {
        panel.style.display = s['pages-panel'] ? 'block' : 'none';
        if (arrow) arrow.textContent = s['pages-panel'] ? '▼' : '▶';
      }
    }
  } catch(e) { console.warn('loadUserPrefs:', e); }
}

function saveUserPrefs() {
  if (!STATE.user) return;
  clearTimeout(_prefsTimer);
  _prefsTimer = setTimeout(async () => {
    const s = {};
    _SIDEBAR_PANELS.forEach(({ id }) => {
      const panel = document.getElementById(id);
      if (panel) s[id] = panel.style.display !== 'none';
    });
    const pagesPanel = document.getElementById('pages-panel-body');
    if (pagesPanel) s['pages-panel'] = pagesPanel.style.display !== 'none';
    try {
      await sb.from('user_prefs').upsert({ user_id: STATE.user.id, prefs: { sidebar: s }, updated_at: new Date().toISOString() });
    } catch(e) { console.warn('saveUserPrefs:', e); }
  }, 500);
}

function addPage() {
  const id = uid();
  STATE.pages.push({ id, title: 'Página ' + (STATE.pages.length + 1), blocks: [] });
  if (!STATE.activePage) {
    STATE.activePage = id;
  }
  renderPagesPanel();
  scheduleLocalSave();
  notify('📄 Página añadida');
}

function deletePage(id) {
  if (STATE.pages.length <= 1) { notify('⚠️ No se puede eliminar la única página'); return; }
  if (!confirm('¿Eliminar esta página? Se perderán todos sus bloques.')) return;
  STATE.pages = STATE.pages.filter(p => p.id !== id);
  if (STATE.activePage === id) {
    STATE.activePage = STATE.pages[0].id;
    STATE.blocks = [...(STATE.pages[0].blocks || [])];
    render();
  }
  renderPagesPanel();
  scheduleLocalSave();
}

function duplicatePage(id) {
  // Capturar los últimos cambios de la página activa antes de clonar
  if (STATE.activePage) {
    const cur = STATE.pages.find(p => p.id === STATE.activePage);
    if (cur) cur.blocks = [...STATE.blocks];
  }
  const idx = STATE.pages.findIndex(p => p.id === id);
  if (idx === -1) return;
  const src = STATE.pages[idx];
  // Clonado profundo con ids NUEVOS de bloque (los ids deben ser únicos en todo el manual).
  // storagePath de imágenes/vídeos se conserva: ambas páginas referencian el mismo archivo
  // en Storage; si luego cambias el medio en una, se sube uno nuevo y la otra no se afecta.
  const clonedBlocks = (src.blocks || []).map(b => {
    const nb = JSON.parse(JSON.stringify(b));
    nb.id = uid();
    return nb;
  });
  const newPage = { id: uid(), title: (src.title || 'Página') + ' (copia)', blocks: clonedBlocks };
  STATE.pages.splice(idx + 1, 0, newPage); // insertar justo después del original
  switchPage(newPage.id); // ir a la copia para editar los matices (hace render + guardar)
  notify('📑 Página duplicada');
}

function switchPage(id) {
  if (STATE.activePage === id) return;
  // Save current blocks to active page
  if (STATE.activePage) {
    const cur = STATE.pages.find(p => p.id === STATE.activePage);
    if (cur) cur.blocks = [...STATE.blocks];
  }
  STATE.activePage = id;
  const page = STATE.pages.find(p => p.id === id);
  STATE.blocks = page ? [...(page.blocks || [])] : [];
  STATE.selectedBlockId = null;
  STATE.history = [];
  STATE.historyIdx = -1;
  pushHistory();
  render();
  renderPagesPanel();
  scheduleLocalSave();
}

function renamePage(id, title) {
  const page = STATE.pages.find(p => p.id === id);
  if (page && title) { page.title = title; scheduleLocalSave(); }
}

function renderPagesPanel() {
  const wrap = document.getElementById('pages-list');
  if (!wrap) return;
  if (!STATE.pages.length) {
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = STATE.pages.map(p => `
    <div class="page-item ${p.id === STATE.activePage ? 'active' : ''}" data-pageid="${p.id}" onclick="switchPage('${p.id}')">
      <span class="page-item-icon">📄</span>
      <span class="page-item-title" contenteditable="true"
        onclick="event.stopPropagation()"
        onblur="renamePage('${p.id}',this.textContent.trim())"
        onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"
        spellcheck="false">${esc(p.title)}</span>
      <button class="page-dup-btn" onclick="event.stopPropagation();duplicatePage('${p.id}')" title="Duplicar página">⧉</button>
      ${STATE.pages.length > 1 ? `<button class="page-del-btn" onclick="event.stopPropagation();deletePage('${p.id}')" title="Eliminar">🗑</button>` : ''}
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════
// IMPORT MODULE — PDF / DOCX
// ═══════════════════════════════════════════════════════
let _importBlocks = [];

function openImportModal() {
  document.getElementById('modal-import').classList.remove('hidden');
  document.getElementById('import-file-input').value = '';
  document.getElementById('import-preview').innerHTML = '';
  document.getElementById('import-confirm-btn').style.display = 'none';
  document.getElementById('import-file-name').textContent = 'Se aceptan .pdf y .docx';
  _importBlocks = [];
}

function closeImportModal() {
  document.getElementById('modal-import').classList.add('hidden');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('No se pudo cargar: ' + src));
    document.head.appendChild(s);
  });
}

async function handleImportFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('import-file-name').textContent = file.name;
  const prev = document.getElementById('import-preview');
  prev.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)"><div class="spinner" style="margin:0 auto 10px"></div>Procesando…</div>';
  document.getElementById('import-confirm-btn').style.display = 'none';
  _importBlocks = [];
  _docxExtractedMedia = [];
  try {
    const ab = await file.arrayBuffer();
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'docx') {
      _importBlocks = await parseDOCXtoBlocks(ab);
    } else if (ext === 'pdf') {
      _importBlocks = await parsePDFtoBlocks(ab);
    } else {
      prev.innerHTML = '<div style="color:#dc2626;padding:12px">⚠️ Solo se aceptan .pdf y .docx</div>';
      return;
    }
    renderImportPreview(_importBlocks);
  } catch(e) {
    prev.innerHTML = `<div style="color:#dc2626;padding:12px">❌ ${esc(e.message||String(e))}</div>`;
  }
}

// ═══════════════════════════════════════════════════════
// DOCX IMPORT — parser directo (JSZip + document.xml)
// mammoth solo emite <img> para imágenes inline; los manuales de Word reales
// llevan las imágenes ANCLADAS dentro de grupos DrawingML y cuadros de texto,
// que mammoth descarta. Este parser lee el .docx directamente para recuperar
// imágenes flotantes, listas, avisos resaltados y títulos de sección.
const _WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const _ANS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const _RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const _VNS = 'urn:schemas-microsoft-com:vml';
const _IMG_MIME = { png:'image/png', jpeg:'image/jpeg', jpg:'image/jpeg', gif:'image/gif', webp:'image/webp', svg:'image/svg+xml' };
const _STEP_RE = /^\s*\d{1,3}\s*[–—).:-]\s+/;

async function parseDOCXtoBlocks(ab) {
  if (!window.JSZip) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  if (!window.JSZip) throw new Error('No se pudo cargar JSZip. Verifica tu conexión a internet.');
  const zip = await JSZip.loadAsync(ab);
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('El .docx no contiene word/document.xml (archivo no válido).');

  // rels: relId → ruta de media
  const relmap = {};
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (relsFile) {
    const relsXml = new DOMParser().parseFromString(await relsFile.async('string'), 'application/xml');
    for (const r of relsXml.getElementsByTagName('Relationship')) {
      relmap[r.getAttribute('Id')] = r.getAttribute('Target');
    }
  }

  const xml = new DOMParser().parseFromString(await docFile.async('string'), 'application/xml');
  const body = xml.getElementsByTagNameNS(_WNS, 'body')[0];
  if (!body) throw new Error('El .docx no tiene cuerpo de documento legible.');

  const DRAW = new Set(['drawing', 'txbxContent', 'pict']);
  const underDrawing = (node) => {
    let x = node.parentNode;
    while (x && x.nodeType === 1) { if (DRAW.has(x.localName)) return true; x = x.parentNode; }
    return false;
  };
  const paraText = (p) => {
    let out = '';
    for (const t of p.getElementsByTagNameNS(_WNS, 't')) if (!underDrawing(t)) out += t.textContent || '';
    return out.trim();
  };
  const paraImgs = (p) => {
    const out = [];
    for (const blip of p.getElementsByTagNameNS(_ANS, 'blip')) {
      const tgt = relmap[blip.getAttributeNS(_RNS, 'embed')];
      if (tgt && !out.includes(tgt)) out.push(tgt);
    }
    for (const im of p.getElementsByTagNameNS(_VNS, 'imagedata')) {
      const tgt = relmap[im.getAttributeNS(_RNS, 'id')];
      if (tgt && !out.includes(tgt)) out.push(tgt);
    }
    return out;
  };
  const paraHL = (p) => {
    for (const h of p.getElementsByTagNameNS(_WNS, 'highlight')) if (!underDrawing(h)) return h.getAttributeNS(_WNS, 'val');
    return null;
  };
  const paraStyle = (p) => {
    const ps = p.getElementsByTagNameNS(_WNS, 'pStyle')[0];
    return ps ? (ps.getAttributeNS(_WNS, 'val') || '') : '';
  };
  const firstSentence = (t) => {
    const clean = t.replace(_STEP_RE, '').trim();
    const m = clean.match(/^(.+?[.:])\s+([\s\S]+)$/); // 1a frase / resto, sin lookbehind (compat. Safari)
    if (m) return { titulo: m[1].slice(0, 90), descripcion: m[2] };
    return { titulo: clean.slice(0, 90), descripcion: '' };
  };

  // media (ruta relativa a /word/) → dataURL, resolviendo bajo demanda y cacheado
  const dataUrlCache = {};
  const refMedia = new Set();      // todas las imágenes soportadas referenciadas en el cuerpo
  const usedMedia = new Set();     // imágenes efectivamente asignadas a un bloque
  async function mediaDataUrl(rel) {
    if (dataUrlCache[rel] !== undefined) return dataUrlCache[rel];
    const ext = (rel.split('.').pop() || '').toLowerCase();
    const mime = _IMG_MIME[ext];
    if (!mime) return (dataUrlCache[rel] = null); // emf/wmf: no renderizables en navegador
    const f = zip.file('word/' + rel.replace(/^\/?word\//, '').replace(/^\.\.\//, ''));
    if (!f) return (dataUrlCache[rel] = null);
    const b64 = await f.async('base64');
    return (dataUrlCache[rel] = 'data:' + mime + ';base64,' + b64);
  }
  const isSupported = (rel) => !!_IMG_MIME[(rel.split('.').pop() || '').toLowerCase()];

  // ── Paso 1: recorrer el cuerpo y construir un stream de bloques (con rutas de media) ──
  const raw = [];
  let lastPaso = null;
  let alertBuf = [];
  const flushAlert = () => { if (alertBuf.length) { raw.push({ type: 'alerta', tipo: 'advertencia', texto: alertBuf.join(' ') }); alertBuf = []; } };

  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType !== 1) continue;
    const ln = node.localName;
    if (ln === 'tbl') {
      flushAlert();
      const rows = Array.from(node.getElementsByTagNameNS(_WNS, 'tr')).map(tr =>
        Array.from(tr.getElementsByTagNameNS(_WNS, 'tc')).map(tc => {
          let txt = ''; for (const t of tc.getElementsByTagNameNS(_WNS, 't')) if (!underDrawing(t)) txt += t.textContent || '';
          return txt.trim();
        }));
      if (rows.length) raw.push({ type: 'tabla', columnas: rows[0], filas: rows.slice(1) });
      lastPaso = null;
      continue;
    }
    if (ln !== 'p') continue;

    const txt = paraText(node);
    const imgs = paraImgs(node);
    imgs.forEach(i => { if (isSupported(i)) refMedia.add(i); });
    const disp = imgs.filter(isSupported);
    const hl = paraHL(node);
    const st = paraStyle(node).toLowerCase();
    const numbered = !!node.getElementsByTagNameNS(_WNS, 'numPr').length;
    const isSub = st.includes('ubt') || st.includes('tulo') || st.includes('heading');
    const isHead = !numbered && txt && txt === txt.toUpperCase() && txt.length > 0 && txt.length < 70 && !imgs.length && !hl;

    // Aviso resaltado en amarillo → alerta (fusiona párrafos consecutivos)
    if (hl === 'yellow' && txt) { alertBuf.push(txt); continue; }
    flushAlert();

    // Encabezado de sección → titulo (el primero) / subtitulo (resto)
    if (isSub || isHead) {
      raw.push({ type: 'titulo', _first: raw.length === 0, titulo: txt, subtitulo: '', isSub });
      lastPaso = null;
      continue;
    }

    // Paso: lista Word (numPr) o párrafo numerado manualmente ("1 –", "2 -", "3)")
    if (numbered || _STEP_RE.test(txt)) {
      const { titulo, descripcion } = firstSentence(txt);
      const paso = { type: 'paso', titulo, descripcion, media: disp[0] || null };
      if (disp[0]) usedMedia.add(disp[0]);
      raw.push(paso);
      lastPaso = paso;
      for (const extra of disp.slice(1)) { usedMedia.add(extra); raw.push({ type: 'imagen', media: extra }); }
      continue;
    }

    // Párrafo solo-imagen → adjunta al paso previo si no tiene; si no, imagen suelta
    if (!txt && disp.length) {
      for (const m of disp) {
        if (lastPaso && !lastPaso.media) { lastPaso.media = m; usedMedia.add(m); }
        else { raw.push({ type: 'imagen', media: m }); usedMedia.add(m); }
      }
      continue;
    }

    // Resto → texto (saneado)
    if (txt) { raw.push({ type: 'texto', html: esc(txt) }); lastPaso = null; }
  }
  flushAlert();

  // ── Paso 2: materializar bloques y resolver dataURLs de media ──
  const blocks = [];
  let firstTitle = true;
  for (const r of raw) {
    if (r.type === 'titulo') {
      // El primer encabezado es el título del manual (H1); los demás, subtítulos de sección
      if (firstTitle && r._first) { blocks.push({ id: uid(), type: 'titulo', order: 0, emoji: '📋', titulo: r.titulo, subtitulo: '', _isH1: true }); firstTitle = false; }
      else blocks.push({ id: uid(), type: 'subtitulo', order: 0, texto: r.titulo, blockBgColor: '#64748b' });
    } else if (r.type === 'alerta') {
      blocks.push({ id: uid(), type: 'alerta', order: 0, tipo: 'advertencia', texto: r.texto });
    } else if (r.type === 'tabla') {
      const cols = r.columnas.length ? r.columnas : (r.filas[0] || ['Columna 1']).map((_, i) => 'Columna ' + (i + 1));
      blocks.push({ id: uid(), type: 'tabla', order: 0, columnas: cols, filas: r.filas });
    } else if (r.type === 'paso') {
      // Desacoplado: el paso se importa SIN imagen; las imágenes van al repositorio.
      blocks.push({ id: uid(), type: 'paso', order: 0, titulo: r.titulo, descripcion: r.descripcion, storagePath: null, caption: '' });
    } else if (r.type === 'imagen') {
      // Desacoplado: no se crean bloques de imagen automáticos.
    } else if (r.type === 'texto') {
      blocks.push({ id: uid(), type: 'texto', order: 0, html: r.html });
    }
  }

  // ── Paso 3: extraer TODAS las imágenes de /word/media/ al repositorio (no a los bloques) ──
  _docxExtractedMedia = [];
  const mediaFolder = zip.folder('word/media');
  if (mediaFolder) {
    const files = [];
    mediaFolder.forEach((rel, file) => { if (!file.dir) files.push(file); });
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    for (const file of files) {
      const fn = file.name.split('/').pop();
      const ext = (fn.split('.').pop() || '').toLowerCase();
      if (!_IMG_MIME[ext]) continue; // emf/wmf: no renderizables en navegador
      const b64 = await file.async('base64');
      _docxExtractedMedia.push({ filename: fn, dataUrl: 'data:' + _IMG_MIME[ext] + ';base64,' + b64, size: Math.round(b64.length * 0.75) });
    }
  }
  return blocks;
}

// Sube a Supabase Storage las imágenes de bloques importados (reutiliza el bucket
// y el patrón de ruta de las imágenes manuales). No cambia el tipo de bloque.
async function uploadImportedImages(blocks) {
  if (!STATE.user || !STATE.manual.id) return;
  for (const b of blocks) {
    if (!b._pendingBase64 || b.storagePath) continue;
    const dataUrl = b._pendingBase64;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/svg+xml' ? 'svg' : blob.type === 'image/gif' ? 'gif' : 'jpg';
      const storagePath = `${STATE.user.id}/${STATE.manual.id}/${b.id}/${Date.now()}.${ext}`;
      const { error } = await sb.storage.from('manual-images').upload(storagePath, blob, { contentType: blob.type, upsert: true });
      if (!error) { b.storagePath = storagePath; delete b.src; delete b._pendingBase64; }
      else { console.warn('uploadImportedImages:', error); }
    } catch (e) { console.warn('uploadImportedImages:', e); }
  }
  renderPagesPanel(); render(); scheduleLocalSave();
}

// ═══════════════════════════════════════════════════════
// REPOSITORIO DE IMÁGENES DEL MANUAL (galería + recorte)
// Desacopla "extraer imágenes del docx" de "insertarlas en bloques".
// STATE.mediaLibrary = [{id, storagePath, filename, size, w, h, usedInBlocks:[], parentId?}]
// ═══════════════════════════════════════════════════════
let _docxExtractedMedia = [];      // media extraída del último .docx, pendiente de decisión
let _galleryMode = 'manage';       // 'manage' (recortar) | 'pick' (asignar a bloque)
let _galleryPickTarget = null;     // blockId destino en modo pick
let _cropper = null, _cropMediaId = null;

function loadCSS(href) {
  return new Promise(res => {
    if ([...document.styleSheets].some(s => s.href === href)) return res();
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href; l.onload = res; l.onerror = res;
    document.head.appendChild(l);
  });
}
function _fmtSize(bytes) {
  if (!bytes) return '';
  return bytes < 1024*1024 ? Math.round(bytes/1024) + ' KB' : (bytes/1048576).toFixed(1) + ' MB';
}
function _mediaExt(mime) {
  return mime === 'image/png' ? 'png' : mime === 'image/svg+xml' ? 'svg'
       : mime === 'image/gif' ? 'gif' : mime === 'image/webp' ? 'webp' : 'jpg';
}

// dataURL → {blob,w,h}; redimensiona a maxW con canvas (svg pasa tal cual)
async function _resizeDataUrl(dataUrl, maxW = 1600) {
  if (/^data:image\/svg/.test(dataUrl)) { const r = await fetch(dataUrl); return { blob: await r.blob(), w: 0, h: 0 }; }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight, cw = w, ch = h;
      if (w > maxW) { ch = Math.round(h * maxW / w); cw = maxW; }
      const c = document.createElement('canvas'); c.width = cw; c.height = ch;
      c.getContext('2d').drawImage(img, 0, 0, cw, ch);
      c.toBlob(b => b ? resolve({ blob: b, w: cw, h: ch }) : reject(new Error('canvas vacío')), 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('imagen no cargable'));
    img.src = dataUrl;
  });
}

// Asegura user + manual guardado (necesario para tener manualId en la ruta de Storage)
async function _ensureManualSaved() {
  if (!STATE.user) { notify('⚠️ Inicia sesión para usar el repositorio de imágenes'); return false; }
  if (!STATE.manual.id) { const ok = await guardar(); if (!ok || !STATE.manual.id) { notify('❌ Guarda el manual primero'); return false; } }
  return true;
}

// Sube una imagen (dataURL o Blob) al bucket como nueva entrada del repositorio
async function _uploadMedia(blobOrDataUrl, filename, extra = {}) {
  let blob, w = 0, h = 0;
  if (typeof blobOrDataUrl === 'string') { const r = await _resizeDataUrl(blobOrDataUrl); blob = r.blob; w = r.w; h = r.h; }
  else blob = blobOrDataUrl;
  const id = uid();
  const ext = _mediaExt(blob.type);
  const storagePath = `${STATE.user.id}/${STATE.manual.id}/_library/${id}.${ext}`;
  const { error } = await sb.storage.from('manual-images').upload(storagePath, blob, { contentType: blob.type, upsert: true });
  if (error) { console.warn('_uploadMedia:', error); return null; }
  const entry = { id, storagePath, filename: filename || ('imagen.' + ext), size: blob.size, w, h, usedInBlocks: [], ...extra };
  STATE.mediaLibrary.push(entry);
  return entry;
}

// Recalcula qué imágenes del repositorio están usadas y en qué bloques (todas las páginas)
function _recomputeMediaUsage() {
  if (!STATE.mediaLibrary) STATE.mediaLibrary = [];
  if (STATE.activePage && STATE.pages.length) {
    const cur = STATE.pages.find(p => p.id === STATE.activePage);
    if (cur) cur.blocks = [...STATE.blocks];
  }
  const all = STATE.pages.length ? STATE.pages.flatMap(p => p.blocks || []) : STATE.blocks;
  const used = {};
  all.forEach(b => { if (b.storagePath) (used[b.storagePath] = used[b.storagePath] || []).push(b.id); });
  STATE.mediaLibrary.forEach(m => { m.usedInBlocks = used[m.storagePath] || []; });
}

// ── Diálogo de selección tras importar un .docx ──
function _afterImport() { if (_docxExtractedMedia.length) openImportMediaDialog(); }

function openImportMediaDialog() {
  if (!_docxExtractedMedia.length) return;
  document.getElementById('import-media-count').textContent = _docxExtractedMedia.length;
  document.getElementById('import-media-grid').innerHTML = _docxExtractedMedia.map((m, i) => `
    <label class="mg-pick">
      <input type="checkbox" checked data-midx="${i}">
      <img src="${m.dataUrl}" alt="" loading="lazy">
      <span class="mg-fn" title="${esc(m.filename)}">${esc(m.filename)}</span>
      <span class="mg-sz">${_fmtSize(m.size)}</span>
    </label>`).join('');
  document.getElementById('modal-import-media').classList.remove('hidden');
}
function toggleAllImportMedia(state) {
  document.querySelectorAll('#import-media-grid input[type=checkbox]').forEach(cb => cb.checked = state);
}
function closeImportMediaDialog() { document.getElementById('modal-import-media').classList.add('hidden'); _docxExtractedMedia = []; }

async function confirmImportMedia() {
  const chosen = [...document.querySelectorAll('#import-media-grid input[type=checkbox]')]
    .filter(cb => cb.checked).map(cb => _docxExtractedMedia[+cb.dataset.midx]);
  document.getElementById('modal-import-media').classList.add('hidden');
  if (!chosen.length) { _docxExtractedMedia = []; return; }
  if (!await _ensureManualSaved()) return;
  const btn = document.getElementById('import-media-confirm');
  let ok = 0, i = 0;
  for (const m of chosen) {
    i++; if (btn) btn.textContent = `Subiendo ${i}/${chosen.length}…`;
    const e = await _uploadMedia(m.dataUrl, m.filename);
    if (e) ok++;
  }
  if (btn) btn.textContent = 'Cargar seleccionadas';
  _docxExtractedMedia = [];
  scheduleLocalSave();
  notify(`✅ ${ok} imágenes añadidas al repositorio`);
  openMediaGallery();
}

// ── Galería (modo gestionar / modo elegir para un bloque) ──
function openMediaGallery() { _galleryMode = 'manage'; _galleryPickTarget = null; _renderGallery(); document.getElementById('modal-media-gallery').classList.remove('hidden'); }
function openMediaPicker(blockId) { _galleryMode = 'pick'; _galleryPickTarget = blockId; _renderGallery(); document.getElementById('modal-media-gallery').classList.remove('hidden'); }
function closeMediaGallery() { document.getElementById('modal-media-gallery').classList.add('hidden'); }

function _renderGallery() {
  _recomputeMediaUsage();
  const lib = STATE.mediaLibrary || [];
  const grid = document.getElementById('media-gallery-grid');
  const unused = lib.filter(m => !m.usedInBlocks.length).length;
  document.getElementById('media-gallery-title').textContent = _galleryMode === 'pick'
    ? '🗂 Elige una imagen para el bloque' : '🖼 Imágenes del manual';
  document.getElementById('media-gallery-sub').textContent = `${lib.length} imágenes · ${unused} sin usar`;
  const cleanBtn = document.getElementById('media-clean-btn');
  if (cleanBtn) cleanBtn.style.display = (_galleryMode === 'manage' && unused > 0) ? '' : 'none';
  if (!lib.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:36px">El repositorio está vacío.<br>Importa un .docx o sube imágenes desde un bloque.</div>';
    return;
  }
  grid.innerHTML = lib.map(m => `
    <div class="mg-item" onclick="_galleryClick('${m.id}')" title="${_galleryMode==='pick'?'Asignar al bloque':'Recortar / editar'}">
      <div class="mg-thumb"><img src="" data-path="${m.storagePath}" class="lazy-img" alt=""></div>
      <div class="mg-meta">
        <span class="mg-fn" title="${esc(m.filename)}">${esc(m.filename)}${m.parentId?' ✂':''}</span>
        <span class="mg-badge ${m.usedInBlocks.length ? 'used' : 'unused'}">${m.usedInBlocks.length ? 'usada' : 'sin usar'}</span>
      </div>
    </div>`).join('');
  loadLazyImages();
}
function _galleryClick(id) {
  if (_galleryMode === 'pick') assignMediaToBlock(id, _galleryPickTarget);
  else openCropEditor(id);
}

async function assignMediaToBlock(mediaId, blockId) {
  const m = STATE.mediaLibrary.find(x => x.id === mediaId);
  const b = STATE.blocks.find(x => x.id === blockId);
  if (!m || !b) { notify('No se pudo asignar la imagen'); return; }
  delete b.src;
  b.storagePath = m.storagePath;
  closeMediaGallery();
  renderBlock(blockId);
  _recomputeMediaUsage();
  scheduleLocalSave();
  notify('✅ Imagen asignada desde el repositorio');
}

async function deleteUnusedMedia() {
  _recomputeMediaUsage();
  const unused = (STATE.mediaLibrary || []).filter(m => !m.usedInBlocks.length);
  if (!unused.length) { notify('No hay imágenes sin usar'); return; }
  if (!confirm(`¿Eliminar ${unused.length} imágenes SIN USAR del repositorio?\nSe borrarán de la nube y no se puede deshacer.`)) return;
  try { await sb.storage.from('manual-images').remove(unused.map(m => m.storagePath)); }
  catch (e) { console.warn('deleteUnusedMedia:', e); }
  STATE.mediaLibrary = STATE.mediaLibrary.filter(m => m.usedInBlocks.length);
  _renderGallery();
  scheduleLocalSave();
  notify(`🗑 ${unused.length} imágenes eliminadas`);
}

// ── Editor de recorte (Cropper.js) ──
async function openCropEditor(mediaId) {
  const m = STATE.mediaLibrary.find(x => x.id === mediaId);
  if (!m) return;
  _cropMediaId = mediaId;
  if (!window.Cropper) {
    await loadCSS('https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js');
  }
  if (!window.Cropper) { notify('❌ No se pudo cargar el editor de recorte'); return; }
  document.getElementById('modal-crop').classList.remove('hidden');
  const img = document.getElementById('crop-img');
  let url = '';
  try {
    const { data } = await sb.storage.from('manual-images').createSignedUrl(m.storagePath, 3600);
    const res = await fetch((data && data.signedUrl) || '');
    url = URL.createObjectURL(await res.blob()); // blob: evita el "taint" del canvas
  } catch (e) { console.warn('openCropEditor:', e); notify('❌ No se pudo cargar la imagen'); return; }
  if (_cropper) { _cropper.destroy(); _cropper = null; }
  img.onload = () => {
    if (_cropper) _cropper.destroy();
    _cropper = new Cropper(img, { viewMode: 1, autoCropArea: 1, background: false, responsive: true });
  };
  img.src = url;
}
function _cropRotate(deg) { if (_cropper) _cropper.rotate(deg); }
function _cropZoom(delta) { if (_cropper) _cropper.zoom(delta); }
function _cropAspect(v) {
  if (!_cropper) return;
  _cropper.setAspectRatio(v === 'free' ? NaN : Number(v));
  document.querySelectorAll('#crop-aspects button').forEach(b => b.classList.toggle('active', b.dataset.aspect === v));
}
function closeCropEditor() {
  if (_cropper) { _cropper.destroy(); _cropper = null; }
  const img = document.getElementById('crop-img');
  if (img && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  document.getElementById('modal-crop').classList.add('hidden');
}
async function applyCrop() {
  if (!_cropper) return;
  const parent = STATE.mediaLibrary.find(x => x.id === _cropMediaId);
  const canvas = _cropper.getCroppedCanvas({ maxWidth: 1600 });
  if (!canvas) { notify('Selecciona un área de recorte'); return; }
  const btn = document.getElementById('crop-apply-btn');
  if (btn) { btn.textContent = 'Guardando…'; btn.disabled = true; }
  canvas.toBlob(async blob => {
    try {
      if (!blob || !await _ensureManualSaved()) return;
      const base = parent ? parent.filename.replace(/\.[^.]+$/, '') : 'recorte';
      const entry = await _uploadMedia(blob, base + '-recorte.jpg', { parentId: _cropMediaId });
      closeCropEditor();
      if (entry) { _renderGallery(); scheduleLocalSave(); notify('✅ Recorte guardado como nueva imagen (original intacta)'); }
    } finally { if (btn) { btn.textContent = 'Aplicar recorte'; btn.disabled = false; } }
  }, 'image/jpeg', 0.9);
}

async function parsePDFtoBlocks(ab) {
  if (!window.pdfjsLib) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  }
  const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
  if (!pdfjsLib) throw new Error('No se pudo cargar PDF.js. Verifica tu conexión a internet.');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab.slice(0)) }).promise;
  const allBlocks = [];
  for (let pn = 1; pn <= pdf.numPages; pn++) {
    const page = await pdf.getPage(pn);
    const tc = await page.getTextContent();
    // Group items into lines by Y coordinate
    const lineMap = new Map();
    for (const item of tc.items) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, { y, text: '', fontSize: 0 });
      const ln = lineMap.get(y);
      ln.text += item.str;
      ln.fontSize = Math.max(ln.fontSize, Math.abs(item.transform[0]));
    }
    const lines = [...lineMap.values()].sort((a,b) => b.y - a.y);
    if (pn > 1 && allBlocks.length) allBlocks.push({ id:uid(), type:'separador', order:0, _pageBreak:true });
    let i = 0;
    while (i < lines.length) {
      const ln = lines[i];
      const txt = ln.text.trim();
      if (!txt) { i++; continue; }
      const stepMatch = txt.match(/^(paso\s+\d+[\s:.)]|step\s+\d+[\s:.)]|\d+[.)]\s)/i);
      if (ln.fontSize > 14) {
        let title = txt; i++;
        while (i < lines.length && lines[i].fontSize > 14) { title += ' ' + lines[i].text.trim(); i++; }
        allBlocks.push({ id:uid(), type:'titulo', order:0, emoji:'📋', titulo:title, subtitulo:'', _isH1:true });
      } else if (ln.fontSize > 11 && ln.fontSize <= 14 && !stepMatch) {
        allBlocks.push({ id:uid(), type:'titulo', order:0, emoji:'📌', titulo:txt, subtitulo:'' });
        i++;
      } else if (stepMatch) {
        const titulo = txt.replace(stepMatch[0],'').trim() || txt;
        let desc = ''; i++;
        while (i < lines.length && lines[i].fontSize <= 13 && !lines[i].text.match(/^(paso\s+\d+|step\s+\d+|\d+[.)]\s)/i)) {
          desc += (desc?' ':'')+lines[i].text.trim(); i++;
        }
        allBlocks.push({ id:uid(), type:'paso', order:0, titulo, descripcion:desc, storagePath:null, caption:'' });
      } else {
        let para = txt; i++;
        while (i < lines.length && lines[i].fontSize <= 13 && lines[i].text.trim() && !lines[i].text.match(/^(paso\s+\d+|step\s+\d+|\d+[.)]\s)/i) && lines[i].fontSize < 14) {
          para += ' ' + lines[i].text.trim(); i++;
        }
        const cm = para.match(/^(nota|aviso|importante|warning|caution|tip|consejo)[:\s]/i);
        if (cm) {
          const t = cm[1].toLowerCase();
          const ct = (t==='nota'||t==='tip'||t==='consejo')?'tip':(t==='aviso'||t==='warning'||t==='caution')?'warning':'important';
          allBlocks.push({ id:uid(), type:'callout', order:0, tipo:ct, texto:para });
        } else {
          allBlocks.push({ id:uid(), type:'texto', order:0, html:esc(para) });
        }
      }
    }
    try {
      const opList = await page.getOperatorList();
      const imgNames = new Set();
      for (let j = 0; j < opList.fnArray.length; j++) {
        const fn = opList.fnArray[j];
        if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintJpegXObject) imgNames.add(opList.argsArray[j][0]);
      }
      for (const name of imgNames) {
        await new Promise(resolve => {
          page.objs.get(name, imgObj => {
            if (!imgObj) { resolve(); return; }
            const { width, height, kind, data } = imgObj;
            if (!width || !height || width < 30 || height < 30 || !data) { resolve(); return; }
            try {
              const canvas = document.createElement('canvas');
              canvas.width = width; canvas.height = height;
              const ctx = canvas.getContext('2d');
              const iData = ctx.createImageData(width, height);
              if (kind === 3) { iData.data.set(data); }
              else if (kind === 2) {
                for (let p = 0; p < width * height; p++) {
                  iData.data[p*4]=data[p*3]; iData.data[p*4+1]=data[p*3+1];
                  iData.data[p*4+2]=data[p*3+2]; iData.data[p*4+3]=255;
                }
              } else { resolve(); return; }
              ctx.putImageData(iData, 0, 0);
              let src = canvas.toDataURL('image/jpeg', 0.85);
              if (src.length > 512000) {
                const sc = Math.sqrt(512000 / src.length);
                const c2 = document.createElement('canvas');
                c2.width = Math.max(1, Math.round(width * sc));
                c2.height = Math.max(1, Math.round(height * sc));
                c2.getContext('2d').drawImage(canvas, 0, 0, c2.width, c2.height);
                src = c2.toDataURL('image/jpeg', 0.75);
              }
              allBlocks.push({id:uid(), type:'imagen', order:0, src, storagePath:null, caption:'', width:'100%'});
            } catch(e) { /* skip */ }
            resolve();
          });
        });
      }
    } catch(e) { /* image extraction is optional */ }
  }
  return allBlocks;
}

function htmlToImportBlocks(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // ── App's own multi-page export: detect section.mp-page elements ──
  const mpSections = doc.querySelectorAll('section.mp-page');
  if (mpSections.length > 0) {
    const navTitles = {};
    doc.querySelectorAll('li[data-page]').forEach(li => {
      navTitles[li.dataset.page] = li.textContent.trim();
    });
    const allBlocks = [];
    mpSections.forEach((section, idx) => {
      const navTitle = navTitles[section.id] || `Página ${idx + 1}`;
      const secBlocks = [];
      for (const child of Array.from(section.children)) {
        const b = _exportChildToBlock(child);
        if (b) secBlocks.push(b);
      }
      // Page boundary marker for importAsPages: reuse the section's own título
      // banner if it leads; otherwise synthesize one from the nav label.
      if (secBlocks.length && secBlocks[0].type === 'titulo') {
        secBlocks[0]._isH1 = true;
      } else {
        secBlocks.unshift({ id: uid(), type: 'titulo', order: 0, emoji: '📄', titulo: navTitle, subtitulo: '', _isH1: true });
      }
      allBlocks.push(...secBlocks);
    });
    return allBlocks;
  }

  // ── Generic HTML (DOCX / external pages) ──
  const wrapper = parser.parseFromString('<div class="content">' + html + '</div>', 'text/html');
  const content = wrapper.querySelector('.content') || wrapper.body;
  return _genericChildrenToBlocks(Array.from(content.children));
}

function _exportChildToBlock(el) {
  const style = el.getAttribute('style') || '';
  const text = el.textContent.trim();
  if (!text && !el.querySelector('img,hr,svg,video,iframe')) return null;

  // separador — contains an <hr>
  if (el.querySelector('hr')) return { id: uid(), type: 'separador', order: 0 };

  // titulo — centered banner with an <h2>
  const h2 = el.querySelector('h2');
  if (h2) {
    const p = el.querySelector('p');
    return { id: uid(), type: 'titulo', order: 0, emoji: '📋',
             titulo: h2.textContent.trim(), subtitulo: p ? p.textContent.trim() : '' };
  }

  // codigo — contains a <pre>
  const pre = el.querySelector('pre');
  if (pre) {
    const head = el.querySelector('div');
    const language = (head && !head.contains(pre) && head.textContent.trim().length < 24) ? head.textContent.trim() : '';
    return { id: uid(), type: 'codigo', order: 0, language, code: pre.textContent };
  }

  // paso — has a circular numbered badge (border-radius:50% + numeric text)
  const badge = Array.from(el.querySelectorAll('div')).find(d =>
    /border-radius:50%/.test(d.getAttribute('style') || '') && /^\d+$/.test(d.textContent.trim()));
  if (badge) {
    const row = badge.parentElement;
    const titleDiv = row && row.querySelector('div[style*="font-weight:600"]');
    const ul = el.querySelector('ul');
    const descripcion = ul
      ? Array.from(ul.querySelectorAll('li')).map(li => li.textContent.trim()).filter(Boolean).join('\n')
      : '';
    const img = el.querySelector('img[src^="data:"]');
    const cap = el.querySelector('div[style*="border-top"]');
    const blk = { id: uid(), type: 'paso', order: 0,
                  titulo: titleDiv ? titleDiv.textContent.trim() : text.slice(0, 80),
                  descripcion, storagePath: null, caption: (img && cap) ? cap.textContent.trim() : '' };
    if (img) blk.src = img.src;
    return blk;
  }

  // imagen — embedded image not part of a step
  const img = el.querySelector('img[src^="data:"]');
  if (img && !el.querySelector('ul')) {
    const cap = el.querySelector('div[style*="border-top"]');
    return { id: uid(), type: 'imagen', order: 0, src: img.src, storagePath: null,
             caption: cap ? cap.textContent.trim() : '', width: '100%' };
  }

  // tabla / flujos — contains a <table>
  const table = el.querySelector('table');
  if (table) {
    const headers = Array.from(table.querySelectorAll('thead th,thead td')).map(th => th.textContent.trim());
    const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
      Array.from(tr.querySelectorAll('td,th')).map(td => td.textContent.trim()));
    const lh = headers.map(h => h.toLowerCase());
    if (headers.length === 2 && (lh[0].includes('condic') || lh[1].includes('acci') || lh[1].includes('result'))) {
      return { id: uid(), type: 'flujos', order: 0, filas: rows.map(r => ({ condicion: r[0] || '', accion: r[1] || '' })) };
    }
    const cols = headers.length ? headers : (rows[0]?.map((_, i) => `Col ${i + 1}`) || ['Col 1']);
    return { id: uid(), type: 'tabla', order: 0, columnas: cols, filas: headers.length ? rows : rows.slice(1) };
  }

  // lista — every direct child div is a ✅ / ❌ item row
  const directDivs = Array.from(el.children).filter(c => c.tagName === 'DIV');
  const listRows = directDivs.filter(d => /^[✅❌✓✗]/.test(d.textContent.trim()));
  if (listRows.length && listRows.length === directDivs.length) {
    return { id: uid(), type: 'lista', order: 0, items: listRows.map(d => {
      const t = d.textContent.trim();
      return { icono: /^[✅✓]/.test(t) ? 'check' : 'cross', texto: t.replace(/^[✅❌✓✗]\s*/, '') };
    })};
  }

  // alerta / callout — flex box led by an icon <span>
  const span = el.querySelector(':scope > span');
  if (span && /display:flex/.test(style)) {
    const ul = el.querySelector('ul');
    const body = el.querySelector(':scope > div');
    const texto = ul
      ? Array.from(ul.querySelectorAll('li')).map(li => li.textContent.trim()).filter(Boolean).join('\n')
      : (body ? body.textContent.trim() : text);
    if (/border-left:\s*4px/.test(style)) {
      let tipo = 'info';
      if (style.includes('#fefce8')) tipo = 'advertencia';
      else if (style.includes('#fef2f2')) tipo = 'peligro';
      else if (style.includes('#f0fdf4')) tipo = 'exito';
      return { id: uid(), type: 'alerta', order: 0, tipo, texto };
    }
    let tipo = 'tip';
    if (style.includes('#fefce8')) tipo = 'warning';
    else if (style.includes('#eff6ff')) tipo = 'important';
    return { id: uid(), type: 'callout', order: 0, tipo, texto };
  }

  // fallback — preserve as editable rich text
  return { id: uid(), type: 'texto', order: 0, html: el.innerHTML };
}

function _genericChildrenToBlocks(children) {
  const blocks = [];
  for (const el of children) {
    const tag = el.tagName;
    const text = el.textContent.trim();
    if (!text && !el.querySelector('img')) continue;
    if (tag==='H1') { blocks.push({id:uid(),type:'titulo',order:0,emoji:'📋',titulo:text,subtitulo:'',_isH1:true}); continue; }
    if (tag==='H2'||tag==='H3') { blocks.push({id:uid(),type:'titulo',order:0,emoji:'📌',titulo:text,subtitulo:''}); continue; }
    if (tag==='H4'||tag==='H5') { blocks.push({id:uid(),type:'callout',order:0,tipo:'important',texto:text}); continue; }
    if (tag==='HR') { blocks.push({id:uid(),type:'separador',order:0}); continue; }
    if (tag==='IMG' || (!text && el.querySelector('img[src^="data:"]'))) {
      const imgEl = tag==='IMG' ? el : el.querySelector('img[src^="data:"]');
      if (imgEl && imgEl.src && imgEl.src.startsWith('data:')) {
        blocks.push({id:uid(),type:'imagen',order:0,src:imgEl.src,storagePath:null,caption:'',width:'100%'});
        continue;
      }
    }
    if (tag==='TABLE') {
      const headers = Array.from(el.querySelectorAll('thead th,thead td')).map(th=>th.textContent.trim());
      const rows = Array.from(el.querySelectorAll('tbody tr')).map(tr=>Array.from(tr.querySelectorAll('td,th')).map(td=>td.textContent.trim()));
      if (headers.length===2) {
        const lh = headers.map(h=>h.toLowerCase());
        if (lh.some(h=>h.includes('condic')||h.includes('caso'))||lh.some(h=>h.includes('acci')||h.includes('result'))) {
          blocks.push({id:uid(),type:'flujos',order:0,filas:rows.map(r=>({condicion:r[0]||'',accion:r[1]||''}))}); continue;
        }
      }
      const cols = headers.length ? headers : (rows[0]?.map((_,i)=>`Col ${i+1}`)||['Col 1']);
      blocks.push({id:uid(),type:'tabla',order:0,columnas:cols,filas:headers.length?rows:rows.slice(1)}); continue;
    }
    if (tag==='OL') {
      for (const li of el.querySelectorAll('li')) {
        const strong = li.querySelector('strong,b');
        const titulo = strong?.textContent?.trim() || li.textContent.split('\n')[0].trim().slice(0,80);
        let desc = '';
        if (strong) { const c=li.cloneNode(true); c.querySelector('strong,b')?.remove(); desc=c.textContent.trim(); }
        blocks.push({id:uid(),type:'paso',order:0,titulo,descripcion:desc,storagePath:null,caption:''});
      }
      continue;
    }
    if (tag==='UL') {
      const items = Array.from(el.querySelectorAll('li')).map(li=>({
        icono: li.textContent.trim().startsWith('✗')||li.textContent.trim().startsWith('❌') ? 'cross' : 'check',
        texto: li.textContent.trim().replace(/^[✓✗✅❌×]\s*/,'')
      }));
      if (items.length) { blocks.push({id:uid(),type:'lista',order:0,items}); continue; }
    }
    const cls = (el.className||'').toLowerCase();
    if (cls.includes('alert')||cls.includes('warning')||cls.includes('danger')||cls.includes('callout')||cls.includes('note')) {
      const tipo = cls.includes('danger')?'peligro':cls.includes('warn')?'advertencia':'info';
      blocks.push({id:uid(),type:'alerta',order:0,tipo,texto:text}); continue;
    }
    const cm = text.match(/^(nota|aviso|importante|warning|caution|tip|consejo)[:\s]/i);
    if (cm) {
      const t=cm[1].toLowerCase();
      const ct=(t==='nota'||t==='tip'||t==='consejo')?'tip':(t==='aviso'||t==='warning'||t==='caution')?'warning':'important';
      blocks.push({id:uid(),type:'callout',order:0,tipo:ct,texto:text}); continue;
    }
    if (text.length>0) blocks.push({id:uid(),type:'texto',order:0,html:el.innerHTML});
  }
  return blocks;
}

function renderImportPreview(blocks) {
  const prev = document.getElementById('import-preview');
  const btn  = document.getElementById('import-confirm-btn');
  if (!blocks.length) {
    prev.innerHTML = '<div style="color:var(--text-muted);padding:16px;text-align:center">No se encontraron bloques reconocibles en el archivo</div>';
    btn.style.display = 'none'; return;
  }
  const labels = {titulo:'📑 Título',subtitulo:'🔹 Subtítulo',alerta:'⚠️ Alerta',paso:'🔢 Paso',imagen:'🖼 Imagen',tabla:'📊 Tabla',callout:'💡 Callout',lista:'✅ Lista',separador:'— Sep.',texto:'📝 Texto',flujos:'🔀 Flujos',video:'🎬 Vídeo',enlace:'🔗 Enlace'};
  prev.innerHTML = `<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${blocks.length} bloques detectados — selecciona los que quieres importar:</div>
    <div style="max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:6px">
      ${blocks.map((b,i)=>`<label class="import-row" style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);cursor:pointer;font-size:13px">
        <input type="checkbox" checked data-bidx="${i}" style="flex-shrink:0">
        <span style="font-size:11px;font-weight:600;color:var(--primary);width:80px;flex-shrink:0">${labels[b.type]||b.type}</span>
        <span style="flex:1;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(getBlockPreviewText(b).slice(0,90))}</span>
      </label>`).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-sm" onclick="toggleAllImportBlocks(true)">Sel. todos</button>
      <button class="btn btn-sm" onclick="toggleAllImportBlocks(false)">Desel. todos</button>
    </div>`;
  btn.style.display = 'inline-flex';
}

function getBlockPreviewText(b) {
  switch(b.type) {
    case 'titulo': return b.titulo||'';
    case 'subtitulo': return b.texto||'';
    case 'paso':   return (b.titulo||'') + (b.descripcion ? ': '+b.descripcion : '');
    case 'texto':  { const d=document.createElement('div'); d.innerHTML=b.html||''; return d.textContent; }
    case 'alerta': case 'callout': return b.texto||'';
    case 'lista':  return (b.items||[]).map(i=>i.texto).join(', ');
    case 'tabla':  return (b.columnas||[]).join(', ');
    case 'flujos': return (b.filas||[]).map(f=>f.condicion).join(', ');
    case 'enlace': return b.titulo||b.url||'';
    case 'separador': return '──────────';
    default: return b.type;
  }
}

function toggleAllImportBlocks(state) {
  document.querySelectorAll('#import-preview input[type=checkbox]').forEach(cb=>cb.checked=state);
}

function confirmImport() {
  const checkboxes = document.querySelectorAll('#import-preview input[type=checkbox]');
  const asPages = document.getElementById('import-as-pages')?.checked;
  const selected = [];
  checkboxes.forEach(cb => { if (cb.checked) selected.push(_importBlocks[parseInt(cb.dataset.bidx)]); });
  if (!selected.length) { notify('⚠️ Selecciona al menos un bloque'); return; }
  pushHistory();
  if (asPages) {
    importAsPages(selected);
  } else {
    const _added = selected.map((b,i)=>({...b, id:uid(), order:STATE.blocks.length+i, _isH1:undefined}));
    STATE.blocks.push(..._added);
    render();
    scheduleLocalSave();
    notify(`✅ Importados ${selected.length} bloques`);
  }
  closeImportModal();
  _afterImport();
}

function importAsPages(blocks) {
  const pages = [];
  let curBlocks = [];
  let curTitle = 'Importado';
  const flush = () => { if (pages.length) pages[pages.length-1].blocks = curBlocks.map((b,i)=>({...b,id:uid(),order:i,_isH1:undefined})); };
  for (const b of blocks) {
    if (b.type==='titulo' && b._isH1) {
      flush();
      curTitle = b.titulo || 'Sección';
      curBlocks = [{ ...b, id:uid(), _isH1:undefined }];
      pages.push({ id:uid(), title:curTitle, blocks:[] });
    } else {
      curBlocks.push(b);
    }
  }
  flush();
  if (!pages.length) pages.push({ id:uid(), title:'Importado', blocks:blocks.map((b,i)=>({...b,id:uid(),order:i,_isH1:undefined})) });
  STATE.pages.push(...pages);
  if (!STATE.activePage) {
    STATE.activePage = STATE.pages[0].id;
    STATE.blocks = [...(STATE.pages[0].blocks||[])];
  }
  renderPagesPanel();
  render();
  scheduleLocalSave();
  notify(`✅ Importado como ${pages.length} página(s)`);
  _postImportUpload(STATE.pages.flatMap(p=>p.blocks||[]));
}

// Sube a la nube las imágenes recién importadas; si el manual aún no está guardado, avisa.
function _postImportUpload(blocks) {
  const pend = blocks.filter(b=>b && b._pendingBase64);
  if (!pend.length) return;
  if (STATE.user && STATE.manual.id) {
    setTimeout(()=>uploadImportedImages(STATE.pages.length ? STATE.pages.flatMap(p=>p.blocks||[]) : STATE.blocks), 400);
  } else if (STATE.user) {
    notify('💾 Guarda el manual para subir sus imágenes a la nube', 5000);
  }
}

// ─── UNIFIED IMPORT MODAL ───────────────────────────────
let _unifiedImportBlocks = [];

function openUnifiedImportModal() {
  document.getElementById('modal-import-unified').classList.remove('hidden');
  _unifiedImportBlocks = [];
  switchImportTab('pdf');
  ['pdf','docx','html'].forEach(t => {
    const inp = document.getElementById('ui-import-file-' + t);
    if (inp) inp.value = '';
    const nm = document.getElementById('ui-import-name-' + t);
    if (nm) nm.textContent = 'Selecciona un archivo .' + t;
  });
  const prev = document.getElementById('ui-import-preview');
  if (prev) prev.innerHTML = '';
  const btn = document.getElementById('ui-import-confirm');
  if (btn) btn.style.display = 'none';
  const pagesCheck = document.getElementById('ui-import-pages');
  if (pagesCheck) pagesCheck.checked = false;
}

function switchImportTab(type) {
  ['pdf','docx','html'].forEach(t => {
    const sec = document.getElementById('uisec-' + t);
    const tab = document.getElementById('uitab-' + t);
    if (sec) sec.style.display = t === type ? 'block' : 'none';
    if (tab) tab.className = 'import-tab' + (t === type ? ' active' : '');
  });
  const prev = document.getElementById('ui-import-preview');
  if (prev) prev.innerHTML = '';
  const btn = document.getElementById('ui-import-confirm');
  if (btn) btn.style.display = 'none';
  _unifiedImportBlocks = [];
}

async function handleUnifiedFileSelect(input, type) {
  const file = input.files[0];
  if (!file) return;
  const nm = document.getElementById('ui-import-name-' + type);
  if (nm) nm.textContent = file.name;
  const prev = document.getElementById('ui-import-preview');
  const btn = document.getElementById('ui-import-confirm');
  prev.innerHTML = '<div style="text-align:center;padding:20px;color:var(--ui-text-muted)"><div class="spinner" style="margin:0 auto 10px;border-top-color:var(--primary)"></div>Procesando…</div>';
  btn.style.display = 'none';
  _unifiedImportBlocks = [];
  _docxExtractedMedia = [];
  try {
    const ab = await file.arrayBuffer();
    if (type === 'pdf') {
      _unifiedImportBlocks = await parsePDFtoBlocks(ab);
    } else if (type === 'docx') {
      _unifiedImportBlocks = await parseDOCXtoBlocks(ab);
    } else {
      const text = await file.text();
      _unifiedImportBlocks = htmlToImportBlocks(text);
    }
    showUnifiedPreview(_unifiedImportBlocks);
    // Auto-activate "as pages" when importing app's own multi-page export
    if (_unifiedImportBlocks.some(b => b._isH1)) {
      const pagesCheck = document.getElementById('ui-import-pages');
      if (pagesCheck) pagesCheck.checked = true;
    }
  } catch(e) {
    prev.innerHTML = `<div style="color:#f87171;padding:12px;background:rgba(239,68,68,.1);border-radius:8px">❌ Error: ${esc(e.message||String(e))}</div>`;
  }
}

function showUnifiedPreview(blocks) {
  const prev = document.getElementById('ui-import-preview');
  const btn = document.getElementById('ui-import-confirm');
  if (!blocks.length) {
    prev.innerHTML = '<div style="color:var(--ui-text-muted);padding:12px;text-align:center">No se encontraron bloques en el archivo.</div>';
    btn.style.display = 'none';
    return;
  }
  const typeNames = {titulo:'Título',subtitulo:'Subtítulo',paso:'Paso',texto:'Texto',callout:'Callout',alerta:'Alerta',lista:'Lista',tabla:'Tabla',imagen:'Imagen',separador:'Sep.',flujos:'Flujos',video:'Vídeo',enlace:'Enlace',codigo:'Código'};
  const counts = {};
  blocks.forEach(b => { counts[b.type] = (counts[b.type]||0)+1; });
  const tags = Object.entries(counts).map(([t,n]) => `<span style="background:rgba(255,255,255,.1);padding:3px 10px;border-radius:12px;font-size:12px">${typeNames[t]||t} ×${n}</span>`).join('');
  prev.innerHTML = `<div style="background:rgba(255,255,255,.05);border:1px solid var(--panel-border);border-radius:8px;padding:14px 16px">
    <div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--ui-text)">✅ ${blocks.length} bloques detectados</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${tags}</div>
  </div>`;
  btn.style.display = '';
}

function confirmUnifiedImport() {
  const blocks = _unifiedImportBlocks;
  if (!blocks.length) { notify('No hay bloques para importar'); return; }
  const asPages = document.getElementById('ui-import-pages')?.checked;
  pushHistory();
  const clean = blocks.map((b,i)=>({...b, id:uid(), order:STATE.blocks.length+i}));
  if (asPages) {
    importAsPages(clean);
  } else {
    STATE.blocks.push(...clean);
    render();
    scheduleLocalSave();
    notify(`✅ Importados ${clean.length} bloques`);
  }
  closeModal('modal-import-unified');
  _afterImport();
}

// ═══════════════════════════════════════════════════════
// MULTI-PAGE EXPORT
// ═══════════════════════════════════════════════════════
async function exportHTMLMultipage(preview) {
  const titulo = q('#manual-titulo').value || 'Manual';
  const empresa = q('#manual-empresa').value || '';
  const color = STATE.manual.color || '#2563EB';

  // Collect only blocks without local src (annotated images stay in block.src)
  const allImageBlocks = [];
  for (const pg of STATE.pages) {
    for (const b of (pg.blocks||[])) { if (b.storagePath && !b.src) allImageBlocks.push(b); }
  }

  const prog = q('#export-progress'); prog.classList.add('show');
  const bar = q('#export-bar'); const msg = q('#export-msg');
  const imgCache = {};
  let done = 0;
  for (const block of allImageBlocks) {
    msg.textContent = `Descargando imagen ${done+1} de ${allImageBlocks.length}…`;
    bar.style.width = Math.round((done/Math.max(allImageBlocks.length,1))*80)+'%';
    try {
      const { data, error } = await sb.storage.from('manual-images').download(block.storagePath);
      if (!error && data) imgCache[block.storagePath] = await blobToBase64(data);
    } catch(e) {}
    done++;
  }

  msg.textContent = 'Generando HTML multipágina…';
  bar.style.width = '90%';

  const pagesHTML = STATE.pages.map(pg => {
    let pasoN = 0;
    const blocksHTML = (pg.blocks||[]).map(b => {
      if (b.type==='paso') { if (b.resetStep) pasoN = 0; pasoN++; }
      const bCopy = {...b};
      if (!bCopy.src && bCopy.storagePath && imgCache[bCopy.storagePath]) bCopy.src = imgCache[bCopy.storagePath];
      return renderBlockForExport(bCopy, pasoN);
    }).join('\n');
    return { id: pg.id, title: pg.title, html: blocksHTML };
  });

  const html = buildExportHTMLMultipage(titulo, empresa, color, pagesHTML);
  bar.style.width = '100%';
  setTimeout(() => {
    prog.classList.remove('show');
    if (preview) { _showHtmlPreview(html, titulo); return; }
    const blob = new Blob([html], {type:'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (titulo.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g,'').trim()||'manual') + '.html';
    a.click();
    URL.revokeObjectURL(url);
    notify(`✅ Exportado: ${(blob.size/1024/1024).toFixed(1)} MB`);
  }, 400);
}

function buildExportHTMLMultipage(titulo, empresa, color, pages) {
  const navItems = pages.map((p,i) => `<li data-page="${p.id}" class="${i===0?'active':''}" onclick="showPage('${p.id}',this)">${esc(p.title)}</li>`).join('');
  const sections = pages.map((p,i) => `<section class="mp-page${i===0?' active':''}" id="${p.id}">${p.html}</section>`).join('\n');
  const dark = shadeColorHex(color, -40);
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#f8fafc;color:#0f172a}
.mp-header{position:sticky;top:0;z-index:100;background:${color};color:#fff;padding:14px 24px;display:flex;align-items:center;gap:16px;box-shadow:0 2px 8px rgba(0,0,0,.15)}
.mp-header h1{font-size:18px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.mp-header .empresa{font-size:12px;opacity:.75;white-space:nowrap}
.mp-search-wrap{position:relative;flex-shrink:0}
#searchInput{padding:7px 14px;border-radius:20px;border:none;font-size:13px;width:220px;background:rgba(255,255,255,.18);color:#fff;outline:none}
#searchInput::placeholder{color:rgba(255,255,255,.6)}
#searchInput:focus{background:rgba(255,255,255,.28)}
#searchResults{position:absolute;top:calc(100%+6px);right:0;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.14);min-width:360px;max-height:420px;overflow-y:auto;display:none;z-index:200}
#searchResults.open{display:block}
.sr-item{padding:10px 14px;border-bottom:1px solid #f1f5f9;cursor:pointer;font-size:13px}
.sr-item:last-child{border-bottom:none}
.sr-item:hover{background:#f8fafc}
.sr-page{font-size:11px;font-weight:600;color:${color};text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}
.sr-ctx{line-height:1.5;color:#374151}
.sr-ctx mark{background:#fef08a;border-radius:2px;padding:0 2px}
.sr-empty{padding:14px;text-align:center;color:#94a3b8;font-size:13px}
.mp-layout{display:flex;min-height:calc(100vh - 52px);height:calc(100vh - 52px);overflow:hidden}
.mp-nav{width:240px;flex-shrink:0;background:#0f1729;position:sticky;top:52px;height:calc(100vh - 52px);overflow-y:auto;padding:12px 0}
.mp-nav ul{list-style:none}
.mp-nav li{padding:9px 18px;font-size:13px;color:rgba(255,255,255,.65);cursor:pointer;border-radius:6px;margin:1px 8px;transition:all .15s}
.mp-nav li:hover{background:rgba(255,255,255,.08);color:#fff}
.mp-nav li.active{background:rgba(255,255,255,.13);color:#fff;font-weight:500}
.mp-content{flex:1;padding:32px 28px;display:flex;flex-direction:column;align-items:center;overflow-y:auto;min-height:0}
.mp-page{width:100%;max-width:760px;display:none}
.mp-page.active{display:block}
/* hamburger for mobile nav */
.mp-nav-toggle{display:none;background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:2px 6px;margin-right:4px}
@media(max-width:768px){
  .mp-nav{position:fixed;left:-260px;top:0;bottom:0;z-index:300;transition:left .25s;height:100vh}
  .mp-nav.open{left:0;box-shadow:4px 0 20px rgba(0,0,0,.3)}
  .mp-content{padding:20px 16px}
  .mp-page{max-width:100%}
  .mp-nav-toggle{display:inline-block}
  #searchInput{width:140px}
  .mp-layout{flex-direction:column}
}
/* block styles (same as single-page export) */
@media print{.mp-header,.mp-nav,.mp-nav-toggle{display:none!important}.mp-content{padding:0}.mp-page{display:block!important}}
${_lbCSS()}
</style>
</head>
<body>
<header class="mp-header">
  ${pages.length > 1 ? '<button class="mp-nav-toggle" onclick="toggleMobileNav()" title="Menú">☰</button>' : ''}
  <div style="flex:1;min-width:0">
    <h1>${esc(titulo)}</h1>
    ${empresa ? `<div class="empresa">${esc(empresa)}</div>` : ''}
  </div>
  <div class="mp-search-wrap">
    <input type="text" id="searchInput" placeholder="🔍 Buscar en el manual…" oninput="onSearch(this.value)" onkeydown="if(event.key==='Escape')closeSearch()">
    <div id="searchResults"></div>
  </div>
</header>
<div class="mp-layout">
  ${pages.length > 1 ? `<nav class="mp-nav" id="mpNav"><ul>${navItems}</ul></nav>` : ''}
  <main class="mp-content">
    ${sections}
  </main>
</div>
<script>
// ── Navigation ──
function showPage(id, liEl) {
  document.querySelectorAll('.mp-page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#mpNav li').forEach(l=>l.classList.remove('active'));
  const pg = document.getElementById(id);
  if (pg) pg.classList.add('active');
  if (liEl) liEl.classList.add('active');
  window.location.hash = id; const mc=document.querySelector('.mp-content');if(mc)mc.scrollTop=0;
  document.querySelector('.mp-nav')?.classList.remove('open');
}
function toggleMobileNav() {
  document.getElementById('mpNav')?.classList.toggle('open');
}
document.addEventListener('click', e => {
  const nav = document.getElementById('mpNav');
  if (nav && nav.classList.contains('open') && !nav.contains(e.target) && !e.target.closest('.mp-nav-toggle')) nav.classList.remove('open');
  if (!e.target.closest('.mp-search-wrap')) closeSearch();
});
// Hash routing
(function(){
  const h = window.location.hash.slice(1);
  if (h) {
    const li = document.querySelector('#mpNav li[data-page="'+h+'"]');
    if (li) showPage(h, li);
  }
})();

// ── Search ──
let _searchTimer = null;
function onSearch(val) {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => doSearch(val.trim()), 250);
}
function closeSearch() {
  const r = document.getElementById('searchResults');
  r.classList.remove('open'); r.innerHTML = '';
  document.getElementById('searchInput').value = '';
}
function doSearch(term) {
  const r = document.getElementById('searchResults');
  if (!term) { r.classList.remove('open'); r.innerHTML=''; return; }
  const re = new RegExp(term.replace(/[.*+?^\${}()|[\\]\\\\]/g,'\\\\$&'), 'gi');
  const results = [];
  document.querySelectorAll('.mp-page').forEach(pg => {
    const pageTitle = (document.querySelector('#mpNav li[data-page="'+pg.id+'"]')?.textContent || '');
    const walker = document.createTreeWalker(pg, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      const txt = node.textContent;
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(txt)) !== null) {
        const start = Math.max(0, m.index - 60);
        const end = Math.min(txt.length, m.index + term.length + 60);
        const ctx = (start>0?'…':'')+txt.slice(start,end).replace(/</g,'&lt;').replace(/>/g,'&gt;')+(end<txt.length?'…':'');
        const hi = ctx.replace(new RegExp(term.replace(/[.*+?^\${}()|[\\]\\\\]/g,'\\\\$&'),'gi'), '<mark>$&</mark>');
        results.push({ pageId: pg.id, pageTitle, ctx: hi, node });
        if (results.length >= 30) break;
      }
      if (results.length >= 30) break;
    }
  });
  if (!results.length) {
    r.innerHTML = '<div class="sr-empty">Sin resultados para "'+term.replace(/</g,'&lt;')+'"</div>';
  } else {
    r.innerHTML = results.map((res,i) => \`<div class="sr-item" onclick="goToResult(\${i})">
      <div class="sr-page">\${res.pageTitle}</div>
      <div class="sr-ctx">\${res.ctx}</div>
    </div>\`).join('');
  }
  r.classList.add('open');
  window._searchResults = results;
}
function goToResult(i) {
  const res = window._searchResults?.[i];
  if (!res) return;
  const li = document.querySelector('#mpNav li[data-page="'+res.pageId+'"]');
  showPage(res.pageId, li);
  closeSearch();
  // Scroll to node and highlight
  try {
    const el = res.node.parentElement;
    el.scrollIntoView({ behavior:'smooth', block:'center' });
    const orig = el.style.outline;
    el.style.outline = '2px solid #eab308';
    el.style.borderRadius = '4px';
    setTimeout(() => { el.style.outline = orig; el.style.borderRadius = ''; }, 2000);
  } catch(e) {}
}
${_lbJS()}
<\/script>
${_lbHTML()}
</body>
</html>`;
}

function shadeColorHex(hex, pct) {
  try {
    let n=parseInt(hex.replace('#',''),16),r=(n>>16)+pct,g=((n>>8)&0xFF)+pct,b=(n&0xFF)+pct;
    return '#'+(0x1000000+Math.max(0,Math.min(255,r))*0x10000+Math.max(0,Math.min(255,g))*0x100+Math.max(0,Math.min(255,b))).toString(16).slice(1);
  } catch(e) { return hex; }
}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
async function handleSession(session) {
  if (session?.user) {
    hideAuthScreen();
    STATE.user = session.user;

    // Apply pending invitation role
    const pendingRole = localStorage.getItem('pending_role_' + session.user.email);
    if (pendingRole) {
      await sb.from('user_roles').upsert({ user_id: session.user.id, role: pendingRole });
      localStorage.removeItem('pending_role_' + session.user.email);
    }

    let role = await loadUserRole(session.user.id);
    if (!role) role = await ensureAdminExists(session.user.id);
    if (!role) role = await loadUserRole(session.user.id);
    STATE.role = role || 'editor';
    applyRoleUI(STATE.role);
    loadUserPrefs();
            loadManualesPanel('activos');

    // Load local draft for the current manual if any
    const lastId = localStorage.getItem('last_manual_id');
    const draft = loadLocalDraft(lastId || STATE.manual.id || 'guest');
    if (draft && !STATE.blocks.length) {
      STATE.blocks = draft.blocks || [];
      STATE.pages = draft.pages || [];
      STATE.activePage = draft.activePage || null;
      STATE.mediaLibrary = draft.mediaLibrary || [];
      STATE.manual = { ...STATE.manual, ...draft.manual };
      if (draft.titulo) q('#manual-titulo').value = draft.titulo;
      if (draft.empresa) q('#manual-empresa').value = draft.empresa;
      if (draft.manual?.color) setColor(draft.manual.color);
      pushHistory();
      render();
      renderPagesPanel();
    } else if (!draft && !STATE.blocks.length) {
      // No local draft (e.g. localStorage cleared) — silently restore last manual from Supabase
      const restoreId = lastId;
      if (restoreId) {
        loadManual(restoreId).catch(() => {});
      } else {
        sb.from('manuales').select('id').neq('estado','papelera').order('updated_at',{ascending:false}).limit(1)
          .then(({ data }) => { if (data?.length) loadManual(data[0].id).catch(()=>{}); });
      }
    }
  } else {
    STATE.user = null; STATE.role = null;
    q('#btn-logout').style.display = 'none';
    q('#btn-cambiar-pass').style.display = 'none';
    q('#role-btns').innerHTML = '';
    q('#sidebar').style.display = '';
    q('#canvas-wrap').style.marginLeft = '';
    showAuthScreen();

    // Load guest draft
    const draft = loadLocalDraft('guest');
    if (draft) {
      STATE.blocks = draft.blocks || [];
      STATE.pages = draft.pages || [];
      STATE.activePage = draft.activePage || null;
      STATE.mediaLibrary = draft.mediaLibrary || [];
      STATE.manual = { ...STATE.manual, ...draft.manual };
      if (draft.titulo) q('#manual-titulo').value = draft.titulo;
      if (draft.empresa) q('#manual-empresa').value = draft.empresa;
      if (draft.manual?.color) setColor(draft.manual.color);
    }
    pushHistory();
    render();
    renderPagesPanel();
  }
  setLoading(false);
}

// ── onAuthStateChange: sólo para cambios POSTERIORES al arranque ──────────────
sb.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')         handleSession(session);
  if (event === 'SIGNED_OUT')        handleSession(null);
  if (event === 'PASSWORD_RECOVERY') {
    history.replaceState(null, '', window.location.pathname);
    hideAuthScreen();
    setLoading(false);
    showSetPasswordModal(true);
  }
});

// Safety net: si en 5s la app sigue sin mostrar contenido, limpiar y forzar login
setTimeout(() => {
  if (!STATE.user && !q('#auth-screen')?.classList.contains('hidden')) return; // ya en login, OK
  if (!STATE.user) {
    Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
    setLoading(false);
    showAuthScreen();
  }
}, 5000);

async function saveVersion() {
  if (!STATE.manual.id || !STATE.user) return;
  try {
    const contenido = (STATE.pages.length > 0)
      ? { blocks: STATE.blocks, pages: STATE.pages, activePage: STATE.activePage, mediaLibrary: STATE.mediaLibrary }
      : ((STATE.mediaLibrary && STATE.mediaLibrary.length)
          ? { blocks: STATE.blocks, mediaLibrary: STATE.mediaLibrary }
          : STATE.blocks);
    await sb.from('manual_versions').insert({ manual_id: STATE.manual.id, user_id: STATE.user.id, contenido, titulo: STATE.manual.titulo });
    const { data } = await sb.from('manual_versions').select('id, created_at').eq('manual_id', STATE.manual.id).order('created_at', { ascending: false });
    if (data && data.length > 10) {
      await sb.from('manual_versions').delete().in('id', data.slice(10).map(v => v.id));
    }
  } catch(e) { /* non-critical */ }
}
async function openVersionHistory() {
  if (!STATE.manual.id || !STATE.user) { notify('⚠ Guarda el manual primero'); return; }
  openModal('modal-versions');
  const body = q('#versions-body');
  body.innerHTML = '<p>Cargando...</p>';
  try {
    const { data, error } = await sb.from('manual_versions').select('id, titulo, created_at').eq('manual_id', STATE.manual.id).order('created_at', { ascending: false }).limit(20);
    if (error || !data?.length) { body.innerHTML = '<p style="color:var(--text-muted)">No hay versiones guardadas aún. Guarda el manual para crear la primera versión.</p>'; return; }
    body.innerHTML = data.map((v, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);gap:12px"><div style="min-width:0"><div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${i===0?'<span style="background:#dcfce7;color:#16a34a;font-size:10px;padding:1px 6px;border-radius:8px;margin-right:6px">Actual</span>':''}${esc(v.titulo||'Sin título')}</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">${new Date(v.created_at).toLocaleString('es',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div></div><button class="btn btn-sm" style="flex-shrink:0" onclick="restoreVersion('${v.id}')">${i===0?'Revertir':'Restaurar'}</button></div>`).join('');
  } catch(e) { body.innerHTML = '<p style="color:#dc2626">Error al cargar.</p>'; }
}
async function restoreVersion(id) {
  if (!confirm('¿Restaurar esta versión? Los cambios actuales se perderán.')) return;
  try {
    const { data, error } = await sb.from('manual_versions').select('contenido').eq('id', id).single();
    if (error || !data) throw new Error('Versión no encontrada');
    pushHistory();
    const c = data.contenido;
    if (Array.isArray(c)) { STATE.blocks = c; }
    else if (c && c.pages) { STATE.blocks = c.blocks || []; STATE.pages = c.pages; STATE.activePage = c.activePage; }
    render(); renderPagesPanel(); scheduleLocalSave();
    closeModal('modal-versions');
    notify('✅ Versión restaurada');
  } catch(e) { notify('❌ Error al restaurar: ' + (e.message||e)); }
}

async function openVersionHistoryFor(manualId) {
  if (!STATE.user) return;
  if (manualId !== STATE.manual.id) {
    await loadManual(manualId);
    setTimeout(() => openVersionHistory(), 150);
  } else {
    openVersionHistory();
  }
}

function deleteManual(id, titulo) { softDeleteManual(id, titulo); }

function openTemplatesModal() { openModal('modal-templates'); loadUserTemplates(); }
async function saveAsTemplate() {
  if (!STATE.user) { openAuthModal('Accede para guardar plantillas'); return; }
  const nombre = prompt('Nombre de la plantilla:', q('#manual-titulo').value || 'Mi plantilla');
  if (!nombre) return;
  if (STATE.activePage && STATE.pages.length) {
    const cur = STATE.pages.find(p => p.id === STATE.activePage);
    if (cur) cur.blocks = [...STATE.blocks];
  }
  const contenido = STATE.pages.length > 0
    ? { blocks: STATE.blocks, pages: STATE.pages, activePage: STATE.activePage }
    : STATE.blocks;
  const { error } = await sb.from('manuales').insert({
    titulo: nombre, empresa: q('#manual-empresa').value || '', color: STATE.manual.color,
    contenido, estado: 'plantilla', user_id: STATE.user.id, created_by: STATE.user.id
  });
  if (error) { notify('\u274c ' + error.message); return; }
  notify('\u2705 Plantilla guardada');
  loadUserTemplates();
}
async function loadUserTemplates() {
  const box = document.getElementById('user-templates');
  if (!box || !STATE.user) return;
  const { data } = await sb.from('manuales').select('id,titulo').eq('estado','plantilla').order('updated_at',{ascending:false}).limit(20);
  box.innerHTML = (data && data.length)
    ? data.map(t => '<button class="btn" style="text-align:left;padding:10px 16px" onclick="applyUserTemplate(\'' + t.id + '\')">\ud83d\udcc4 ' + esc(t.titulo) + '</button>').join('')
    : '<small style="color:var(--text-muted)">A\u00fan no tienes plantillas propias.</small>';
}
async function applyUserTemplate(id) {
  const { data, error } = await sb.from('manuales').select('contenido').eq('id', id).single();
  if (error || !data) { notify('\u274c No se pudo cargar la plantilla'); return; }
  pushHistory();
  const c = data.contenido;
  if (Array.isArray(c)) { STATE.blocks = c.map(b => ({...b, id: uid()})); STATE.pages = []; STATE.activePage = null; }
  else {
    STATE.pages = (c.pages||[]).map(pg => ({...pg, id: uid(), blocks: (pg.blocks||[]).map(b => ({...b, id: uid()}))}));
    STATE.activePage = STATE.pages[0]?.id || null;
    STATE.blocks = STATE.pages[0] ? [...STATE.pages[0].blocks] : [];
  }
  STATE.manual.id = null; // nuevo manual a partir de plantilla, no sobrescribe la original
  render(); renderPagesPanel(); scheduleLocalSave();
  closeModal('modal-templates');
  notify('\u2705 Plantilla aplicada');
}
function applyTemplate(idx) {
  const T = [
    { name:'Manual de Proceso', blocks:() => [
      {id:uid(),type:'titulo',order:0,emoji:'📋',titulo:'Manual de Proceso',subtitulo:'Descripción del proceso'},
      {id:uid(),type:'paso',order:1,titulo:'Paso 1: Preparación',descripcion:'Descripción del primer paso',storagePath:null,caption:''},
      {id:uid(),type:'paso',order:2,titulo:'Paso 2: Ejecución',descripcion:'Descripción del segundo paso',storagePath:null,caption:''},
      {id:uid(),type:'paso',order:3,titulo:'Paso 3: Verificación',descripcion:'Comprueba que el resultado es correcto',storagePath:null,caption:''},
      {id:uid(),type:'callout',order:4,tipo:'tip',texto:'Recuerda guardar el trabajo periódicamente'}
    ]},
    { name:'Guía de Instalación', blocks:() => [
      {id:uid(),type:'titulo',order:0,emoji:'🛠',titulo:'Guía de Instalación',subtitulo:'Requisitos previos y pasos'},
      {id:uid(),type:'alerta',order:1,tipo:'info',texto:'Asegúrate de tener permisos de administrador antes de comenzar.'},
      {id:uid(),type:'paso',order:2,titulo:'Descargar el instalador',descripcion:'Accede al sitio oficial y descarga la última versión',storagePath:null,caption:''},
      {id:uid(),type:'paso',order:3,titulo:'Ejecutar la instalación',descripcion:'Haz doble clic en el instalador y sigue las instrucciones',storagePath:null,caption:''},
      {id:uid(),type:'paso',order:4,titulo:'Configuración inicial',descripcion:'Completa el asistente con tus datos',storagePath:null,caption:''},
      {id:uid(),type:'paso',order:5,titulo:'Verificación',descripcion:'Abre la aplicación y comprueba que funciona',storagePath:null,caption:''},
      {id:uid(),type:'lista',order:6,items:[{icono:'check',texto:'Instalación completada'},{icono:'check',texto:'Configuración verificada'},{icono:'check',texto:'Acceso probado'}]}
    ]},
    { name:'Manual de Políticas', blocks:() => [
      {id:uid(),type:'titulo',order:0,emoji:'📄',titulo:'Política de [Área]',subtitulo:'Versión 1.0 · [Fecha]'},
      {id:uid(),type:'texto',order:1,html:'<p>Esta política establece las normas y directrices que deben seguir todos los miembros de la organización en relación con este proceso.</p>'},
      {id:uid(),type:'callout',order:2,tipo:'important',texto:'El cumplimiento de esta política es obligatorio para todos los miembros del equipo.'},
      {id:uid(),type:'lista',order:3,items:[{icono:'check',texto:'Norma 1: descripción'},{icono:'check',texto:'Norma 2: descripción'},{icono:'check',texto:'Norma 3: descripción'}]},
      {id:uid(),type:'tabla',order:4,columnas:['Acción','Responsable','Plazo'],filas:[['Revisión anual','RRHH','Enero'],['Actualización','Dirección','Según cambios']]}
    ]},
    { name:'Nota de Versión', blocks:() => [
      {id:uid(),type:'titulo',order:0,emoji:'🚀',titulo:'Novedades v[X.Y]',subtitulo:'[Fecha de lanzamiento]'},
      {id:uid(),type:'callout',order:1,tipo:'tip',texto:'Esta versión incluye mejoras de rendimiento y nuevas funcionalidades.'},
      {id:uid(),type:'lista',order:2,items:[{icono:'check',texto:'Nueva funcionalidad 1'},{icono:'check',texto:'Nueva funcionalidad 2'},{icono:'check',texto:'Corrección de errores'}]},
      {id:uid(),type:'enlace',order:3,url:'',titulo:'Ver documentación completa',descripcion:'Accede al detalle técnico de todos los cambios'}
    ]},
    { name:'Manual Técnico', blocks:() => [
      {id:uid(),type:'titulo',order:0,emoji:'⚙️',titulo:'Manual Técnico',subtitulo:'Documentación del sistema'},
      {id:uid(),type:'alerta',order:1,tipo:'advertencia',texto:'Este manual es solo para personal técnico autorizado.'},
      {id:uid(),type:'titulo',order:2,emoji:'🔧',titulo:'Arquitectura del sistema',subtitulo:''},
      {id:uid(),type:'texto',order:3,html:'<p>Descripción de la arquitectura y componentes principales del sistema.</p>'},
      {id:uid(),type:'codigo',order:4,language:'bash',code:'# Comando de instalación\nnpm install && npm start'},
      {id:uid(),type:'tabla',order:5,columnas:['Componente','Versión','Estado'],filas:[['Backend','2.0','✅ Activo'],['Frontend','1.5','✅ Activo'],['Base de datos','14.0','✅ Activo']]}
    ]}
  ];
  const tmpl = T[idx];
  if (!tmpl) return;
  pushHistory();
  STATE.blocks = tmpl.blocks();
  render();
  scheduleLocalSave();
  closeModal('modal-templates');
  notify(`✅ Plantilla "${tmpl.name}" aplicada`);
}

async function init() {
  renderColorPicker();
  q('#manual-titulo').addEventListener('input', scheduleLocalSave);
  q('#manual-empresa').addEventListener('input', scheduleLocalSave);
  startAutoSave();
  window.addEventListener('beforeunload', e => {
    if (STATE.isDirty && STATE.user && STATE.blocks.length) { e.preventDefault(); e.returnValue = ''; }
  });

  // 1. Mostrar login inmediatamente, sin esperar nada
  setLoading(false);
  const draft = loadLocalDraft('guest');
  if (draft) {
    STATE.blocks = draft.blocks || [];
    STATE.pages = draft.pages || [];
    STATE.activePage = draft.activePage || null;
    STATE.manual = { ...STATE.manual, ...draft.manual };
    if (draft.titulo) q('#manual-titulo').value = draft.titulo;
    if (draft.empresa) q('#manual-empresa').value = draft.empresa;
    if (draft.manual?.color) setColor(draft.manual.color);
  }
  pushHistory();
  render();
  renderPagesPanel();

  // Ensure contenteditable fields get focus when clicked (selectBlock no longer re-renders)
  document.getElementById('canvas').addEventListener('click', e => {
    const editable = e.target.closest('[contenteditable]');
    if (editable) editable.focus();
  });

  showAuthScreen();

  // 2. Intentar recuperar sesión en background con timeout duro de 3s
  const sessionPromise = sb.auth.getSession();
  const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ data: { session: null } }), 3000));
  const { data } = await Promise.race([sessionPromise, timeoutPromise]);

  if (data?.session) {
    await handleSession(data.session);
  }
  // Si no hay sesión, el login ya está visible — no hacer nada más
}

// ── Procesar token en URL (magic link / reset password) antes de init normal ──
(async () => {
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const accessToken  = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token') || '';
  const type         = hashParams.get('type');

  if (accessToken) {
    // Limpiar localStorage corrupto primero
    Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
    history.replaceState(null, '', window.location.pathname);

    const { data, error } = await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) {
      console.error('Error setting session from URL token:', error.message);
      init();
    } else if (type === 'recovery') {
      // Reset de contraseña — no llames a init para no disparar onAuthStateChange doblemente
      STATE.user = data.session?.user;
      hideAuthScreen();
      setLoading(false);
      renderColorPicker();
      render();
      showSetPasswordModal(true);
    } else {
      // Magic link normal — onAuthStateChange disparará SIGNED_IN con la sesión
      init();
    }
  } else {
    init();
  }
})();

// ── Format sidebar panel ──────────────────────────────────────────────────
function showFormatToolbar() {} // replaced by sidebar panel
function hideFormatToolbar() {}
function fmt(cmd) {
  document.execCommand(cmd, false, null);
  updateFmtStates();
}
function fmtSize(val) { document.execCommand('fontSize', false, val); }
function fmtColor(val) {
  if (_fmtSavedSel) { const s=window.getSelection(); s.removeAllRanges(); s.addRange(_fmtSavedSel); }
  document.execCommand('foreColor', false, val);
  updateFmtStates();
}
function updateFmtStates() {
  const cmds = ['bold','italic','underline','strikeThrough','justifyLeft','justifyCenter','justifyRight',
                 'insertUnorderedList','insertOrderedList'];
  cmds.forEach(cmd => {
    const btn = document.getElementById('fmts-' + cmd);
    if (!btn) return;
    try { btn.classList.toggle('active', document.queryCommandState(cmd)); } catch(e) {}
  });
}

// ── Iconos (Iconify): módulo en barra lateral + modal "más grande" ──────────
const ICO_CATS = [
  ['Manuales', ['mdi:book-open-page-variant','mdi:format-list-checks','mdi:information','mdi:alert','mdi:check-circle','mdi:close-circle','mdi:cog','mdi:wrench','mdi:lightbulb-on','mdi:folder','mdi:file-document','mdi:clock-outline']],
  ['Avisos', ['mdi:alert','mdi:alert-circle','mdi:information','mdi:check-circle','mdi:close-circle','mdi:help-circle','mdi:bell','mdi:flag','mdi:shield-alert','mdi:cancel','mdi:fire','mdi:exclamation-thick']],
  ['Acciones', ['mdi:pencil','mdi:delete','mdi:plus','mdi:content-save','mdi:magnify','mdi:content-copy','mdi:download','mdi:upload','mdi:refresh','mdi:send','mdi:printer','mdi:share-variant']],
  ['Objetos', ['mdi:folder','mdi:file-document','mdi:cog','mdi:wrench','mdi:monitor','mdi:cellphone','mdi:email','mdi:link-variant','mdi:paperclip','mdi:image','mdi:calendar','mdi:lock']],
  ['Personas', ['mdi:account','mdi:account-group','mdi:account-circle','mdi:badge-account-horizontal','mdi:face-agent','mdi:account-hard-hat','mdi:account-cog','mdi:account-plus','mdi:shield-account','mdi:briefcase','mdi:school','mdi:card-account-details']],
  ['Flechas', ['mdi:arrow-right','mdi:arrow-left','mdi:arrow-up','mdi:arrow-down','mdi:chevron-right','mdi:chevron-down','mdi:arrow-top-right','mdi:sync','mdi:undo','mdi:redo','mdi:arrow-right-bold','mdi:swap-horizontal']]
];
let _icoColorVal = '#374151';
let _icoMode = 'cat';
let _icoCurCat = 0;
let _icoResults = ICO_CATS[0][1].slice();
let _icoSearchTimer = null;
let _icoTargetEl = null;
let _icoLibLoaded = false;
let _icoInited = false;
function _icoEnsureLib() {
  if (_icoLibLoaded) return;
  _icoLibLoaded = true;
  loadScript('https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js').catch(() => { _icoLibLoaded = false; });
}
function _icoInit() {
  _icoEnsureLib();
  if (!_icoInited) { _icoInited = true; _icoSetCat(0); }
  else { _icoRenderCats(); _icoRenderGrids(); }
}
function _icoRenderCats() {
  const html = ICO_CATS.map((c, i) => `<button class="ico-cat${(i === _icoCurCat && _icoMode === 'cat') ? ' active' : ''}" onclick="_icoSetCat(${i})">${c[0]}</button>`).join('');
  ['ico-cats-sb', 'ico-cats-modal'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = html; });
}
function _icoSetCat(i) {
  _icoMode = 'cat'; _icoCurCat = i; _icoResults = ICO_CATS[i][1].slice();
  ['ico-search-sb', 'ico-search-modal'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  _icoRenderCats(); _icoRenderGrids();
}
function _icoOnSearch(v) {
  ['ico-search-sb', 'ico-search-modal'].forEach(id => { const el = document.getElementById(id); if (el && el.value !== v) el.value = v; });
  clearTimeout(_icoSearchTimer);
  _icoSearchTimer = setTimeout(() => _icoDoSearch(v), 250);
}
async function _icoDoSearch(query) {
  query = (query || '').trim();
  if (!query) { _icoSetCat(_icoCurCat); return; }
  _icoMode = 'search'; _icoEnsureLib();
  _icoRenderCats();
  ['ico-grid-sb', 'ico-grid-modal'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = '<div class="ico-msg">Buscando…</div>'; });
  try {
    const r = await fetch('https://api.iconify.design/search?query=' + encodeURIComponent(query) + '&limit=60');
    const d = await r.json();
    _icoResults = (d.icons || []);
    _icoRenderGrids();
  } catch (e) {
    _icoResults = [];
    _icoRenderGrids('Sin conexión para buscar. Los iconos ya insertados sí funcionan offline.');
  }
}
function _icoSetColor(v) {
  _icoColorVal = v || '#374151';
  ['ico-color-sb', 'ico-color-modal'].forEach(id => { const el = document.getElementById(id); if (el && el.value !== _icoColorVal) el.value = _icoColorVal; });
  _icoRenderGrids();
}
function _icoCellHTML(full) {
  return `<button class="ico-cell" title="${full}" onmousedown="event.preventDefault()" onclick="insertIconAt('${full}')"><iconify-icon icon="${full}" style="font-size:24px;color:${_icoColorVal}"></iconify-icon></button>`;
}
function _icoRenderGrids(msg) {
  const html = msg ? `<div class="ico-msg">${msg}</div>` : (_icoResults.length ? _icoResults.map(_icoCellHTML).join('') : '<div class="ico-msg">Sin resultados</div>');
  ['ico-grid-sb', 'ico-grid-modal'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = html; });
}
async function insertIconAt(full) {
  _icoTargetEl = null;
  if (_fmtSavedSel) {
    let n = _fmtSavedSel.startContainer;
    n = (n && n.nodeType === 1) ? n : (n ? n.parentElement : null);
    while (n && !(n.matches && n.matches('[contenteditable][data-id]'))) n = n.parentElement;
    _icoTargetEl = n;
  }
  if (!_icoTargetEl) { notify('Coloca el cursor dentro de un texto, paso, título o subtítulo primero'); return; }
  const i = full.indexOf(':'); const prefix = full.slice(0, i), name = full.slice(i + 1);
  try {
    const r = await fetch('https://api.iconify.design/' + prefix + '/' + name + '.svg?color=' + encodeURIComponent(_icoColorVal) + '&height=18');
    let svg = await r.text();
    if (!svg || svg.indexOf('<svg') === -1) throw new Error('icono no disponible');
    svg = svg.replace('<svg ', '<svg class="inline-ico" style="display:inline-block;vertical-align:-0.18em;height:1.05em;width:auto;margin:0 1px" ');
    closeIconifyPicker();
    _icoTargetEl.focus();
    _restoreFmtSel();
    document.execCommand('insertHTML', false, svg + '​');
    saveInlineEdit(_icoTargetEl);
    scheduleLocalSave();
    notify('✱ Icono insertado');
  } catch (e) {
    notify('❌ No se pudo insertar el icono: ' + (e.message || e));
  }
}
function openIconifyPicker() {
  _icoInit();
  const m = document.getElementById('modal-iconify'); if (m) m.style.display = 'flex';
  _icoRenderCats(); _icoRenderGrids();
  const s = document.getElementById('ico-search-modal'); if (s) setTimeout(() => s.focus(), 50);
}
function closeIconifyPicker() {
  const m = document.getElementById('modal-iconify'); if (m) m.style.display = 'none';
}
(function initFormatPanel() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  function setHint(show) {
    const h = document.getElementById('fmt-hint');
    if (h) h.style.display = show ? '' : 'none';
  }
  canvas.addEventListener('focusin', function(e) {
    if (!e.target.matches('[contenteditable="true"]')) return;
    setHint(false);
    updateFmtStates();
  });
  canvas.addEventListener('focusout', function() {
    setTimeout(function() {
      const cvs = document.getElementById('canvas');
      const fp = document.getElementById('sid-fmt-panel');
      if (cvs && fp && !cvs.contains(document.activeElement) && !fp.contains(document.activeElement)) {
        setHint(true);
      }
    }, 200);
  });
  canvas.addEventListener('mouseup', function() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) _fmtSavedSel = sel.getRangeAt(0).cloneRange();
    updateFmtStates();
  });
  canvas.addEventListener('keyup', updateFmtStates);
  document.addEventListener('selectionchange', function() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const cvs = document.getElementById('canvas');
    if (cvs && cvs.contains(range.commonAncestorContainer)) {
      _fmtSavedSel = range.cloneRange();
      updateFmtStates();
    }
  });
})();

// ── Titulo inline color swatches ──────────────────────────────────────────
(function initTituloSwatches() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  canvas.addEventListener('click', function(e) {
    const swatch = e.target.closest('.titulo-color-swatch');
    if (!swatch) return;
    const wrap = swatch.closest('.block-wrap');
    if (!wrap) return;
    const block = STATE.blocks.find(b => b.id === wrap.dataset.id);
    if (!block || (block.type !== 'titulo' && block.type !== 'subtitulo')) return;
    block.blockBgColor = swatch.dataset.color;
    applyBlockColors();
    // Update swatch highlights
    wrap.querySelectorAll('.titulo-color-swatch').forEach(s => s.style.border = '2px solid transparent');
    swatch.style.border = '2px solid white';
    const cprev = wrap.querySelector('.titulo-cprev');
    if (cprev) cprev.style.background = swatch.dataset.color;
    const cinput = wrap.querySelector('.titulo-color-custom');
    if (cinput) cinput.value = swatch.dataset.color;
    scheduleLocalSave();
  });
  canvas.addEventListener('input', function(e) {
    if (!e.target.matches('.titulo-color-custom')) return;
    const wrap = e.target.closest('.block-wrap');
    if (!wrap) return;
    const block = STATE.blocks.find(b => b.id === wrap.dataset.id);
    if (!block || (block.type !== 'titulo' && block.type !== 'subtitulo')) return;
    block.blockBgColor = e.target.value;
    applyBlockColors();
    wrap.querySelectorAll('.titulo-color-swatch').forEach(s => s.style.border = '2px solid transparent');
    const cprev = wrap.querySelector('.titulo-cprev');
    if (cprev) cprev.style.background = e.target.value;
    scheduleLocalSave();
  });
})();

// ── Format toolbar saved-selection + custom color picker ──────────────────
let _fmtSavedSel = null;
function _saveFmtSel() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) _fmtSavedSel = sel.getRangeAt(0).cloneRange();
}
function _restoreFmtSel() {
  if (!_fmtSavedSel) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(_fmtSavedSel);
}
function _rgbToHex(rgb) {
  const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!m) return null;
  return '#' + [m[1],m[2],m[3]].map(x=>parseInt(x).toString(16).padStart(2,'0')).join('');
}
(function initFmtColorPicker() {
  const dot = document.getElementById('fmtColorDot');
  const customInput = document.getElementById('fmtColorCustom');
  if (!dot || !customInput) return;
  dot.addEventListener('mousedown', function(e) {
    e.preventDefault();
    _saveFmtSel();
    customInput.click();
  });
  customInput.addEventListener('input', function(e) {
    _restoreFmtSel();
    document.execCommand('foreColor', false, e.target.value);
    dot.style.background = e.target.value;
    _fmtSavedSel = window.getSelection().rangeCount > 0 ? window.getSelection().getRangeAt(0).cloneRange() : _fmtSavedSel;
  });
  document.addEventListener('selectionchange', function() {
    const rawColor = document.queryCommandValue('foreColor');
    if (rawColor && rawColor !== 'false' && rawColor !== '') {
      const hex = _rgbToHex(rawColor);
      if (hex) dot.style.background = hex;
    }
  });
})();

// ══ MÓDULO ANOTACIONES EN IMÁGENES ═══════════════════════════════════════

// Step 1: resolve image src — block.src > DOM lazy-loaded img > fresh signed URL
async function _resolveAnnotationSrc(block) {
  if (block.src) return block.src;
  // DOM img already lazy-loaded?
  const imgEl = document.querySelector(`[data-id="${block.id}"] img`);
  if (imgEl && imgEl.complete && imgEl.naturalWidth > 0 && imgEl.src && !imgEl.src.endsWith('/') && imgEl.src !== window.location.href) {
    return imgEl.src;
  }
  // Generate a fresh signed URL from storagePath
  if (block.storagePath && window.sb) {
    try {
      const { data } = await sb.storage.from('manual-images').createSignedUrl(block.storagePath, 3600);
      if (data && data.signedUrl) return data.signedUrl;
    } catch(e) { console.warn('signedUrl:', e); }
  }
  return null;
}

// Step 2: load image onto canvas via fetch+blob (avoids CORS taint on signed URLs)
function _loadImageToCanvas(src, canvas, ctx) {
  return new Promise((resolve, reject) => {
    function drawImg(imgSrc, useCrossOrigin) {
      const img = new Image();
      if (useCrossOrigin) img.crossOrigin = 'anonymous';
      img.onload = () => {
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        ctx.drawImage(img, 0, 0);
        resolve();
      };
      img.onerror = reject;
      img.src = imgSrc;
    }
    // Data URLs are same-origin — draw directly, no taint risk
    if (src.startsWith('data:')) { drawImg(src, false); return; }
    // Remote URLs: fetch+blob is the most reliable CORS-free strategy
    fetch(src)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(blobUrl);
          resolve();
        };
        img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('blob img load failed')); };
        img.src = blobUrl;
      })
      .catch(() => {
        // Last resort: crossOrigin direct load
        drawImg(src, true);
      });
  });
}

async function openAnnotationEditor(blockId) {
  const block = STATE.blocks.find(b => b.id === blockId);
  if (!block) return;

  const imgSrc = await _resolveAnnotationSrc(block);
  if (!imgSrc) { notify('⚠️ No hay imagen cargada para anotar'); return; }

  const existing = document.getElementById('annotationModal');
  if (existing) existing.remove();

  const COLORS = ['#FF0000','#FF8C00','#FFFF00','#00CC44','#2563EB','#7C3AED','#FFFFFF','#1a1a1a'];
  const ANN = { tool:'arrow', color:'#FF0000', lw:3, drawing:false, startX:0, startY:0, snapshots:[] };

  const colorDotsHTML = COLORS.map(c =>
    `<div class="ann-color-dot${c===ANN.color?' active':''}" data-ann-color="${c}" style="background:${c}${c==='#FFFFFF'?';outline:2px solid #888':''}" title="${c}"></div>`
  ).join('');

  const modal = document.createElement('div');
  modal.id = 'annotationModal';
  modal.innerHTML = `
    <div class="ann-toolbar">
      <button class="ann-tool-btn active" data-ann-tool="arrow" title="Flecha">➡️</button>
      <button class="ann-tool-btn" data-ann-tool="rect" title="Rectángulo">⬜</button>
      <button class="ann-tool-btn" data-ann-tool="circle" title="Círculo">⭕</button>
      <button class="ann-tool-btn" data-ann-tool="line" title="Línea">↗️</button>
      <button class="ann-tool-btn" data-ann-tool="text" title="Texto libre" style="font-weight:700;font-family:serif;font-size:17px">T</button>
      <div class="ann-divider"></div>
      ${colorDotsHTML}
      <div class="ann-divider"></div>
      <button class="ann-lw-btn active" data-ann-lw="2" title="Fino">—</button>
      <button class="ann-lw-btn" data-ann-lw="4" title="Medio">━</button>
      <button class="ann-lw-btn" data-ann-lw="8" title="Grueso">▬</button>
      <div class="ann-divider"></div>
      <button class="ann-act-btn" id="ann-undo" title="Deshacer (Ctrl+Z)">↩️</button>
      <button class="ann-act-btn" id="ann-clear" title="Limpiar todo">🗑️</button>
      <div style="flex:1;min-width:8px"></div>
      <button id="ann-cancel" style="background:#444;color:#fff;border:none;border-radius:6px;padding:7px 16px;cursor:pointer;font-size:13px">Cancelar</button>
      <button id="ann-apply" style="background:#16A34A;color:#fff;border:none;border-radius:6px;padding:7px 16px;cursor:pointer;font-size:13px;font-weight:600;margin-left:6px">✅ Aplicar</button>
    </div>
    <div class="ann-canvas-wrap">
      <div id="annCanvasContainer" style="position:relative;line-height:0;display:inline-block">
        <canvas id="annCanvas" style="cursor:crosshair;max-width:calc(100vw - 32px);max-height:calc(100vh - 80px);display:block;box-shadow:0 0 40px rgba(0,0,0,.6)"></canvas>
        <input id="annTextInput" class="ann-text-input" type="text" placeholder="Escribe y Enter…">
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const canvas = document.getElementById('annCanvas');
  const ctx = canvas.getContext('2d');
  const txtInput = document.getElementById('annTextInput');
  const canvasCont = document.getElementById('annCanvasContainer');

  try {
    await _loadImageToCanvas(imgSrc, canvas, ctx);
    ANN.snapshots.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  } catch(err) {
    modal.remove();
    notify('⚠️ No se pudo cargar la imagen: ' + (err.message || err));
    return;
  }

  function closeModal() {
    document.removeEventListener('keydown', _annKeydown);
    modal.remove();
  }

  // Scale-aware coordinate mapping
  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width;
    const sy = canvas.height / r.height;
    const src = (e.touches && e.touches.length > 0) ? e.touches[0]
              : (e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0]
              : e;
    return { x: (src.clientX - r.left) * sx, y: (src.clientY - r.top) * sy };
  }

  function applyStyle() {
    ctx.strokeStyle = ANN.color;
    ctx.fillStyle = ANN.color;
    ctx.lineWidth = ANN.lw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }

  function drawArrowShape(x1, y1, x2, y2) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const len = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
    const headLen = Math.max(14, Math.min(32, len * 0.32));
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.42), y2 - headLen * Math.sin(angle - 0.42));
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.42), y2 - headLen * Math.sin(angle + 0.42));
    ctx.closePath(); ctx.fill();
  }

  function previewDraw(x, y) {
    if (!ANN.snapshots.length) return;
    ctx.putImageData(ANN.snapshots[ANN.snapshots.length - 1], 0, 0);
    applyStyle();
    const dx = x - ANN.startX, dy = y - ANN.startY;
    if (ANN.tool === 'arrow') {
      drawArrowShape(ANN.startX, ANN.startY, x, y);
    } else if (ANN.tool === 'rect') {
      ctx.strokeRect(ANN.startX, ANN.startY, dx, dy);
    } else if (ANN.tool === 'circle') {
      ctx.beginPath();
      ctx.ellipse(ANN.startX + dx/2, ANN.startY + dy/2, Math.max(1,Math.abs(dx)/2), Math.max(1,Math.abs(dy)/2), 0, 0, Math.PI*2);
      ctx.stroke();
    } else if (ANN.tool === 'line') {
      ctx.beginPath(); ctx.moveTo(ANN.startX, ANN.startY); ctx.lineTo(x, y); ctx.stroke();
    }
  }

  function commitDraw() {
    ANN.snapshots.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  }

  // ── Mouse events ──
  canvas.addEventListener('mousedown', e => {
    if (ANN.tool === 'text') return;
    ANN.drawing = true;
    const p = getPos(e); ANN.startX = p.x; ANN.startY = p.y;
    e.preventDefault();
  });
  canvas.addEventListener('mousemove', e => {
    if (!ANN.drawing) return;
    const p = getPos(e); previewDraw(p.x, p.y);
  });
  canvas.addEventListener('mouseup', e => {
    if (!ANN.drawing) return;
    ANN.drawing = false;
    const p = getPos(e); previewDraw(p.x, p.y); commitDraw();
  });
  canvas.addEventListener('mouseleave', () => {
    if (ANN.drawing) { ANN.drawing = false; commitDraw(); }
  });

  // ── Touch events ──
  canvas.addEventListener('touchstart', e => {
    if (ANN.tool === 'text') return;
    ANN.drawing = true;
    const p = getPos(e); ANN.startX = p.x; ANN.startY = p.y;
    e.preventDefault();
  }, { passive:false });
  canvas.addEventListener('touchmove', e => {
    if (!ANN.drawing) return;
    const p = getPos(e); previewDraw(p.x, p.y);
    e.preventDefault();
  }, { passive:false });
  canvas.addEventListener('touchend', e => {
    if (!ANN.drawing) return;
    ANN.drawing = false;
    commitDraw();
    e.preventDefault();
  }, { passive:false });

  // ── Text tool ──
  canvas.addEventListener('click', e => {
    if (ANN.tool !== 'text') return;
    const r = canvas.getBoundingClientRect();
    const cr = canvasCont.getBoundingClientRect();
    const fontSize = Math.max(16, ANN.lw * 5);
    // Input is absolute inside canvasCont; position at click point
    txtInput.style.display = 'block';
    txtInput.style.left = (e.clientX - cr.left) + 'px';
    txtInput.style.top = (e.clientY - cr.top - fontSize) + 'px';
    txtInput.style.color = ANN.color;
    txtInput.style.fontSize = fontSize + 'px';
    // Store canvas coords for drawing
    txtInput.dataset.px = String((e.clientX - r.left) * canvas.width / r.width);
    txtInput.dataset.py = String((e.clientY - r.top) * canvas.height / r.height);
    txtInput.value = '';
    setTimeout(() => txtInput.focus(), 10);
  });

  txtInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const text = txtInput.value.trim();
      if (text) {
        applyStyle();
        const fontSize = Math.max(16, ANN.lw * 5);
        ctx.font = `600 ${fontSize}px Inter, Arial, sans-serif`;
        ctx.fillText(text, parseFloat(txtInput.dataset.px), parseFloat(txtInput.dataset.py));
        commitDraw();
      }
      txtInput.style.display = 'none'; txtInput.value = '';
    }
    if (e.key === 'Escape') { txtInput.style.display = 'none'; txtInput.value = ''; }
    e.stopPropagation();
  });

  // ── Toolbar event delegation ──
  modal.addEventListener('click', e => {
    const toolBtn = e.target.closest('[data-ann-tool]');
    if (toolBtn) {
      modal.querySelectorAll('[data-ann-tool]').forEach(b => b.classList.remove('active'));
      toolBtn.classList.add('active');
      ANN.tool = toolBtn.dataset.annTool;
      canvas.style.cursor = ANN.tool === 'text' ? 'text' : 'crosshair';
      return;
    }
    const colorDot = e.target.closest('[data-ann-color]');
    if (colorDot) {
      modal.querySelectorAll('[data-ann-color]').forEach(d => d.classList.remove('active'));
      colorDot.classList.add('active');
      ANN.color = colorDot.dataset.annColor;
      if (txtInput.style.display !== 'none') txtInput.style.color = ANN.color;
      return;
    }
    const lwBtn = e.target.closest('[data-ann-lw]');
    if (lwBtn) {
      modal.querySelectorAll('[data-ann-lw]').forEach(b => b.classList.remove('active'));
      lwBtn.classList.add('active');
      ANN.lw = parseInt(lwBtn.dataset.annLw);
      return;
    }
  });

  document.getElementById('ann-undo').addEventListener('click', () => {
    if (ANN.snapshots.length > 1) { ANN.snapshots.pop(); ctx.putImageData(ANN.snapshots[ANN.snapshots.length-1], 0, 0); }
  });
  document.getElementById('ann-clear').addEventListener('click', () => {
    if (ANN.snapshots.length > 0) { ctx.putImageData(ANN.snapshots[0], 0, 0); ANN.snapshots = [ANN.snapshots[0]]; }
  });
  document.getElementById('ann-cancel').addEventListener('click', closeModal);
  document.getElementById('ann-apply').addEventListener('click', () => {
    let dataUrl;
    try { dataUrl = canvas.toDataURL('image/png'); }
    catch(err) { notify('⚠️ No se puede exportar: canvas tainted (' + err.message + ')'); return; }
    block.src = dataUrl;
    // Keep storagePath for reference; render() checks block.src first
    closeModal();
    render();
    scheduleLocalSave();
    notify('✅ Anotación aplicada');
  });

  // ── Global keyboard ──
  function _annKeydown(e) {
    if (e.key === 'Escape') {
      if (txtInput.style.display !== 'none') { txtInput.style.display = 'none'; txtInput.value = ''; }
      else closeModal();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      if (ANN.snapshots.length > 1) { ANN.snapshots.pop(); ctx.putImageData(ANN.snapshots[ANN.snapshots.length-1], 0, 0); }
      e.preventDefault();
    }
  }
  document.addEventListener('keydown', _annKeydown);
}
