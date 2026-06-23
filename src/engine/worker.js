// WEB WORKER (motor). Corre World+Sim en un hilo aparte del render. Por frame envía al hilo principal una "foto" compacta
// (posiciones + heading + cuerpos aplanados en typed arrays transferibles) y recibe comandos (reset/pausa).

import { World, WORLD_P } from './world.js';
import { Sim, SIM_P } from './sim.js';
import { GENOME_P } from './genome.js';   // ritmo de mutación (parámetro de UI en vivo)
import { START, RENDER_P } from '../config.js';   // defaults de arranque y velocidad inicial
const GROW_MIN = RENDER_P.growMin, GROW_MAT = RENDER_P.growMature || 1;   // CRÍAS (render): tamaño dibujado growMin→1 según edad/growMature

// Oficio realizado desde la DIETA (veg/caza/carroña acumuladas), no de la morfología. 0 herbívoro · 1 carnívoro · 2 omnívoro.
function roleFromDiet(veg, prey, scav) { const tot = veg + prey + scav; if (tot < 0.5) return 0;   // recién nacido sin dieta → herbívoro
  const carn = (prey + scav) / tot; return carn > 0.6 ? 1 : carn < 0.25 ? 0 : 2; }

let worldSize = START.worldSize, seedCount = START.seedCount, spawnSpread = START.spawnSpread, diversity = START.diversity;   // parámetros de ARRANQUE (se actualizan en init())
let world, sim, running = true, tps = RENDER_P.tps, maxSpeed = false;
let selectedId = -1;   // serial del agente inspeccionado (-1 = ninguno); su detalle en vivo viaja en cada foto
const CORPSE_LIFE = 240;   // vida visual del cadáver (ticks) ≈ lo que tarda su carroña en mineralizarse
// historiales para las gráficas. Se muestrean en fronteras fijas de HIST_EVERY ticks (ver sampleHist), no por frame.
// Población = valor absoluto; nacimientos/muertes = delta por ventana (de contadores acumulados).
const HIST_W = 160, HIST_EVERY = 60; const histPop = [], histHerb = [], histCarn = [];
const histSexB = [], histAsexB = [], histPred = [], histStarv = [];   // nacimientos sexual/asexual · muertes predación/inanición (por ventana)
let lastSexB = 0, lastAsexB = 0, lastKills = 0, lastStarved = 0;
const histMassH = [], histMassC = [];   // masa media por oficio (herbívoro/carnívoro) en el tiempo
// HISTOGRAMA de un rasgo seleccionable: se computa aquí (datos SoA) y al cliente solo viajan los bins.
// Por bin se separa por oficio (herbívoro vs resto); rango fijo por rasgo → eje estable.
const HBINS = 28;
const HIST_TRAITS = { mass: [0, 16], mouthCap: [0, 40], vmax: [0, 2], nParts: [1, 32], reproK: [0.5, 2], investFrac: [0.2, 0.8], hue: [0, 1] };
let histTrait = 'mass';   // rasgo mostrado (lo fija la UI vía mensaje 'histTrait')

function init({ seed, worldSize: ws, seedCount: sc, spawnSpread: sp, diversity: dv } = {}) {
  // Parámetros de ARRANQUE (se conservan entre resets).
  if (Number.isFinite(+ws) && +ws > 0) worldSize = +ws | 0;
  if (Number.isFinite(+sc) && +sc > 0) seedCount = +sc | 0;
  if (Number.isFinite(+sp)) spawnSpread = Math.min(1, Math.max(0.05, +sp));   // 1 = todo el mundo · <1 = disco central
  if (Number.isFinite(+dv)) diversity = Math.min(1, Math.max(0, +dv));        // 1 = normal · 0 = founders idénticos
  // semilla opcional (null/no-finito → aleatoria); la misma semilla alimenta mundo y población → determinista
  const sd = (seed == null || !Number.isFinite(+seed)) ? (Math.random() * 1e9) | 0 : (+seed | 0);
  world = new World(worldSize, sd, { ...WORLD_P, lightBase: START.lightBase });
  world.nutrient.fill(START.nutrientInit);
  world.veg.fill(START.vegInit);   // la base productora arranca sembrada
  sim = new Sim(world, { seed: sd, cap: START.cap });
  sim.seed(seedCount, spawnSpread, diversity);
  selectedId = -1;
  histPop.length = 0; histHerb.length = 0; histCarn.length = 0;   // historiales limpios al (re)iniciar
  histSexB.length = 0; histAsexB.length = 0; histPred.length = 0; histStarv.length = 0; lastSexB = lastAsexB = lastKills = lastStarved = 0;
  histMassH.length = 0; histMassC.length = 0;
  // dims del mundo (cambian solo al reset). vegRef = veg máx aprox (normaliza el color del fondo). cover: campo de refugio ESTÁTICO → se manda una vez.
  postMessage({ type: 'world', cols: world.cols, rows: world.rows, cellW: world.cellW, size: worldSize, vegRef: world.P.vegKcoef * world.P.lightBase, seed: sd, cover: world.cover.slice() });
}

