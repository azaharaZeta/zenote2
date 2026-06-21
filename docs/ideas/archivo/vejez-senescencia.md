# Vejez / senescencia — mortalidad intrínseca (criaturas inmortales que acumulan energía) — **HECHO** (2026-06-21)

**Estado: IMPLEMENTADA — opción B (senescencia metabólica) como palanca de lab `senesce`, default 0 (off → dorado intacto, gate 9/9).**

## Implementado (opción B)
- `SIM_P.senesce` (default **0** = apagado, criaturas inmortales, dinámica idéntica → dorado intacto). Coste metabólico extra ∝ EDAD:
  en [sim.js:262](../../src/engine/sim.js) `cost += P.senesce · age` → los viejos gastan más → mueren por la vía de **inanición ya
  existente** (`E ≤ 1e-6` → cuerpo a detrito, [sim.js:264](../../src/engine/sim.js)) → **conserva gratis** + drena a los acumuladores.
- Slider de lab **"Senescencia (vejez)"** (grupo Metabolismo y cría), rango 0–0.00015 (display ×1e5 → 0–15), cableado genérico.
- Gate **9/9 verde** (dorado `0x55828375` intacto a senesce=0).

## Medido (seed 7, 15000 ticks) — la vejez muerde y capa el atesoramiento
| senesce (display) | pop | carn | edad media | edad máx | Emean | maxE |
|---|---|---|---|---|---|---|
| 0 (off) | 421 | 22 | 2963 | 13501 | 377 | 4001 |
| 5e-5 (**5.0**) | 304 | 22 | 1757 | 13315 | **168** | **2078** |
| 1e-4 (10.0) | 311 | 10 | 1148 | 7630 | 112 | 1375 |
| 2e-4 (20.0) | 119 | **0** | 1192 | 3688 | 164 | 670 |
| 4e-4 (40.0) | **0** | — | — | — | — | — |

→ A **~5.0** la vejez ya muerde (edad media −40%, atesoramiento `Emean`/`maxE` a la mitad) **sin tocar al carnívoro** (22). A 10
recambio más fuerte pero el ápice se adelgaza (10). **≥20 colapsa** (cazador extinto → pop crash) — la sensibilidad del ápice a la
mortalidad extra, como se predijo. **Rango útil 0–~15.**

## PROMOVIDO A DEFAULT ON (2026-06-21, decisión de usuario)
`senesce` pasó de off a **DEFAULT 5e-5** (junto con `fatWeight`=0.15, ver tejido-adiposo). Re-fijado el dorado `0x55828375 →
0x2ccff67c`; m5-saturation `CAP 250→150` (la capacidad de carga bajó a ~210). m9 verde (pop 207-217 · carn 9-21 · drift~0). Cubre la
**inmortalidad** (vida finita + recambio) y drena la **acumulación** (maxE 4001→~2200). Gate 9/9.

---
_Análisis original abajo._

**Estado original: ANALIZADA — pendiente de DECISIÓN de diseño + implementación.**

> Idea de usuario: *"Analizar implementar Vejez. Tenemos ahora mismo criaturas inmortales, que acumulan energía al infinito."*

## El síntoma, con precisión
La muerte hoy es **solo EXTRÍNSECA**: depredación (`sim.js:245`) o inanición cuando `E ≤ 1e-6` (`sim.js:261`). Un adulto
que no es comido y mantiene energía positiva **vive para siempre**, y sus reservas pueden crecer sin tope (no hay `maxE`).
El único sumidero de energía aparte del metabolismo es **reproducirse**.

**Matiz que AGRAVÓ el síntoma:** con `reproMode='sexual'` por DEFAULT (sin respaldo asexual, ver memoria del default sexual /
[[sexual-repro-flattens-size]]), un adulto **sin pareja compatible no se reproduce nunca** → nunca drena energía en crías →
se vuelve un acumulador inmortal. El cambio reciente hizo el fenómeno más visible.

## ¿Es un problema o es el modelo?
Son dos cosas distintas:
1. **Inmortalidad** → sin recambio generacional intrínseco. En pecera cerrada/saturada, los slots los ocupan veteranos
   establecidos y un fundador afortunado puede dominar indefinidamente. Sin coste por envejecer, "vivir despacio" no penaliza
   → es justo lo que mantiene PLANO el eje r/K ([[zenote2-rk-near-neutral]]).
