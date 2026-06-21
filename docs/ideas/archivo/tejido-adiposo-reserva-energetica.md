# Tejido adiposo / la energía acumulada "ocupa lugar" — estudio de viabilidad — **RESUELTO** (2026-06-21)

**Estado: RESUELTO.** `fatWeight` (V2) queda **ON por DEFAULT 0.15** — NO como solución al atesoramiento (eso lo cubre la
SENESCENCIA, ficha [[vejez-senescencia]], promovida a default ON), sino por su valor **ecológico**: el excedente de presa rica →
carroña → subsidia al carroñero/omnívoro y **refuerza la coexistencia del cazador** (medido: fat 0.15 da MÁS carn que 0.10 en m9).
Dorado re-fijado `→ 0x2ccff67c`, gate 9/9. La pivote V-alt (coste metabólico ∝ reservas) NO se implementó: la senescencia ya acota
`E` (drena maxE 4001→~2200) y cubre además la inmortalidad. V1 (tejido adiposo evolvable, `TISSUE_N→4`) queda como posible futuro si
se quiere un eje magro↔graso HEREDABLE. Análisis completo abajo.

---
**Estado previo: SPIKE V2 PROBADO — hipótesis FALSADA para el objetivo (capar atesoramiento).**

## ⚠️ Resultado del SPIKE V2 (2026-06-21) — el penalti al movimiento NO capa la acumulación
Implementado V2 dorado-neutro: `vmax_ef = vmax / (1 + fatWeight·E/masa)`, `fatWeight` slider de lab (default 0). Gate 9/9 verde
(dorado intacto a 0 → la física a default es idéntica). Medido headless (seed 7, 8000 ticks, fatWeight 0 vs 0.15):

| fatWeight | pop | spMean | **Emean** | **maxE** |
|-----------|-----|--------|-----------|----------|
| 0 (off)   | 397 | 0.39   | 178       | 2381     |
| 0.15 (on) | 346 | 0.18   | **353**   | **2766** |

El mecanismo **muerde** (velocidad a la mitad) pero la acumulación **SUBE**, no baja. Causa = el caveat de "swim-cost menor a
baja velocidad" llevado al extremo: el herbívoro mayoritario **pasta casi quieto**, el ingreso por forrajeo NO depende de la
velocidad → ser lento no le cuesta fitness, y **moverse menos le ahorra `moveCost` → atesora MÁS**. La depredación sobre los
lentos thins la pop (397→346) pero no impide que los supervivientes engorden. → **El canal "velocidad" es la palanca equivocada
para el objetivo "la energía ocupa lugar / capar el atesoramiento".** (Confirma de paso el síntoma de [[vejez-senescencia]]:
`maxE` 2381 con `reproE` 16 = acumuladores inmortales.)

## Por qué la "vaca gorda inmóvil" NO dispara un boom de cazadores (investigación 2026-06-21)
Pregunta: si V2 deja herbívoros lentos y cargados de energía, ¿por qué no estallan los carnívoros? Medido (seed 7, flujos últimos
1000 ticks): carn **20→40**, omni **18→47** (¡el gremio SÍ crece!), pero kills **410→361** (bajan) y carroñeo **3014→5152 (+71%)**.
→ La vaca gorda alimenta al gremio depredador **como carroña, no como caza**, por tres mecanismos encadenados:
1. **Cuello de botella de la TRIPA:** por kill el cazador solo absorbe `room = Gmax − tripa`, con `Gmax ∝ su propia masa`
   ([sim.js:210](../../src/engine/sim.js) y [:245](../../src/engine/sim.js)). Presa con `E=10` o `E=353` → el cazador se lleva un
   buche igual; **la riqueza de la presa no escala su recompensa** (tiempo de manejo/saciedad). El excedente → `detritusE`.
