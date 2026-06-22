# El organismo del inspector, en movimiento (como en el mundo) — **HECHO** (2026-06-22)

**Estado: IMPLEMENTADA.** Render puro → sin dorado.

## Implementado
`drawInspOrganism` ([main.js](../../src/main.js)) ahora ondula como en el mundo: cada nodo añade
`uy = ly + swim·sin(t·5 + lx·0.16 + hue·6.28)` (misma onda viajera transversal que `drawOrgs`), con `t = performance.now()/1000`
y `swim = 0.6` (0 si cadáver → inmóvil). Aplicada igual en el bucle de contorno y en el de nodos → cuerpo y nodos se menean juntos;
los ojos siguen a la cabeza ondulada. **Encuadre estable:** el bounding box se calcula con la geometría base + margen `swim` en Y →
reserva sitio para el meneo, no recorta ni salta. Ya se redibujaba por frame (`updateInspector` en `draw`), así que anima solo.
- Verificado en preview: organismo seleccionado, retrato dibujado (~6966 px) y la silueta CAMBIA entre frames (anima), área estable.

---
_Análisis original abajo._

**Estado original: ANALIZADA — lista para implementar (render puro → sin dorado).**

> Idea de usuario: *"Mete el movimiento del organismo en la vista de preview"* (el retrato del inspector, hoy estático).

## Estado hoy
`drawInspOrganism` ([main.js:429](../../src/main.js)) dibuja el organismo seleccionado **estático**: el comentario lo dice —
"Estático (sin ondulación ni heading: mira a +x)" ([main.js:426](../../src/main.js)). En el MUNDO, en cambio, los cuerpos ondulan:
`uy = ly + (0.35 + spd·RENDER_P.undulation)·sin(t·5 + lx·0.16 + ph)` (`drawOrgs` [main.js:305/315](../../src/main.js)) — meneo
de nado animado por el tiempo de render `t`.

## Fix
Aplicar la MISMA ondulación temporal a los nodos del retrato (reusar el término `uy` con `t`), y redibujar el retrato cada frame
(no solo al cambiar de selección) para que se anime. Como el retrato no tiene heading real, basta la ondulación + quizá un balanceo
suave; mantenerlo mirando a +x.
- **Encolado estable:** la ondulación desplaza los nodos → recalcular el bounding box CADA frame haría "saltar" el encuadre. Fijar
  el centrado/escala con la geometría base (sin ondular) y aplicar la ondulación solo al dibujar → el bicho menea dentro de un marco quieto.
- **Cadáver congelado:** si `dead`, sin ondulación (como ahora) → el cadáver queda inmóvil.
- **Coste:** un canvas pequeño redibujado por frame; trivial. Verificar que el inspector ya redibuja por rAF (si no, engancharlo al loop).
- **Dorado intacto:** render puro; la geometría llega de `detail.bodyParts` (write-only), no toca la sim.

## Alcance
`src/main.js` (`drawInspOrganism`: ondulación + redibujo por frame; centrado con geometría base). Sin worker, sin dorado.

## Siguiente acción
Animar el retrato con la ondulación de nado, encuadre estable, cadáver inmóvil.
