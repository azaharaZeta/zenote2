// CLIENTE DE RENDER. El motor corre en un Web Worker (engine/worker.js); aquí solo se dibuja desde las "fotos" y se
// maneja la CÁMARA (zoom + paneo toroidal) + los controles. Render puro: no toca la sim ni el dorado.

import { TISSUE } from './engine/genome.js';
import { RENDER_P, START, SIM_P, GENOME_P, WORLD_P, QUALITY } from './config.js';   // fuente única de parámetros

const worker = new Worker(new URL('./engine/worker.js', import.meta.url), { type: 'module' });
let WORLD = null, frame = null;
worker.onmessage = (e) => { const m = e.data; if (m.type === 'world') { WORLD = m; resetCamera(); bakeCover(); } else if (m.type === 'frame') { frame = m; if (m.veg) bakeVeg(m.veg); } };   // fondo = vegetación (cada frame) + cobertura estática (refugio, una vez en 'world')

const canvas = document.getElementById('world'), ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
let cw = 0, ch = 0, vignette = null;
// CALIDAD gráfica: preset activo `Q` (umbrales LOD + resolución + atmósfera); `dpr` y `bloomStrength` se derivan. Cambiable
// en vivo (setQuality) sin tocar la sim. 'baja' = móvil.
let quality = RENDER_P.quality, Q = QUALITY[quality] || QUALITY.alta;
let dpr = Math.min(Q.dprCap, window.devicePixelRatio || 1);
// BLOOM: la capa de organismos (glowCv) reducida + reescalada aditiva → glow suave; factor ∝ zoom. Vía downsample/drawImage,
// no ctx.filter blur (Safari<16.4 lo ignora). bloomStrength=0 lo apaga (Baja/móvil).
const glowCv = document.createElement('canvas'), glowCtx = glowCv.getContext('2d');
const bloomCv = document.createElement('canvas'), bloomCtx = bloomCv.getContext('2d');
const bloom2Cv = document.createElement('canvas'), bloom2Ctx = bloom2Cv.getContext('2d');   // 2º búfer del bloom: pre-blur del búfer pequeño (suaviza la rejilla del reescalado)
let bloomStrength = RENDER_P.bloom * Q.bloom; const BLOOM_DIV = RENDER_P.bloomDiv;   // bloom efectivo = base × factor de calidad (0 en 'baja' → sin glow/plancton/nieve)
// FONDO DEL ABISMO = vegetación: el campo veg de cada frame se hornea a mini-textura (1 px/celda) y se reescala suavizado →
// nebulosa verde sobre abismo. Fluye con la luz.
const vegCv = document.createElement('canvas');
let depthField = null;   // nebulosa de profundidad: campo frío↔cálido (toroidal, estático) fundido en el bake → el abismo no es teal plano
let vegBlurA = null, vegBlurB = null;   // scratch del blur toroidal del veg en el render (persistente entre frames)
function bakeVeg(veg) {
  if (!WORLD) return;
  // contraste auto: normaliza por el relieve (media + desviación) → revela regiones ricas/pobres sin amplificar ruido.
  const cols = WORLD.cols, rows = WORLD.rows, N = cols * rows;
  // blur toroidal ligero (render): suaviza la rejilla.
  if (!vegBlurA || vegBlurA.length !== N) { vegBlurA = new Float32Array(N); vegBlurB = new Float32Array(N); }
  vegBlurA.set(veg);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < rows; y++) { const yp = (y - 1 + rows) % rows, yn = (y + 1) % rows;
      for (let x = 0; x < cols; x++) { const xp = (x - 1 + cols) % cols, xn = (x + 1) % cols;
        vegBlurB[y * cols + x] = (vegBlurA[yp * cols + xp] + vegBlurA[yp * cols + x] + vegBlurA[yp * cols + xn] + vegBlurA[y * cols + xp] + vegBlurA[y * cols + x] + vegBlurA[y * cols + xn] + vegBlurA[yn * cols + xp] + vegBlurA[yn * cols + x] + vegBlurA[yn * cols + xn]) / 9;
      } }
    const t = vegBlurA; vegBlurA = vegBlurB; vegBlurB = t;
  }
  const vf = vegBlurA;
  let sum = 0, sumsq = 0; for (let i = 0; i < N; i++) { const v = vf[i]; sum += v; sumsq += v * v; }
  const mean = sum / N, sd = Math.sqrt(Math.max(0, sumsq / N - mean * mean)), denom = Math.max(2.0 * sd, 0.4 * mean) || 1;
  vegCv.width = cols; vegCv.height = rows;
  const lc = vegCv.getContext('2d'), img = lc.createImageData(cols, rows), d = img.data;
  // campo de profundidad frío↔cálido (estático, una vez por tamaño): sumas de senos con ciclos enteros → tesela sin costura en el toro.
  if (!depthField || depthField.length !== cols * rows) {
    depthField = new Float32Array(cols * rows);
    for (let yy = 0; yy < rows; yy++) for (let xx = 0; xx < cols; xx++) {
      const u = xx / cols, w = yy / rows;
      let dd = Math.sin(u * 12.566 + 1.3) * 0.5 + Math.sin(w * 6.283 + 2.1) * 0.35 + Math.sin((u + w) * 18.85 + 0.7) * 0.15;
      depthField[yy * cols + xx] = 0.5 + 0.5 * (dd < -1 ? -1 : dd > 1 ? 1 : dd);   // 0 frío .. 1 cálido
    }
  }
  for (let i = 0; i < N; i++) {
    // contraste estirado: z = exceso sobre la media / relieve → b∈[0,1] (rico→1 · pobre→0). ^0.7 = curva suave.
    let z = (vf[i] - mean) / denom, b = 0.5 + 0.5 * z; b = b < 0 ? 0 : b > 1 ? 1 : b; b = Math.pow(b, 0.7);
    const o = i * 4, dep = depthField[i];
    // interpola ABISMO(b=0)→PASTO(b=1) por riqueza local (colores de config) + nebulosa de profundidad.
    d[o] = ABYSS[0] + (PASTO[0] - ABYSS[0]) * b + dep * 3; d[o + 1] = ABYSS[1] + (PASTO[1] - ABYSS[1]) * b + dep * 3; d[o + 2] = ABYSS[2] + (PASTO[2] - ABYSS[2]) * b + dep * 6; d[o + 3] = 255;
  }
  lc.putImageData(img, 0, 0);
}
// COBERTURA = refugio (campo `cover` estático, llega una vez en 'world'): capa de espesura oscura verde-oliva (distinta del
// teal de la vegetación-comida) = parches de matorral/sombra. Alpha ∝ cover^0.6. Render puro (no toca la sim).
const coverCv = document.createElement('canvas');
function bakeCover() {
  if (!WORLD || !WORLD.cover) return;
  const cols = WORLD.cols, rows = WORLD.rows, N = cols * rows;
  // blur toroidal del campo → parches orgánicos sin bloques de rejilla. 3 pasadas 3×3.
  let a = Float32Array.from(WORLD.cover), b = new Float32Array(N);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < rows; y++) { const yp = (y - 1 + rows) % rows, yn = (y + 1) % rows;
      for (let x = 0; x < cols; x++) { const xp = (x - 1 + cols) % cols, xn = (x + 1) % cols;
        b[y * cols + x] = (a[yp * cols + xp] + a[yp * cols + x] + a[yp * cols + xn] + a[y * cols + xp] + a[y * cols + x] + a[y * cols + xn] + a[yn * cols + xp] + a[yn * cols + x] + a[yn * cols + xn]) / 9;
      } }
    const t = a; a = b; b = t;
  }
  coverCv.width = cols; coverCv.height = rows;
  const lc = coverCv.getContext('2d'), img = lc.createImageData(cols, rows), d = img.data;
  for (let i = 0; i < N; i++) { const c = a[i] <= 0 ? 0 : a[i] > 1 ? 1 : a[i], o = i * 4;
    // REFUGIO = verde alga (color de config). Opacidad ∝ espesura, capada por refugioAlpha.
    d[o] = REFUGIO[0]; d[o + 1] = REFUGIO[1]; d[o + 2] = REFUGIO[2]; d[o + 3] = (Math.min(RENDER_P.refugioAlpha, 1.1 * Math.pow(c, 0.7)) * 255) | 0;
  }
  lc.putImageData(img, 0, 0);
}
function resize() {
  cw = canvas.clientWidth; ch = canvas.clientHeight; canvas.width = cw * dpr; canvas.height = ch * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  glowCv.width = canvas.width; glowCv.height = canvas.height; glowCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  bloomCv.width = Math.max(1, (canvas.width / BLOOM_DIV) | 0); bloomCv.height = Math.max(1, (canvas.height / BLOOM_DIV) | 0);   // miniatura del bloom a zoom 1 (máx.)
  bloom2Cv.width = bloomCv.width; bloom2Cv.height = bloomCv.height;   // 2º búfer del bloom: mismo tamaño máximo
  const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
  g.addColorStop(0, 'rgba(5,8,13,0)'); g.addColorStop(1, 'rgba(2,4,8,0.7)'); vignette = g;
}
window.addEventListener('resize', resize); resize();

