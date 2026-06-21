# Zenote 2 — simulador de evolución emergente

## Qué es esto
Aplicación web autocontenida (HTML/CSS/JS vanilla, sin backend ni build) que simula un ecosistema artificial donde la
**morfología y la conducta de los organismos EMERGEN de la evolución** (herencia + mutación + selección), no de reglas
escritas a mano. Propósito contemplativo: ver patrones emerger y fascinarse. El motor corre en un Web Worker; se publica
como estáticos (Vercel / GitHub Pages / cualquier hosting).

## Documentos de referencia (LÉELOS ANTES DE PROGRAMAR)
- `docs/MODELO-ACTUAL.md` — **fuente de verdad del modelo VIVO** (solo animales + vegetación parametrizada; sin
  fotosíntesis en el genoma; energía luz→vegetación→animal→calor; materia cerrada). **Empieza aquí.**
- `src/config.js` — **fuente única** de TODOS los parámetros (defaults + rangos de genes), agrupados como la UI y
  marcados *(UI)* / NO-UI. Cambiar un valor aquí cambia el comportamiento.
- `docs/02-Redesign/` (2.1–2.6) — rediseño desde primeros principios: leyes del mundo · cuerpo/desarrollo ·
  fisiología/conducta · bucle evolutivo. Reglas exactas de genética / energética / rendimiento.
- `docs/01-Assessment/` — auditoría del enfoque anterior + análisis de emergencia (el porqué del rediseño).
- **Ideas (backlog):** `docs/ideas/`. **Ciclo de vida ESTRICTO** (reglas completas al inicio de `docs/ideas/indice-ideas.md`
  — LÉELAS antes de tocar ideas): el índice solo lista ideas SIN PROCESAR en texto breve; al **empezar a procesar** una idea
  se saca del índice y se le crea ficha propia `<idea>.md`; al **terminar/descartar** se mueve a `docs/ideas/archivo/`. Una
  idea con ficha NUNCA está en el índice.

## Reglas innegociables
1. **Emergencia real.** Ninguna estrategia ("cazar", "huir", "pastar") está codificada como if/else fijo: la conducta sale
   del cerebro neuronal (pesos = genes) bajo selección y la morfología del genoma de desarrollo. El programador define la
   FÍSICA del mundo y la expresión de los genes; nunca qué genes son "buenos". (Excepción consciente y medida: `seedBrain`
   da pesos de PARTIDA competentes — bootstrap, no estrategia fija; la conducta sigue evolucionando desde ahí.)
2. **Conservación.** Materia cerrada (nutriente↔vegetación↔organismo↔detrito) + energía abierta (luz→…→calor) son el alma
   del modelo. Toda transacción re-enruta materia (conserva) y contabiliza energía (disipa). El gate lo verifica (m4–m9).
3. **Determinismo.** Mismo seed → misma corrida. Hay **checksum DORADO** (`test/m8-determinism.mjs`): cualquier cambio NO
   intencionado de la dinámica lo rompe. Si cambias la física a propósito, re-captura el dorado. Los datos que el sim escribe
   SOLO para el render deben ser **write-only** (no leídos por la dinámica) para no tocar el dorado.
4. **Rendimiento.** Miles de agentes a ritmo interactivo: spatial hashing (nada de O(n²)), typed arrays (SoA), Canvas 2D,
   sin asignaciones en el bucle caliente, motor desacoplado del render (Web Worker).
5. **Belleza y fluidez (responsive).** Fondo abisal oscuro, color = linaje, movimiento orgánico, UI discreta y ocultable.
   Debe verse y usarse en MÓVIL: la adaptación vive solo en render/UI (escalado del canvas, táctil); el mundo lógico NO
   cambia con el tamaño de pantalla.
6. **Configurable en vivo.** Los parámetros marcados *(UI)* en `config.js` son sliders que afectan la simulación en tiempo real.
7. **Sin dependencias pesadas.** Vanilla JS (ES modules). Debe publicarse subiendo estáticos (sin build obligatorio).

## Pila técnica y estructura
- HTML + CSS + JavaScript vanilla (ES modules), Canvas 2D. Sin framework ni bundler.
- `src/engine/` = motor (world · genome · phenotype · sim · hash · worker) — independiente del render, corre headless en Node.
- `src/main.js` = cliente de render + cámara + UI (lee "fotos" del worker, no toca la sim).
- `src/config.js` = parámetros (fuente única). `test/` = gate de correctitud. `spikes/` = exploraciones (a mano).

## Cómo correr y validar
- **Servir:** `npm run serve` (= `python3 -m http.server 8732`) → http://localhost:8732. (O cualquier servidor de estáticos.)
- **Tests (gate):** `npm test` (= `node test/run-all.mjs`). Debe quedar **TODO VERDE (9/9)** antes de dar por bueno un cambio:
  invariantes de conservación, el dorado de determinismo y la regresión ecológica (coexistencia trófica + anti-bloat).
- Comenta el código en la frontera genotipo→física (lo que define el programador vs lo que evoluciona) para que sea auditable.
