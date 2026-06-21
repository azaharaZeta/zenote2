# Slider de "Diversidad inicial" — qué diversificar y la viabilidad

**Estado: PROCESADA (analizada; pendiente de decisión de producto + implementación).** 2026-06-21.

> Idea de usuario: el slider "Diversidad inicial" (0..1) debe ir de "todos idénticos" (0) a "diferencias amplias" (1), creciendo
> de forma gradual por organismo. Analizar qué parámetros necesitan un mínimo de viabilidad (fijos o con algo de random) vs los
> libres (color = random total). Proponer alternativa.

## Estado actual (`src/engine/genome.js`)
`div` (= `START.diversity`) escala el ruido de SOLO tres cosas, mezclándolas hacia un valor neutro:
- `makeFounder`: `dv(x) = 0.5 + (x-0.5)·div` aplicado a `phase` (raíz + módulo, cosmético = fase de la ondulación) y `hue` (color de linaje, neutro).
- `makeBrain`/`seedBrain`: ruido de pesos `(rng()-0.5)·0.4·div`; la **estructura de relés del seedBrain es fija**.

**La MORFOLOGÍA del fundador es CONSTANTE** — `div` no la toca: root (size 0.42, aspect 0.4, tissue 0.8 = boca, oscAmp 0.1) + 1
módulo (par de aletas MUSCLE) son fijos; tampoco varían r/K (reproK 1, investFrac 0.4375). Conclusión: hoy `div` solo diversifica
**color + fase de gait + cerebro**. A `div=0` todos son clones byte-idénticos; a `div=1` tienen la MISMA forma, distinto color/fase/cerebro.
No hay riesgo de inviabilidad porque la forma (boca + músculo) está garantizada por construcción.

## El problema que plantea la idea
Si se quiere diversidad **real** creciente (tamaños/formas/dietas distintas desde t=0), hay que perturbar también los genes
morfológicos — y ahí aparece la **viabilidad**: un fundador random podría nacer sin boca (no come → muere), sin músculo (no se
mueve) o todo STRUCTURE. Por eso la idea pide distinguir genes con "suelo de viabilidad" de los libres.

## Propuesta
Clasificar los genes y que `div` los perturbe con ruido gaussiano ∝ div, con clamps donde haga falta:
- **Libres (random total):** `hue` (color), `phase`, pesos del cerebro. (Ya cubiertos.)
- **Con suelo de viabilidad (clamp a zona viable):** tejido de la raíz → garantizar BOCA (`root.tissue ∈ [0.67,1]`); conservar ≥1 módulo MUSCLE (locomoción).
- **Perturbables sin garantía dura (la selección filtra desde t=0):** `size`, `aspect`, `oscAmp`, `taper`, ángulos, `reproK`, `investFrac`, módulos extra. A más `div`, más ruido. Algunos morirán → es selección desde el inicio (deseable, no bug).

**Alternativa más barata:** dejar `div` como está (cosmético) y NO prometer diversidad morfológica inicial — la forma diverge igual
por mutación en pocas generaciones. Decisión de producto: ¿diversidad VISIBLE desde t=0 (vale el coste + re-capturar dorado) o emergente?

## Riesgo / coste
Perturbar más genes cambia el consumo de RNG → **re-captura del dorado** (cambio de física intencionado). Mantener documentado el orden de consumo.

## Siguiente acción
Decidir producto (¿diversidad morfológica inicial sí/no?). Si sí: implementar perturbación gaussiana ∝ div con clamps de viabilidad en `makeFounder` + re-capturar dorado.