2. **Acumulación de energía** → la energía es un flujo ABIERTO (luz→calor), no materia, así que un acumulador **NO rompe la
   conservación** (el gate sigue verde). Es un tema estético/ecológico, no de corrección.

→ **Hipótesis FALSABLE (lo jugoso):** una **esperanza de vida EVOLVABLE** podría **desatascar el r/K near-neutral** — si vivir
mucho cuesta, emerge el trade-off "vivir rápido y morir joven" (r) vs "vivir despacio" (K) con presión REAL. Es adyacente al
spike ONTOGENIA (B) en staging del índice.

## Estado del código (lo relevante)
- `this.age[i]` **YA existe** y se incrementa cada tick (`sim.js:278`). Hoy es **WRITE-ONLY**: solo lo lee el render (crías que
  crecen). Que la DINÁMICA lo lea = cambio intencionado → **re-fijar el dorado** (m8).
- La muerte **ya enruta** materia→detrito y energía→detrito/calor (`_recordCorpse` + `detritusM/detritusE`, `sim.js:245/261`).
  Una muerte por vejez **reutiliza ese camino → conserva gratis**.

## Opciones de diseño
- **A) Hazard de senescencia (muerte por azar creciente).** `p_muerte/tick` sube con la edad (Gompertz/lineal tras la madurez).
  Muerte "dura" (tirada de dado). + control directo de la esperanza de vida · − menos emergente (dado, no energético) + un RNG
  por agente/tick.
- **B) Senescencia METABÓLICA — *recomendada*.** El `baseCost` efectivo sube con la edad (p.ej. `×(1 + age/τ)`) → el viejo
  gasta más → muere por la vía de **INANICIÓN ya existente** cuando no compensa. + muerte EMERGENTE (vía energía, no dado),
  reutiliza el camino de inanición y la conservación, **sin RNG nuevo, sin tope de energía**; ataca a la vez la inmortalidad
  Y la acumulación (el acumulador parado se va drenando con la edad). − la esperanza de vida es indirecta (emerge de τ × economía).
- **C) Tope de energía / fuga ∝ reservas.** Ataca SOLO la acumulación, no la inmortalidad. Complemento, no "vejez".

**Gen vs parámetro.** Máxima emergencia = `τ`/`lifespan` como **gen evolvable** (entra en genome + mutate + recombine + fundador) →
la selección busca el punto r/K. Riesgo: ampliar el genoma toca homología/recombinación (ver #4 homología en
[[zenote2-animals-only-vegetation]]). Vía conservadora: `τ` primero como **parámetro de lab (UI, palanca viva)**, medir, y
promover a gen si la hipótesis r/K se sostiene.

## Recomendación
Empezar por **B con `τ` como parámetro de lab (UI)**: senescencia metabólica = una línea en el coste basal que lee `age`, más un
slider "Senescencia / esperanza de vida". Es el cambio MÍNIMO que (1) mata la inmortalidad, (2) drena a los acumuladores,
(3) conserva por construcción, (4) no amplía el genoma. Medir en m9 si rompe la coexistencia (el cazador, ápice fino, es el más
sensible a mortalidad extra → floor `carn` ya en 6) y re-calibrar. Si la hipótesis r/K pica → promover `τ` a gen evolvable como
SPIKE (cierra junto al spike ONTOGENIA B).

## Alcance / riesgos
- **Dorado:** cambia (intencionado) → re-capturar m8.
- **m9 ecología:** vigilar que la mortalidad extra no extinga al cazador; posible re-calibración del floor.
- **Conservación:** intacta SI la muerte por vejez usa el camino de detrito existente (no inventar sumidero nuevo).
- **Frontera render↔dinámica:** `age` deja de ser write-only (ahora lo lee la dinámica) → documentar y comentar la frontera.

## Siguiente acción
Decisión de usuario: ¿**B** (metabólica, recomendada) · A (hazard) · gen vs slider? → implementar + re-fijar dorado + revisar m9.
