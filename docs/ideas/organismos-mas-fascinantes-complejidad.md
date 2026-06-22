# Organismos más fascinantes — formas y conductas más complejas (estrategia)

**Estado: ANALIZADA — ROADMAP / estrategia; pendiente de DECISIÓN de rumbo.** (No es un cambio; es la palanca más grande del proyecto.)

> Idea de usuario (volcado libre, "cógelas con pinzas"): que las FORMAS y CONDUCTAS que emergen sean más complejas y fascinantes —
> distintos tipos de **movimiento**, de **ataque**, **partes del cuerpo**, **formas**, **apéndices/patas/garras**, **comportamientos**.

## Regla que NO se negocia (por qué esto es delicado)
Emergencia real (CLAUDE.md #1): nada de estrategias cableadas. El programador define la FÍSICA del mundo y la EXPRESIÓN de los genes;
NUNCA qué genes son buenos. "Patas/garras/emboscada" no se programan como conductas: deben **emerger** de paleta + selección. El
`seedBrain` solo da pesos de PARTIDA competentes (bootstrap), no estrategia. → Cualquier cosa de aquí se mide con un test falsable
("¿emergió un nicho/forma/estrategia nueva?"), no se da por buena porque "se ve chulo".

## Diagnóstico honesto: por qué HOY son simples
La fascinación está bloqueada por DOS puertas (y dos moduladores). Hoy faltan ambas:

**1. Puerta de EXPRESIVIDAD (la paleta es pequeña).** Lo que un genoma PUEDE llegar a ser hoy:
- **Tejidos = 3** (`STRUCTURE·MUSCLE·MOUTH`, [genome.js:10](../../src/engine/genome.js)). No existen apéndices, garras, órganos sensoriales,
  defensas… como cosas expresables. No hay "de qué" diversificar.
- **Locomoción = 1 modo.** El músculo da un escalar `thrust`; `vmax = vGain·thrust/drag` ([phenotype.js:30](../../src/engine/phenotype.js)).
  El cerebro elige dirección+gas. No hay marchas (dardo/planeo/reptado): un solo régimen continuo. (`oscAmp/phase` por módulo existen
  pero solo los usa el RENDER para ondular, no la dinámica → la propulsión no depende de la geometría.)
- **Ataque = 1 canal.** "Abrir boca" ([sim.js:212](../../src/engine/sim.js)) pasta/caza/carroñea; la ingesta por kill está capada por la
  TRIPA ([[rich-prey-subsidizes-scavengers]]). No hay garra/veneno/emboscada como mecanismos distintos.
- **Cerebro I/O acotado:** 10 entradas (∇veg, dir presa, dir amenaza, hambre, propia velocidad, ∇detrito) y 4 salidas (dirección×2,
  gas, abrir-boca) ([sim.js:191-212](../../src/engine/sim.js)). La conducta no puede ser más rica que lo que puede SENTIR y HACER:
  no siente congéneres (→ no hay cardumen/territorio como tal), no tiene posturas/exhibición, no elige modo de ataque.

  *Lo que SÍ existe ya* (y está infrautilizado): la **gramática de desarrollo** es razonable —módulos con simetría bilateral, recursión
  en cadena, taper, ángulo de emisión, add/duplicate/delete y homología tipo Hox ([genome.js:112-163](../../src/engine/genome.js)).
  Puede generar formas variadas; el problema no es solo la gramática, es que **no hay presión que premie usarla**.

**2. Puerta de PAYOFF (no hay nichos que paguen la complejidad).** El mundo es una pradera de vegetación casi uniforme + depredación →
un único eje de recurso. El ganador es el **generalista pequeño** (de ahí el [[zenote2-rk-near-neutral]] r/K plano y las batallas de
colapso de talla). Sin nichos distintos, la complejidad no se amortiza → **deriva** o se poda. Es exactamente la lección
[[vision-organo-neutra-sin-coste]]: añadir un órgano SIN payoff → neutro (deriva); CON coste y sin payoff → todos lo pierden.

**Modulador A — valles de fitness:** una FORMA compleja vive en un valle; las formas intermedias son menos aptas → no se cruza sola.
Hay que **SEMBRAR la proto-forma** viable ([[morphology-valley-needs-seeding]]).
**Modulador B — ESCALA:** una radiación real (muchas formas/estrategias coexistiendo) probablemente necesita MÁS agentes / mundo más
grande que la pecera contemplativa ([[pecera-pequena-contemplativa-scope]], y la lección de escala de [[vision-organo-neutra-sin-coste]]).

> **Tesis:** Fascinación = PALETA × PAYOFF × CAMINO-VIABLE × ESCALA. Mover una sola puerta no basta (paleta sin payoff → deriva; payoff
> sin paleta → nada nuevo donde diversificar). El orden importa: **primero crear payoff, luego ampliar paleta, sembrando, y midiendo.**

## Mapeo de las "ideas locas" → mecanismo EMERGENTE posible · coste/riesgo
- **Formas / apéndices / partes.** Enriquecer un poco la gramática (recursión RAMIFICADA y ángulo a lo largo de la cadena → frondas/extremidades;
  varios niveles) + **dar payoff a la forma** (elongado vs compacto forrajean/escapan distinto) + **sembrar** proto-formas (gusano, multi-apéndice).
  Coste: cambios en develop/mutate/recombine + homología coherente + **re-fija dorado**.
- **Tipos de movimiento (marchas).** Que la propulsión EMERJA de la geometría: apéndices oscilantes (usar `oscAmp/phase` ya existentes en la
  DINÁMICA, no solo el render) + anisotropía de arrastre (planea vs aletea) + músculo rápido/lento con tradeoff energético → dardo (escape) vs
  crucero (forrajeo). La presión de escape (`fleeSpeed`) ya premia el burst. Coste: reescritura de la física de locomoción + dorado + cuidado de NO cablear marchas.
- **Tipos de ataque (garra/veneno/emboscada).** Tejido "arma" con coste que sube el manejo de presa (atacar presa mayor / romper algo el tope de
  tripa) · veneno = daño en el tiempo (hunter pequeño tumba presa grande) · emboscada = quieto+golpe (lo habilitaría el sistema de marchas). Crea
  ESTRATEGIAS de depredador distintas — pero el nicho cazador es fino ([[pecera-pequena-contemplativa-scope]]): primero necesita masa crítica (payoff/energía).
- **Comportamientos (cardumen, emboscada, acopio, exhibición).** Emergen del cerebro → hay que ampliar I/O: **sentidos** (densidad/dirección de
  congéneres → gregarismo/territorio; cobertura → esconderse) y **actuadores** (elegir modo de ataque, postura). Más I/O = cerebro mayor = más que
  evolucionar (más lento, necesita payoff y quizá escala). Emergencia intacta si añades CANALES, no if/else.

## Ejes de palanca (transversales)
- **(A) ENTORNO heterogéneo = payoff** *(lo más barato y emergente, casi listo):* sustratos/cobertura, varios recursos, gradientes (luz/profundidad),
  día/noche. Crea "varias maneras de ganarse la vida" → el genoma+cerebro ACTUALES ya diversifican sin tocar la paleta. Fichas relacionadas:
  [cobertura-vegetal-refugio](cobertura-vegetal-refugio.md), [vegetacion-con-genetica](vegetacion-con-genetica.md), día/noche (staging del índice).
- **(B) PALETA expresiva costeada:** marchas por geometría · tejido-arma · sentidos/actuadores nuevos. Cada uno = SPIKE con test de emergencia + m9 + dorado.
- **(C) SEMBRAR proto-formas** para cruzar valles ([[morphology-valley-needs-seeding]]).
- **(D) ESCALA** (más agentes / mundo mayor / quizá GPU) si la radiación lo pide.

## Recomendación
NO meter patas+garras+marchas+veneno a la vez (enorme, machaca el dorado, arriesga la emergencia y SIN nichos derivaría). Secuencia:
1. **Empezar por (A): heterogeneidad de entorno** — el multiplicador de fascinación más barato y de mayor emergencia. **Hipótesis falsable:**
   ¿con varios "modos de vida" el genoma+cerebro de HOY ya producen morfos/conductas divergentes (sin tocar la paleta)? Spike: añadir cobertura/refugio
   (ficha ya escrita) o un 2º recurso, y medir divergencia morfológica/dieta. Barato, reversible, alto valor visual.
2. Si (1) da divergencia pero topa en la paleta → **un (B) cada vez**, sembrado y costeado. Yo elegiría **MARCHAS por geometría** primero (lo más
   "fascinante" a la vista y engancha con `oscAmp/phase` ya presentes).
3. Sembrar proto-formas en paralelo a (B). Vigilar escala: si la pecera no da masa crítica, plantear un "modo macro".

## Riesgos / alcance
Dorado (cada paso intencionado lo re-fija) · m9 (no romper coexistencia) · **emergencia** (definir física/expresión, jamás estrategias) · rendimiento
(I/O de cerebro y partes ↑ coste; typed arrays, sin O(n²)) · **escala/alcance** (radiación rica quizá excede la pecera contemplativa — decisión de producto).

## Bitácora
**Rumbo elegido (2026-06-22): (A) entorno/nichos primero.**

**Spike A.1 — cobertura = refugio ([[cobertura-vegetal-refugio]]):** implementada `coverStrength` (default 0, dorado intacto). Resultado:
estabiliza la ecología (pop ↑, cazador aguanta) **pero NO diversifica** — la "veg bajo herbívoros" no sube y la dispersión de talla baja.
**Aprendizaje clave:** en zenote2 *el refugio ES el alimento* (misma veg) → la presa se come su propia cobertura → el nicho NO es
SEPARABLE → sin separabilidad, sin divergencia. **Corolario para todo (A): los nichos deben ser SEPARABLES** ("dónde me escondo/como/crío"
en sitios distintos), si no, el entorno solo cambia el equilibrio, no la diversidad.

**Spike A.2 — refugio NO comestible (HECHO, 2026-06-22):** campo `cover` ESTÁTICO separado del alimento + **sensor de cerebro nuevo
∇cover** (entradas 10,11 → `BRAIN.I` 10→12, sin sembrar = neutro) + escape `∝ coverStrength·cover_local` (campo smoothstep, default
**0.25** — el campo suave protege más, bajado de 0.5 para que el cazador coexista). Dorado re-fijado `→ 0xb6dce579`; gate 9/9;
conserva (drift~0); coexistencia OK (m9 carn 10/14/27). **Render:** la cobertura se pinta como parches de espesura oscura (verde-oliva,
blur toroidal render-only). **Resultado: separabilidad FUNCIONA
pero modesto** — la dispersión de talla (sdMass) **sube en las 3 semillas** (vs A.1 que la bajaba) = primera señal positiva de
divergencia; el refugiarse es débil (2/3 semillas: herbívoros en cobertura > media). Efecto modesto porque el refugio solo importa
con depredador cerca y el cazador es minoría (pecera pequeña). **Conclusión:** la regla "nichos separables" se confirma; un solo eje
da poco → la fascinación pedirá VARIOS ejes separables + paleta (B) + quizá escala.

## Diagnóstico de HOMOGENEIDAD (2026-06-22, feedback de usuario: "aun en 3000×3000 todo se ve homogéneo — prado verde parejo, organismos mezclados, sin dinámicas")
Medido (mundo 3000, 8k ticks): **VEG cv=0.50 (mean 0.76) · LUZ cv=0.25 · COVER cv=1.61 · dispersión de organismos var/mean=5.09**
(sí se agrupan 5×, solo 2/144 macro-celdas vacías). → El problema NO es que los bichos no se agrupen (lo hacen); es que el ESCENARIO
es plano. Tres causas que aplanan:
1. **La luz casi no llega a extremos** (suma de lóbulos ≈ campana centrada en 0) → productividad real cv 0.25 pese a lightContrast=0.7
   → sin oasis/desiertos marcados.
2. **El pastoreo recorta la veg a una alfombra fina uniforme** (veg media 0.76 « K≈10) → el mapa rico/pobre de K se BORRA → prado parejo.
3. **El render comprime** el poco contraste que queda → "apenas variación de color".
**Implicación:** la diversidad morfológica/conductual no se VERÁ mientras el escenario sea uniforme. Hay que hacer un **PAISAJE**:
regiones lush/desiertas ESTABLES (que el pastoreo no borre), que migren (lightFlow) y que el render muestre. Esto antecede a la paleta (B).

**Plan "mundo como paisaje" (B0 — habilita todo lo demás):**
- **Render (barato, ya):** ensanchar el mapeo de color de la veg (rico = verde bioluminiscente brillante · ralo = abismo oscuro) → que el contraste EXISTENTE se vea. + la cobertura ya pintada.
- **Geografía estable (dinámica, re-fija dorado):** que las zonas ricas NO se borren por pastoreo — subir contraste EFECTIVO de la luz (curva que lleve el ruido a extremos, no solo lightContrast) y/o que el rebrote en zonas ricas supere al pastoreo (grazeRefuge↑ / grazeRate↓) → oasis lush persistentes vs desiertos pelados.
- **Dinámica visible:** con oasis estables + lightFlow, las regiones MIGRAN → los organismos las siguen = migración/frentes emergentes. Medir: ¿sube veg cv?, ¿sube la dispersión/“vacíos”?, ¿se ven frentes?

**B0-render HECHO (2026-06-22, render puro, sin dorado):** `bakeVeg` ahora (1) **estira el contraste por el propio relieve** del campo
(z = exceso sobre la media / desv., con guard) en vez de un ref fijo → revela regiones ricas/pobres; (2) **blur toroidal ligero** (2
pasadas) → quita la cuadrícula de las celdas pastadas. Resultado visible: el mundo es una nebulosa con relieve y aparece un **CLARO
PASTADO** (oscuro) donde se concentra el grupo, rodeado de veg lush → la dinámica de pastoreo, antes invisible, ahora se VE. La cobertura
también se pinta (parches de espesura oscura). Pendiente la parte de DINÁMICA de B0 (geografía estable que no se borre + migración).

**B0-ruido HECHO (2026-06-22):** los campos de LUZ (productividad/pasto) y COVER pasaron de pocos lóbulos lisos ("lámpara de lava") a
**RUIDO FRACTAL (fBm multi-octava)** → zonas irregulares naturales. La luz deriva (estructura grande fluye, detalle fino casi fijo);
el cover queda fractal estático. Re-fija dorado `→ 0x65f6795f`, gate 9/9 (coexistencia OK). Paleta del fondo parametrizada en hex en
`config.js` (abyss/pasto/refugio). **Pendiente (pedido de usuario):** deriva INDEPENDIENTE del cover (hoy estático) — requiere re-bake
periódico del cover + re-envío al render; fácil pero con algo de plumbing.
**Siguiente paso de fondo elegido: Turing (patrones emergentes)** — la vegetación se auto-organiza por feedback escala-dependiente
(facilitación local + competencia/inhibición a distancia) → manchas/laberintos que EMERGEN de la dinámica, no impuestos. Spike con
hipótesis falsable. Es el camino más fiel a "evolución natural de la biosfera" (vs el ruido impuesto, que es decorado).

## Siguiente acción
**Recomiendo el plan "mundo como paisaje" (B0) ANTES de seguir con nichos/paleta** — es lo que hará VISIBLE todo lo demás. Empezar por el
render-contraste (instantáneo) + el contraste/persistencia de la veg (dorado). Opciones alternativas (si se prefiere):
- **Hacer VISIBLE la cobertura en el render** (hoy el refugio es invisible → el usuario no ve por qué la presa se agrupa). Recomendado YA (polish barato, alto valor perceptivo).
- **Reforzar el efecto:** subir `coverStrength`, o que el refugio importe más (más presión de depredación), o correr más tiempo (el sensor nuevo evoluciona lento).
- **Añadir OTRO eje separable** (A.3 2º recurso · día/noche temporal) → apilar nichos.
- **Pasar a (B) paleta** (marchas por geometría, sembrando) para divergencia de FORMA, no solo de talla/conducta.
Decisión de usuario.