// Foto por frame: solo vivos, cuerpos aplanados (offset + nodos por parte). Transferible (cero copia).
function snapshot() {
  const s = sim, idx = []; let totalParts = 0;
  for (let i = 0; i < s.hi; i++) if (s.alive[i] && s.body[i]) { idx.push(i); totalParts += s.body[i].length; }   // marca de agua (todo vivo ∈ [0,hi))
  const n = idx.length;
  // partData = [lx, ly, r, tissue, phase, aspect, dir] por nodo (stride 7); aspect+dir → siluetas orientadas en el render.
  // aE = energía normalizada [0,1] (E/reproE) → el render atenúa a los hambrientos.
  // aGazeX/Y = dirección al estímulo más saliente (mundo) · aAlert = intensidad [0,1] → orienta y aviva los ojos.
  const ax = new Float32Array(n), ay = new Float32Array(n), ah = new Float32Array(n), aspd = new Float32Array(n), ahue = new Float32Array(n), aE = new Float32Array(n), aGazeX = new Float32Array(n), aGazeY = new Float32Array(n), aAlert = new Float32Array(n), aGrow = new Float32Array(n), arole = new Uint8Array(n), aid = new Int32Array(n), partOff = new Int32Array(n + 1), partData = new Float32Array(totalParts * 7);
  let po = 0, detail = null;
  // histograma del rasgo seleccionado (por bin, separado herbívoro/resto); rango fijo + array SoA del rasgo (o caso especial nParts/hue).
  const gh = new Float32Array(HBINS), gc = new Float32Array(HBINS);
  const trng = HIST_TRAITS[histTrait] || HIST_TRAITS.mass, tlo = trng[0], tspan = (trng[1] - trng[0]) || 1;
  const tArr = histTrait === 'mass' ? s.mass : histTrait === 'mouthCap' ? s.mouthCap : histTrait === 'vmax' ? s.vmax : histTrait === 'reproK' ? s.reproK : histTrait === 'investFrac' ? s.investFrac : null;
  for (let a = 0; a < n; a++) {
    const i = idx[a]; ax[a] = s.x[i]; ay[a] = s.y[i]; ahue[a] = s.genome[i].hue; aid[a] = s.serial[i];
    aGrow[a] = GROW_MIN + (1 - GROW_MIN) * Math.min(1, s.age[i] / GROW_MAT);   // CRÍAS (write-only): tamaño dibujado ∝ edad real; la dinámica no lo lee
    aE[a] = Math.min(1, Math.max(0, s.E[i] / (SIM_P.reproE * s.reproK[i])));   // vitalidad para el render (atenúa hambrientos); umbral propio (r/K)
    const vx = s.vx[i], vy = s.vy[i], sp = Math.sqrt(vx * vx + vy * vy); ah[a] = sp > 1e-3 ? Math.atan2(vy, vx) : 0;
    aspd[a] = sp / 3 > 1 ? 1 : sp / 3;   // velocidad normalizada → amplitud de ondulación del render
    // oficio realizado desde la dieta (color/gráfica) + percepción para los ojos
    const dv = s.vegIn[i], dp = s.preyIn[i], ds = s.scavIn[i], dt = dv + dp + ds;
    arole[a] = roleFromDiet(dv, dp, ds);
    aGazeX[a] = s.senseX[i]; aGazeY[a] = s.senseY[i]; aAlert[a] = s.senseMag[i];   // estímulo saliente (dir mundo) + intensidad → ojos que miran/se avivan
    partOff[a] = po; const body = s.body[i];
    { const tv = tArr ? tArr[i] : (histTrait === 'nParts' ? body.length : s.genome[i].hue);   // bin del rasgo (caso especial: nParts/hue)
      let hb = ((tv - tlo) / tspan * HBINS) | 0; if (hb < 0) hb = 0; else if (hb >= HBINS) hb = HBINS - 1;
      if (arole[a] === 0) gh[hb]++; else gc[hb]++; }
    let rad = 0;
    for (let k = 0; k < body.length; k++) { const p = body[k]; const o = po * 7; partData[o] = p.x; partData[o + 1] = p.y; partData[o + 2] = p.r; partData[o + 3] = p.tissue; partData[o + 4] = p.phase; partData[o + 5] = p.aspect; partData[o + 6] = p.dir; po++;
      const d = Math.hypot(p.x, p.y) + p.r; if (d > rad) rad = d; }
    // detalle en vivo del agente inspeccionado (si sigue vivo): stats fisiológicos + morfológicos para el inspector
    if (s.serial[i] === selectedId) { const reproEi = SIM_P.reproE * s.reproK[i];
      const ib = []; for (let k = 0; k < body.length; k++) { const p = body[k]; ib.push(p.x, p.y, p.r, p.aspect, p.dir, p.tissue); }   // geometría del cuerpo (stride 6) para el inspector (write-only)
      detail = { id: selectedId, role: arole[a], E: s.E[i], reproE: reproEi, gut: s.gut[i],
      mass: s.mass[i], mouthCap: s.mouthCap[i], maxMouthR: s.maxMouthR[i], vmax: s.vmax[i], age: s.age[i], nParts: body.length, hue: s.genome[i].hue, x: s.x[i], y: s.y[i], rad,
      investE: s.investFrac[i] * reproEi, reproK: s.reproK[i],   // r/K: umbral e inversión propios
      dietV: s.vegIn[i], dietP: s.preyIn[i], dietS: s.scavIn[i], bodyParts: ib }; }   // dieta acumulada (pasto/caza/carroña) + geometría
  }
  partOff[n] = po;
  // CADÁVERES: los recientes (edad < CORPSE_LIFE) con su forma → el render los desvanece con su carroña. Acotado por el ring del
  // motor; aplanado como los organismos (offset + [lx,ly,r,aspect,dir] por parte, stride 5). dcfade = edad/vida.
  const cidx = []; let ctp = 0;
  for (let k = 0; k < s.CORPSE_CAP; k++) { const nn = s.ccn[k]; if (nn <= 0) continue; const age = s.tick - s.cct0[k]; if (age < 0 || age >= CORPSE_LIFE) continue; cidx.push(k); ctp += nn; }
  const dcm = cidx.length;
  const dcx = new Float32Array(dcm), dcy = new Float32Array(dcm), dch = new Float32Array(dcm), dchue = new Float32Array(dcm), dcfade = new Float32Array(dcm), dcOff = new Int32Array(dcm + 1), dcData = new Float32Array(ctp * 5);
  let cpo = 0;
  for (let a = 0; a < dcm; a++) { const k = cidx[a]; dcx[a] = s.ccx[k]; dcy[a] = s.ccy[k]; dch[a] = s.cch[k]; dchue[a] = s.cchue[k]; dcfade[a] = (s.tick - s.cct0[k]) / CORPSE_LIFE;
    dcOff[a] = cpo; const nn = s.ccn[k]; let o = k * s.CORPSE_MAXP * 5;
    for (let j = 0; j < nn; j++) { const d = cpo * 5; dcData[d] = s.ccData[o]; dcData[d + 1] = s.ccData[o + 1]; dcData[d + 2] = s.ccData[o + 2]; dcData[d + 3] = s.ccData[o + 3]; dcData[d + 4] = s.ccData[o + 4]; o += 5; cpo++; } }
  dcOff[dcm] = cpo;
  // VEGETACIÓN: el campo veg actual → el render lo pinta como fondo (la base de comida). Cambia cada tick. Transferible (cero copia).
  const veg = world.veg.slice();
  // detail = null si no hay selección o si el agente seleccionado ya murió (selectedId set pero detail null)
  postMessage({ type: 'frame', tick: s.tick, pop: n, n, ax, ay, ah, aspd, ahue, aE, aGazeX, aGazeY, aAlert, aGrow, arole, aid, partOff, partData,
      dcm, dcx, dcy, dch, dchue, dcfade, dcOff, dcData, veg, histPop, histHerb, histCarn, histSexB, histAsexB, histPred, histStarv, histMassH, histMassC,
      geneTrait: histTrait, geneLo: trng[0], geneHi: trng[1], geneH: gh, geneC: gc, sel: selectedId, detail },
    [ax.buffer, ay.buffer, ah.buffer, aspd.buffer, ahue.buffer, aE.buffer, aGazeX.buffer, aGazeY.buffer, aAlert.buffer, aGrow.buffer, arole.buffer, aid.buffer, partOff.buffer, partData.buffer,
     dcx.buffer, dcy.buffer, dch.buffer, dchue.buffer, dcfade.buffer, dcOff.buffer, dcData.buffer, veg.buffer, gh.buffer, gc.buffer]);
}

