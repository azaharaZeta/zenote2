// SIM INTEGRADO. Código KEEPER: el ANIMAL REAL (genoma→develop→fenotipo) viviendo sobre las leyes del mundo, vía las
// transacciones (pastoreo de vegetación · caza · carroñeo · metabolismo · muerte) + reproducción con mutación/recombinación
// del genoma de reglas (la morfología EVOLUCIONA). TODOS los organismos son ANIMALES (no fotosintetizan): la energía entra al
// ecosistema por la VEGETACIÓN (world.vegStep) y el animal la obtiene COMIENDO. Materia/energía contabilizadas en cada
// transacción → los invariantes (materia cerrada + energía luz→calor, con la vegetación en el libro mayor) deben SEGUIR pasando.

import { develop, mutate, makeFounder, recombine, seedBrain, resetHom, BRAIN, BRAIN_W } from './genome.js';
import { computePhenotype, phenoDistance } from './phenotype.js';
import { SpatialHash } from './hash.js';
import { makeRng } from '../util/rng.js';

import { SIM_P } from '../config.js';   // parámetros de simulación: fuente única en config.js
export { SIM_P };

const SENSE_R = 120;   // alcance (u) para la INTENSIDAD visual de la PERCEPCIÓN (ojos del render): un estímulo a <SENSE_R aviva la
                       // mirada (1 en contacto · 0 a SENSE_R). Solo afecta a la representación; la dinámica no lo lee → byte-idéntico.

