// LEYES DEL MUNDO: la base física del motor. Dos monedas INDEPENDIENTES: MATERIA cerrada (cicla nutriente↔organismo↔detrito↔
// nutriente) y ENERGÍA abierta (entra como LUZ, se almacena, sale como CALOR). Campos en rejilla (∝ tamaño), toro.
//   MATERIA = Σ nutrient + Σ veg + Σ detritusM + Σ animales.mass = CONSTANTE
//   ENERGÍA = Σ animales.E + Σ veg·vegEcoef + Σ detritusE ; entra: lightCaptured (vía vegetación) ; sale: heat
// El PRODUCTOR es la VEGETACIÓN parametrizada: capta luz al crecer (vegStep); los animales la pastan (o cazan/carroñean, en
// sim). Toda transacción re-enruta materia (conserva) y contabiliza energía (disipa).

import { makeRng } from '../util/rng.js';
import { WORLD_P } from '../config.js';   // parámetros del mundo: fuente única en config.js
export { WORLD_P };

export class World {
  constructor(size, seed = 1, P = WORLD_P) {
    this.P = P; this.size = size;
    this.cols = Math.max(8, Math.round(size / P.cellRef)); this.rows = this.cols;
    this.cellW = size / this.cols;
    const N = this.cols * this.rows;
    this.light0 = new Float32Array(N);     // luz base espacial (heterogénea, periódica en el toro)
    this.nutrient = new Float32Array(N);   // N: materia inorgánica
    this.veg = new Float32Array(N);        // VEGETACIÓN: biomasa del productor (materia; energía embebida = veg·vegEcoef)
    this.detritusM = new Float32Array(N);  // materia orgánica muerta
    this.detritusE = new Float32Array(N);  // energía residual del detrito
    this._scratch = new Float32Array(N);
    this._diffScratch = new Float32Array(N);   // PERF: scratch único para la difusión (ping-pong, sin copia)
    this.cover = new Float32Array(N);      // COBERTURA: refugio ESTÁTICO no comestible → nicho separable; la captura lo lee si coverStrength>0
    this._buildLight(seed);
    this._buildCover(seed);
    // Libro mayor (acumuladores de energía abierta): monótonos.
    this.heat = 0;            // energía disipada que abandonó el sistema (sumidero; monótono ↑)
    this.lightCaptured = 0;   // energía que entró por la VEGETACIÓN al captar luz (fuente; monótono ↑)
    this.daylight = 1;        // multiplicador día/noche del tick actual
    this.lightMul = 1;        // multiplicador GLOBAL de luz (lab, en vivo): escala la productividad sin re-hornear light0
  }

  // COBERTURA: campo ESTÁTICO [0,1] en parches (ruido fBm), refugio NO comestible (escape ∝ cover_local·coverStrength) → nicho
  // separable "esconderse ≠ comer". No toca materia/energía. La lee la captura solo si coverStrength>0; el cerebro lo sensa por ∇cover.
  _buildCover(seed) {
    const rng = makeRng((seed ^ 0x5bf03635) >>> 0), cols = this.cols, rows = this.rows, lobes = [];
    let sumAmp = 0;
    // RUIDO FRACTAL (fBm), igual que la luz pero con su propia semilla → parches de refugio irregulares y naturales (no blobs). Estático.
    const octaves = [{ lo: 1, hi: 3, amp: 1.0, n: 3 }, { lo: 4, hi: 7, amp: 0.5, n: 3 }, { lo: 8, hi: 13, amp: 0.25, n: 3 }];
    for (const oc of octaves) for (let k = 0; k < oc.n; k++) { const kx = oc.lo + (rng.next() * (oc.hi - oc.lo + 1) | 0), ky = (rng.next() * (2 * oc.hi + 1) | 0) - oc.hi, ph = rng.next() * 6.283, amp = oc.amp * (0.7 + rng.next() * 0.6); lobes.push({ kx, ky, ph, amp }); sumAmp += amp; }
    const L = lobes.length, norm = sumAmp > 0 ? 1 / (0.62 * sumAmp) : 1, lo = 0.45, span = 1 - lo;   // smoothstep(lo,1): refugio solo donde el ruido es alto, con BORDES SUAVES (parches orgánicos)
    for (let y = 0; y < rows; y++) { const v = y / rows * 6.283;
      for (let x = 0; x < cols; x++) { const u = x / cols * 6.283;
        let n = 0; for (let k = 0; k < L; k++) { const l = lobes[k]; n += l.amp * Math.sin(l.kx * u + l.ky * v + l.ph); }
        n *= norm; const c01 = 0.5 + 0.5 * (n < -1 ? -1 : n > 1 ? 1 : n);   // ruido → [0,1]
        let t = (c01 - lo) / span; t = t < 0 ? 0 : t > 1 ? 1 : t;           // ventana [lo,1]
        this.cover[y * cols + x] = t * t * (3 - 2 * t);                     // smoothstep → transición suave (gradiente liso para ∇cover y render orgánico)
      } }
  }

