// GENOMA DE REGLAS + DESARROLLO: mapa genotipo→fenotipo. El genoma son REGLAS DE DESARROLLO (no rasgos): `develop()`
// recorre un grafo de MÓDULOS (recursión/simetría/modulación por contexto) y produce un CUERPO = lista de PARTES con
// geometría. Validez POR CONSTRUCCIÓN (recursión acotada → siempre cuerpo legal). Alimenta la física y el render.

// Tejido de una parte. TODOS los organismos son ANIMALES (sin PHOTO). MUSCLE propulsa · MOUTH ingiere (pasta/caza/carroña)
// · STRUCTURE solo da cuerpo. FRONTERA genotipo→física: el programador define qué hace cada tejido; el eje herbívoro↔carnívoro
// EMERGE de la inversión MOUTH/MUSCLE + la dieta realizada (no se codifica).
export const TISSUE = { STRUCTURE: 0, MUSCLE: 1, MOUTH: 2 };
export const TISSUE_N = 3;

import { GENOME_P } from '../config.js';   // parámetros del genoma/mutación: fuente única en config.js
export { GENOME_P };

const TWO_PI = 6.283185307;
const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
const clamp = (x, lo, hi) => x < lo ? lo : x > hi ? hi : x;
const radOf = (size) => GENOME_P.radMin + (GENOME_P.radMax - GENOME_P.radMin) * size;
const tissueOf = (t) => Math.min(TISSUE_N - 1, (t * TISSUE_N) | 0);   // gen [0,1] → categoría

// CEREBRO: RNN Elman; pesos = genes heredables. 12 entradas (∇veg, dir presa/amenaza, hambre, velocidad, ∇detrito, ∇cobertura)
// → 4 salidas (dir empuje, throttle, ataque). La plasticidad ajusta una COPIA de trabajo en vida (no heredable); evoluciona el cerebro de NACIMIENTO.
export const BRAIN = { I: 12, H: 6, O: 4, scale: 5 };
export const BRAIN_W = BRAIN.I * BRAIN.H + BRAIN.H * BRAIN.H + BRAIN.H + BRAIN.H * BRAIN.O + BRAIN.O;  // 154
// `div` (diversidad inicial, 1=normal · 0=sin ruido → todos idénticos) escala el ruido de pesos. Consume el mismo RNG → div=1 byte-idéntico.
export function makeBrain(rng, div = 1) { const b = new Float32Array(BRAIN_W); for (let i = 0; i < BRAIN_W; i++) b[i] = (rng.next() - 0.5) * 0.4 * div; return b; }

// SEEDBRAIN: pesos de partida competentes (ir a comida/presa, huir, atacar en contacto) vía 2 neuronas-relé (eje X/Y); resto = ruido.
// Bootstrap, NO estrategia fija: la conducta sigue evolucionando desde aquí.
export function seedBrain(rng, div = 1) {
  const b = makeBrain(rng, div), I = BRAIN.I, H = BRAIN.H, O = BRAIN.O, k = 1.5;   // div escala SOLO el ruido; estructura (relés) fija → a div=0 cerebros idénticos
  const wHo = I * H + H * H + H, bO = wHo + H * O;
  // h0 = relé del eje X: + hacia presa (in2) · − amenaza (in4) · + ∇veg/comida (in0) · + ∇detrito (in8)   [índice wIh = in·H + h]
  b[2 * H + 0] = k; b[4 * H + 0] = -k; b[0 * H + 0] = k * 0.6; b[8 * H + 0] = k * 0.6;
  // h1 = relé del eje Y: + presa (in3) · − amenaza (in5) · + ∇veg/comida (in1) · + ∇detrito (in9)
  b[3 * H + 1] = k; b[5 * H + 1] = -k; b[1 * H + 1] = k * 0.6; b[9 * H + 1] = k * 0.6;
  // oculta→salida: h0→dir X (out0) · h1→dir Y (out1)   [índice wHo + h·O + o]
  b[wHo + 0 * O + 0] = k; b[wHo + 1 * O + 1] = k;
  // sesgos de salida: throttle (out2) + → se mueve · ataque (out3) + → ataca en contacto
  b[bO + 2] = 0.5; b[bO + 3] = 0.3;
  return b;
}