// --- Cámara + selección ---
let zoom = RENDER_P.zoom, camX = 0, camY = 0; const MINZ = RENDER_P.zoomMin, MAXZ = RENDER_P.zoomMax;   // zoom 1.0 = mundo entero cabe
let selectedId = -1, following = false, lastDetail = null;   // inspector: id seleccionado · seguimiento de cámara · último detalle vivo (para congelar el cadáver)
function resetCamera() { if (WORLD) { camX = WORLD.size / 2; camY = WORLD.size / 2; } }
const fitScale = () => WORLD ? Math.min(cw, ch) / WORLD.size : 1;
const scaleOf = () => fitScale() * zoom;
function wrap(v) { const S = WORLD.size; return ((v % S) + S) % S; }

const TCOL = [ '#5a6b7a', '#e0664d', '#e0a84a' ];   // STRUCTURE, MUSCLE, MOUTH (índice = tissue)
// Paleta del fondo (hex de config → RGB): interpola ABISMO→PASTO; REFUGIO se superpone.
const hexRGB = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const ABYSS = hexRGB(RENDER_P.abyssColor), PASTO = hexRGB(RENDER_P.pastoColor), REFUGIO = hexRGB(RENDER_P.refugioColor);
const RCOL = [ '#3fb98f', '#e0664d', '#e0a84a' ];   // rol (por dieta): 0 herbívoro · 1 carnívoro · 2 omnívoro
const RCOL_HSL = [ [159, 49, 49], [10, 70, 59], [38, 71, 58] ];   // RCOL en HSL [h,s,l] para el sombreado volumétrico del modo Oficio
const ROLE_TXT = [ 'herbívoro', 'carnívoro', 'omnívoro' ];
const LIGHT_DX = -0.42, LIGHT_DY = -0.5;   // dirección de luz (pantalla, arriba-izq); el realce cae hacia ahí en todos los nodos
const cl = (v) => v < 0 ? 0 : v > 100 ? 100 : v;   // clamp 0..100 para s/l
// NIEVE MARINA: detrito a la deriva que titila, mayoría azul-frío + algunas con color. Render puro.
const SNOW_PAL = [ 190, 200, 285, 45, 330 ];   // cian · azul · violeta · oro · rosa (chispa rara con color)
let snow = null;
function initSnow(size) {
  const n = Math.round(680 * Q.atmos), p = new Float32Array(n * 4), hue = new Float32Array(n);   // densidad ∝ calidad (0 en 'baja')
  for (let k = 0; k < n; k++) { p[k * 4] = Math.random() * size; p[k * 4 + 1] = Math.random() * size; p[k * 4 + 2] = Math.random() * 6.283; p[k * 4 + 3] = 0.5 + Math.random() * Math.random() * 1.6;
    hue[k] = Math.random() < 0.06 ? SNOW_PAL[(Math.random() * SNOW_PAL.length) | 0] : -1; }   // ~6% con color
  snow = { p, hue, n, size };
}
// Dibuja la nieve marina de un tile (pantalla oX,oY + escala sc). Tamaño en PÍXELES (constante en pantalla a cualquier zoom);
// posición en MUNDO (parallax al panear). Aditiva ('lighter').
function drawSnow(oX, oY, sc, t) {
  if (!snow || snow.size !== WORLD.size) initSnow(WORLD.size);
  const { p, hue, n } = snow, S = WORLD.size, tt = t * 0.9;
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < n; k++) {
    const ph = p[k * 4 + 2], sz = p[k * 4 + 3];
    const wx = p[k * 4] + Math.sin(tt * 0.8 + ph) * 7 + Math.sin(tt * 0.26 + ph * 2.1) * 4;   // deriva lateral suave (2 frecuencias)
    let wy = (p[k * 4 + 1] + tt * 5 + Math.cos(tt * 0.6 + ph) * 4) % S; if (wy < 0) wy += S;   // descenso lento + wrap toroidal
    const px = oX + wx * sc, py = oY + wy * sc;
    if (px < -4 || px > cw + 4 || py < -4 || py > ch + 4) continue;
    let tw = Math.sin(tt * 3.1 + ph * 3.1); tw = tw > 0 ? tw * tw : 0;   // titileo con destellos puntuales
    const a = 0.04 + tw * 0.5, hh = hue[k];
    ctx.fillStyle = hh < 0 ? `rgba(200,224,255,${a})` : `hsla(${hh},80%,64%,${a})`;
    ctx.beginPath(); ctx.arc(px, py, sz * (0.6 + tw * 1.2), 0, 6.283); ctx.fill();   // la mota crece al destellar = chispa
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}
// PLANCTON / micro-flora: chispas glow fijas que florecen donde hay vegetación (densidad ∝ cantidad). Aditivo.
let plankton = null, sparkSprites = null;
function makeSparkSprite(hue) {
  const S = 20, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), r = S / 2;
  const g = x.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, `hsla(${hue},70%,80%,0.95)`); g.addColorStop(0.35, `hsla(${hue},75%,60%,0.40)`); g.addColorStop(1, `hsla(${hue},75%,50%,0)`);
  x.fillStyle = g; x.beginPath(); x.arc(r, r, r, 0, 6.283); x.fill(); return c;
}
function initPlankton(size) {
  if (!sparkSprites) sparkSprites = [158, 172, 186, 200].map(makeSparkSprite);   // tonos teal/cian/verde (algas)
  const n = Math.round(700 * (size / 1500) * (size / 1500) * Q.atmos);   // ∝ área × calidad → densidad ~constante por tamaño (0 en 'baja')
  const px = new Float32Array(n), py = new Float32Array(n), ps = new Uint8Array(n), pscale = new Float32Array(n), pseed = new Float32Array(n);
  for (let i = 0; i < n; i++) { px[i] = Math.random() * size; py[i] = Math.random() * size; ps[i] = (Math.random() * sparkSprites.length) | 0; pscale[i] = 0.7 + Math.random() * 0.9; pseed[i] = Math.random(); }
  plankton = { px, py, ps, pscale, pseed, n, size };
}
// Dibuja el plancton de un tile: cada mota enciende ∝ vegetación local (lee el campo veg de la foto). Aditivo.
function drawPlankton(oX, oY, sc) {
  if (!frame || !frame.veg || !WORLD) return;
  if (!plankton || plankton.size !== WORLD.size) initPlankton(WORLD.size);
  const { px, py, ps, pscale, pseed, n } = plankton, veg = frame.veg, cols = WORLD.cols, cw2 = WORLD.cellW, ref = (WORLD.vegRef || 10) * 0.25;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = px[i], y = py[i];
    let cx = (x / cw2) | 0, cy = (y / cw2) | 0; if (cx >= cols) cx = cols - 1; if (cy >= cols) cy = cols - 1;
    const food = veg[cy * cols + cx] / ref;
    if (food < 0.08 + pseed[i] * 0.7) continue;   // densidad ∝ cantidad de vegetación local
    const sx = oX + x * sc, sy = oY + y * sc;
    if (sx < -12 || sx > cw + 12 || sy < -12 || sy > ch + 12) continue;
    const a = Math.min(0.6, 0.12 + food * 0.5) * pscale[i];
    let sz = (4 + food * 5) * pscale[i] * sc; if (sz < 2) sz = 2; else if (sz > 16) sz = 16;
    ctx.globalAlpha = a;
    ctx.drawImage(sparkSprites[ps[i]], sx - sz / 2, sy - sz / 2, sz, sz);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
// SILUETA del nodo: curva bézier cerrada base↔punta (gota/aleta/tentáculo). Eje local = rumbo+dir; la punta (+L) mira hacia
// afuera. wB = medio-ancho base (interior) · wT = medio-ancho punta (exterior). Solo construye el path; lo rellena el llamador.
// cx,cy en píxeles; rot en rad.
function silPath(c, cx, cy, rot, L, wB, wT, append) {
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const X = (lx, ly) => cx + lx * cr - ly * sr, Y = (lx, ly) => cy + lx * sr + ly * cr;
  if (!append) c.beginPath();   // append=true → acumula como subpath (contorno unificado: muchos nodos en un path/fill)
  c.moveTo(X(-L, 0), Y(-L, 0));
  c.bezierCurveTo(X(-L * 0.5, wB), Y(-L * 0.5, wB), X(L * 0.5, wT), Y(L * 0.5, wT), X(L, 0), Y(L, 0));
  c.bezierCurveTo(X(L * 0.5, -wT), Y(L * 0.5, -wT), X(-L * 0.5, -wB), Y(-L * 0.5, -wB), X(-L, 0), Y(-L, 0));
  c.closePath();
}
let colorMode = RENDER_P.colorMode, tissueMix = RENDER_P.tissueMix;   // tissueMix: nivel de tinte de tejido en modo 'natural' (slider)

function draw() {
  const t = performance.now() / 1000;
  ctx.fillStyle = '#05080d'; ctx.fillRect(0, 0, cw, ch);
  if (!WORLD || !frame) return;
  const size = WORLD.size, sc = scaleOf();
  const vwHalf = cw / 2 / sc, vhHalf = ch / 2 / sc;
  const txMin = Math.floor((camX - vwHalf) / size), txMax = Math.floor((camX + vwHalf) / size);
  const tyMin = Math.floor((camY - vhHalf) / size), tyMax = Math.floor((camY + vhHalf) / size);

  // sustrato (campo de vegetación) por tile
  for (let tx = txMin; tx <= txMax; tx++) for (let ty = tyMin; ty <= tyMax; ty++) drawVeg((tx * size - camX) * sc + cw / 2, (ty * size - camY) * sc + ch / 2, sc);
  // BORDE DEL TORO: líneas del límite del mundo (x=k·size, y=k·size) repetidas en el mosaico. 3 pasadas aditivas
  // (ancha+tenue → fina+clara) → línea difusa. Cada línea se traza una vez (full-canvas).
  ctx.globalCompositeOperation = 'lighter';
  for (const pass of [[9, 0.018], [4, 0.038], [1.4, 0.12]]) {
    ctx.lineWidth = pass[0]; ctx.strokeStyle = `rgba(150,182,208,${pass[1]})`;
    ctx.beginPath();
    for (let tx = txMin; tx <= txMax + 1; tx++) { const x = (tx * size - camX) * sc + cw / 2; ctx.moveTo(x, 0); ctx.lineTo(x, ch); }
    for (let ty = tyMin; ty <= tyMax + 1; ty++) { const y = (ty * size - camY) * sc + ch / 2; ctx.moveTo(0, y); ctx.lineTo(cw, y); }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';

  // PLANCTON: chispas sobre el sustrato (bajo nieve y organismos). Gateado por bloomStrength (0 = apagado, Baja/móvil).
  if (bloomStrength > 0) for (let tx = txMin; tx <= txMax; tx++) for (let ty = tyMin; ty <= tyMax; ty++) drawPlankton((tx * size - camX) * sc + cw / 2, (ty * size - camY) * sc + ch / 2, sc);
  // NIEVE MARINA: bajo los organismos. Gateada por bloomStrength (0 = apagado, Baja/móvil).
  if (bloomStrength > 0) for (let tx = txMin; tx <= txMax; tx++) for (let ty = tyMin; ty <= tyMax; ty++) drawSnow((tx * size - camX) * sc + cw / 2, (ty * size - camY) * sc + ch / 2, sc, t);

  // CADÁVERES: bajo los organismos, siluetas oscuras del linaje que se desvanecen con su carroña.
  for (let tx = txMin; tx <= txMax; tx++) for (let ty = tyMin; ty <= tyMax; ty++) drawCorpses((tx * size - camX) * sc + cw / 2, (ty * size - camY) * sc + ch / 2, sc);

  // ORGANISMOS → búfer aparte (glowCv). El glow lo da el bloom (desenfoque de los cuerpos nítidos). Gateado por bloomStrength.
  glowCtx.clearRect(0, 0, cw, ch);
  glowCtx.globalCompositeOperation = 'source-over'; glowCtx.globalAlpha = 1;
  for (let tx = txMin; tx <= txMax; tx++) for (let ty = tyMin; ty <= tyMax; ty++) drawOrgs(glowCtx, (tx * size - camX) * sc + cw / 2, (ty * size - camY) * sc + ch / 2, sc, t);

  // BLOOM: reduce glowCv a miniatura y la reescala aditiva sobre el fondo; factor de reducción ∝ zoom. Amplía ×2 por pasos
  // (bilinear suave → sin rejilla) con ping-pong de búferes; solo drawImage (no ctx.filter blur, por compatibilidad).
  if (bloomStrength > 0) {
    const bd = BLOOM_DIV * (zoom > 1 ? zoom : 1);
    let w = Math.max(2, (canvas.width / bd) | 0), h = Math.max(2, (canvas.height / bd) | 0);
    const maxW = bloomCv.width, maxH = bloomCv.height;   // tope de los búferes = canvas/BLOOM_DIV
    bloomCtx.imageSmoothingEnabled = true; bloom2Ctx.imageSmoothingEnabled = true;
    bloomCtx.clearRect(0, 0, w, h); bloomCtx.drawImage(glowCv, 0, 0, w, h);   // reduce glowCv → w×h (blur base)
    let src = bloomCv, sctx = bloomCtx, dst = bloom2Cv, dctx = bloom2Ctx;
    while (w * 2 <= maxW && h * 2 <= maxH) {                                  // amplía ×2 por pasos hasta el tope del búfer
      const nw = w * 2, nh = h * 2;
      dctx.clearRect(0, 0, nw, nh); dctx.drawImage(src, 0, 0, w, h, 0, 0, nw, nh);
      w = nw; h = nh;
      const ts = src; src = dst; dst = ts; const tc = sctx; sctx = dctx; dctx = tc;   // ping-pong de búferes
    }
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = bloomStrength; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(src, 0, 0, w, h, 0, 0, cw, ch);   // salto final a pantalla (búfer ya suave → sin rejilla)
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  // TINTE DE TEJIDO (solo Natural, slider «Resaltar tipo tejido»): se superpone a glowCv DESPUÉS del bloom → el glow queda
  // siempre con el color natural (linaje); el cuerpo nítido (drawImage de glowCv, abajo) sí muestra el tinte.
  if (colorMode === 'natural' && tissueMix > 0)
    for (let tx = txMin; tx <= txMax; tx++) for (let ty = tyMin; ty <= tyMax; ty++) drawTissueTint(glowCtx, (tx * size - camX) * sc + cw / 2, (ty * size - camY) * sc + ch / 2, sc, t);
  // organismos NÍTIDOS encima
  ctx.imageSmoothingEnabled = false; ctx.drawImage(glowCv, 0, 0, cw, ch); ctx.imageSmoothingEnabled = true;

  // anillo de selección sobre el agente inspeccionado (en cada tile visible)
  if (selectedId >= 0 && frame.detail && frame.detail.id === selectedId) {
    const d = frame.detail, rr = Math.max(7, d.rad * sc) + 4 + Math.sin(t * 3) * 2;
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(244,246,255,.9)';
    for (let tx = txMin; tx <= txMax; tx++) for (let ty = tyMin; ty <= tyMax; ty++) {
      const px = (tx * size - camX) * sc + cw / 2 + d.x * sc, py = (ty * size - camY) * sc + ch / 2 + d.y * sc;
      if (px < -rr || px > cw + rr || py < -rr || py > ch + rr) continue;
      ctx.beginPath(); ctx.arc(px, py, rr, 0, 6.283); ctx.stroke();
    }
  }

  if (vignette) { ctx.fillStyle = vignette; ctx.fillRect(0, 0, cw, ch); }
  updateHud();
  updateInspector();
}

function drawVeg(oX, oY, sc) {
  // un tile = la mini-textura de vegetación reescalada suavizada (bilinear) → nebulosa verde sin rejilla.
  if (!vegCv.width) return;
  const wpx = WORLD.size * sc;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(vegCv, oX, oY, wpx, wpx);
  if (coverCv.width) ctx.drawImage(coverCv, oX, oY, wpx, wpx);   // COBERTURA del refugio sobre el fondo (mismo tile toroidal)
}

// CADÁVERES: cuerpos muertos recientes, en su orientación final (sin ondulación ni ojos), tono del linaje desaturado y
// oscuro. alpha y luminosidad caen con `dcfade` (edad/vida) → se funden con el fondo. Se dibujan en `ctx` (bajo el glow).
function drawCorpses(oX, oY, sc) {
  const f = frame; if (!f.dcm) return;
  const { dcm, dcx, dcy, dch, dchue, dcfade, dcOff, dcData } = f;
  for (let a = 0; a < dcm; a++) {
    const wx = dcx[a], wy = dcy[a], bx = oX + wx * sc, by = oY + wy * sc;
    if (bx < -40 || bx > cw + 40 || by < -40 || by > ch + 40) continue;   // culling
    const fade = dcfade[a], alpha = (1 - fade) * 0.55; if (alpha <= 0.01) continue;
    const hh = dch[a], chh = Math.cos(hh), shh = Math.sin(hh), p0 = dcOff[a], p1 = dcOff[a + 1];
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `hsl(${(dchue[a] * 360) | 0},${(20 * (1 - fade)) | 0}%,${(34 - 16 * fade) | 0}%)`;   // linaje desaturado, se oscurece con fade
    for (let k = p0; k < p1; k++) {
      const o = k * 5, lx = dcData[o], ly = dcData[o + 1], r = dcData[o + 2], aspect = dcData[o + 3], dir = dcData[o + 4];
      const pr = Math.max(1, r * sc); if (pr < 1.2) continue;   // LOD
      const px = oX + (wx + (lx * chh - ly * shh)) * sc, py = oY + (wy + (lx * shh + ly * chh)) * sc;
      const rL = pr * (1 + aspect * 1.4);
      ctx.beginPath();
      if (rL > 1.6) ctx.ellipse(px, py, rL, pr, hh + dir, 0, 6.283); else ctx.arc(px, py, pr, 0, 6.283);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawOrgs(c, oX, oY, sc, t) {   // dibuja los organismos nítidos en glowCv (el glow lo da el bloom al desenfocar este búfer)
  const { n, ax, ay, ah, aspd, ahue, aE, aGazeX, aGazeY, aAlert, arole, aGrow, partOff, partData } = frame;
  for (let a = 0; a < n; a++) {
    const wx = ax[a], wy = ay[a], bx = oX + wx * sc, by = oY + wy * sc;
    if (bx < -40 || bx > cw + 40 || by < -40 || by > ch + 40) continue;   // culling en pantalla
    const h = ah[a], chh = Math.cos(h), shh = Math.sin(h), spd = aspd[a], p0 = partOff[a], p1 = partOff[a + 1];
    const grow = aGrow ? aGrow[a] : 1, scg = sc * grow;   // CRÍAS: la edad escala el tamaño DIBUJADO del cuerpo (posiciones+radios). Solo render.
    // VITALIDAD: los hambrientos se atenúan. energía 0..1 → alpha 0.35..1.
    c.globalAlpha = aE ? 0.35 + 0.65 * aE[a] : 1;
    // COLOR DEL NÚCLEO según el modo: 'natural'/'lineage' = linaje · 'role' = oficio (dieta). En 'natural' el tinte de tejido
    // se superpone DESPUÉS del bloom (drawTissueTint).
    let bH = ahue[a] * 360, bS = 62, bL = 54;
    if (colorMode === 'role') { const c0 = RCOL_HSL[arole[a]] || RCOL_HSL[0]; bH = c0[0]; bS = c0[1]; bL = c0[2]; }
    else if (colorMode === 'lineage') { bS = 58; bL = 58; }
    // SEGMENTACIÓN: nº de costillas/bandas transversales derivado de `hue` (heredado) → familias comparten patrón.
    const bandN = 3 + ((ahue[a] * 7919) | 0) % 4;   // 3..6 segmentos por nodo
    let bodyR = 0, headX = bx, headY = by, headR = 0, headScore = -1e9;   // OJOS: extensión del cuerpo (LOD) + parte-cabeza donde anclar los ojos
    {   // CONTORNO unificado: silueta dilatada de todos los nodos en UN path → un solo fill oscuro = reborde suave (sin bordes por-nodo)
      c.beginPath();
      for (let k = p1 - 1; k >= p0; k--) {
        const o = k * 7, lx = partData[o], ly = partData[o + 1], r = partData[o + 2], ph = partData[o + 4], aspect = partData[o + 5], dir = partData[o + 6];
        const uy = ly + (0.35 + spd * RENDER_P.undulation) * Math.sin(t * 5 + lx * 0.16 + ph);
        const px = bx + (lx * chh - uy * shh) * scg, py = by + (lx * shh + uy * chh) * scg, pr = Math.max(1, r * scg);
        const rL = pr * (1 + aspect * 1.4); if (rL <= Q.lodSil) continue;   // diminutos: sin contorno (LOD por calidad)
        const ow = Math.max(0.8, pr * 0.16);   // grosor del reborde ∝ tamaño
        silPath(c, px, py, h + dir, rL + ow, pr * (1 + aspect * 0.15) + ow, pr * (1 - aspect * 0.85) + ow, true);   // append → acumula
      }
      c.fillStyle = `hsl(${bH | 0},${cl(bS)}%,${cl(bL - 28)}%)`; c.fill();   // reborde = tono del animal más oscuro (no negro)
    }
    for (let k = p1 - 1; k >= p0; k--) {
      const o = k * 7, lx = partData[o], ly = partData[o + 1], r = partData[o + 2], tissue = partData[o + 3], ph = partData[o + 4], aspect = partData[o + 5], dir = partData[o + 6];
      const uy = ly + (0.35 + spd * RENDER_P.undulation) * Math.sin(t * 5 + lx * 0.16 + ph);
      const px = bx + (lx * chh - uy * shh) * scg, py = by + (lx * shh + uy * chh) * scg, pr = Math.max(1, r * scg);
      { const dx = px - bx, dy = py - by, ext = Math.hypot(dx, dy) + pr; if (ext > bodyR) bodyR = ext;
        // CABEZA = nodo más adelantado + leve preferencia BOCA, donde se anclan los OJOS. Puntúa por coord local `lx` (estable),
        // no por proyección en pantalla, para no parpadear entre dos lóbulos frontales del mismo lx ("dos cabezas").
        const hs = lx * sc + (tissue === TISSUE.MOUTH ? pr : 0); if (hs > headScore) { headScore = hs; headX = px; headY = py; headR = pr; } }
      // SILUETA bézier: gota/aleta/tentáculo (afila hacia afuera según `aspect`; eje = rumbo + dir). LOD: diminuta → punto.
      const rL = pr * (1 + aspect * 1.4), wB = pr * (1 + aspect * 0.15), wT = pr * (1 - aspect * 0.85);
      if (rL > Q.lodSil) silPath(c, px, py, h + dir, rL, wB, wT);   // LOD: silueta bézier; bajo el umbral, punto plano
      else { c.beginPath(); c.arc(px, py, pr, 0, 6.283); }
      // color base del NÚCLEO = el del modo (linaje / oficio) → lo usan relleno y costillas
      let nh = bH, ns = bS, nl = bL;
      if (pr > Q.lodVol) {   // VOLUMEN: gradiente radial (caro) solo sobre el umbral de calidad (en 'baja' nunca → plano)
        const lr = rL > pr ? rL : pr;
        const g = c.createRadialGradient(px + LIGHT_DX * pr, py + LIGHT_DY * pr, pr * 0.15, px, py, lr * 1.03);
        g.addColorStop(0, `hsl(${nh | 0},${cl(ns - 12)}%,${cl(nl + 20)}%)`);    // realce
        g.addColorStop(0.55, `hsl(${nh | 0},${ns}%,${nl}%)`);                   // medio
        g.addColorStop(1, `hsl(${nh | 0},${cl(ns + 10)}%,${cl(nl - 22)}%)`);    // sombra
        c.fillStyle = g;
      } else c.fillStyle = `hsl(${nh | 0},${ns}%,${nl}%)`;
      c.fill();
      // (el tinte de tejido del modo Natural NO se pinta aquí: va en drawTissueTint, tras el bloom → el glow no se tiñe)
      // COSTILLAS transversales: curvas combadas hacia la punta, color = sombra del propio cuerpo, ajustadas al ancho local
      // de la silueta. LOD: solo nodos grandes.
      if (bandN > 1 && pr > Q.lodRib) {
        c.strokeStyle = `hsla(${nh | 0},${cl(ns + 8)}%,${cl(nl - 20)}%,0.42)`; c.lineWidth = Math.max(0.6, pr * 0.12);
        const rot = h + dir, cr = Math.cos(rot), sr = Math.sin(rot), txu = -sr, tyu = cr;   // eje (cr,sr) + transversal (txu,tyu)
        for (let bI = 1; bI < bandN; bI++) {
          const f = bI / bandN, lw = (wB + (wT - wB) * f) * 0.82, ax = (2 * f - 1) * rL, ccx = px + cr * ax, ccy = py + sr * ax, bow = lw * 0.4;
          c.beginPath(); c.moveTo(ccx - txu * lw, ccy - tyu * lw); c.quadraticCurveTo(ccx + cr * bow, ccy + sr * bow, ccx + txu * lw, ccy + tyu * lw); c.stroke();
        }
      }
    }
    // OJOS (solo render): anclados a la parte-cabeza, eyespot orgánico (mancha de pigmento + iris del linaje + glint hacia la
    // luz de la escena, sin esclera blanca). Nº y disposición por linaje. La pupila mira al estímulo (amenaza>presa) o al rumbo
    // en calma, y se dilata con la cercanía (alert). LOD: nada en vista de mundo.
    if (headR > Q.lodEye) {
      const amt = Math.min(1, Math.max(0, (bodyR - 4) / 14));
      if (amt > 0.02) {
        const alert = aAlert ? aAlert[a] : 0, lh = (ahue[a] * 360) | 0, vv = (ahue[a] * 41.7) % 1;
        const hr = (ahue[a] * 9301) % 1, nEye = hr < 0.18 ? 1 : hr < 0.85 ? 2 : 3;   // linaje → cíclope / par / tres
        const er = headR * (0.36 - 0.045 * nEye + 0.05 * alert) * (0.85 + 0.3 * vv) * (1 + (1 - grow) * 0.6);   // ∝ cabeza; mayores en crías; más ojos → menores; crece con alert
        const fo = headR * 0.20, lo = headR * 0.44, latx = -shh, laty = chh;            // dentro de la silueta: adelante (fo) + apertura lateral (lo) transversal
        let gx = chh, gy = shh; if (alert > 0.01 && aGazeX) { gx = aGazeX[a]; gy = aGazeY[a]; }   // mirada: al estímulo o, en calma, al rumbo
        const ga0 = c.globalAlpha, baseA = ga0 * amt;
        for (let e = 0; e < nEye; e++) {
          const tt = nEye === 1 ? 0 : (e / (nEye - 1)) * 2 - 1;   // -1..1 a lo ancho de la cabeza
          const ex = headX + chh * fo + latx * lo * tt, ey = headY + shh * fo + laty * lo * tt;
          c.globalAlpha = baseA;
          c.fillStyle = `hsl(${lh},${(42 + 28 * alert) | 0}%,${(19 + 10 * alert) | 0}%)`;   // mancha/iris oscuro del linaje
          c.beginPath(); c.arc(ex, ey, er, 0, 6.283); c.fill();
          const pf = er * (0.18 + 0.30 * alert);                                            // pupila desplazada hacia la mirada + dilatada con alert
          c.fillStyle = 'rgba(6,5,9,0.95)';
          c.beginPath(); c.arc(ex + gx * pf, ey + gy * pf, er * (0.5 + 0.12 * alert), 0, 6.283); c.fill();
          c.globalAlpha = baseA * (0.65 + 0.35 * alert);                                    // GLINT especular hacia la luz de la escena
          c.fillStyle = 'rgba(216,232,255,0.92)';
          c.beginPath(); c.arc(ex + LIGHT_DX * er * 0.5, ey + LIGHT_DY * er * 0.5, er * 0.26, 0, 6.283); c.fill();
        }
        c.globalAlpha = ga0;
      }
    }
  }
  c.globalAlpha = 1;
}

// TINTE DE TEJIDO (modo Natural): superpone el color de la función (TCOL por tejido) sobre los cuerpos ya pintados en glowCv,
// con alpha = «Resaltar tipo tejido» × desvanecido-por-energía. Se llama DESPUÉS del bloom → el glow nunca lleva color de
// tejido. Reusa la geometría de nodo (misma ondulación que drawOrgs).
function drawTissueTint(c, oX, oY, sc, t) {
  const { n, ax, ay, ah, aspd, aE, partOff, partData } = frame;
  for (let a = 0; a < n; a++) {
    const wx = ax[a], wy = ay[a], bx = oX + wx * sc, by = oY + wy * sc;
    if (bx < -40 || bx > cw + 40 || by < -40 || by > ch + 40) continue;
    const h = ah[a], chh = Math.cos(h), shh = Math.sin(h), spd = aspd[a], p0 = partOff[a], p1 = partOff[a + 1];
    const aBase = (aE ? 0.35 + 0.65 * aE[a] : 1) * tissueMix;   // desvanecido por energía × nivel del slider
    for (let k = p1 - 1; k >= p0; k--) {
      const o = k * 7, lx = partData[o], ly = partData[o + 1], r = partData[o + 2], tissue = partData[o + 3], ph = partData[o + 4], aspect = partData[o + 5], dir = partData[o + 6];
      const uy = ly + (0.35 + spd * RENDER_P.undulation) * Math.sin(t * 5 + lx * 0.16 + ph);
      const px = oX + (wx + (lx * chh - uy * shh)) * sc, py = oY + (wy + (lx * shh + uy * chh)) * sc, pr = Math.max(1, r * sc);
      const rL = pr * (1 + aspect * 1.4);
      c.globalAlpha = aBase; c.fillStyle = TCOL[tissue] || '#5a6b7a';
      if (rL > Q.lodSil) silPath(c, px, py, h + dir, rL, pr * (1 + aspect * 0.15), pr * (1 - aspect * 0.85));
      else { c.beginPath(); c.arc(px, py, pr, 0, 6.283); }
      c.fill();
    }
  }
  c.globalAlpha = 1;
}

// --- HUD (fps render · t/s sim · pop · tick) + gráfica de población ---
let lastT = performance.now(), lastTick = 0, frames = 0, fps = 0, tpsReal = 0;
const pc = document.getElementById('popChart'), pctx = pc.getContext('2d');
const bc = document.getElementById('birthChart'), bctx = bc && bc.getContext('2d');   // nacimientos por vía reproductiva
const dc = document.getElementById('deathChart'), dctx = dc && dc.getContext('2d');   // muertes por causa
const mcv = document.getElementById('massChart'), mctx = mcv && mcv.getContext('2d');   // talla (masa) media por oficio en el tiempo
const gcv = document.getElementById('geneChart'), gctx = gcv && gcv.getContext('2d');   // histograma de un rasgo seleccionable (por oficio)
const TRAIT_LABEL = { mass: 'masa', mouthCap: 'boca', vmax: 'v.máx', nParts: 'partes', reproK: 'umbral cría', investFrac: 'inversión/cría', hue: 'linaje' };
function updateHud() {
  frames++; const now = performance.now(), dt = now - lastT;
  if (dt > 500 && frame) { fps = Math.round(frames * 1000 / dt); tpsReal = Math.round((frame.tick - lastTick) * 1000 / dt); frames = 0; lastT = now; lastTick = frame.tick; drawChart(); }
  hud.textContent = `pob ${frame.pop} · tick ${frame.tick} · ${tpsReal} t/s · ${fps} fps`;
}

// Retrato del organismo seleccionado en la tarjeta (mini-canvas): mismo aspecto que en el mundo (contorno + silueta bézier +
// volumen + costillas + ojos), respetando el modo de color activo. Ondula como en el mundo (cadáver inmóvil); mira a +x.
// dead=true → cadáver apagado, sin ojos. Geometría en detail.bodyParts (stride 6: lx,ly,r,aspect,dir,tissue) + d.role.
const inspCv = document.getElementById('inspCanvas'), inspCtx = inspCv && inspCv.getContext('2d');
function drawInspOrganism(d, dead) {
  if (!inspCtx) return;
  const c = inspCtx, W = inspCv.width, H = inspCv.height; c.clearRect(0, 0, W, H);
  const bp = d && d.bodyParts; if (!bp || !bp.length) return;
  const t = performance.now() / 1000, swim = dead ? 0 : 0.6;   // ondulación de nado (transversal); cadáver inmóvil
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let k = 0; k < bp.length; k += 6) { const lx = bp[k], ly = bp[k + 1], r = bp[k + 2]; if (lx - r < minX) minX = lx - r; if (lx + r > maxX) maxX = lx + r; if (ly - r - swim < minY) minY = ly - r - swim; if (ly + r + swim > maxY) maxY = ly + r + swim; }   // +swim en Y → reserva sitio para el meneo (encuadre estable)
  const scl = Math.min(W * 0.8 / Math.max(1, maxX - minX), H * 0.8 / Math.max(1, maxY - minY));
  const oX = W / 2 - (minX + maxX) / 2 * scl, oY = H / 2 - (minY + maxY) / 2 * scl;
  // color base del NÚCLEO según el modo (igual que drawOrgs): natural/lineage = linaje · role = oficio · cadáver = apagado.
  let bH = (d.hue * 360) | 0, bS = 62, bL = 54;
  if (dead) { bS = 16; bL = 32; }
  else if (colorMode === 'role') { const r0 = RCOL_HSL[d.role] || RCOL_HSL[0]; bH = r0[0]; bS = r0[1]; bL = r0[2]; }
  else if (colorMode === 'lineage') { bS = 58; bL = 58; }
  const tint = (!dead && colorMode === 'natural') ? tissueMix : 0;   // «resaltar tipo tejido»: mismo % que el mundo (solo Natural)
  c.globalAlpha = dead ? 0.6 : 1;
  // CONTORNO unificado (reborde = linaje oscurecido), como en el mundo
  c.beginPath();
  for (let k = 0; k < bp.length; k += 6) {
    const lx = bp[k], ly = bp[k + 1], r = bp[k + 2], aspect = bp[k + 3], dir = bp[k + 4];
    const uy = ly + swim * Math.sin(t * 5 + lx * 0.16 + d.hue * 6.28);   // ondulación de nado
    const px = oX + lx * scl, py = oY + uy * scl, pr = Math.max(1, r * scl), rL = pr * (1 + aspect * 1.4);
    if (rL <= 1.6) continue; const ow = Math.max(0.8, pr * 0.16);
    silPath(c, px, py, dir, rL + ow, pr * (1 + aspect * 0.15) + ow, pr * (1 - aspect * 0.85) + ow, true);
  }
  c.fillStyle = `hsl(${bH},${cl(bS)}%,${cl(bL - 28)}%)`; c.fill();
  // NODOS: silueta + volumen + costillas; busca la cabeza (max lx, leve preferencia BOCA) para los ojos.
  const bandN = 3 + ((d.hue * 7919) | 0) % 4;
  let headX = oX, headY = oY, headR = 0, headScore = -1e9;
  for (let k = 0; k < bp.length; k += 6) {
    const lx = bp[k], ly = bp[k + 1], r = bp[k + 2], aspect = bp[k + 3], dir = bp[k + 4], tissue = bp[k + 5];
    const uy = ly + swim * Math.sin(t * 5 + lx * 0.16 + d.hue * 6.28);   // misma ondulación que el contorno
    const px = oX + lx * scl, py = oY + uy * scl, pr = Math.max(1, r * scl);
    const hs = lx + (tissue === TISSUE.MOUTH ? r : 0); if (hs > headScore) { headScore = hs; headX = px; headY = py; headR = pr; }
    const rL = pr * (1 + aspect * 1.4), wB = pr * (1 + aspect * 0.15), wT = pr * (1 - aspect * 0.85);
    if (rL > 1.6) silPath(c, px, py, dir, rL, wB, wT); else { c.beginPath(); c.arc(px, py, pr, 0, 6.283); }
    if (pr > 3) {   // VOLUMEN: gradiente radial luz→sombra (luz arriba-izq, como en el mundo)
      const lr = rL > pr ? rL : pr, g = c.createRadialGradient(px + LIGHT_DX * pr, py + LIGHT_DY * pr, pr * 0.15, px, py, lr * 1.03);
      g.addColorStop(0, `hsl(${bH},${cl(bS - 12)}%,${cl(bL + 20)}%)`); g.addColorStop(0.55, `hsl(${bH},${bS}%,${bL}%)`); g.addColorStop(1, `hsl(${bH},${cl(bS + 10)}%,${cl(bL - 22)}%)`);
      c.fillStyle = g;
    } else c.fillStyle = `hsl(${bH},${bS}%,${bL}%)`;
    c.fill();
    if (tint > 0) { c.globalAlpha = tint; c.fillStyle = TCOL[tissue] || '#5a6b7a'; c.fill(); c.globalAlpha = 1; }   // «resaltar tejido»: color de función al mismo % que el mundo
    if (bandN > 1 && pr > 5) {   // COSTILLAS transversales
      c.strokeStyle = `hsla(${bH},${cl(bS + 8)}%,${cl(bL - 20)}%,0.42)`; c.lineWidth = Math.max(0.6, pr * 0.12);
      const cr = Math.cos(dir), sr = Math.sin(dir), txu = -sr, tyu = cr;
      for (let bI = 1; bI < bandN; bI++) { const f = bI / bandN, lw = (wB + (wT - wB) * f) * 0.82, ax = (2 * f - 1) * rL, ccx = px + cr * ax, ccy = py + sr * ax, bow = lw * 0.4;
        c.beginPath(); c.moveTo(ccx - txu * lw, ccy - tyu * lw); c.quadraticCurveTo(ccx + cr * bow, ccy + sr * bow, ccx + txu * lw, ccy + tyu * lw); c.stroke(); }
    }
  }
  // OJOS (eyespot en la cabeza, mirando a +x; sin ojos en el cadáver)
  if (!dead && headR > 1.2) {
    const vv = (d.hue * 41.7) % 1, hr = (d.hue * 9301) % 1, nEye = hr < 0.18 ? 1 : hr < 0.85 ? 2 : 3;
    const er = headR * (0.36 - 0.045 * nEye) * (0.85 + 0.3 * vv), fo = headR * 0.20, lo = headR * 0.44;
    for (let e = 0; e < nEye; e++) {
      const tt = nEye === 1 ? 0 : (e / (nEye - 1)) * 2 - 1, ex = headX + fo, ey = headY + lo * tt;   // adelante (+x) + apertura lateral (±y)
      c.fillStyle = `hsl(${(d.hue * 360) | 0},42%,19%)`; c.beginPath(); c.arc(ex, ey, er, 0, 6.283); c.fill();   // iris del linaje
      c.fillStyle = 'rgba(6,5,9,0.95)'; c.beginPath(); c.arc(ex + er * 0.18, ey, er * 0.5, 0, 6.283); c.fill();   // pupila hacia +x
      c.fillStyle = 'rgba(216,232,255,0.92)'; c.beginPath(); c.arc(ex + LIGHT_DX * er * 0.5, ey + LIGHT_DY * er * 0.5, er * 0.26, 0, 6.283); c.fill();   // glint
    }
  }
  c.globalAlpha = 1;
}

// Inspector: rellena la tarjeta con el detalle en vivo del agente seleccionado (energía, fisiología, morfología).
function updateInspector() {
  const card = $('inspector');
  if (selectedId < 0) { card.hidden = true; return; }
  card.hidden = false;
  if (frame.sel !== selectedId) { worker.postMessage({ type: 'inspect', id: selectedId }); $('inspRole').textContent = '…'; return; }   // reenvía hasta que el worker confirme (autosana mensajes perdidos); evita parpadeo "murió"
  const d = frame.detail;
  if (!d || d.id !== selectedId) {   // el worker lo buscó y no estaba vivo → murió
    $('inspRole').textContent = '† murió'; $('inspRole').style.color = '#8a93a0';
    $('inspE').style.width = '0%'; $('inspEtxt').textContent = 'el organismo ha muerto';
    following = false; drawInspOrganism(lastDetail, true);   // deja fijo el dibujo del cadáver (último cuerpo vivo)
    return;
  }
  lastDetail = d; drawInspOrganism(d, false);   // cachea el último detalle vivo y dibuja el retrato
  $('inspRole').textContent = ROLE_TXT[d.role]; $('inspRole').style.color = RCOL[d.role] || '#c3cdda';
  $('inspHue').style.background = `hsl(${(d.hue * 360) | 0},62%,58%)`;   // swatch de linaje (tono heredado)
  // DIETA emergente (pasto/caza/carroña, acumulada en vida) → barra apilada + texto.
  const dV = d.dietV || 0, dP = d.dietP || 0, dS = d.dietS || 0, dT = dV + dP + dS, seg = $('inspDiet').children;
  if (dT > 0.5) { const pV = dV / dT * 100, pP = dP / dT * 100, pS = dS / dT * 100;
    seg[0].style.width = pV + '%'; seg[1].style.width = pP + '%'; seg[2].style.width = pS + '%';
    $('inspDietTxt').textContent = `dieta: pasto ${pV.toFixed(0)}% · caza ${pP.toFixed(0)}%` + (pS >= 0.5 ? ` · carroña ${pS.toFixed(0)}%` : '');
  } else { seg[0].style.width = seg[1].style.width = seg[2].style.width = '0%'; $('inspDietTxt').textContent = 'dieta: — (recién nacido)'; }
  $('inspE').style.width = (Math.max(0, Math.min(1, d.E / d.reproE)) * 100).toFixed(0) + '%';
  $('inspEtxt').textContent = `energía ${d.E.toFixed(1)} / cría ${d.reproE.toFixed(0)}` + (d.investE != null ? ` · inv/cría ${d.investE.toFixed(1)}` : '') + (d.gut > 0.05 ? ` · tripa ${d.gut.toFixed(1)}` : '');
  $('inspMass').textContent = d.mass.toFixed(2);
  $('inspParts').textContent = d.nParts;
  $('inspV').textContent = d.vmax.toFixed(2);
  $('inspAge').textContent = d.age | 0;
  $('inspTroph').textContent = `${d.mouthCap.toFixed(2)} / ${d.maxMouthR.toFixed(1)}`;
  if (following) { camX = wrap(d.x); camY = wrap(d.y); }   // seguir: la cámara se centra en el agente
}
// Gráfica de ÁREA APILADA de dos series (lower abajo, upper encima). Escala al máximo de la suma.
function drawStack(cv, c, lower, upper, colLow, colUp) {
  const w = cv.width, h = cv.height; c.clearRect(0, 0, w, h);
  if (!lower || lower.length < 2) return;
  const n = lower.length; let mx = 1; for (let i = 0; i < n; i++) { const t = lower[i] + upper[i]; if (t > mx) mx = t; }
  const X = (i) => i / (n - 1) * w, Y = (v) => h - v / mx * (h - 2) - 1;
  c.beginPath(); c.moveTo(0, h); for (let i = 0; i < n; i++) c.lineTo(X(i), Y(lower[i])); c.lineTo(w, h); c.closePath(); c.fillStyle = colLow; c.fill();
  c.beginPath(); for (let i = 0; i < n; i++) { const x = X(i), y = Y(lower[i] + upper[i]); i ? c.lineTo(x, y) : c.moveTo(x, y); } for (let i = n - 1; i >= 0; i--) c.lineTo(X(i), Y(lower[i])); c.closePath(); c.fillStyle = colUp; c.fill();
}
function drawChart() {
  drawStack(pc, pctx, frame.histHerb, frame.histCarn, 'rgba(63,185,143,.5)', 'rgba(224,102,77,.55)');           // población: herbívoro + carnívoro
  if (bctx) drawStack(bc, bctx, frame.histAsexB, frame.histSexB, 'rgba(111,174,90,.55)', 'rgba(201,138,224,.6)'); // nacimientos: asexual + sexual
  if (dctx) drawStack(dc, dctx, frame.histPred, frame.histStarv, 'rgba(224,102,77,.55)', 'rgba(120,134,150,.6)'); // muertes: depredación + inanición
  if (mctx && frame.histMassH) drawLines(mcv, mctx, [frame.histMassH, frame.histMassC], ['rgba(63,185,143,.85)', 'rgba(224,102,77,.9)'], 12, 'masa');  // talla media por oficio
  if (gctx && frame.geneH) drawGeneHist();                                                                       // histograma del rasgo seleccionado
}
// Gráfica de LÍNEAS (serie temporal) de N series sobre eje Y fijo [0, ymax].
function drawLines(cv, c, series, cols, ymax, label) {
  const w = cv.width, h = cv.height; c.clearRect(0, 0, w, h);
  const s0 = series[0]; if (!s0 || s0.length < 2) return;
  const n = s0.length, X = (i) => i / (n - 1) * w, Y = (v) => h - Math.min(1, v / ymax) * (h - 2) - 1;
  c.lineWidth = 1.5;
  for (let k = 0; k < series.length; k++) { const ser = series[k]; c.strokeStyle = cols[k]; c.beginPath();
    for (let i = 0; i < n; i++) { const x = X(i), y = Y(ser[i]); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
  c.fillStyle = 'rgba(195,205,218,.8)'; c.font = '10px ui-monospace,monospace'; c.textBaseline = 'top'; c.textAlign = 'left';
  c.fillText(label, 3, 1); c.textAlign = 'right'; c.fillText(ymax.toFixed(0), w - 2, 1); c.textAlign = 'left';   // eje: rasgo + tope Y
}
// HISTOGRAMA del rasgo seleccionado: barras apiladas por bin (herbívoro abajo + carnívoro encima) sobre eje fijo [lo,hi]. Los
// bins (geneH/geneC) y el rango los computa el worker; aquí solo se pintan. Escala a la barra máxima.
function drawGeneHist() {
  const c = gctx, w = gcv.width, h = gcv.height, H = frame.geneH, C = frame.geneC, nb = H.length; c.clearRect(0, 0, w, h);
  let mx = 1; for (let i = 0; i < nb; i++) { const t = H[i] + C[i]; if (t > mx) mx = t; }
  const bw = w / nb, hh = h - 12;
  for (let i = 0; i < nb; i++) { const x = i * bw, hHt = H[i] / mx * hh, cHt = C[i] / mx * hh;
    if (hHt > 0) { c.fillStyle = 'rgba(63,185,143,.65)'; c.fillRect(x, h - hHt, bw - 0.6, hHt); }
    if (cHt > 0) { c.fillStyle = 'rgba(224,102,77,.7)'; c.fillRect(x, h - hHt - cHt, bw - 0.6, cHt); }
  }
  c.fillStyle = 'rgba(195,205,218,.8)'; c.font = '10px ui-monospace,monospace';
  c.textBaseline = 'top'; c.textAlign = 'left'; c.fillText(TRAIT_LABEL[frame.geneTrait] || frame.geneTrait, 3, 1);
  const fmt = (v) => Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1);
  c.textBaseline = 'bottom'; c.fillText(fmt(frame.geneLo), 2, h - 1);
  c.textAlign = 'right'; c.fillText(fmt(frame.geneHi), w - 2, h - 1); c.textAlign = 'left';
}

// Limitador de FPS de render (no afecta a la sim: el motor corre en el worker a su propio t/s). rAF sigue a la frecuencia de
// pantalla; saltamos el draw() (lo caro) hasta que toca → ahorra CPU/batería.
let maxFps = RENDER_P.maxFps, lastDrawT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  if (now - lastDrawT < 1000 / maxFps - 2) return;   // aún no toca dibujar este frame
  lastDrawT = now;
  draw();
}
requestAnimationFrame(loop);

// --- Interacción de cámara + clic para inspeccionar ---
let dragging = false, lastX = 0, lastY = 0, moved = 0;
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; moved = 0; canvas.classList.add('dragging'); canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (!dragging || !WORLD) return; const sc = scaleOf();
  moved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
  if (following && moved > 6) following = false;   // panear cancela el seguimiento (la selección y el retrato se mantienen)
  camX = wrap(camX - (e.clientX - lastX) / sc); camY = wrap(camY - (e.clientY - lastY) / sc); lastX = e.clientX; lastY = e.clientY; });
canvas.addEventListener('pointerup', (e) => {
  dragging = false; canvas.classList.remove('dragging');
  if (moved < 6 && WORLD && frame) { const r = canvas.getBoundingClientRect(); pickAt(e.clientX - r.left, e.clientY - r.top); }   // clic limpio (sin arrastrar) → selecciona
});
canvas.addEventListener('pointercancel', () => { dragging = false; canvas.classList.remove('dragging'); });

// Selección: agente más cercano al clic (coords de mundo, distancia toroidal) dentro de un radio.
function pickAt(px, py) {
  const sc = scaleOf(), size = WORLD.size;
  const wx = wrap(camX + (px - cw / 2) / sc), wy = wrap(camY + (py - ch / 2) / sc);
  const { n, ax, ay, aid } = frame; let best = -1, bestD = (22 / sc) ** 2;
  for (let a = 0; a < n; a++) {
    let dx = Math.abs(ax[a] - wx); if (dx > size - dx) dx = size - dx;
    let dy = Math.abs(ay[a] - wy); if (dy > size - dy) dy = size - dy;
    const d = dx * dx + dy * dy; if (d < bestD) { bestD = d; best = a; }
  }
  if (best >= 0) { selectedId = aid[best]; following = true; lastDetail = null; worker.postMessage({ type: 'inspect', id: selectedId }); }   // seleccionar → la cámara sigue; resetea el retrato cacheado
  else deselect();
}
function deselect() { selectedId = -1; following = false; lastDetail = null; worker.postMessage({ type: 'deselect' }); $('inspector').hidden = true; }
canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (!WORLD) return;
  const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, sc0 = scaleOf();
  const wx = camX + (px - cw / 2) / sc0, wy = camY + (py - ch / 2) / sc0;
  setZoom(zoom * Math.exp(-e.deltaY * 0.0060));   // sensibilidad de la rueda
  const sc1 = scaleOf(); camX = wrap(wx - (px - cw / 2) / sc1); camY = wrap(wy - (py - ch / 2) / sc1);
}, { passive: false });

// --- Panel: controles ---
const $ = (id) => document.getElementById(id);
// Valores iniciales de los controles desde config.js (el HTML es solo fallback). Debe ir antes de los inits de display y del
// bucle del laboratorio (que leen .value).
$('worldSize').value = START.worldSize; $('seedCount').value = START.seedCount; $('spawnSpread').value = START.spawnSpread; $('diversity').value = START.diversity;
$('tps').value = RENDER_P.tps; $('fps').value = RENDER_P.maxFps; $('zoom').value = RENDER_P.zoom;
$('colorMode').value = RENDER_P.colorMode; $('quality').value = RENDER_P.quality; $('tissueMix').value = RENDER_P.tissueMix;
$('reproSex').checked = SIM_P.reproMode !== 'asexual'; $('reproAsex').checked = SIM_P.reproMode !== 'sexual';   // both→ambos · asexual→solo asex · sexual→solo sexual
{ const src = { lightFlow: WORLD_P.lightFlow, vegGrowth: WORLD_P.vegGrowth, patchiness: WORLD_P.patchiness, grazeRefuge: SIM_P.grazeRefuge, forageReach: SIM_P.forageReach, baseCost: SIM_P.baseCost, reproE: SIM_P.reproE, grazeRate: SIM_P.grazeRate, scavRate: SIM_P.scavRate, fleeSpeed: SIM_P.fleeSpeed, mutRate: GENOME_P.mutRate };
  for (const s of document.querySelectorAll('.lab-slider')) if (s.dataset.key in src) s.value = src[s.dataset.key]; }
function setZoom(z) { zoom = Math.max(MINZ, Math.min(MAXZ, z)); $('zoom').value = zoom.toFixed(1); $('zoomVal').textContent = zoom.toFixed(1) + '×'; }
$('zoom').addEventListener('input', (e) => setZoom(+e.target.value));
let running = true, maxOn = false;
// La barra de velocidad se atenúa en pausa o MAX (el valor del slider no manda en esos modos).
function syncSpeedUI() { $('play').textContent = running ? '❚❚' : '▶'; $('max').classList.toggle('on', maxOn); $('tps').classList.toggle('dim', !running || maxOn); }
$('play').addEventListener('click', () => { running = !running; worker.postMessage({ type: 'running', value: running }); syncSpeedUI(); });
$('max').addEventListener('click', () => { maxOn = !maxOn; worker.postMessage({ type: 'maxSpeed', value: maxOn }); syncSpeedUI(); });
// Pulsar/arrastrar la barra: fija esa velocidad y desmarca pausa y MAX.
$('tps').addEventListener('input', (e) => {
  const v = +e.target.value; worker.postMessage({ type: 'tps', value: v }); $('tpsVal').textContent = v + ' t/s';
  if (!running) { running = true; worker.postMessage({ type: 'running', value: true }); }
  if (maxOn) { maxOn = false; worker.postMessage({ type: 'maxSpeed', value: false }); }
  syncSpeedUI();
});
$('fps').addEventListener('input', (e) => { maxFps = +e.target.value; $('fpsVal').textContent = maxFps + ' fps'; });   // límite de FPS de render
// Reiniciar re-siembra con semilla aleatoria (el determinismo sigue interno: el worker elige una semilla y la corrida es
// reproducible). El mundo nuevo nace con lightMul=1 → re-aplica el lab.
function resetWorld() {
  worker.postMessage({ type: 'reset', seed: null, worldSize: +$('worldSize').value, seedCount: +$('seedCount').value, spawnSpread: +$('spawnSpread').value, diversity: +$('diversity').value });
  applyLab(); }
$('reset').addEventListener('click', resetWorld);
$('hide').addEventListener('click', () => document.body.classList.add('hidden-panel'));
$('show').addEventListener('click', () => document.body.classList.remove('hidden-panel'));
$('colorMode').addEventListener('change', (e) => { colorMode = e.target.value; $('tissueMixCtrl').hidden = colorMode !== 'natural'; buildLegend(); });
// Nivel de tejido (solo modo Natural): tiñe el cuerpo con el color de su función. Render puro (no va al worker).
$('tissueMix').addEventListener('input', (e) => { tissueMix = +e.target.value; $('tissueMixVal').textContent = Math.round(tissueMix * 100) + '%'; buildLegend(); });   // la leyenda muestra/oculta la clave de tejidos
$('tissueMixVal').textContent = Math.round(tissueMix * 100) + '%';
$('tissueMixCtrl').hidden = colorMode !== 'natural';
// CALIDAD gráfica: cambia el preset de LOD/resolución/atmósfera en vivo. Reaplica dpr (vía resize), bloom y la densidad de
// plancton/nieve. No envía nada al worker → la sim es byte-idéntica.
$('quality').addEventListener('change', (e) => setQuality(e.target.value));
function setQuality(q) {
  if (!QUALITY[q]) return; quality = q; Q = QUALITY[q];
  bloomStrength = RENDER_P.bloom * Q.bloom;       // 'baja' (bloom 0) apaga glow/bloom + plancton + nieve
  snow = null; plankton = null;                    // re-densifica la atmósfera al nuevo nivel (se re-crean en el próximo draw)
  dpr = Math.min(Q.dprCap, window.devicePixelRatio || 1); resize();   // nueva resolución (recrea los búferes)
  if (WORLD && frame) draw();                      // redibuja ya (el rAF puede estar throttleado o en pausa)
}
// Histograma: la UI elige el rasgo a distribuir → el worker lo binnea por oficio. Envía el inicial (por si el navegador restauró otra opción).
$('geneTrait').addEventListener('change', (e) => worker.postMessage({ type: 'histTrait', key: e.target.value }));
worker.postMessage({ type: 'histTrait', key: $('geneTrait').value });

// LABORATORIO — sliders de leyes en vivo. Cada uno manda {set,key,value} al worker (mutación en caliente de SIM_P/mundo).
const LAB_DEF = { lightMul: 1, lightFlow: WORLD_P.lightFlow, vegGrowth: WORLD_P.vegGrowth, patchiness: WORLD_P.patchiness, grazeRefuge: SIM_P.grazeRefuge, forageReach: SIM_P.forageReach, baseCost: SIM_P.baseCost, reproE: SIM_P.reproE, grazeRate: SIM_P.grazeRate, scavRate: SIM_P.scavRate, fleeSpeed: SIM_P.fleeSpeed, fatWeight: SIM_P.fatWeight, senesce: SIM_P.senesce, mutRate: GENOME_P.mutRate };   // defaults del lab = config (para restaurar)
const fmtLab = (k, v) => k === 'lightMul' ? v.toFixed(2) + '×' : (k === 'mutRate' || k === 'fleeSpeed') ? v.toFixed(1) + '×' : (k === 'reproE' || k === 'forageReach') ? v.toFixed(0) : k === 'lightFlow' ? (v * 10000).toFixed(1) : k === 'senesce' ? (v * 100000).toFixed(1) : (k === 'grazeRate' || k === 'scavRate' || k === 'vegGrowth' || k === 'patchiness' || k === 'grazeRefuge' || k === 'fatWeight') ? v.toFixed(2) : v.toFixed(3);
const labSliders = [...document.querySelectorAll('.lab-slider')];
const labOut = (k) => document.querySelector(`output[data-for="${k}"]`);
function applyLab() { for (const s of labSliders) worker.postMessage({ type: 'set', key: s.dataset.key, value: +s.value }); }
for (const s of labSliders) {
  const k = s.dataset.key, o = labOut(k);
  o.textContent = fmtLab(k, +s.value);
  s.addEventListener('input', () => { o.textContent = fmtLab(k, +s.value); worker.postMessage({ type: 'set', key: k, value: +s.value }); });
}
$('labReset').addEventListener('click', () => {
  for (const s of labSliders) { const k = s.dataset.key; s.value = LAB_DEF[k]; labOut(k).textContent = fmtLab(k, LAB_DEF[k]); }
  applyLab();
});
// Parámetros de arranque (necesitan reinicio): solo actualizan su display; se aplican al pulsar «Reiniciar».
const ws = $('worldSize'), sct = $('seedCount'), spr = $('spawnSpread'), dvr = $('diversity');
const pct = (el) => Math.round(+el.value * 100) + '%';
ws.addEventListener('input', () => $('worldSizeVal').textContent = ws.value + ' u');
sct.addEventListener('input', () => $('seedCountVal').textContent = sct.value);
spr.addEventListener('input', () => $('spawnSpreadVal').textContent = +spr.value >= 1 ? 'todo el mundo' : pct(spr) + ' (disco central)');
dvr.addEventListener('input', () => $('diversityVal').textContent = pct(dvr));
$('worldSizeVal').textContent = ws.value + ' u'; $('seedCountVal').textContent = sct.value;
$('spawnSpreadVal').textContent = +spr.value >= 1 ? 'todo el mundo' : pct(spr) + ' (disco central)'; $('diversityVal').textContent = pct(dvr);
// Vía reproductiva (en vivo): dos checkboxes (sexual/asexual) → reproMode (both/asexual/sexual). No se permite apagar las dos
// (revierte la última).
function applyRepro(changed) {
  let sx = $('reproSex').checked, ax = $('reproAsex').checked;
  if (!sx && !ax) { if (changed) changed.checked = true; sx = $('reproSex').checked; ax = $('reproAsex').checked; }
  const mode = sx && ax ? 'both' : ax ? 'asexual' : 'sexual';
  worker.postMessage({ type: 'set', key: 'reproMode', value: mode });
}
$('reproSex').addEventListener('change', (e) => applyRepro(e.target));
$('reproAsex').addEventListener('change', (e) => applyRepro(e.target));

// Inspector: controles de la tarjeta
$('inspClose').addEventListener('click', deselect);
window.addEventListener('keydown', (e) => {
  if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('hidden-panel');
  else if (e.code === 'Space') { e.preventDefault(); $('play').click(); }
  else if (e.key === 'Escape' && selectedId >= 0) deselect();
});

function buildLegend() {
  const L = $('legend');
  let rows;
  if (colorMode === 'role') rows = [['#3fb98f', 'herbívoro'], ['#e0664d', 'carnívoro'], ['#e0a84a', 'omnívoro']];
  else if (colorMode === 'lineage') rows = [['#e0664d', 'tono = linaje (color heredado, deriva lenta)']];
  else {   // natural: color de linaje + (si se resalta tejido) la clave de los 3 tipos con sus colores reales (TCOL)
    rows = [['#7fb0d8', 'color = linaje (pigmento heredado)']];
    if (tissueMix > 0) rows.push([TCOL[TISSUE.STRUCTURE], 'estructura'], [TCOL[TISSUE.MUSCLE], 'músculo'], [TCOL[TISSUE.MOUTH], 'boca']);
  }
  L.innerHTML = rows.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('');
}
buildLegend();
$('tpsVal').textContent = $('tps').value + ' t/s'; $('zoomVal').textContent = (+$('zoom').value).toFixed(1) + '×'; $('fpsVal').textContent = $('fps').value + ' fps';

// depuración / preview: forzar avance del motor + dibujar (el rAF se throttlea)
window.__worker = worker;
window.__burst = (n) => worker.postMessage({ type: 'burst', n: n || 2000 });
window.__draw = draw;
window.__view = () => ({ zoom, camX: camX | 0, camY: camY | 0, sel: selectedId, follow: following, n: frame && frame.n,
  frameSel: frame && frame.sel, hasDetail: !!(frame && frame.detail), detailId: frame && frame.detail && frame.detail.id });
window.__testPick = () => {   // ejercita la ruta real de selección (pickAt) sobre el agente más cercano al centro de cámara
  if (!frame || !WORLD) return null; const sc = scaleOf(), S = WORLD.size; let best = -1, bd = 1e18;
  for (let a = 0; a < frame.n; a++) { let dx = Math.abs(frame.ax[a] - camX); if (dx > S - dx) dx = S - dx; let dy = Math.abs(frame.ay[a] - camY); if (dy > S - dy) dy = S - dy; const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = a; } }
  if (best < 0) return null;
  pickAt((frame.ax[best] - camX) * sc + cw / 2, (frame.ay[best] - camY) * sc + ch / 2);
  return { picked: selectedId, aid: frame.aid[best] };
};