// Muestreo del HISTORIAL en fronteras fijas de HIST_EVERY ticks (lo llama stepSim al cruzar un múltiplo). Pasada O(cap); write-only (step no lo lee).
function sampleHist() {
  const s = sim; let n = 0, nHerb = 0, nCarn = 0, massSumH = 0, massSumC = 0;
  for (let i = 0; i < s.hi; i++) if (s.alive[i] && s.body[i]) {   // marca de agua (todo vivo ∈ [0,hi))
    n++; if (roleFromDiet(s.vegIn[i], s.preyIn[i], s.scavIn[i]) === 0) { nHerb++; massSumH += s.mass[i]; } else { nCarn++; massSumC += s.mass[i]; }
  }
  histPop.push(n); histHerb.push(nHerb); histCarn.push(nCarn);
  histSexB.push(s.sexBirths - lastSexB); histAsexB.push(s.asexBirths - lastAsexB); histPred.push(s.kills - lastKills); histStarv.push(s.starved - lastStarved);
  lastSexB = s.sexBirths; lastAsexB = s.asexBirths; lastKills = s.kills; lastStarved = s.starved;
  histMassH.push(nHerb ? massSumH / nHerb : 0); histMassC.push(nCarn ? massSumC / nCarn : 0);   // talla media por oficio
  if (histPop.length > HIST_W) { histPop.shift(); histHerb.shift(); histCarn.shift(); histSexB.shift(); histAsexB.shift(); histPred.shift(); histStarv.shift(); histMassH.shift(); histMassC.shift(); }
}
// un paso de simulación + muestreo del historial al cruzar cada frontera de HIST_EVERY ticks
function stepSim() { sim.step(); if (sim.tick % HIST_EVERY === 0) sampleHist(); }

