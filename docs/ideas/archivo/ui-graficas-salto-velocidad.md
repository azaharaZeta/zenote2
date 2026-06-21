# Gráficas que pegan un salto al cambiar la velocidad — **HECHO** (2026-06-22)

**Estado: IMPLEMENTADA.** Render/worker, datos write-only → dorado `0x2ccff67c` intacto.

## Implementado
El muestreo del historial se sacó de `snapshot()` (1 push/frame → ventana variable) y se metió en el bucle de pasos: nueva función
`sampleHist()` + helper `stepSim()` que la llama cuando `sim.tick % HIST_EVERY === 0` ([worker.js](../../src/engine/worker.js)).
Los 3 sitios que avanzaban la sim (`do{stepSim()}` en máx · `while(acc>=1) stepSim()` normal · `burst` de depuración) usan ahora
`stepSim()`. Así **cada muestra cubre exactamente 60 ticks** sea cual sea la velocidad/fps → las series de tasa (nacimientos/muertes)
ya no saltan al cambiar de tps. Se quitó la acumulación `nHerb/nCarn/massSum*` de `snapshot` (ahora vive en `sampleHist`) y el `lastHist`.
- Verificado en preview: barrido tps 30→600→60→300→60 sin errores de consola, HUD vivo, gráficas pintando; `node --check` OK; dorado intacto.
- Coste: `sampleHist` es O(cap) cada 60 ticks (a máx, varias veces/frame; <1% del frame). Datos write-only → no toca la dinámica.

---
_Análisis original abajo._

**Estado original: ANALIZADA — lista para implementar (render/worker, datos write-only → dorado intacto).**

> Idea de usuario: *"Arreglar gráficas para que se ajusten a la velocidad. Ahora al cambiar la velocidad del juego, las gráficas
> dan un salto raro."*

## Causa (diagnóstico)
El historial de las gráficas se muestrea por TICKS en el worker (`HIST_EVERY=60`, [worker.js:22](../../src/engine/worker.js)) pero
el push ocurre dentro de `snapshot()`, gated por `s.tick - lastHist >= HIST_EVERY` ([worker.js:97](../../src/engine/worker.js)) →
**como mucho UNA muestra por frame**. El bucle del worker, en cambio, ejecuta un LOTE de `sim.step()` por frame ([worker.js:143-152](../../src/engine/worker.js)):
a tps bajo pasan <60 ticks/frame, a tps alto pasan 200-300+ ticks/frame. Resultado:
- Las series ABSOLUTAS (población, talla media) aguantan (eje Y = valor, no tasa) → poco afectadas.
- Las series de TASA (**nacimientos/muertes por ventana** = `s.kills - lastKills` etc., [worker.js:99](../../src/engine/worker.js)) se
  calculan sobre la ventana real transcurrida, que NO es fija: 60 ticks a velocidad baja, 300 a velocidad alta → al subir la velocidad
  cada barra cuenta MÁS eventos → **salto** de altura. Y la cadencia real en pantalla cambia → la curva parece "acelerar/saltar".

## Fix
Muestrear el historial en **fronteras de 60 ticks fijas**, no una vez por frame: sacar el push de `snapshot()` y hacerlo en el
LOTE de pasos del worker (un sample cada vez que `s.tick` cruza un múltiplo de `HIST_EVERY`, p.ej. acumulando y emitiendo en bucle).
Así **cada muestra cubre exactamente 60 ticks** de eventos, independientemente de la velocidad → sin saltos. Los contadores de tasa
(`lastKills`…) se leen en cada frontera → ventana constante.
- A velocidad muy alta saldrían varias muestras por frame (barato: solo push a arrays acotados); el render sigue leyendo el array.
- **Dorado intacto:** los historiales son datos de DISPLAY (write-only, no los lee `step()`); cambiar CUÁNDO se muestrean no toca la dinámica.

## Alcance
`src/engine/worker.js` (mover el muestreo de `snapshot()` al bucle de `step`); `src/main.js` sin cambios (sigue leyendo `frame.hist*`).

## Siguiente acción
Implementar el muestreo por frontera fija de 60 ticks.
