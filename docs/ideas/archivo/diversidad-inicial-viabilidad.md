# Slider de "Diversidad inicial" — qué diversificar y la viabilidad — **HECHO** (2026-06-21)

> Idea de usuario: el slider "Diversidad inicial" (0..1) debe ir de "todos idénticos" (0) a "diferencias amplias" (1), creciendo
> de forma gradual por organismo. Analizar qué parámetros necesitan un mínimo de viabilidad vs los libres. Proponer alternativa.

## Diagnóstico (estado previo)
`div` solo escalaba el ruido de **color (hue) + fase de gait + cerebro**; la **morfología del fundador era CONSTANTE** (root y
módulo hardcodeados) y r/K fijos. Es decir: a `div=1` los fundadores tenían la MISMA forma, solo cambiaban de tono/fase/cerebro.
No había diversidad de forma/talla/estrategia desde t=0 (sí emergía luego por mutación).

## Implementado
`makeFounder(rng, div)` ahora perturba con un helper `jig` (ruido gaussiano acotado **∝ div**) los genes morfológicos CONTINUOS
+ r/K, manteniendo un **suelo de viabilidad**:
- **Libres / perturbados ∝ div:** `root.size/aspect/oscAmp`, `module.angle/size/aspect/oscAmp/taper`, `reproK`, `investFrac` (+ hue/phase/cerebro, ya antes).
- **FIJOS (suelo de viabilidad):** los TEJIDOS — raíz = BOCA, módulo = MÚSCULO (con oscilación mínima) → todo fundador puede
  **comer y moverse** aunque su forma/talla/r-K varíen.
- **Estructura mayor** (más módulos, recursión, ramas) NO se siembra: sigue EMERGIENDO por mutación.
- **Determinismo:** `jig` y `dv` consumen el MISMO RNG sea cual sea `div`; a **div=0** la perturbación es 0 → **fundadores
  byte-idénticos (clones)**, stream consistente. A div=1, diversos.

## Decisión de producto (resuelta)
Se optó por **diversidad morfológica VISIBLE desde t=0** (la otra opción era dejarla solo emergente). Coste asumido: re-captura
del dorado (cambio de génesis intencionado).

## Verificado
- Headless: div=0 → fundadores idénticos ✓ · div=1 → distintos ✓ (p.ej. root.size 0.42 vs 0.34, reproK 1.39 vs 1.09).
- **Gate 9/9 verde** con fundadores diversos (m9: coexistencia intacta, cazador 37-41, conservación ~0.0017%, sin bloat).
- **Dorado re-fijado** `0xe8984a53 → 0x4bcdaeaa` (`test/m8-determinism.mjs`).
- En vivo (preview, div=1): población inicial con tallas/formas/colores variados.

## Archivos
`src/engine/genome.js` (`makeFounder` con `jig`) · `test/m8-determinism.mjs` (dorado) · `docs/MODELO-ACTUAL.md` (nota de diversidad + dorado).

## Refinamiento del COLOR (2026-06-21, posterior)
Síntoma: a div=0 el color era SIEMPRE teal (la `hue` salía de `dv(rng.next())` → 0.5 fijo). El usuario quería un color de
arranque ALEATORIO pero el MISMO a div=0. Fix:
- Un **tono base por mundo** (`baseHue`) se saca en `sim.seed()` de un **RNG APARTE derivado de la semilla** (`makeRng(seed ^
  0x9e3779b9)`), NO del rng dinámico → la `hue` es render-only y **el dorado NO se mueve** (sigue `0x4bcdaeaa`).
- `makeFounder` recibe `baseHue` y calcula `hue = (baseHue + (rng()-0.5)·div + 1) % 1`: a **div=0** todos = `baseHue` (mismo color
  aleatorio, reproducible por semilla); a **div=1** se dispersa por todo el círculo (variedad amplia).
- Verificado headless: div=0 seed1 → 68°, seed2 → 187° (aleatorio por mundo, reproducible); div=1 span 0.97. Dorado intacto.
- ⚠️ Bug pillado y corregido en el camino: `this.seed = seed` en el constructor SOMBREABA el método `seed()` → renombrado a `this.rngSeed`.

## Posible extensión (no hecha)
Diversidad ESTRUCTURAL inicial (sembrar fundadores con nº de módulos/recursión variable) — más dramática pero con más riesgo de
viabilidad; hoy se deja emerger por mutación.
