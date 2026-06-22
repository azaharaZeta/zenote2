// CHECKSUM DORADO — regresión de determinismo + detección de deriva. La auditoría técnica (Tests) marcó la falta de un
// test de regresión de determinismo. Este: (1) corre el motor con seed fijo y exige que DOS corridas idénticas den el
// MISMO checksum (determinismo), y (2) ancla ese checksum a un valor DORADO → cualquier cambio NO intencionado de la
// dinámica del motor lo rompe. Si cambias la física A PROPÓSITO (p.ej. B2/B3), re-captura el dorado (imprime el valor).
//   uso: node zenote2/test/m8-determinism.mjs

import { World, WORLD_P } from '../src/engine/world.js';
import { Sim } from '../src/engine/sim.js';

// Checksum FNV-1a sobre el estado vivo, cuantizado (evita ruido de impresión f32; orden de slot determinista).
function checksum(s) {
  let h = 2166136261 >>> 0;
  const mix = (v) => { h = (Math.imul(h ^ (v | 0), 16777619)) >>> 0; };
  mix(s.tick); mix(s.pop());
  for (let i = 0; i < s.cap; i++) if (s.alive[i]) {
    mix(s.serial[i]);
    mix(Math.round(s.x[i] * 1000)); mix(Math.round(s.y[i] * 1000));
    mix(Math.round(s.E[i] * 1000)); mix(Math.round(s.mass[i] * 1000)); mix(Math.round(s.mouthCap[i] * 1000));
  }
  return h >>> 0;
}

function run(ticks) {
  const w = new World(1500, 1, { ...WORLD_P, lightBase: 2.5 });
  w.nutrient.fill(1.5); w.veg.fill(1.0);
  const s = new Sim(w, { seed: 1, cap: 4000 }); s.seed(800);
  for (let t = 0; t < ticks; t++) s.step();
  return { c: checksum(s), pop: s.pop(), tick: s.tick };
}

const GOLDEN = 0x65f6795f;   // re-fijado 2026-06-22: RUIDO FRACTAL (fBm multi-octava) en los campos de LUZ (productividad/pasto) y COVER
                             // (refugio) → zonas naturales irregulares en vez de pocos lóbulos lisos ("lámpara de lava"). La luz deriva (estructura
                             // grande fluye, detalle fino casi fijo); el cover queda fractal estático. Cambia el patrón espacial → re-fija dorado.
                             // Previos: 0xb6dce579 (cover smoothstep + sensor ∇cover, coverStrength 0.25), 0x2ccff67c (senescencia+lastre).
                             // Cambio INTENCIONADO (la topología del cerebro cambia → todo el genoma-cerebro distinto). Nicho SEPARABLE → la
                             // dispersión de talla sube (vs el refugio=veg que la bajaba); coexistencia OK. Previos: 0x2ccff67c (senescencia+lastre),
                             // 0x55828375 (reproMode='sexual'), 0x4bcdaeaa (diversidad inicial), 0xe8984a53 (homología #4), 0xf5375391 (coste boca),
                             // 0xebd987f9 (r/K dial→gen), 0xe5d3f569 (fleeSpeed). seed 1, cap 4000, 800 fund., 2000 ticks.
const TICKS = 2000;
console.log('=== Checksum dorado — determinismo + deriva ===\n');
const a = run(TICKS), b = run(TICKS);
const deterministic = a.c === b.c;
const matchesGolden = a.c >>> 0 === GOLDEN >>> 0;
console.log(`  corrida 1: checksum=0x${a.c.toString(16)} · pop=${a.pop} · tick=${a.tick}`);
console.log(`  corrida 2: checksum=0x${b.c.toString(16)} · pop=${b.pop}`);
console.log(`  1) Determinismo (misma seed → mismo estado) ... ${deterministic ? 'OK ✓' : 'FALLO ✗'}`);
console.log(`  2) Coincide con el DORADO 0x${(GOLDEN >>> 0).toString(16)} ...... ${matchesGolden ? 'OK ✓' : 'DERIVA ✗ (si es intencionada, fija GOLDEN = 0x' + a.c.toString(16) + ')'}`);

process.exit(deterministic && matchesGolden ? 0 : 1);
