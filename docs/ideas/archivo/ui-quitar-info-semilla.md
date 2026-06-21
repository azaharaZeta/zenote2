# Quitar del UI la info de semilla (sin alterar funcionalidad) — **HECHO** (2026-06-21)

**Estado: IMPLEMENTADA (interpretación 2: fila Semilla entera fuera).** Render/UI puro → sin dorado, gate no afectado.

## Implementado
- `index.html`: eliminada la fila **Semilla** completa (input `#seed` + readout `#seedVal`) del desplegable "Mundo nuevo".
- `src/main.js`: quitado el cableado — el readout `#seedVal` en `onmessage('world')` y la lectura de `$('seed')` en `resetWorld()`,
  que ahora postea **siempre `seed: null`** (el worker elige una semilla aleatoria; la corrida sigue siendo determinista internamente).
- Verificado en preview: `#seed`/`#seedVal` ya no existen, **Reiniciar no lanza error** (si corriera el main.js viejo con
  `$('seed').value` habría petado al faltar el elemento), sin referencias colgando (`grep` limpio). Funcionalidad intacta.

---
_Análisis original abajo._

**Estado original: ANALIZADA — lista para implementar (render/UI puro, sin dorado).**

> Idea de usuario: *"quitar del ui la info de semilla (sin alterar funcionalidad)."*

## Qué es hoy
En el desplegable "Mundo nuevo" (`index.html:40-43`): fila **Semilla** con un `<input id="seed">` (teclear una semilla para
reproducir un mundo) + `<output id="seedVal">` que tras *Reiniciar* MUESTRA la semilla usada (para copiarla). El determinismo
"misma semilla → mismo mundo" vive bajo el capó (la sim siempre corre con una semilla; aleatoria si no se pasa).

## Dos interpretaciones
1. **Quitar solo el READOUT** (`#seedVal`, la semilla mostrada tras reiniciar) — se mantiene el input para fijar semilla.
2. **Quitar toda la fila Semilla** (input + readout) — la semilla pasa a ser SIEMPRE aleatoria e invisible; se pierde teclear
   una semilla y copiar la usada.

→ **Recomiendo (2):** encaja con "quitar la info de semilla", deja la UI más limpia/contemplativa, y la **funcionalidad no
cambia** (cada corrida sigue siendo determinista por su semilla aleatoria; solo deja de exponerse).

## Alcance
- `index.html`: borrar la fila Semilla (líneas ~40-43).
- `src/main.js`: quitar el cableado de `#seed` (lectura al reiniciar) y `#seedVal` (escritura del readout tras el reset). El
  worker sigue recibiendo semilla (aleatoria si no se pasa) → **sin cambio de funcionalidad**. Verificar que no quede acceso a
  elementos borrados (null) que rompa el arranque.
- Sin dorado (UI pura; el gate no cubre la UI).

## Siguiente acción
Implementar interpretación (2) salvo que el usuario prefiera (1).
