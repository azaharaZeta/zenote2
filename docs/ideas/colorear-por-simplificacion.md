# Simplificar "Colorear por" — un solo "Natural" con slider de nivel de tejido

**Estado: PROCESADA (parte HECHA en 2026-06-21; resto pendiente de implementar).** 

> Idea de usuario: dejar por defecto "Natural + Tejido" llamándolo solo **"Natural"**, con un **slider de "nivel de coloreado de
> tejido"** (hoy hardcodeado); eliminar "Natural (aspecto real)" y "Tejido + Aura"; renombrar "Oficio + aura real" → "Oficio".

## Ya hecho (consecuencia de quitar el aura, sesión 2026-06-21)
Al eliminar la pasada de aura, las etiquetas dejaron de tener "aura": **"Tejido + aura real" → "Tejido"** y **"Oficio + aura real"
→ "Oficio"** (en `index.html`), y la leyenda se actualizó. Esos modos ya son señal pura (sin halo de linaje).

## Estado actual (`src/main.js` + `index.html`)
5 modos en el selector: `natural` (pigmento de linaje puro) · `natmix` ("Natural + tejido": pigmento + overlay de tejido a
**α hardcodeado 0.32** en `drawOrgs`) · `tissue` · `role` · `lineage`.

## Pendiente (lo que falta de la idea)
- **Fusionar `natural` + `natmix` en un único "Natural"** con un **slider "nivel de tejido" (0..1)** que reemplace el `0.32` fijo:
  - slider = 0 → pigmento de linaje puro (= el actual `natural`).
  - slider > 0 → tinte de tejido creciente (= `natmix` con α variable).
  Así "Natural (aspecto real)" desaparece (es Natural con slider a 0) → se cumple "eliminar Natural (aspecto real)".
- **Selector final (4 modos):** **Natural** (con slider de tejido) · Tejido · Oficio · Linaje.

## Implementación (boceto)
- Añadir el slider a la UI (visible/relevante solo en modo Natural); su valor es una variable de render (NO `RENDER_P` ni worker → render puro).
- En `drawOrgs`, el overlay de `natMix` usa ese valor en vez de `0.32`; el modo `natural` = ese mismo camino con valor 0.
- Quitar la opción `natural` del `<select>` (o mapearla a "Natural" con slider por defecto). Render puro → **dorado intacto**.

## Siguiente acción
Implementar la fusión "Natural + slider de tejido" (cambio de UI acotado, render puro).
