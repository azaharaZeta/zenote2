# Modo de calidad gráfica (alta / media / baja) con LOD — **HECHO** (2026-06-21)

> Idea (staging de Claude, aceptada en sesión): un selector de calidad gráfica en la UI, aplicado con ajustes de LOD, para que
> corra fluido en móvil/equipos lentos sin sacrificar el aspecto en equipos capaces.

## Qué se hizo
Preset único `QUALITY` en `config.js` (fuente única), elegido por `RENDER_P.quality` y leído por `main.js`. Selector
**"Calidad gráfica"** en el panel (`index.html`, junto a FPS). Cambia **en vivo** (`setQuality`): reaplica resolución (vía
`resize`), bloom y densidad de atmósfera. Es render PURO → no toca la simulación ni el dorado.

Cada nivel ajusta:
- **dprCap** (resolución de render): alta 2 · media 1.5 · baja 1.
- **bloom** (factor del glow; 0 lo apaga junto con plancton/nieve): alta/media 1 · **baja 0**.
- **atmos** (densidad de plancton/nieve): alta 1 · media 0.5 · baja 0.
- **LOD** (umbral en px a partir del cual un nodo recibe el detalle): silueta (`lodSil`) · volumen-gradiente (`lodVol`, el más
  caro) · costillas (`lodRib`) · ojos (`lodEye`). En **baja** el volumen y las costillas se desactivan del todo (`1e9`) y las
  siluetas solo se trazan de cerca → todo plano y barato.

Default = **alta** (no cambia la experiencia de quien no toque el selector).

## Verificación
Sintaxis OK; **dorado intacto** (`config.js` está en la cadena del motor, sigue byte-idéntico). En vivo (preview): el selector
funciona, alta = todo el detalle, baja = plano sin glow ni atmósfera y a media resolución (canvas 1528→764 px confirmado).

## Pendiente (no bloqueante)
Medir fps en un **móvil real** con la población al tope — el preview throttlea `requestAnimationFrame` en segundo plano, así que
ahí no se puede medir. Queda anotado en `indice-ideas.md` (staging técnico).
