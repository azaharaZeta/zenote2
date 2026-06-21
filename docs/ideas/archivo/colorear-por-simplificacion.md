# Simplificar "Colorear por" — un solo "Natural" con slider de nivel de tejido — **HECHO** (2026-06-21)

> Idea de usuario: dejar por defecto "Natural + Tejido" llamándolo solo **"Natural"**, con un **slider de "nivel de coloreado de
> tejido"** (antes hardcodeado); eliminar "Natural (aspecto real)" y "Tejido + Aura"; renombrar "Oficio + aura real" → "Oficio".

## Implementado
- **Selector de 4 modos:** **Natural · Tejido · Oficio · Linaje**. Se fusionaron "Natural (aspecto real)" y "Natural + tejido"
  (`natmix`) en un único **"Natural"**. (Las etiquetas "+ aura real" ya se habían quitado al eliminar el aura.)
- **Slider "Nivel de tejido" (0..1)** = `RENDER_P.tissueMix` (default 0.5; UI junto al selector, **visible solo en modo Natural**):
  en Natural tiñe el cuerpo con el color de su función (TCOL por tejido) sobre el pigmento de linaje, con `alpha = nivel · 0.5`.
  - **0** = pigmento de linaje puro (= el antiguo "Natural (aspecto real)").
  - **1** = tinte de tejido fuerte (más que el antiguo `natmix` fijo de 0.32).
- Render PURO (`tissueMix` es variable de cliente, NO va al worker) → **dorado intacto**.

## Verificado (preview)
Selector con 4 opciones (sin `natmix`); slider presente, **visible solo en Natural** (oculto en Tejido/Oficio/Linaje); tinte 0 =
pigmento puro, 100% = matices de función visibles (ámbar en bocas, cálidos en músculo). Sin errores de consola.

## Archivos
`src/config.js` (`tissueMix`) · `index.html` (selector reducido + slider `#tissueMix`/`#tissueMixCtrl`) · `src/main.js`
(init, listener, leyenda, `drawTissueTint`).

## Refinamiento (2026-06-21, posterior)
A petición del usuario:
- **Modo "Tejido" eliminado** del selector (queda **Natural · Oficio · Linaje**). El coloreado por tejido se obtiene ahora con el
  slider en Natural a tope.
- Slider renombrado **"Resaltar tipo tejido"** y reconvertido en un **crossfade 0→1**: 0 = solo color natural, **1 = solo tejido**
  (antes era un tinte sutil con tope α≈0.5). El tinte usa `alpha = nivel · desvanecido-por-energía`.
- **El GLOW conserva SIEMPRE el color natural** (linaje), nunca el del tejido: el tinte ya NO se pinta dentro de `drawOrgs`
  (que va a `glowCv`, fuente del bloom), sino en una pasada aparte **`drawTissueTint`** que se aplica a `glowCv` **DESPUÉS** de
  capturar el bloom y antes de volcar los cuerpos nítidos. Así el bloom toma la versión natural y el cuerpo nítido muestra el tejido.
- Dead code retirado: rama `colorMode==='tissue'` y `TCOL_HSL` (sin uso). Verificado en preview: cuerpo «solo tejido» con glow cian natural.