2. **El excedente se recicla a carroña** → lo rebaña el carroñeo ([sim.js:254](../../src/engine/sim.js)) → +71% scavenged.
3. **Carroña abundante desincentiva cazar** (rebañar = sin riesgo ni carrera) → kills bajan; el gremio crece comiendo muertos.
→ Para un boom de cazador ACTIVO la palanca sería `gutPerMass`/`digestRate` (banquear presas grandes), a costa del balance
anti-bloat ([[zenote2-bloat-masscostexp]]). Ecológicamente realista: un excedente de presa fácil **subsidia descomponedores, no
superdepredadores**. Relacionado [[lean-prey-starves-predators]] (la cara opuesta: presa magra mata al cazador).

## Pivote recomendado
Para que "guardar energía cueste" de verdad y se autolimite, el coste debe ir por un canal con **realimentación negativa sobre E**:
- **Coste de mantenimiento ∝ reservas** (`cost += fatCarry·E`): `dE/dt = ingreso − base − fatCarry·E` → equilibrio ESTABLE
  `E* = (ingreso−base)/fatCarry` → **acotado por construcción** (mata la acumulación infinita sin tope duro ni RNG). Es "la grasa
  cuesta mantenerla", no "la grasa te frena" — diverge de la letra de la idea (movimiento) pero cumple su ESPÍRITU.
- o combinarlo con **senescencia** ([[vejez-senescencia]]), que ataca la inmortalidad (la otra causa de fondo).

El penalti al movimiento (V2) queda como **palanca física legítima** ("graso = lento", arquetipo tanque), dorado-neutra a 0, pero
NO como solución a la acumulación. Decisión de usuario abajo.

---
_Análisis original (pre-spike):_

**Estado original: ANALIZADA — estudio de viabilidad; pendiente de DECISIÓN de diseño.**

> Idea de usuario: *"¿la energía acumulada no ocupa lugar? Investigar si se necesita un tejido adicional adiposo: permite guardar
> energía pero penaliza el movimiento. O pensar variantes. Hacer estudio de viabilidad."*

## El hueco que señala
Hoy `E` (reservas) **no tiene tope ni coste físico** (no hay `maxE`; ver [sim.js:261](../../src/engine/sim.js)). Un adulto puede
acumular energía sin límite y sin pagar nada por llevarla encima → "energía gratis que no ocupa lugar". Es la **otra mitad** del
problema de [[vejez-senescencia]] (allí se separó *inmortalidad* de *acumulación*; esto ataca la **acumulación**, de forma
EMERGENTE en vez de por mortalidad). La intuición del usuario es buena: en biología, almacenar reservas pesa y estorba.

## Cómo está hecho hoy (lo que habilita o estorba la idea)
- **Tejidos** ([genome.js:10-20](../../src/engine/genome.js)): `TISSUE = {STRUCTURE, MUSCLE, MOUTH}`, `TISSUE_N=3`. El gen de
  tejido `[0,1]` se discretiza con `tissueOf = (t·TISSUE_N)|0`. ⚠️ **Subir a `TISSUE_N=4` reabaraja el mapeo de TODOS los genes de
  tejido existentes** (los umbrales 1/3·2/3 pasan a 1/4·2/4·3/4) → cambia la morfología de todo el mundo de golpe.
- **Fenotipo** ([phenotype.js:13-31](../../src/engine/phenotype.js)): `mass += area·massCoef`; `drag += area·dragCoef·(1−streamline·aspect)`;
  solo MUSCLE aporta empuje, solo MOUTH aporta boca; `vmax = vGain·thrust/drag`. → **una parte "grasa" (sin músculo ni boca) ya
  resta velocidad por sí sola**: suma masa (inercia) y arrastre, no suma empuje → lastre puro. La penalización al movimiento que
  pide la idea **ya existe en la física**; lo único nuevo a inventar es la *capacidad de reserva* que aporta la grasa.
- **Locomoción**: el coste de nado es `moveCost·v²`, **menor a baja velocidad** ([[swim-cost-minor-at-low-speed]]) → el lastre de
  grasa MUERDE sobre todo bajo presión de velocidad (escape/caza, [[speed-is-a-race-quantity]] + `fleeSpeed`). En régimen lento
  rinde poco: ojo, la grasa podría ser casi neutra para un herbívoro pastando quieto (riesgo de deriva, como pasó con la visión-órgano).