// Marcas de HOMOLOGÍA (alinean módulos en la recombinación, como genes Hox). Marca 1 RESERVADA al módulo del FUNDADOR (par de
// aletas) → todos los fundadores la comparten → sus descendientes recombinan ese módulo de forma HOMÓLOGA. Módulos nuevos por
// mutación estrenan marca (HOM++, desde 2).
let HOM = 2;   // contador de marcas de homología; 1 = reservada al módulo fundador (compartida)
const FOUNDER_HOM = 1;
// Reinicia el contador (HOM=2). Lo llama el constructor de Sim para que cada mundo arranque limpio. Determinista: recombine
// compara `hom` por IGUALDAD y el ancla del fundador es constante → el offset no afecta al resultado.
export function resetHom() { HOM = 2; }

function mkModule(rng) {
  return {
    angle: rng.next() * Math.PI,   // emisión rel. al eje (0 frente .. π atrás)
    size: 0.3 + rng.next() * 0.4, aspect: rng.next(), tissue: rng.next(),
    oscAmp: rng.next() * 0.6, phase: rng.next(),
    recursive: rng.next() < 0.3, recLimit: 1 + (rng.next() * GENOME_P.recCap) | 0,
    symmetric: rng.next() < 0.4, taper: 0.6 + rng.next() * 0.4,
    hom: HOM++,
  };
}

// Fundador SIMPLE = ANIMAL grazer (la complejidad EMERGE): cabeza con BOCA + par bilateral de MÚSCULO (aletas). tissueOf con
// TISSUE_N=3 (t·3|0): <0.333 STRUCTURE · 0.333-0.667 MUSCLE · ≥0.667 MOUTH.
export function makeFounder(rng, div = 1, baseHue = 0.5) {
  // div = DIVERSIDAD inicial: 0 = fundadores IDÉNTICOS (clones) · 1 = variación amplia (talla/proporciones/aletas/r-K).
  // `dv(x)` y `jig` perturban ∝ div consumiendo el MISMO RNG sea cual sea div (a div=0 perturbación 0 pero stream avanza igual →
  // determinista). SUELO DE VIABILIDAD: TEJIDOS FIJOS (raíz=BOCA, módulo=MÚSCULO) + músculo con oscilación → todo fundador puede
  // COMER y MOVERSE. La complejidad ESTRUCTURAL (más módulos, recursión, ramas) EMERGE por mutación, no se siembra.
  const dv = (x) => 0.5 + (x - 0.5) * div;
  const jig = (base, amp, lo, hi) => { const v = base + rng.gaussian() * amp * div; return v < lo ? lo : v > hi ? hi : v; };
  const P = GENOME_P;
  return {
    root: { size: jig(0.42, 0.18, 0.12, 0.95), aspect: jig(0.4, 0.22, 0, 1), tissue: 0.8 /*MOUTH (fijo: viabilidad — comer)*/, oscAmp: jig(0.1, 0.12, 0, 0.6), phase: dv(rng.next()) },
    modules: [{ angle: jig(2.8, 0.5, 0.3, Math.PI), size: jig(0.35, 0.16, 0.12, 0.8), aspect: jig(0.6, 0.22, 0, 1), tissue: 0.5 /*MUSCLE (fijo: viabilidad — moverse)*/, oscAmp: jig(0.4, 0.18, 0.05, 0.9), phase: dv(rng.next()),
                recursive: false, recLimit: 1, symmetric: true, taper: jig(0.85, 0.12, 0.5, 1), hom: FOUNDER_HOM }],   // par de aletas: marca COMPARTIDA → recombinación homóloga
    brain: seedBrain(rng, div),   // bootstrap; div escala el ruido (div=0 → cerebro idéntico)
    hue: (baseHue + (rng.next() - 0.5) * div + 1) % 1,   // LINAJE (render-only, heredable): a div=0 todos = baseHue · a div=1 disperso por el círculo
    // r/K: historia de vida; varían ∝ div dentro de su rango (GENOME_P).
    reproK: jig(1.0, 0.3, P.reproKMin, P.reproKMax), investFrac: jig(0.4375, 0.12, P.investFracMin, P.investFracMax),
  };
}

