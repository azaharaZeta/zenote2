# Bug: los ojos parpadean entre dos zonas ("dos cabezas") — **RESUELTO** (2026-06-21)

> Idea de usuario: «a veces alterna dibujar el set de ojos en dos zonas distintas de un mismo organismo, como que cambia de
> opinión constantemente. Ocurre en organismos que parece que tienen dos cabezas. El parpadeo persiste hasta con el mundo en
> pausa. No me importaría que la solución fuera dibujarlos en todas las cabezas, si es algo acotado.»

## Causa (sutil, de coma flotante)
Los ojos se anclan al **nodo más adelantado** ("cabeza"). Ese nodo se elegía con el `argmax` de `dx·chh + dy·shh` (la proyección
de la posición del nodo **en pantalla** sobre el rumbo). Esa proyección es, en aritmética real, EXACTAMENTE `lx·sc` (la coord
local "adelante" × escala): la ondulación `uy` (∝ `sin(t)`) se **cancela** al proyectar sobre el rumbo.

Pero en **coma flotante** la cancelación NO es exacta: deja un residuo sub-ULP (~9e-16) que **depende de `t`**. En cuerpos
bilaterales con dos lóbulos frontales del MISMO `lx` ("dos cabezas") eso es un **empate exacto**, y ese epsilon —cuyo signo
ALTERNA con `t`— rompía el empate hacia un lóbulo u otro frame a frame → los ojos **parpadeaban** entre ambos. Persistía en pausa
porque `t` es el tiempo de **render** (`performance.now`), no el de la simulación.

Medido (micro-test headless, 2 lóbulos simétricos, t∈[0,20)): el criterio viejo alterna el ganador **456 veces**; el nuevo, **0**.

## Fix
Puntuar la cabeza por la coord local **`lx`** (constante en el tiempo), no por la proyección en pantalla:
`const hs = lx * sc + (tissue === MOUTH ? pr : 0);` — `main.js` `drawOrgs`. El empate por simetría se rompe de forma
DETERMINISTA y estable (orden de iteración fijo) → cabeza fija → sin parpadeo. El nodo ganador conserva su `px/py` ondulado, así
que la cabeza sigue meneándose viva. No hizo falta «dibujar en todas las cabezas».

## Alcance / verificación
Render PURO (no toca la simulación) → **dorado intacto**. Verificado en vivo (preview): los ojos ya no saltan, ni en pausa.
