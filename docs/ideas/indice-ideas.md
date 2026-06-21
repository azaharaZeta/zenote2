# Input de Ideas de usuario — Zenote 2.0

## Cómo funciona este backlog (CICLO DE VIDA de una idea) — LEER ANTES DE EDITAR
Este fichero es **solo el backlog de ideas SIN PROCESAR**. Reglas estrictas para no ensuciarlo:

1. **El índice solo lista ideas sin procesar, en TEXTO BREVE** — una línea por idea, el enunciado y nada más:
   sin análisis, sin estado, sin histórico, sin detalle. (Todo eso vive en la ficha de la idea, no aquí.)
2. **Solo un HUMANO añade ideas en la sección "Ideas de usuario".** Claude puede sugerir en la sección de
   "Ideas propuestas por Claude" (zona de staging para que el humano las suba; no es el backlog real).
3. **Cuando una idea EMPIEZA a procesarse** (se analiza / se le da ficha): se **QUITA de este índice** y se crea su
   fichero propio `<idea>.md` en **esta misma carpeta** (`docs/Zenote 2.0/ideas/`). El análisis, el estado y el
   histórico van en ESE fichero, nunca aquí.
4. **Cuando una idea se TERMINA (implementada) o se DESCARTA**: se actualiza su fichero con el estado final y se
   **MUEVE a `archivo/`** (subcarpeta de esta misma ruta).
5. **Al archivar, los temas pendientes que deja la idea** (su "siguiente acción"):
   - si son **simples / sin analizar** → se añaden como idea(s) BREVE(s) en este índice (para procesar luego);
   - si ya están **analizados / son complejos** → van directamente a su propio fichero `<idea>.md` (NO al índice).
6. **Corolario:** una idea que YA tiene fichero (en esta carpeta o en `archivo/`) **NO aparece en este índice**.
   Si la ves listada aquí y ya tiene fichero, es un error de mantenimiento → quítala.

---

## Ideas de usuario (pendientes de procesar)
> Solo un humano edita esta sección. Texto breve; el detalle se desarrolla al crear la ficha.
- _(vacío — las pendientes se procesaron a fichas en `docs/ideas/`)_

## Ideas propuestas por Claude (staging — el humano las sube arriba si las acepta)
Emergencia / realismo:
- Día/noche activable como slider (ya existe `dayNightAmp`, a 0) → ritmos de actividad, ventaja por acumular reservas.
- Spike: ONTOGENIA real (crías que crecen escalando el FENOTIPO + madurez + vulnerabilidad juvenil). Hipótesis falsable: ¿desatasca el r/K near-neutral? Ver `archivo/crias-juveniles-crecimiento.md` (la opción A, solo-render, ya está hecha).

Técnico / robustez:
- Validar rendimiento en MÓVIL REAL con la población al tope (el toggle de calidad alta/media/baja YA existe → `archivo/modo-calidad-grafica-lod.md`; falta medir fps en un móvil de verdad, no en el preview que throttlea rAF).