  // Luz base = suma de lóbulos (ondas planas con freq/dir/fase aleatorias por semilla; freqs enteras → periódicas en el toro,
  // sin costura). Cada lóbulo lleva freqs/offsets de VAGABUNDEO para la deriva temporal (stepLight).
  _buildLight(seed) {
    const rng = makeRng(seed); this._lobes = []; let sumAmp = 0;
    // fBm: octavas de freq creciente y amplitud decreciente. Vagabundeo ∝ amplitud (wa) → solo las octavas grandes fluyen.
    const octaves = [{ lo: 1, hi: 3, amp: 1.0, n: 3 }, { lo: 4, hi: 7, amp: 0.5, n: 3 }, { lo: 8, hi: 14, amp: 0.25, n: 4 }];
    for (const oc of octaves) for (let k = 0; k < oc.n; k++) {
      const kx = oc.lo + (rng.next() * (oc.hi - oc.lo + 1) | 0);     // freq entera en la banda de la octava
      const ky = (rng.next() * (2 * oc.hi + 1) | 0) - oc.hi;         // orientación variada (-hi..hi)
      const ph = rng.next() * 6.283, amp = oc.amp * (0.7 + rng.next() * 0.6);
      const wf = [0.5 + rng.next() * 1.5, 0.5 + rng.next() * 1.5, 0.5 + rng.next() * 1.5];   // freqs de vagabundeo (incommensurables → cuasi-aperiódico)
      const wo = [rng.next() * 6.283, rng.next() * 6.283, rng.next() * 6.283];
      this._lobes.push({ kx, ky, ph, amp, wf, wo, wa: oc.amp }); sumAmp += amp;   // wa = escala de deriva (∝ amplitud → solo lo grande fluye)
    }
    this._lobeNorm = sumAmp > 0 ? 1 / (0.62 * sumAmp) : 1;   // normaliza a ~[-1,1] (factor <1 = más contraste; se clampa)
    this._ep = new Float64Array(this._lobes.length);         // fase efectiva por lóbulo (preasignada; sin asignar en re-horneado)
    this._precomputeLight();   // PERF: tablas sin/cos para re-hornear la luz sin Math.sin por celda (ver _fillLight)
    this._fillLight(0);
  }

  // PERF — precomputa 1× por mundo las tablas 1D sin/cos de kx·u (por columna) y ky·v (por fila) por lóbulo. Como θ=kx·u+ky·v
  // es ESTÁTICO y solo la fase ep deriva, sin(θ+ep)=sinθ·cos ep+cosθ·sin ep se evalúa en el bucle de celdas SIN trascendentes
  // (era el coste #1 del tick). Byte-idéntico: la diferencia sub-ULP la absorbe el f32 de light0. Memoria O(L·(cols+rows)).
  _precomputeLight() {
    const lobes = this._lobes, L = lobes.length, cols = this.cols, rows = this.rows, T = 6.283;   // 6.283 (no 2π exacto): mismo factor en todo el campo
    this._SU = new Float64Array(cols * L); this._CU = new Float64Array(cols * L);   // sin/cos(kx·u) por columna×lóbulo
    this._SV = new Float64Array(rows * L); this._CV = new Float64Array(rows * L);   // sin/cos(ky·v) por fila×lóbulo
    this._amp = new Float64Array(L); this._ce = new Float64Array(L); this._se = new Float64Array(L);   // amp del lóbulo · cos/sin(ep) (se rellenan por re-horneado)
    for (let k = 0; k < L; k++) { const l = lobes[k]; this._amp[k] = l.amp;
      for (let x = 0; x < cols; x++) { const a = l.kx * (x / cols * T); this._SU[x * L + k] = Math.sin(a); this._CU[x * L + k] = Math.cos(a); }
      for (let y = 0; y < rows; y++) { const b = l.ky * (y / rows * T); this._SV[y * L + k] = Math.sin(b); this._CV[y * L + k] = Math.cos(b); }
    }
  }

