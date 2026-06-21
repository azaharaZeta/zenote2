# Ventana del inspector — dibujar el organismo, seguir siempre, congelar el cadáver — **HECHO** (2026-06-21)

> Idea de usuario: (1) dibujar el organismo dentro de la ventana del inspector; (2) seguir SIEMPRE con la cámara (eliminar el
> botón "seguir cámara"); (3) si el organismo muere, dejar fijo el dibujo de su cadáver hasta cerrar el visor o cambiar de organismo.

## Implementado
1. **Retrato RICO en la tarjeta** (`<canvas id="inspCanvas">` + `drawInspOrganism` en `main.js`): el organismo con el MISMO aspecto
   que en el mundo — **contorno + silueta bézier + sombreado VOLUMÉTRICO + costillas (segmentación) + ojos**; estático (sin
   ondulación ni heading, mira a +x), centrado y escalado a su bounding box. **Respeta el MODO de color activo** (Natural + «resaltar
   tipo tejido» al MISMO % que el mundo · Oficio = color por dieta vía `d.role` · Linaje); iris de ojo SIEMPRE de linaje. La geometría
   llega del worker en `detail.bodyParts` (stride 6: lx,ly,r,aspect,dir,tissue) — write-only. (Cadáver: dibujo apagado de linaje, sin ojos.)
2. **Seguir al seleccionar, sin botón:** `pickAt` pone `following=true`; el botón `#inspFollow` se eliminó. Panear cancela el follow
   pero MANTIENE la selección y el retrato (el organismo se sigue viendo en la tarjeta). UX elegida: opción B (la recomendada en el análisis).
3. **Congelar el cadáver:** al morir el seleccionado (`detail` pasa a null), se dibuja `drawInspOrganism(lastDetail, true)` (último
   cuerpo vivo cacheado, tono apagado) y se mantiene hasta cerrar/cambiar. `lastDetail` se cachea en cada frame vivo.

## Alcance / verificación
Render/UI puro + `detail.bodyParts` write-only (se construye en `snapshot`, no en `step`) → **dorado intacto por construcción**.
Verificado en preview (con worker fresco): retrato dibujado (5804 px, silueta de linaje, 3 partes), follow activo, stats correctos.
⚠️ El worker del preview se servía CACHEADO (módulo aparte del page); hizo falta un cache-buster temporal en su URL para verlo
(revertido). En navegador real, Cmd+Shift+R recarga el worker fresco.

## Archivos
`src/engine/worker.js` (`detail.bodyParts`) · `index.html` (`#inspCanvas`, sin botón "seguir cámara") · `src/main.js`
(`drawInspOrganism`, auto-follow en `pickAt`, congelado del cadáver) · `styles.css` (`.insp-canvas`).
