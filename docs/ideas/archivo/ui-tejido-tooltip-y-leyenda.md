# "Resaltar tipo tejido": tooltip demasiado largo + falta la leyenda de color — **HECHO** (2026-06-22)

**Estado: IMPLEMENTADA.** Render/UI puro → sin dorado.

## Implementado
1. **Tooltip acortado** a una línea (de ~240 a 106 chars) en el slider `#tissueMix` ([index.html](../../index.html)).
2. **Leyenda de tejido:** `buildLegend()` ([main.js](../../src/main.js)) en modo Natural añade, cuando `tissueMix > 0`, los 3 swatches
   *estructura · músculo · boca* con sus colores reales de `TCOL` (fuente única); desaparecen a 0. La leyenda se reconstruye también
   al mover el slider (engancha `buildLegend()` en el handler de `#tissueMix`).
- Verificado en preview: con realce>0 la leyenda = "color = linaje … estructura · músculo · boca"; a 0% solo "color = linaje"; tooltip 106 chars.

---
_Análisis original abajo._

**Estado original: ANALIZADA — lista para implementar (render/UI puro → sin dorado).**

> Idea de usuario: *"Arreglar el texto informativo de 'Resaltar tipo de tejido'. Es demasiado largo, y no se ve la leyenda de
> color por tipo de tejido."*

## Estado hoy
- El slider "Resaltar tipo tejido" ([index.html](../../index.html), grupo Vista) tiene un `title` MUY largo (explica natural↔tejido,
  glow, etc.) → tooltip incómodo.
- Cuando en modo **Natural** se sube el slider, los cuerpos se tiñen por FUNCIÓN con `TCOL = ['#5a6b7a' estructura, '#e0664d'
  músculo, '#e0a84a' boca]` ([main.js:74](../../src/main.js), `drawTissueTint` [main.js:389](../../src/main.js)) — pero **no hay
  leyenda** que diga qué es cada color → el usuario ve colores sin clave. La leyenda actual (`buildLegend`, [main.js:644](../../src/main.js))
  es la de oficio/linaje, no la de tejido.

## Fix
1. **Acortar el `title`** del slider a una línea (p.ej. "Resalta el tipo de tejido —estructura/músculo/boca— sobre el color natural").
2. **Leyenda de tejido:** mostrar 3 muestras de color (TCOL) con etiqueta *estructura · músculo · boca* cuando el modo es Natural y
   `tissueMix > 0` (integrar en `buildLegend`/`#legend`, o un mini-bloque junto al slider). Reusa `TCOL` (fuente única del color).

## Alcance
`index.html` (title), `src/main.js` (`buildLegend` añade la leyenda de tejido; mostrar/ocultar con el modo y el slider), `styles.css`
si hace falta una fila de swatches. Sin dorado (UI pura).

## Siguiente acción
Acortar el tooltip + añadir la leyenda de los 3 tejidos (estructura/músculo/boca) con sus colores.