export class Sim {
  constructor(world, { seed = 1, cap = 8000, eDensity = SIM_P.eDensity, randomBehavior = false, freezeBrain = false } = {}) {
    resetHom();   // marcas de homología limpias por mundo (no arrastrar el contador entre instancias/procesos; ver genome.js)
    this.world = world; this.cap = cap; this.rng = makeRng(seed); this.rngSeed = seed; this.tick = 0; this.eD = eDensity;   // rngSeed: semilla cruda (≠ método seed()) → tono base de linaje
    this.randomBehavior = randomBehavior;   // control: salidas aleatorias (ignora el cerebro) → mide si la conducta neuronal es ADAPTATIVA
    // control M6.3: cerebro CONGELADO a un seedBrain canónico (sin mutación, recombinación ni plasticidad del cerebro;
    // la morfología SÍ evoluciona). Aísla la conducta SEMBRADA de la aportación de la evolución/aprendizaje del cerebro.
    this.freezeBrain = freezeBrain; this._seedBrain = freezeBrain ? seedBrain(this.rng) : null;
    this.x = new Float32Array(cap); this.y = new Float32Array(cap);
    this.vx = new Float32Array(cap); this.vy = new Float32Array(cap);
    this.E = new Float32Array(cap); this.gut = new Float32Array(cap); this.age = new Float32Array(cap); this.cd = new Float32Array(cap);
    this.alive = new Uint8Array(cap); this.serial = new Int32Array(cap); this._serial = 0;
    this.genome = new Array(cap).fill(null);
    this.body = new Array(cap).fill(null);   // cuerpo desarrollado (partes) cacheado al nacer → lo lee el render (M5.5)
    // fenotipo cacheado (de develop+computePhenotype al nacer)
    this.mass = new Float32Array(cap); this.vmax = new Float32Array(cap);
    this.drag = new Float32Array(cap); this.mouthCap = new Float32Array(cap); this.maxMouthR = new Float32Array(cap);
    this.thrust = new Float32Array(cap);   // empuje cacheado (solo para el oficio trófico del render; no entra en la sim)
    // r/K (historia de vida, genético): umbral_i = SIM_P.reproE·reproK (SIM_P.reproE = baseline live del lab); investE_i = investFrac·umbral_i.
    this.reproK = new Float32Array(cap); this.investFrac = new Float32Array(cap);
    this.free = new Int32Array(cap); for (let i = 0; i < cap; i++) this.free[i] = cap - 1 - i; this.freeTop = cap;
    this.active = new Int32Array(cap); this.nA = 0;
    // M4: la celda del hash = mayor alcance que el barrido 3×3 debe cubrir. Derivada (no hardcodeada): el piso 60 es
    // el alcance de sensado de presa/amenaza; mateRadius (búsqueda de pareja) la eleva si lo supera → así el barrido
    // nunca falla en silencio. Hoy mateRadius=50 < 60 → celda 60 (igual que antes).
    this.hash = new SpatialHash(world.size, Math.max(60, SIM_P.mateRadius)); this.hash.setCapacity(cap);
    this.kills = 0; this.sexBirths = 0; this.asexBirths = 0; this.starved = 0;   // instrumentación: depredación · vía reproductiva · muertes por inanición (causas de muerte = kills + starved)
    this.scavenged = 0;   // instrumentación: energía total rebañada del detrito (carroñeo) — para medir el flujo del nicho
    // INGRESO POR AGENTE (acumulativo): de dónde saca la energía cada animal → pasto (veg) / caza / carroña. Solo ESCRITURA
    // (la dinámica no lo lee) → byte-idéntico. Revela el OFICIO real emergente (herbívoro/carnívoro/carroñero) para medir y para el inspector.
    this.vegIn = new Float32Array(cap); this.preyIn = new Float32Array(cap); this.scavIn = new Float32Array(cap);
    // PERCEPCIÓN POR AGENTE (solo ESCRITURA, como vegIn → byte-idéntico): dirección unitaria al estímulo más saliente
    // (senseX/Y, mundo) + intensidad [0,1] (senseMag). Lo escribe el sensado del cerebro; lo lee el render para ORIENTAR y
    // AVIVAR los ojos (todos los organismos sensan → todos tienen ojos; miran a su presa/amenaza). La dinámica nunca lo lee.
    this.senseX = new Float32Array(cap); this.senseY = new Float32Array(cap); this.senseMag = new Float32Array(cap);
    // CADÁVERES (#3): buffer CIRCULAR acotado de muertes recientes (forma + posición + linaje + rumbo + tick de muerte) →
    // el render dibuja cuerpos que se desvanecen con su carroña ("muerte visible"). Solo lo ESCRIBE el motor / lo LEE el
    // snapshot; la dinámica no lo lee → byte-idéntico. Preasignado (sin asignaciones en el bucle caliente).
    this.CORPSE_CAP = 400; this.CORPSE_MAXP = 32;   // 32 = GENOME_P.partBudget (tope de partes por cuerpo)
    this.ccx = new Float32Array(this.CORPSE_CAP); this.ccy = new Float32Array(this.CORPSE_CAP); this.cch = new Float32Array(this.CORPSE_CAP);
    this.cchue = new Float32Array(this.CORPSE_CAP); this.cct0 = new Float32Array(this.CORPSE_CAP); this.ccn = new Int32Array(this.CORPSE_CAP);
    this.ccData = new Float32Array(this.CORPSE_CAP * this.CORPSE_MAXP * 5); this.ccHead = 0;   // [lx,ly,r,aspect,dir] por parte
    // M6.3 — cerebro: COPIA DE TRABAJO de pesos por agente (aprendida en vida; NO heredable) + estado oculto recurrente.
    this.wbrain = new Float32Array(cap * BRAIN_W); this.hidden = new Float32Array(cap * BRAIN.H);
    this._in = new Float32Array(BRAIN.I); this._hid = new Float32Array(BRAIN.H); this._out = new Float32Array(BRAIN.O);
    // NACIMIENTOS DIFERIDOS del tick (preasignados → sin asignar en el bucle caliente, regla §2). Cada cría: refs a genoma/
    // cuerpo/fenotipo + x/y/E. Tope = cap (un agente cría ≤1 vez/tick y los recién nacidos no están activos este tick).
    // x/y/E en Array (DOBLE), no Float32Array: la coord de cría se compara contra el wrap toroidal ANTES de almacenarse en
    // this.x (f32); truncarla a f32 aquí cambiaría decisiones de wrap en el borde → deriva del checksum. Doble = byte-idéntico.
    this._bornG = new Array(cap); this._bornBody = new Array(cap); this._bornPh = new Array(cap);
    this._bornX = new Array(cap); this._bornY = new Array(cap); this._bornE = new Array(cap);
  }

  // cachea el cuerpo desarrollado + su fenotipo en la SoA del slot i (lo leen el render y las transacciones)
  _setBody(i, parts, ph) { this.body[i] = parts;
    this.mass[i] = ph.mass; this.vmax[i] = ph.vmax; this.drag[i] = ph.drag;
    this.mouthCap[i] = ph.mouthCap; this.maxMouthR[i] = ph.maxMouthR; this.thrust[i] = ph.thrust; }
  _expr(i) { const parts = develop(this.genome[i]); this._setBody(i, parts, computePhenotype(parts)); }

  // CADÁVER (#3): vuelca la forma del organismo que muere al buffer circular (solo render; no toca la dinámica). Hay que
  // llamarlo ANTES de anular genome[i]/body[i]. Copia acotada de partes (sin asignar) → respeta el presupuesto del bucle.
  _recordCorpse(i) { const parts = this.body[i]; if (!parts) return; const c = this.ccHead, MP = this.CORPSE_MAXP;
    const n = parts.length < MP ? parts.length : MP, vx = this.vx[i], vy = this.vy[i];
    this.ccx[c] = this.x[i]; this.ccy[c] = this.y[i]; this.cch[c] = (vx * vx + vy * vy) > 1e-6 ? Math.atan2(vy, vx) : 0;
    this.cchue[c] = this.genome[i] ? this.genome[i].hue : 0; this.cct0[c] = this.tick; this.ccn[c] = n;
    let o = c * MP * 5; for (let k = 0; k < n; k++) { const p = parts[k]; this.ccData[o] = p.x; this.ccData[o + 1] = p.y; this.ccData[o + 2] = p.r; this.ccData[o + 3] = p.aspect; this.ccData[o + 4] = p.dir; o += 5; }
    this.ccHead = (c + 1) % this.CORPSE_CAP; }

