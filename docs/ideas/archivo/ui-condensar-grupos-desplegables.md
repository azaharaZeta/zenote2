# Condensar la UI y agrupar por contextos desplegables — **HECHO** (2026-06-21)

**Estado: IMPLEMENTADA (agrupado propuesto).** Render/UI puro → sin dorado, gate no afectado.

## Implementado
Los controles sueltos se envolvieron en 3 desplegables nuevos (`<details class="lab">`, reusan el marco existente). Panel final:
**Mundo nuevo · Simulación · Vista · Métricas · Laboratorio** (+ HUD fijo arriba, hint abajo).
- **Simulación** (cerrado): Velocidad (play/tps/max) · FPS.
- **Vista** (ABIERTO por defecto): Calidad gráfica · Zoom · Colorear por · Resaltar tipo tejido · leyenda.
- **Métricas** (cerrado): Población · Nacimientos · Muertes · Talla media · Histograma.
- `src/main.js` sin cambios de lógica (los ids no cambiaron; nada dependía del orden del DOM).
- Verificado en preview: 5 `<summary>` en orden, "Vista" abierta, **0 controles sueltos** fuera de desplegables, app viva.

---
_Análisis original abajo._

**Estado original: ANALIZADA — pendiente de aprobar el agrupado (render/UI puro, sin dorado).**

> Idea de usuario: *"condensar el ui un poco, y agrupar por contextos desplegables."*

## Estado hoy
El panel tiene 2 desplegables ("Mundo nuevo", "Laboratorio · leyes en vivo") PERO la mayoría de controles cuelgan **sueltos
entre medias** (`index.html:46-122`): Velocidad, FPS, Calidad, Zoom, Colorear por, Resaltar tejido, leyenda, y 5 gráficas
(población · nacimientos · muertes · talla media · histograma). Panel largo, sobre todo en móvil. (El marco visual de los
`<details>` ya se hizo: [[archivo/marco-zonas-desplegables-ui]].)

## Agrupado propuesto (de arriba a abajo)
- **HUD** (readout) — fijo arriba, fuera de desplegables.
- **▸ Mundo nuevo** (ya existe · `↻ al reiniciar`).
- **▸ Simulación** — Velocidad (play/tps/max) · FPS. *(control del "tiempo")*
- **▸ Vista** — Calidad gráfica · Zoom · Colorear por · Resaltar tipo tejido · leyenda. *(lo visual)*
- **▸ Métricas** — Población · Nacimientos · Muertes · Talla media · Histograma. *(las 5 gráficas; pesado → cerrado por defecto)*
- **▸ Laboratorio · leyes en vivo** (ya existe).
- hint abajo.

**Estado inicial sugerido:** "Vista" abierto (control del día a día); el resto cerrado → panel corto al arrancar. En móvil ayuda mucho.

## Alcance
- `index.html`: envolver los bloques sueltos en `<details class="lab">` con su `<summary>`; reordenar.
- `styles.css`: reutilizar `.lab` (marco ya hecho); ajustar si hace falta.
- `src/main.js`: **sin cambios de lógica** (los ids no cambian); solo verificar que nada dependa del ORDEN del DOM.
- Sin dorado (UI pura).

## Decisión abierta
Confirmar agrupado/nombres y qué secciones abren por defecto.

## Siguiente acción
Implementar el agrupado propuesto tras visto bueno.