## Variantes
**V1 — Tejido adiposo REAL (lo literal).** `TISSUE.FAT=3`, `TISSUE_N=4`. Una parte grasa = lastre (masa+arrastre, ya gratis) +
**capacidad de reserva**: `Emax_i = baseCap + fatCap·(área grasa)`. La energía que excede `Emax` no se absorbe (queda como
detrito/calor → conserva). La inversión en grasa es un **gen bajo selección** → emerge el eje "magro y ágil" ↔ "graso y lento con
colchón".
  - ✓ máximamente emergente y fiel a la petición · ✓ la penalización al movimiento sale gratis de la física actual.
  - ✗ **caro**: `TISSUE_N→4` toca `tissueOf`, `develop`, homología/recombinación, re-anclar los genes del fundador y revisar el
    `seedBrain`; **re-fija dorado**; gate m9 a revisar. Es un refactor de cimientos morfológicos.

**V2 — Adiposidad DINÁMICA sin tejido nuevo (*recomendada para empezar*).** No se toca el genoma: la energía que llevas encima
**pesa**. `mass_efectiva = mass + E·fatWeight` en el bucle caliente → más reservas ⇒ más inercia/arrastre ⇒ menos `vmax`. El
acumulador se vuelve lento y vulnerable → la selección/conducta **autolimita el atesoramiento** sin tope duro ni mecánica nueva.
  - ✓ cambio MÍNIMO (un término en la física), sin expandir genoma, sin problema de conservación (no crea materia; solo acopla un
    coste físico a una variable de energía ya existente), sin RNG nuevo · ✓ la conducta de "cuándo guardar vs gastar" la decide el
    cerebro (emergente). · ✗ menos "tejido" literal; el eje magro↔graso no es un gen dedicado (no se hereda como rasgo morfológico).
  - Toca el bucle caliente y **re-fija dorado**.

**V3 — Solo tope de energía ∝ masa corporal.** `Emax ∝ mass`, sin penalización al moverse. Ataca solo el "infinito", no el "ocupa
lugar/pesa". El más simple y el menos interesante (no crea trade-off) → como mucho, complemento.

## Conservación / rendimiento / dorado (transversal)
- **Conservación:** la grasa-como-tejido (V1) es MATERIA (se construye de nutriente como cualquier parte, con energía embebida `eD`)
  → conserva igual que el resto. La energía almacenada sigue siendo flujo ABIERTO. El único punto delicado es el **tope**: la energía
  no absorbida por estar "lleno" debe re-enrutarse (detrito/calor), nunca desaparecer → el gate m4-m9 lo cazaría.
- **Rendimiento:** V2 = una multiplicación por agente/tick (trivial). V1 = coste de desarrollo una vez al nacer (ya se paga).
- **Dorado:** cualquier variante cambia la dinámica → **re-capturar m8** (intencionado). V1 además puede mover m9 (morfología nueva).

## Recomendación
**Empezar por V2 como SPIKE con `fatWeight` de parámetro (lab/UI).** Es el experimento barato que prueba la hipótesis central del
usuario —*¿que la energía pese autolimita el atesoramiento y crea un trade-off rico forrajear↔almacenar?*— sin pagar el refactor de
`TISSUE_N`. Medir: ¿cae el tope de reservas?, ¿aparece dispersión en "nivel de grasa" por nicho (el cazador, que vive de velocidad,
debería ir más magro)?, ¿sigue verde m9? **Si la mecánica resulta rica y la selección "quiere" controlar el eje magro↔graso →
promover a V1 (tejido adiposo evolvable)**, pagando entonces la expansión del genoma con conocimiento de causa.

Sinergia: combinada con [[vejez-senescencia]], cubre las dos mitades (acumulación = adiposo; inmortalidad = senescencia). Posible
palanca extra sobre el [[zenote2-rk-near-neutral]] r/K plano (un colchón de grasa caro es justo el tipo de coste que podría
diferenciar estrategas r de K).

## Siguiente acción
Decisión de usuario: ¿SPIKE V2 (recomendado) · ir directo a V1 (tejido real) · descartar? → implementar + re-fijar dorado + revisar m9.
