# Cobertura vegetal = refugio de presa (Tier 3 de la veg de zenote1)

**Estado: PROBADA como spike (2026-06-22) — estabilizador ecológico SÍ, motor de divergencia NO. Default 0 (off, dorado intacto).**

## Resultado del spike (2026-06-22)
Implementada como `SIM_P.coverStrength` (default 0 → no consume RNG → dorado `0x2ccff67c` intacto): en la captura, `prob_escape =
coverStrength · veg_local/K` ([sim.js](../../src/engine/sim.js), bloque de depredación). Barrido seeds 1-3, 15k ticks:
- **coverStrength 0.6:** pop ~212→250 (la presa se protege), el cazador aguanta/sube (carn 20/32/14) → **estabilizador Lotka-Volterra,
  como predijo la ficha.** ✓
- **PERO no diversifica:** "veg bajo los herbívoros" (0.041) se queda POR DEBAJO de la media global (0.055) y NO sube con la cobertura
  → los herbívoros **no se refugian más** en lo denso; y la dispersión de talla (`sdMass`) BAJA (1.36→1.09), no sube.
- **Causa (aprendizaje):** en zenote2 **el refugio ES el alimento** (la misma veg). La presa que entra en lo denso se lo COME y
  destruye su cobertura → no hay nicho estable "escóndete" separable de "come" → sin eje separable, sin divergencia. (seed3 a 0.3
  además se desestabiliza: pop 124/carn 4 → no monótono.)

→ Queda como **palanca de lab opcional** (estabilizador), no como vía a la complejidad. Para divergencia, ver el roadmap
[[organismos-mas-fascinantes-complejidad]]: los nichos deben ser SEPARABLES (refugio NO comestible, o recurso separado en el espacio).

---
_Análisis original abajo._ Parte del [análisis de adaptación de la vegetación de zenote1](archivo/vegetacion-de-zenote1-adaptar.md)
(§E / Tier 3). Tier 1 (parches migrantes + visual teal) y Tier 2 (reserva de rebrote + forrajeo por área∝talla) ya están hechos.

## Idea
La **vegetación viva da COBERTURA a la presa**: un animal cazado escapa al depredador con probabilidad ∝ vegetación local
(`prob_escape = coverStrength · veg_local`). Es un **estabilizador Lotka-Volterra** (como en zenote1): donde hay pasto denso,
la presa se esconde → amortigua el ciclo depredador-presa, protege la base herbívora, reduce los colapsos al ápice-carnívoro.

## Por qué encaja con zenote2
- Es una regla **FÍSICA de captura** (la espesura reduce la probabilidad de captura), NO un gen "esconderse" ni una estrategia
  cableada → respeta la emergencia (la conducta sigue saliendo del cerebro; esto solo modula la física de la depredación).
- Conserva (solo cambia SI la captura ocurre, no el balance materia/energía).
- Da a la vegetación un **segundo rol ecológico** (comida + refugio) → más profundidad.

## Implementación (boceto)
En el bloque de depredación de `sim.js`, al confirmar contacto con la presa: `if (rng.next() < coverStrength · W.veg[preyCell]/vegRef) → la presa ESCAPA` (no se captura este intento). Param `coverStrength` (SIM_P, UI «Cobertura del refugio»). Normalizar veg por una referencia (veg típico) para que `coverStrength·vegFrac ∈ [0,1]`.

## Riesgo a medir
Que la cobertura no AHOGUE a los carnívoros (si toda la presa escapa en zonas frondosas, los cazadores se extinguen). Medir
multi-seed la fracción carnívora y la pop con `coverStrength` ∈ {0, 0.3, 0.6}. zenote1 usaba ~0.65 con éxito, pero la economía
de zenote2 es distinta → calibrar.