  // Rellena light0 en el "tiempo de flujo" s: cada lóbulo vagabundea su fase → al avanzar s las zonas se forman/mueven. s=0 = base.
  _fillLight(s) {
    const { cols, rows } = this, P = this.P, lobes = this._lobes, L = lobes.length, norm = this._lobeNorm, ep = this._ep, WA = 3.0;
    const SU = this._SU, CU = this._CU, SV = this._SV, CV = this._CV, amp = this._amp, ce = this._ce, se = this._se;
    for (let k = 0; k < L; k++) { const l = lobes[k];   // fase efectiva del lóbulo (vagabundeo) + sus cos/sin → 1× por re-horneado, no por celda
      ep[k] = l.ph + WA * l.wa * (Math.sin(s * l.wf[0] + l.wo[0]) + 0.6 * Math.sin(s * l.wf[1] + l.wo[1]) + 0.4 * Math.sin(s * l.wf[2] + l.wo[2]));
      ce[k] = Math.cos(ep[k]); se[k] = Math.sin(ep[k]); }
    const base = P.lightBase, oneMinus = 1 - P.lightContrast, contrast = P.lightContrast;
    for (let y = 0; y < rows; y++) { const svB = y * L, row = y * cols;
      for (let x = 0; x < cols; x++) { const suB = x * L;
        let n = 0;
        for (let k = 0; k < L; k++) {   // n += amp·sin(θ+ep); sin(θ+ep)=sinθ·ce+cosθ·se, con sinθ=SU·CV+CU·SV, cosθ=CU·CV−SU·SV (fórmula de la suma; sin trascendentes aquí)
          const su = SU[suB + k], cu = CU[suB + k], sv = SV[svB + k], cv = CV[svB + k];
          n += amp[k] * ((su * cv + cu * sv) * ce[k] + (cu * cv - su * sv) * se[k]);
        }
        n *= norm; n = n < -1 ? -1 : n > 1 ? 1 : n;                         // clamp [-1,1]
        this.light0[row + x] = base * (oneMinus + contrast * (0.5 + 0.5 * n));
      }
    }
  }

  // CORRIENTE DEL ABISMO: re-hornea la luz avanzando s = lightFlow·tick → el fondo fluye y los organismos lo persiguen (∇luz).
  // Throttle por lightFlowEvery. lightFlow=0 → no cambia tras el horneado inicial (byte-idéntico). Determinista (función de tick).
  stepLight(tick) {
    const P = this.P; if (!(P.lightFlow > 0) || tick % P.lightFlowEvery !== 0) return;
    this._fillLight(P.lightFlow * tick);
  }

