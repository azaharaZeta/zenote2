// PERF BENCH (a mano, NO gate) — desglosa el coste por tick: bucle de AGENTES vs rejilla de CAMPOS (veg/difusión/luz),
// y escala con el tamaño del mundo + nº de organismos. Objetivo: ver qué domina en mundos grandes.
//   uso: node spikes/perf-bench.mjs
import { World, WORLD_P } from '../src/engine/world.js';
import { Sim } from '../src/engine/sim.js';

function instrument(world) {
  const acc = { vegStep: 0, decomposeStep: 0, diffuseStep: 0, stepLight: 0, setDayNight: 0 };
  for (const name of Object.keys(acc)) {
    const orig = world[name].bind(world);
    world[name] = (...a) => { const t0 = performance.now(); const r = orig(...a); acc[name] += performance.now() - t0; return r; };
  }
  return acc;
}

function run({ size, founders, ticks, cap }) {
  const w = new World(size, 1, { ...WORLD_P, lightBase: 2.5 });
  w.nutrient.fill(1.5); w.veg.fill(1.0);
  const s = new Sim(w, { seed: 1, cap });
  s.seed(founders);
  // warmup: deja que la población se estabilice y la veg tome forma (no medido)
  const warm = Math.min(1500, (ticks / 2) | 0);
  for (let t = 0; t < warm; t++) s.step();
  const acc = instrument(w);
  const t0 = performance.now();
  let popSum = 0, popN = 0;
  for (let t = 0; t < ticks; t++) { s.step(); if (t % 50 === 0) { popSum += s.pop(); popN++; } }
  const total = performance.now() - t0;
  const grid = acc.vegStep + acc.decomposeStep + acc.diffuseStep + acc.stepLight + acc.setDayNight;
  const rest = total - grid;
  const cells = w.cols * w.rows;
  const avgPop = popSum / popN;
  return { size, cells, avgPop, ticks, total, grid, rest, acc, tps: ticks / (total / 1000),
           usPerTick: (total / ticks) * 1000, usGrid: (grid / ticks) * 1000, usRest: (rest / ticks) * 1000 };
}

function fmt(r) {
  const pct = (x) => ((x / r.total) * 100).toFixed(0).padStart(3);
  console.log(`size ${String(r.size).padStart(4)} · ${String(r.cells).padStart(6)} celdas · pop~${r.avgPop.toFixed(0).padStart(4)} | ` +
    `${r.tps.toFixed(0).padStart(5)} t/s · ${r.usPerTick.toFixed(0).padStart(4)}µs/tick | ` +
    `REJILLA ${r.usGrid.toFixed(0).padStart(4)}µs (${pct(r.grid)}%)  AGENTES+hash ${r.usRest.toFixed(0).padStart(4)}µs (${pct(r.rest)}%)`);
  console.log(`            ↳ veg ${(r.acc.vegStep / r.ticks * 1000).toFixed(0)}µs · decomp ${(r.acc.decomposeStep / r.ticks * 1000).toFixed(0)}µs · diffuse ${(r.acc.diffuseStep / r.ticks * 1000).toFixed(0)}µs · luz ${(r.acc.stepLight / r.ticks * 1000).toFixed(0)}µs`);
}

console.log('=== Zenote2 perf bench — desglose por tick (warmup excluido) ===\n');
console.log('# Escala con el TAMAÑO del mundo (founders ∝ área para densidad ~constante):');
for (const size of [1500, 2250, 3000, 4000]) {
  const founders = Math.round(100 * (size / 1500) ** 2);
  fmt(run({ size, founders, ticks: 1200, cap: 30000 }));
}
console.log('\n# Mundo fijo (1500), variando densidad inicial (estrés del bucle de agentes):');
for (const founders of [200, 800, 2000]) {
  fmt(run({ size: 1500, founders, ticks: 1200, cap: 30000 }));
}