export function cloneGenome(g) {
  return { root: { ...g.root }, modules: g.modules.map((m) => ({ ...m })), brain: g.brain ? Float32Array.from(g.brain) : null, hue: g.hue,
           reproK: g.reproK, investFrac: g.investFrac };
}

// DESARROLLO: genoma de reglas → cuerpo (lista de partes con geometría). Determinista, acotado, SIEMPRE válido.
// Parte: { x,y (rel. al origen del cuerpo), r (radio), aspect, dir (dirección de emisión = eje de gait), tissue,
//          oscAmp, phase, parent (índice, para el render del esqueleto) }.
export function develop(g) {
  const B = GENOME_P, parts = [];
  const root = g.root;
  parts.push({ x: 0, y: 0, r: radOf(root.size), aspect: root.aspect, dir: 0, tissue: tissueOf(root.tissue),
               oscAmp: root.oscAmp, phase: root.phase * TWO_PI, parent: -1 });
  for (const m of g.modules) {
    if (parts.length >= B.partBudget) break;
    const signs = m.symmetric ? [1, -1] : [1];           // simetría bilateral: par espejado (1 bit)
    for (const s of signs) {
      if (parts.length >= B.partBudget) break;
      const dir = clamp(m.angle, 0, Math.PI) * s;         // dirección de emisión (espejada por s)
      const cd = Math.cos(dir), sd = Math.sin(dir);
      let parentIdx = 0, r = radOf(m.size);
      const L = m.recursive ? clamp(m.recLimit | 0, 1, B.recCap) : 1;   // recursión → cadena (acotada)
      for (let d = 0; d < L && parts.length < B.partBudget; d++) {
        const p = parts[parentIdx], dist = p.r + r;
        parts.push({ x: p.x + cd * dist, y: p.y + sd * dist, r, aspect: m.aspect, dir,
                     tissue: tissueOf(m.tissue), oscAmp: m.oscAmp, phase: m.phase * TWO_PI, parent: parentIdx });
        parentIdx = parts.length - 1;                     // cadena: la siguiente se ancla a esta
        r *= clamp(m.taper, 0.4, 1);                      // modulación por contexto: afilamiento a lo largo de la cadena
      }
    }
  }
  return parts;
}

// MUTACIÓN: paramétrica (frecuente, suave) + estructurales (raras, gran efecto).
export function mutate(g, rng) {
  const B = GENOME_P, n = cloneGenome(g), mr = B.mutRate;
  // `chance(p)` = evento con prob p·mutRate (ritmo escalable por UI). A mutRate=1 byte-idéntico. Escala PROBABILIDADES, no magnitudes.
  const chance = (p) => rng.next() < p * mr;
  // paramétricas sobre la raíz
  const r = n.root;
  if (chance(0.2)) r.size = clamp01(r.size + rng.gaussian() * 0.1);
  if (chance(0.2)) r.aspect = clamp01(r.aspect + rng.gaussian() * 0.1);
  if (chance(0.1)) r.tissue = clamp01(r.tissue + rng.gaussian() * 0.15);
  if (chance(0.2)) r.oscAmp = clamp01(r.oscAmp + rng.gaussian() * 0.1);
  if (chance(0.2)) r.phase = (r.phase + rng.gaussian() * 0.1 + 1) % 1;
  // estructurales sobre el conjunto de módulos
  if (chance(0.10) && n.modules.length < B.modCap) n.modules.push(mkModule(rng));                 // AÑADIR
  if (chance(0.08) && n.modules.length && n.modules.length < B.modCap) {                          // DUPLICAR (copia coherente)
    const src = n.modules[(rng.next() * n.modules.length) | 0]; n.modules.push({ ...src, hom: HOM++ });
  }
  if (chance(0.05) && n.modules.length > 0) n.modules.splice((rng.next() * n.modules.length) | 0, 1); // BORRAR
  for (const m of n.modules) {
    if (chance(0.06)) m.recursive = !m.recursive;                                                 // toggle recursión
    if (chance(0.10)) m.recLimit = clamp((m.recLimit + (rng.next() < 0.5 ? 1 : -1)) | 0, 1, B.recCap); // límite
    if (chance(0.06)) m.symmetric = !m.symmetric;                                                 // toggle simetría (1 bit → par)
    if (chance(0.08)) m.tissue = clamp01(m.tissue + rng.gaussian() * 0.2);                        // tejido (puede cambiar de categoría)
    if (chance(0.15)) m.angle = clamp(m.angle + rng.gaussian() * 0.4, 0, Math.PI);
    if (chance(0.15)) m.size = clamp01(m.size + rng.gaussian() * 0.12);
    if (chance(0.15)) m.aspect = clamp01(m.aspect + rng.gaussian() * 0.12);
    if (chance(0.12)) m.oscAmp = clamp01(m.oscAmp + rng.gaussian() * 0.12);
    if (chance(0.10)) m.taper = clamp(m.taper + rng.gaussian() * 0.1, 0.4, 1);                    // regulatoria
    if (chance(0.12)) m.phase = (m.phase + rng.gaussian() * 0.12 + 1) % 1;
    if (chance(0.01)) m.hom = HOM++;                                                              // homología (rarísima)
  }
  // CEREBRO: muta los pesos de NACIMIENTO (lo heredable); la copia de trabajo aprendida en vida NO se hereda.
  if (n.brain) { const b = n.brain; for (let k = 0; k < b.length; k++) { if (chance(0.08)) { let v = b[k] + rng.gaussian() * 0.15; b[k] = v < -3 ? -3 : v > 3 ? 3 : v; } } }
  if (chance(0.1)) n.hue = (n.hue + rng.gaussian() * 0.03 + 1) % 1;   // deriva lenta del linaje (color)
  // r/K (historia de vida): umbral de cría relativo + inversión por cría.
  if (chance(0.12)) n.reproK = clamp(n.reproK + rng.gaussian() * 0.08, B.reproKMin, B.reproKMax);
  if (chance(0.12)) n.investFrac = clamp(n.investFrac + rng.gaussian() * 0.05, B.investFracMin, B.investFracMax);
  return n;
}