  cellAt(x, y) {
    let cx = (x / this.cellW) | 0, cy = (y / this.cellW) | 0;
    if (cx < 0) cx = 0; else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0; else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  // Ciclo día/noche (multiplicador global ∈ [1-amp, 1+amp], ≥0).
  setDayNight(tick) {
    const P = this.P;
    this.daylight = P.dayNightAmp > 0 ? Math.max(0, 1 + P.dayNightAmp * Math.sin(tick / P.dayNightPeriod * 6.283)) : 1;
  }

  // VEGETACIÓN (productor parametrizado): crece logísticamente captando LUZ y consumiendo NUTRIENTE, senesce a detrito.
  // K(celda) = vegKcoef·luz local → los parches siguen al campo de luz. Conserva. Frontera genotipo→física: es física del mundo (no evoluciona).
  vegStep() {
    const P = this.P, veg = this.veg, N = this.nutrient, Dm = this.detritusM, prev = this._scratch;
    const g = P.vegGrowth, kc = P.vegKcoef, ec = P.vegEcoef, dec = P.vegDecay, seed = P.vegSeed, lm = this.lightMul * this.daylight;
    const cols = this.cols, rows = this.rows, cm1 = cols - 1, lbase = P.lightBase || 1; let p = P.patchiness || 0; if (p > 1) p = 1;
    prev.set(veg);   // snapshot del tick previo → rebrote orden-independiente (como zenote1)
    for (let y = 0; y < rows; y++) {
      const up = ((y - 1 + rows) % rows) * cols, dn = ((y + 1) % rows) * cols, rw = y * cols;
      for (let x = 0; x < cols; x++) {
        const i = rw + x, K = kc * this.light0[i] * lm;
        if (K > 1e-6) { const r = prev[i], head = K - r;
          if (head > 0) {
            let inc;
            if (p <= 0) inc = g * (r + seed) * (1 - r / K);                          // logístico simple
            else {                                                                    // logístico + DIFUSIÓN de semilla → parches migrantes
              const xl = x === 0 ? cm1 : x - 1, xr = x === cm1 ? 0 : x + 1;   // PERF: sin % (idéntico a (x∓1+cols)%cols)
              const meanNb = (prev[rw + xl] + prev[rw + xr] + prev[up + x] + prev[dn + x]) * 0.25;
              const seeded = g * (seed + r / K + meanNb / K);                         // crece donde ya hay pasto o lo hay al lado (siembra al vecindario)
              inc = (1 - p) * (g * (r + seed) * (1 - r / K)) + p * seeded;
            }
            // PRODUCTIVIDAD ∝ LUZ: la veg crece más rápido donde hay más luz (factor light/lightBase ∈ ~[0.3,1]) → las zonas
            // frondosas SIGUEN al campo de luz → la "Corriente del abismo" (deriva de la luz) MUEVE la vegetación visiblemente.
            inc *= (this.light0[i] * lm) / lbase;
            if (inc > head) inc = head; if (inc < 0) inc = 0;
            if (inc > 0) { let take = inc; if (take > N[i]) take = N[i]; if (take > 0) { veg[i] += take; N[i] -= take; this.lightCaptured += take * ec; } }   // materia nutriente→veg; energía luz captada
          }
        }
        if (veg[i] > 0) { const die = dec * veg[i]; veg[i] -= die; Dm[i] += die; this.heat += die * ec; }   // senescencia: materia→detrito, energía→calor
      }
    }
  }

  // Descomposición del detrito (por tick): materia → nutriente (CONSERVA), energía residual → calor (DISIPA).
  decomposeStep() {
    const r = this.P.decompose; if (r <= 0) return;
    const Dm = this.detritusM, De = this.detritusE, N = this.nutrient;
    for (let i = 0; i < Dm.length; i++) {
      if (Dm[i] > 0) { const d = Dm[i] * r; Dm[i] -= d; N[i] += d; }          // materia: detrito → nutriente
      if (De[i] > 0) { const d = De[i] * r; De[i] -= d; this.heat += d; }      // energía: residual → calor (se va)
    }
  }

  // Difusión conservativa (4 vecinos, toro) de un campo, por PING-PONG (sin `prev.set`) y sin `%` por celda (split interior/borde).
  // Byte-idéntico al Jacobi previo. 4 pasadas separadas (2 arrays/pasada, cache-friendly; NO fusionar: 8 arrays saturan L2 en mundos
  // grandes). Reapuntar this[name] es seguro: sim/worker leen W.<campo>[i] en vivo.
  _diffuse(name, rate) {
    if (rate <= 0) return;
    const cols = this.cols, rows = this.rows, cm1 = cols - 1, src = this[name], dst = this._diffScratch;
    for (let y = 0; y < rows; y++) {
      const up = ((y - 1 + rows) % rows) * cols, dn = ((y + 1) % rows) * cols, row = y * cols;
      for (let x = 0; x < cols; x++) {
        const i = row + x;
        const xl = x === 0 ? row + cm1 : i - 1, xr = x === cm1 ? row : i + 1;   // idéntico a row+((x∓1+cols)%cols), sin %
        const mean4 = (src[xl] + src[xr] + src[up + x] + src[dn + x]) * 0.25;
        dst[i] = src[i] + rate * (mean4 - src[i]);
      }
    }
    this[name] = dst; this._diffScratch = src;   // swap: el campo pasa a ser el recién calculado; el viejo buffer queda de scratch
  }
  diffuseStep() { this._diffuse('nutrient', this.P.diffuseN); this._diffuse('veg', this.P.vegDiffuse); this._diffuse('detritusM', this.P.diffuseDet); this._diffuse('detritusE', this.P.diffuseDet); }

  // --- Totales del libro mayor (para invariantes) ---
  totalNutrient() { let s = 0; for (let i = 0; i < this.nutrient.length; i++) s += this.nutrient[i]; return s; }
  totalVeg() { let s = 0; for (let i = 0; i < this.veg.length; i++) s += this.veg[i]; return s; }   // biomasa vegetal (materia); su energía = ·vegEcoef
  totalDetritusM() { let s = 0; for (let i = 0; i < this.detritusM.length; i++) s += this.detritusM[i]; return s; }
  totalDetritusE() { let s = 0; for (let i = 0; i < this.detritusE.length; i++) s += this.detritusE[i]; return s; }
}