// Ritmo de simulación por acumulador temporal: cada loop ejecuta `tps × tiempo transcurrido` pasos → el t/s real sigue al slider; tps=0 = parado.
let acc = 0, lastLoopT = performance.now();
const MAX_SNAP_MS = RENDER_P.maxSnapMs;   // en MÁX: un fotograma cada ~N ms (≈4 fps); el lote (≤N ms) garantiza ≥1 fps aun con la pop al tope
function loop() {
  const now = performance.now();
  if (running && maxSpeed) {
    // MÁX: simula en lote hasta el próximo fotograma → t/s máximo y un solo snapshot por lote (no uno por iteración).
    const stepUntil = now + MAX_SNAP_MS;
    do { stepSim(); } while (performance.now() < stepUntil);
    acc = 0; lastLoopT = now;
    snapshot();
    setTimeout(loop, 0);
    return;
  }
  if (running && tps > 0) {
    acc += tps * (now - lastLoopT) / 1000;                            // ticks adeudados desde el último loop
    const budgetEnd = now + 28;                                       // tope de cómputo por frame (deja ~5 ms para snapshot)
    while (acc >= 1) { if (performance.now() >= budgetEnd) { acc = 0; break; } stepSim(); acc -= 1; }   // sin alcanzar el ritmo → se descartan (sin spiral de deuda)
  } else {
    acc = 0;                                                          // pausado o tps=0: el mundo no avanza
  }
  lastLoopT = now;
  snapshot();
  setTimeout(loop, 33);
}

onmessage = (e) => {
  const m = e.data;
  if (m.type === 'reset') init(m);   // reset con seed + parámetros de arranque opcionales
  else if (m.type === 'running') running = m.value;
  else if (m.type === 'tps') tps = m.value;
  else if (m.type === 'maxSpeed') maxSpeed = m.value;
  // LABORATORIO (en vivo): ajusta una ley sin reiniciar. lightMul vive en el mundo; mutRate en GENOME_P; el resto en SIM_P/world.P
  // (step()/mutate()/vegStep los leen por referencia → el cambio surte efecto al instante).
  else if (m.type === 'set') { if (m.key === 'lightMul') world.lightMul = m.value; else if (m.key === 'mutRate') GENOME_P.mutRate = m.value; else if (m.key in SIM_P) SIM_P[m.key] = m.value; else if (m.key in world.P) world.P[m.key] = m.value; }
  else if (m.type === 'histTrait') { if (m.key in HIST_TRAITS) histTrait = m.key; }   // histograma: rasgo a mostrar
  else if (m.type === 'inspect') selectedId = m.id;     // inspector: fijar agente a seguir en vivo
  else if (m.type === 'deselect') selectedId = -1;
  else if (m.type === 'burst') { for (let k = 0; k < (m.n || 0); k++) stepSim(); snapshot(); }   // avance forzado (depuración/preview)
};

init();
loop();