  spawn(genome, x, y, E, parts = null, ph = null) {
    if (this.freeTop === 0) return -1; const i = this.free[--this.freeTop];
    this.alive[i] = 1; this.serial[i] = ++this._serial; this.genome[i] = genome;
    this.reproK[i] = genome.reproK != null ? genome.reproK : 1.0; this.investFrac[i] = genome.investFrac != null ? genome.investFrac : 0.4375;   // r/K: cachea los genes de historia de vida al nacer
    if (this.freezeBrain && genome.brain) genome.brain.set(this._seedBrain);   // control: anula la herencia/mutación del cerebro → todos usan el seedBrain canónico
    this.x[i] = x; this.y[i] = y; this.vx[i] = 0; this.vy[i] = 0; this.E[i] = E; this.gut[i] = 0; this.age[i] = 0;
    this.vegIn[i] = 0; this.preyIn[i] = 0; this.scavIn[i] = 0; this.senseMag[i] = 0;   // ingreso + percepción por agente: a cero al nacer
    this.cd[i] = (this.rng.next() * SIM_P.cooldown) | 0;
    if (parts) this._setBody(i, parts, ph); else this._expr(i);   // M2: reusa el cuerpo ya desarrollado en el gate (evita doble develop)
    // cerebro de trabajo = cerebro de NACIMIENTO (genoma); memoria a cero (la plasticidad parte de aquí; Baldwin)
    const b = genome.brain, wb = i * BRAIN_W; for (let k = 0; k < BRAIN_W; k++) this.wbrain[wb + k] = b ? b[k] : 0;
    const hb = i * BRAIN.H; for (let k = 0; k < BRAIN.H; k++) this.hidden[hb + k] = 0;
    return i;
  }

  // spread = fracción del mundo donde se siembra (1 = todo el mundo, uniforme = comportamiento actual; <1 = DISCO central
  // de radio spread·mundo/2). div = diversidad inicial (1 = normal · 0 = founders idénticos). Orden RNG: genoma → x → y
  // (idéntico al actual) → spread=1 & div=1 es byte-idéntico.
  seed(n, spread = 1, div = 1) { const W = this.world, rng = this.rng, S = W.size, c = S * 0.5;
    // TONO DE LINAJE de arranque: ALEATORIO por mundo pero COMPARTIDO por todos los fundadores → a div=0 todos el MISMO color
    // (aleatorio, NO fijo); a div>0 se dispersa por el círculo. Sale de un RNG APARTE derivado de la semilla → NO consume el rng
    // dinámico → el dorado NO se mueve (la hue es render-only, no la lee la dinámica). Mismo seed → mismo color (reproducible).
    const baseHue = this.rngSeed == null ? Math.random() : makeRng(((this.rngSeed >>> 0) ^ 0x9e3779b9) >>> 0).next();
    for (let k = 0; k < n; k++) {
      const g = makeFounder(rng, div, baseHue);
      let x, y;
      if (spread >= 1) { x = rng.next() * S; y = rng.next() * S; }                                  // uniforme (actual)
      else { const ang = rng.next() * 6.283185307, rr = spread * c * Math.sqrt(rng.next()); x = c + Math.cos(ang) * rr; y = c + Math.sin(ang) * rr; }   // disco central
      this.spawn(g, x, y, SIM_P.initE);
    } }

  // materia del vecindario (para que la cría construya su cuerpo) — gate de natalidad endógeno (2.1)
  _nutrientAround(cell, R) { const W = this.world, cols = W.cols, rows = W.rows, cx = cell % cols, cy = (cell / cols) | 0; let s = 0;
    for (let dy = -R; dy <= R; dy++) { const yy = ((cy + dy) % rows + rows) % rows; for (let dx = -R; dx <= R; dx++) { const xx = ((cx + dx) % cols + cols) % cols; s += W.nutrient[yy * cols + xx]; } } return s; }
  _takeNutrientAround(cell, R, amount) { const W = this.world, total = this._nutrientAround(cell, R); if (total <= 0) return; const f = amount / total, cols = W.cols, rows = W.rows, cx = cell % cols, cy = (cell / cols) | 0;
    for (let dy = -R; dy <= R; dy++) { const yy = ((cy + dy) % rows + rows) % rows; for (let dx = -R; dx <= R; dx++) { const idx = yy * cols + ((cx + dx) % cols + cols) % cols; W.nutrient[idx] -= W.nutrient[idx] * f; } } }