// RECOMBINACIÓN SEXUAL por MÓDULOS HOMÓLOGOS. Alinea los módulos de ambos padres por su marca `hom` y el hijo toma cada
// módulo de un padre u otro con LIGAMIENTO (tramos contiguos) → recombina órganos enteros → la cría es SIEMPRE un cuerpo
// válido. El cerebro se cruza por un punto. NO muta aquí (el sim aplica mutate después).
export function recombine(gA, gB, rng) {
  const root = {}; for (const k of ['size', 'aspect', 'tissue', 'oscAmp', 'phase']) root[k] = (rng.next() < 0.5 ? gA : gB).root[k];
  const byHom = new Map();
  for (const m of gA.modules) byHom.set(m.hom, { a: m });
  for (const m of gB.modules) { const e = byHom.get(m.hom) || {}; e.b = m; byHom.set(m.hom, e); }
  const modules = []; let fromA = rng.next() < 0.5;
  for (const e of byHom.values()) {
    if (rng.next() < 0.3) fromA = !fromA;                 // punto de cruce (ligamiento: tramos del mismo padre)
    if (e.a && e.b) modules.push({ ...(fromA ? e.a : e.b) });   // homólogo en ambos → de uno
    else if (rng.next() < 0.6) modules.push({ ...(e.a || e.b) }); // presente en uno → heredar con prob.
  }
  let brain = null;
  if (gA.brain && gB.brain) { brain = new Float32Array(gA.brain.length); const cut = (rng.next() * brain.length) | 0; for (let k = 0; k < brain.length; k++) brain[k] = (k < cut ? gA : gB).brain[k]; }
  else if (gA.brain || gB.brain) brain = Float32Array.from(gA.brain || gB.brain);
  return { root, modules, brain, hue: (rng.next() < 0.5 ? gA : gB).hue,
           reproK: (rng.next() < 0.5 ? gA : gB).reproK, investFrac: (rng.next() < 0.5 ? gA : gB).investFrac };   // r/K: cada gen de un progenitor
}

// Estadística estructural del cuerpo (para tests/inspección).
export function bodyStats(parts) {
  let chain = new Array(parts.length).fill(1), maxChain = 1;
  const tissues = [0, 0, 0];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]; tissues[p.tissue]++;
    if (p.parent >= 0) { chain[i] = chain[p.parent] + 1; if (chain[i] > maxChain) maxChain = chain[i]; }
  }
  return { nParts: parts.length, maxChain, tissues };
}
