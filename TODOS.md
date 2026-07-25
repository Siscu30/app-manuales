# TODOs

## Autosave solo cubre el modo activo (Manuales/Tablas), no ambos a la vez

**What:** El intervalo de `startAutoSave()` usa `if (appMode==='tablas') {...} else if (...)` — si el usuario deja un Manual sin guardar, cambia a modo Tablas y también deja una tabla sin guardar, cada tick de 60s solo sincroniza el módulo actualmente visible. El otro documento no se sube a la nube hasta que el usuario vuelva a ese modo o guarde a mano.

**Why:** Hallazgo del review adversarial del PR de persistencia de Tablas Interactivas (2026-07-25). El usuario decidió explícitamente NO arreglarlo en ese PR ("dejarlo como if/else-if") — se documenta aquí como comportamiento conocido y aceptado, no como descuido.

**Pros:** Separar en dos `if` independientes cerraría el hueco por completo (~2 min de trabajo).

**Cons:** Ninguno técnico significativo — es una decisión de alcance, no de dificultad.

**Context:** `STATE.manual`/`STATE.blocks` y `STATE.tablaInteractiva` son claves de STATE independientes; `switchAppMode()` no fuerza guardar ni descartar al cambiar de modo, así que ambos documentos pueden quedar dirty simultáneamente.

**Depends on / blocked by:** Ninguna.

---

## Guard de rol visualizador es fail-open para STATE.role === null

**What:** Tanto el guard de `guardarTablaInteractiva()` (`STATE.role === 'visualizador'`) como el nuevo guard del autosave (`STATE.role !== 'visualizador'`) dejan pasar `role === null`. Existe una ventana breve en `handleSession()` donde `STATE.user` ya está asignado pero `STATE.role` aún no (antes de que resuelva `await loadUserRole(...)`).

**Why:** Hallazgo del review adversarial. El mismo patrón fail-open ya existe en Manuales (`guardar()`), no es nuevo — pero vale la pena una revisión conjunta ya que la protección real debe venir de las políticas RLS de Supabase en `tablas_interactivas`/`manuales`, no del guard de cliente (defensa en profundidad, no el límite real).

**Pros:** Cerrarlo (`STATE.role === 'admin' || STATE.role === 'editor'` en vez de `!== 'visualizador'`) sería más seguro por defecto.

**Cons:** Cambio de postura de seguridad más amplio que afecta ambos módulos — requiere confirmar primero que las políticas RLS realmente bloquean escrituras de `visualizador`, ya que no hay archivos de política en el repo para verificarlo.

**Context:** `STATE.role` puede ser `'admin' | 'editor' | 'visualizador' | null`. Verificar RLS vía Supabase Management API antes de decidir si cerrar el guard de cliente.

**Depends on / blocked by:** Confirmar postura de RLS en Supabase primero.

---

## Reintento único de guardado puede duplicar una fila sin concurrencia real

**What:** El patrón "reintento único" (`let ok = await guardarX(); if (!ok) ok = await guardarX();`) usado tanto en Manuales como en el nuevo autosave de Tablas puede reinsertar en vez de reintentar si el primer intento SÍ se guardó en el servidor pero el cliente vio un error de red transitorio antes de procesar la respuesta.

**Why:** Hallazgo del review adversarial. Inherente al patrón ya existente en Manuales, no introducido por el PR de persistencia de Tablas — pero ese PR duplica la superficie donde puede ocurrir.

**Pros:** Una solución real (UUID generado en cliente + `upsert` sobre ese id) sería idempotente y cerraría el problema de raíz para ambos módulos.

**Cons:** Rediseño de mayor alcance que el guard de mutex ya aplicado — toca el esquema de guardado de ambos módulos, no un parche rápido.

**Context:** Con el guard `_tiSaving` ya añadido (PR de persistencia de Tablas, 2026-07-25) el escenario de doble-clic queda cerrado; este TODO cubre específicamente el caso de fallo de red transitorio sin concurrencia real.

**Depends on / blocked by:** Ninguna, pero es un rediseño no trivial.

---

## Ocultar #ti-canvas-wrap para el rol visualizador

**What:** Extender `applyRoleUI()` (app.js:4037-4059) para ocultar/deshabilitar `#ti-canvas-wrap` igual que ya hace con `#canvas-wrap`/`#sidebar` cuando `role==='visualizador'`.

**Why:** Causa raíz de que un visualizador pueda ensuciar (`isDirty=true`) una tabla interactiva hoy — `#ti-canvas-wrap` nunca se oculta ni deshabilita para ese rol, a diferencia del canvas de Manuales. El fix de persistencia (PR de 2026-07-25) añade un guard `STATE.role !== 'visualizador'` en la rama de autosave de Tablas que mitiga el síntoma (evita reintentos de escritura no autorizada cada 60s), pero no cierra la causa: un visualizador todavía puede editar celdas visualmente sin que se guarde nada.

**Pros:** Cierra el problema de raíz en vez de solo mitigar el síntoma; coherencia total con cómo Manuales ya trata este rol.

**Cons:** Toca el shell de Tablas Interactivas, que quedó explícitamente fuera de alcance de la iteración de auditoría/fix de 2026-07-25 por decisión del usuario ("no tocar el shell ya unificado").

**Context:** Descubierto durante el review de arquitectura del fix de persistencia. `applyRoleUI()` es la función que centraliza toda la lógica de visibilidad por rol; añadir Tablas ahí es la extensión natural, mirror del patrón ya usado para `#canvas-wrap`.

**Depends on / blocked by:** Ninguna dependencia técnica — solo pendiente de que se autorice tocar el shell de Tablas en una futura iteración.

---

## Guard explícito de rol visualizador en el autosave de Manuales

**What:** Añadir `STATE.role !== 'visualizador'` como condición explícita en la rama de Manuales dentro de `startAutoSave()` (app.js:1948-1957), en vez de confiar solo en el guard interno de `guardar()`.

**Why:** El fix de persistencia de Tablas Interactivas (2026-07-25) añade un guard explícito equivalente en la rama nueva de Tablas del mismo `startAutoSave()`. Sin este cambio, las dos ramas del mismo intervalo quedan con el mismo tipo de protección implementada de forma inconsistente (una explícita, otra implícita vía el guard interno de `guardar()`).

**Pros:** Consistencia de código entre ambas ramas del mismo `setInterval`.

**Cons:** Valor práctico bajo — el escenario es prácticamente inalcanzable en Manuales hoy, porque `#canvas-wrap`/`#sidebar` SÍ se ocultan correctamente para el rol visualizador (a diferencia de Tablas).

**Context:** Descubierto durante el review de arquitectura del fix de persistencia de Tablas, al comparar el patrón nuevo con el existente en Manuales.

**Depends on / blocked by:** Ninguna.