  // M7 — pareja compatible más cercana (hash): vivo, dentro de mateRadius, distancia FENOTÍPICA < mateCompat. El
  // apareamiento asortativo por divergencia morfológica (métrica fenotípica fija de 3 ejes, no señal↔preferencia
  // evolvable; aislamiento clinal, no especies discretas — ver mateCompat y m7). -1 si no hay.
  _findMate(i) {
    const P = SIM_P, size = this.world.size, mr2 = P.mateRadius * P.mateRadius;
    const hc = this.hash.cell, hx = (this.x[i] / hc) | 0, hy = (this.y[i] / hc) | 0;
    let best = -1, bestD = mr2;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const gx = ((hx + ox) % this.hash.cols + this.hash.cols) % this.hash.cols, gy = ((hy + oy) % this.hash.rows + this.hash.rows) % this.hash.rows;
      let j = this.hash.head[gy * this.hash.cols + gx];
      while (j !== -1) { if (j !== i && this.alive[j]) {
        let dx = this.x[j] - this.x[i], dy = this.y[j] - this.y[i]; if (dx > size * 0.5) dx -= size; else if (dx < -size * 0.5) dx += size; if (dy > size * 0.5) dy -= size; else if (dy < -size * 0.5) dy += size;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD &&   // compatibilidad fenotípica (masa/boca/presa-manejable normalizadas) < umbral
            phenoDistance(this.mass[i], this.mouthCap[i], this.maxMouthR[i], this.mass[j], this.mouthCap[j], this.maxMouthR[j]) < P.mateCompat) { bestD = d2; best = j; }
      } j = this.hash.next[j]; }
    }
    return best;
  }

  step() {
    const W = this.world, rng = this.rng, size = W.size, P = SIM_P;
    W.setDayNight(this.tick); W.stepLight(this.tick);   // corriente del abismo: el campo de luz puede derivar en el tiempo
    let na = 0; for (let i = 0; i < this.cap; i++) if (this.alive[i]) this.active[na++] = i; this.nA = na;
    this.hash.clear();
    for (let a = 0; a < na; a++) { const i = this.active[a]; this.hash.insert(i, this.x[i], this.y[i]); }

    const x = this.x, y = this.y, vx = this.vx, vy = this.vy, E = this.E;
    const bG = this._bornG, bBody = this._bornBody, bPh = this._bornPh, bX = this._bornX, bY = this._bornY, bE = this._bornE;
    let nBorn = 0;   // nacimientos diferidos de este tick → índice en los buffers preasignados (spawn al final del tick)
    for (let a = 0; a < na; a++) {
      const i = this.active[a]; if (!this.alive[i]) continue;   // pudo morir antes en ESTE tick (depredación)
      const cell = W.cellAt(x[i], y[i]);
      const E0 = E[i];   // M6.3: reservas al inicio del tick → recompensa de plasticidad = ΔE
      const reproEi = P.reproE * this.reproK[i];   // r/K: umbral de cría de ESTE organismo = baseline (lab) · gen reproK → alimenta hambre y gate de cría
      // (Los animales NO fotosintetizan: la luz la capta la VEGETACIÓN del mundo. El animal obtiene energía PASTÁNDOLA, cazando o carroñeando, abajo.)

      // ---- SENSADO: ∇vegetación (olor a comida) + ∇detrito + presa/amenaza más cercanas (un barrido del hash) ----
      const cols = W.cols, rows = W.rows, cx = cell % cols, cy = (cell / cols) | 0;
      // Vecinos TOROIDALES (el mundo envuelve) → gradientes coherentes también en las celdas de borde. Índices envueltos.
      const xl = cx > 0 ? cell - 1 : cell + (cols - 1), xr = cx < cols - 1 ? cell + 1 : cell - (cols - 1);
      const yt = cy > 0 ? cell - cols : cell + (rows - 1) * cols, yb = cy < rows - 1 ? cell + cols : cell - (rows - 1) * cols;
      const lgx = (W.veg[xr] - W.veg[xl]) * 2, lgy = (W.veg[yb] - W.veg[yt]) * 2;   // ∇vegetación: hacia dónde hay más comida (pasto)
      // #4 — ∇detritusE (olor a carroña): gradiente de energía residual hacia celdas vecinas. K=20 mapea un gradiente
      // típico (stock ~0.02/celda) a un rango útil para tanh; se acota a [-1,1] como ∇luz. Permite que la conducta
      // carroñera EVOLUCIONE a rastrear carroña (no solo rebañar la celda donde se está).
      const dgx = (W.detritusE[xr] - W.detritusE[xl]) * 20, dgy = (W.detritusE[yb] - W.detritusE[yt]) * 20;
      let preyJ = -1, preyD = 1e9, preyDX = 0, preyDY = 0, thD = 1e9, thDX = 0, thDY = 0;
      const myMass = this.mass[i], myMouth = this.mouthCap[i], myReach = this.maxMouthR[i] * P.preyMassMax;
      { const hc = this.hash.cell, hx = (x[i] / hc) | 0, hy = (y[i] / hc) | 0;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const gx = ((hx + ox) % this.hash.cols + this.hash.cols) % this.hash.cols, gy = ((hy + oy) % this.hash.rows + this.hash.rows) % this.hash.rows;
          let j = this.hash.head[gy * this.hash.cols + gx];
          while (j !== -1) { if (j !== i && this.alive[j]) {
            let dx = x[j] - x[i], dy = y[j] - y[i]; if (dx > size * 0.5) dx -= size; else if (dx < -size * 0.5) dx += size; if (dy > size * 0.5) dy -= size; else if (dy < -size * 0.5) dy += size;
            const d2 = dx * dx + dy * dy;
            if (myMouth > 0 && this.mass[j] < myMass && this.mass[j] <= myReach && d2 < preyD) { preyD = d2; preyJ = j; preyDX = dx; preyDY = dy; }       // presa (puedo comerla)
            if (this.mouthCap[j] > 0 && myMass < this.mass[j] && myMass <= this.maxMouthR[j] * P.preyMassMax && d2 < thD) { thD = d2; thDX = dx; thDY = dy; } // amenaza (puede comerme)
          } j = this.hash.next[j]; } }
      }
      if (preyJ >= 0) { const m = Math.sqrt(preyD) || 1; preyDX /= m; preyDY /= m; }
      if (thD < 1e9) { const m = Math.sqrt(thD) || 1; thDX /= m; thDY /= m; }
      // PERCEPCIÓN para el render (write-only): el ojo mira al estímulo más saliente — AMENAZA antes que presa (vigilancia) —
      // y se aviva con su cercanía; sin nada que sensar, mag=0 (el render hará que mire al rumbo, en calma). No toca la dinámica.
      if (thD < 1e9) { this.senseX[i] = thDX; this.senseY[i] = thDY; this.senseMag[i] = 1 - Math.min(1, Math.sqrt(thD) / SENSE_R); }
      else if (preyJ >= 0) { this.senseX[i] = preyDX; this.senseY[i] = preyDY; this.senseMag[i] = 1 - Math.min(1, Math.sqrt(preyD) / SENSE_R); }
      else this.senseMag[i] = 0;

      // ---- CEREBRO (forward Elman; pesos = copia de trabajo aprendida). Motor de la conducta; arranca SEMBRADO (seedBrain) y evoluciona/aprende. ----
      const I = BRAIN.I, H = BRAIN.H, O = BRAIN.O, inp = this._in, hid = this._hid, out = this._out, wb = i * BRAIN_W, hb = i * H, Wt = this.wbrain, PH = this.hidden;
      const wHh = I * H, bH = I * H + H * H, wHo = bH + H, bO = wHo + H * O;
      inp[0] = lgx < -1 ? -1 : lgx > 1 ? 1 : lgx; inp[1] = lgy < -1 ? -1 : lgy > 1 ? 1 : lgy; inp[2] = preyDX; inp[3] = preyDY; inp[4] = thDX; inp[5] = thDY;
      const h6 = (E[i] / reproEi) * 2 - 1; inp[6] = h6 > 1 ? 1 : h6 < -1 ? -1 : h6;   // B3: hambre acotada a [-1,1]; relativa al umbral PROPIO (r/K)
      const spd0 = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]); inp[7] = this.vmax[i] > 1e-4 ? (spd0 / this.vmax[i]) * 2 - 1 : -1;
      inp[8] = dgx < -1 ? -1 : dgx > 1 ? 1 : dgx; inp[9] = dgy < -1 ? -1 : dgy > 1 ? 1 : dgy;   // #4: ∇detrito (olor a carroña)
      for (let h = 0; h < H; h++) { let s = Wt[wb + bH + h]; for (let k = 0; k < I; k++) s += inp[k] * Wt[wb + k * H + h]; for (let p = 0; p < H; p++) s += PH[hb + p] * Wt[wb + wHh + p * H + h]; hid[h] = Math.tanh(s); }
      for (let o = 0; o < O; o++) { let s = Wt[wb + bO + o]; for (let h = 0; h < H; h++) s += hid[h] * Wt[wb + wHo + h * O + o]; out[o] = Math.tanh(s); }
      if (this.randomBehavior) { out[0] = rng.next() * 2 - 1; out[1] = rng.next() * 2 - 1; out[2] = rng.next() * 2 - 1; out[3] = rng.next() * 2 - 1; }   // control: ignora el cerebro

      // ---- MOVIMIENTO desde las salidas (0,1 dirección · 2 throttle); coste ∝ drag·v² ----
      const dxo = out[0], dyo = out[1], dm = Math.sqrt(dxo * dxo + dyo * dyo), throttle = (out[2] + 1) * 0.5;
      if (dm > 1e-3) { const sp = this.vmax[i] * throttle; vx[i] = dxo / dm * sp; vy[i] = dyo / dm * sp; } else { vx[i] *= 0.5; vy[i] *= 0.5; }
      let nx = x[i] + vx[i], ny = y[i] + vy[i]; if (nx < 0) nx += size; else if (nx >= size) nx -= size; if (ny < 0) ny += size; else if (ny >= size) ny -= size; x[i] = nx; y[i] = ny;
      const v2 = vx[i] * vx[i] + vy[i] * vy[i];

      // ---- INGESTA: el cerebro DECIDE comer (out[3] = abrir boca). La MISMA boca PASTA vegetación · CAZA presa viva ·
      // REBAÑA carroña → el eje herbívoro↔carnívoro EMERGE de a qué dedica su esfuerzo (y de qué hay donde está). CONSERVA. ----
      const attack = (out[3] + 1) * 0.5;
      const Gmax = P.gutBase + P.gutPerMass * this.mass[i];   // capacidad de tripa ∝ masa
      const eating = attack > 0.5 && myMouth > 0;
      // PASTOREO (adaptado de zenote1): la boca consume biomasa vegetal → energía a la tripa · la materia veg vuelve al nutriente.
      // RESERVA DE REBROTE (grazeRefuge): solo es pastable lo que excede grazeRefuge·K de cada celda → no se puede pelar a cero
      // (anti-sobrepastoreo). FORRAJEO POR ÁREA: un animal grande (mass alta) pasta de un vecindario de radio fR∝talla → accede a
      // más terreno (payoff de talla del herbívoro). CONSERVA: veg→nutriente (materia); veg·vegEcoef → tripa(ηene) + calor(resto).
      if (eating && this.gut[i] < Gmax) { const ec = W.P.vegEcoef, room = Gmax - this.gut[i];
        const kc = W.P.vegKcoef, lmd = W.lightMul * W.daylight, refF = P.grazeRefuge;
        const fR = P.forageReach > 0 ? Math.round(P.forageReach * Math.min(1, this.mass[i] / P.forageMassRef)) : 0;
        const grazable = (c) => { const a = W.veg[c] - refF * kc * W.light0[c] * lmd; return a > 0 ? a : 0; };
        let avail = 0;   // biomasa pastable disponible (por encima del refugio) en la celda o el área
        if (fR === 0) avail = grazable(cell);
        else { for (let dy = -fR; dy <= fR; dy++) { const yy = ((cy + dy) % rows + rows) % rows; for (let dx = -fR; dx <= fR; dx++) avail += grazable(yy * cols + ((cx + dx) % cols + cols) % cols); } }
        if (avail > 0) {
          let gb = P.grazeRate * myMouth; if (gb > avail) gb = avail;
          let eGain = gb * ec * P.ηene; if (eGain > room) { eGain = room; gb = room / (ec * P.ηene); }
          if (gb > 0) { const frac = gb / avail;   // mismo % de lo pastable en cada celda → deplea el área, CONSERVA (Σtomas = gb)
            if (fR === 0) { const t = grazable(cell) * frac; W.veg[cell] -= t; W.nutrient[cell] += t; }
            else { for (let dy = -fR; dy <= fR; dy++) { const yy = ((cy + dy) % rows + rows) % rows; for (let dx = -fR; dx <= fR; dx++) { const c = yy * cols + ((cx + dx) % cols + cols) % cols; const t = grazable(c) * frac; if (t > 0) { W.veg[c] -= t; W.nutrient[c] += t; } } } }
            const eRaw = gb * ec; this.gut[i] += eGain; W.heat += eRaw - eGain; this.vegIn[i] += eGain; } } }
      if (preyJ >= 0 && eating && this.gut[i] < Gmax && this.alive[preyJ]) { const reach = this.maxMouthR[i] + P.eatReach;   // SACIEDAD: tripa llena no caza
        // ESCAPE POR VELOCIDAD (fleeSpeed): la presa escapa de la captura si corre más rápido que el depredador (×fleeSpeed).
        // fleeSpeed=0 → siempre capturable dentro de `reach` (comportamiento antiguo: la velocidad no era ni defensa ni ataque →
        // nada premiaba el músculo → la locomoción se podaba y todo derivaba a lento). >0 → la velocidad RELATIVA decide la captura
        // → ser rápido es DEFENSA (presa que huye) y ATAQUE (depredador que alcanza) → carrera armamentística que mantiene el músculo
        // y el movimiento bajo selección. v2 = velocidad² del depredador (ya calculada arriba); preySp2 = la de la presa. CONSERVA
        // (un escape = no hay kill, no se mueve materia ni energía). Frontera genotipo→física: el programador define que correr ayuda
        // a cazar/huir; la selección decide cuánto músculo invertir. Sin estrategia cableada (el cerebro decide hacia dónde y cuánto).
        const preySp2 = vx[preyJ] * vx[preyJ] + vy[preyJ] * vy[preyJ];
        const caught = P.fleeSpeed <= 0 || v2 >= preySp2 * P.fleeSpeed * P.fleeSpeed;
        if (preyD < reach * reach && caught) { const pc = W.cellAt(x[preyJ], y[preyJ]);
          const preyEnergy = E[preyJ] + this.gut[preyJ] + this.mass[preyJ] * this.eD;   // reservas + tripa + cuerpo de la presa
          const ge = P.ηene * preyEnergy, room = Gmax - this.gut[i], intoGut = ge < room ? ge : room;
          this.gut[i] += intoGut; this.preyIn[i] += intoGut; W.detritusE[pc] += preyEnergy - intoGut;   // lo asimilable → TRIPA; el resto → detrito (CONSERVA)
          W.detritusM[pc] += this.mass[preyJ];
          this._recordCorpse(preyJ); this.alive[preyJ] = 0; this.free[this.freeTop++] = preyJ; this.genome[preyJ] = null; this.kills++; } }
      // CARROÑEO (#4): el MISMO gesto de "abrir boca" (attack) rebaña el detrito ENERGÉTICO (detritusE) de la celda —
      // energía residual de muertes/depredación que, si no, se descompondría a calor. CONSERVA: detritusE → tripa (mueve
      // energía dentro del sistema, no la crea). Frontera genotipo→física: el programador define que una boca puede comer
      // carroña; la selección decide quién lo explota. NINGUNA estrategia cableada → el nicho carroñero/descomponedor
      // EMERGE de cómo el organismo reparte su esfuerzo entre cazar presa viva, pastar luz y rebañar detrito.
      if (P.scavRate > 0 && myMouth > 0 && attack > 0.5 && this.gut[i] < Gmax) { const dAvail = W.detritusE[cell];
        if (dAvail > 0) { const room = Gmax - this.gut[i]; let take = P.scavRate * myMouth; if (take > dAvail) take = dAvail; if (take > room) take = room;
          if (take > 0) { W.detritusE[cell] -= take; this.gut[i] += take; this.scavenged += take; this.scavIn[i] += take; } } }
      // DIGESTIÓN: la tripa pasa a reservas a ritmo limitado (energía en tránsito → utilizable)
      if (this.gut[i] > 0) { const d = this.gut[i] < P.digestRate ? this.gut[i] : P.digestRate; this.gut[i] -= d; E[i] += d; }

      // METABOLISMO: reservas → calor (basal + ∝masa + nado). Muerte si se agotan → cuerpo a detrito.
      const mC = P.massCostExp === 1 ? this.mass[i] : Math.pow(this.mass[i], P.massCostExp);   // BALANCE: coste de masa super-lineal (exp>1 frena el bloat)
      const cost = P.baseCost + P.massCost * mC + P.moveCost * v2 * this.drag[i] + P.mouthCost * this.mouthCap[i];   // +mantenimiento de la boca (∝mouthCap) → boca bajo selección
      const spend = Math.min(E[i], cost); E[i] -= spend; W.heat += spend;
      if (E[i] <= 1e-6) { W.detritusM[cell] += this.mass[i]; W.detritusE[cell] += (E[i] > 0 ? E[i] : 0) + this.gut[i] + this.mass[i] * this.eD; this._recordCorpse(i); this.alive[i] = 0; this.free[this.freeTop++] = i; this.genome[i] = null; this.starved++; continue; }

      // ---- PLASTICIDAD (Hebbiano modulado por RECOMPENSA fisiológica = ΔE del tick; NO es objetivo de conducta) ----
      // El cerebro aprende EN VIDA lo que recupera energía (venga de donde venga) → suaviza los valles conductuales
      // (Baldwin). Modifica la copia de TRABAJO (Wt), nunca el cerebro de nacimiento (genoma) → no se hereda lo aprendido.
      if (!this.freezeBrain) { let reward = E[i] - E0; reward = reward > 0.5 ? 0.5 : reward < -0.5 ? -0.5 : reward; const lr = 0.02 * reward;
        if (lr !== 0) {
          for (let h = 0; h < H; h++) { const po = hid[h];
            for (let k = 0; k < I; k++) { const idx = wb + k * H + h; let w = Wt[idx] + lr * inp[k] * po; Wt[idx] = w < -3 ? -3 : w > 3 ? 3 : w; }
            for (let p = 0; p < H; p++) { const idx = wb + wHh + p * H + h; let w = Wt[idx] + lr * PH[hb + p] * po; Wt[idx] = w < -3 ? -3 : w > 3 ? 3 : w; } }
          for (let o = 0; o < O; o++) { const po = out[o]; for (let h = 0; h < H; h++) { const idx = wb + wHo + h * O + o; let w = Wt[idx] + lr * hid[h] * po; Wt[idx] = w < -3 ? -3 : w > 3 ? 3 : w; } }
        }
      }
      for (let h = 0; h < H; h++) PH[hb + h] = hid[h];   // memoria recurrente para el próximo tick

      // REPRODUCCIÓN asexual + MUTACIÓN: la cría desarrolla su (posiblemente mutado) cuerpo; su MATERIA sale del
      // nutriente local (gate endógeno: no nace sin materia), su ENERGÍA del progenitor. Conserva ambas.
      this.age[i]++; if (this.cd[i] > 0) this.cd[i]--;
      else if (E[i] >= reproEi) {   // r/K: cría al alcanzar el umbral PROPIO (gen reproK)
        const mate = P.reproMode !== 'asexual' ? this._findMate(i) : -1;   // M7: both/sexual buscan pareja compatible; asexual no
        // 'sexual' = OBLIGADA (sin respaldo asexual): sin pareja → no se reproduce este intento (ni desarrolla ni cobra).
        if (mate >= 0 || P.reproMode !== 'sexual') {
        const childG = mate >= 0 ? mutate(recombine(this.genome[i], this.genome[mate], rng), rng) : mutate(this.genome[i], rng);
        const childBody = develop(childG), childPh = computePhenotype(childBody);   // M2: desarrolla UNA vez; spawn lo reusa
        const investEi = this.investFrac[i] * reproEi;          // r/K: energía que ESTE progenitor pone en la cría (fracción de su umbral PROPIO)
        const eCost = investEi + childPh.mass * this.eD;        // ENERGÍA: reservas de la cría + energía EMBEBIDA en su cuerpo (M6.1)
        // A1 — RESERVAR el slot ANTES de cobrar. El nacimiento se difiere a `born` y se materializa con spawn() al
        // final del tick; si el pool estuviera lleno spawn devolvería -1 y la materia/energía YA cobradas aquí se
        // perderían (fuga de conservación). `freeTop - cunas ya comprometidas este tick` es el hueco disponible;
        // freeTop sólo CRECE con las muertes posteriores del bucle → exigirlo aquí es conservador y garantiza que
        // todo cobro nazca. (`nBorn` = nacimientos ya en cola este tick.)
        if (E[i] >= eCost && this.freeTop - nBorn > 0 && this._nutrientAround(cell, P.birthR) >= childPh.mass) {
          this._takeNutrientAround(cell, P.birthR, childPh.mass);   // MATERIA: nutriente → cuerpo de la cría
          E[i] -= eCost; this.cd[i] = P.cooldown;                   // el progenitor paga reservas + cuerpo de la cría
          if (mate >= 0) this.sexBirths++; else this.asexBirths++;
          bG[nBorn] = childG; bX[nBorn] = x[i] + (rng.next() - 0.5) * 6; bY[nBorn] = y[i] + (rng.next() - 0.5) * 6; bE[nBorn] = investEi; bBody[nBorn] = childBody; bPh[nBorn] = childPh; nBorn++;   // r/K: la cría nace con la inversión del progenitor
        }
        }
      }
    }
    for (let k = 0; k < nBorn; k++) { let bx = bX[k], by = bY[k];
      if (bx < 0) bx += size; else if (bx >= size) bx -= size; if (by < 0) by += size; else if (by >= size) by -= size;
      this.spawn(bG[k], bx, by, bE[k], bBody[k], bPh[k]); bG[k] = bBody[k] = bPh[k] = null; }   // libera las refs tras materializar (no retener entre ticks)

    W.vegStep(); W.decomposeStep(); W.diffuseStep(); this.tick++;   // la vegetación crece (capta luz) tras el pastoreo del tick
  }

  pop() { let p = 0; for (let i = 0; i < this.cap; i++) if (this.alive[i]) p++; return p; }
  totalMass() { let m = 0; for (let i = 0; i < this.cap; i++) if (this.alive[i]) m += this.mass[i]; return m; }
  totalE() { let e = 0; for (let i = 0; i < this.cap; i++) if (this.alive[i]) e += this.E[i]; return e; }
}
