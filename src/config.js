// CONFIG — FUENTE ÚNICA de parámetros. Agrupados como en la UI; cada campo marcado "UI: <nombre>" o "NO UI".
// Los módulos del motor (world/genome/phenotype/sim) importan y re-exportan su objeto desde aquí. main.js/worker.js
// leen START/RENDER_P. Cambiar un valor aquí cambia el comportamiento.

// ===================== ARRANQUE — panel "Mundo nuevo" (necesita reiniciar) =====================
// (La "Semilla" es un campo de texto aparte; vacío = aleatoria.)
export const START = {
  worldSize: 1500,     // UI: Tamaño del mundo — lado del toro (u)
  seedCount: 100,      // UI: Sembrado inicial — nº de fundadores
  spawnSpread: 0.30,      // UI: Extensión del sembrado — 1 = todo el mundo · <1 = disco central de radio spread·mundo/2
  diversity: 0,        // UI: Diversidad inicial — 0 = clones · 1 = variados (morfología + r/K + color)
  cap: 12000,          // NO UI — tope del pool (nº máx. de agentes)
  lightBase: 2.5,      // NO UI — irradiancia operativa del mundo (sustituye a WORLD_P.lightBase al crear el mundo)
  nutrientInit: 1.5,   // NO UI — nutriente inicial por celda
  vegInit: 1.0,        // NO UI — biomasa vegetal inicial por celda
};

// ===================== RENDER / VISUAL (cliente; NO afecta a la simulación) =====================
export const RENDER_P = {
  tps: 60,             // UI: Velocidad — ticks de simulación por segundo
  maxFps: 20,          // UI: FPS — límite de dibujos por segundo (no afecta a la sim)
  bloom: 0.75,         // UI: Bioluminiscencia — intensidad del glow/bloom (0 = apagado; recomendado en móvil/Baja)
  zoom: 1,             // UI: Zoom — zoom inicial
  colorMode: 'natural',// UI: Colorear por — modo inicial (natural · role · lineage)
  tissueMix: 0.4,      // UI: Resaltar tipo tejido — en 'natural', mezcla color del cuerpo natural (0)→tejido/función (1); el glow conserva el natural
  quality: 'alta',     // UI: Calidad gráfica — preset de LOD/resolución/atmósfera (alta · media · baja)
  zoomMin: 1, zoomMax: 16,   // NO UI — límites del zoom (mín. 1 = el mundo entero cabe)
  dprCap: 2,           // NO UI — tope de devicePixelRatio (lo fija el preset de QUALITY; referencia del nivel 'alta')
  bloomDiv: 5,         // NO UI — factor de reducción base del bloom a zoom 1 (escala con el zoom: bd = bloomDiv·zoom)
  maxSnapMs: 250,      // NO UI — en MÁX: un fotograma cada N ms (≈4 fps; el lote ≤N garantiza ≥1 fps)
  undulation: 2.2,     // NO UI — amplitud de la onda viajera del cuerpo
  growMin: 0.45,       // NO UI — CRÍAS (solo render): tamaño dibujado al nacer como fracción del adulto
  growMature: 320,     // NO UI — CRÍAS (solo render): edad (ticks) a la que la cría alcanza el tamaño adulto
  // PALETA DEL FONDO (hex). Render puro. El fondo interpola abismo→pasto según la riqueza local de vegetación; el refugio se superpone.
  abyssColor: '#0a0e17',   // NO UI — agua profunda / pasto arrasado (extremo oscuro)
  pastoColor: '#103054',   // NO UI — pasto rico (extremo iluminado del campo de comida)
  refugioColor: '#45260d', // NO UI — color del refugio
  refugioAlpha: 0.7,       // NO UI — opacidad máxima del refugio sobre el fondo
};

// PRESETS DE CALIDAD GRÁFICA (render puro). `RENDER_P.quality` elige el nivel. Cada nivel ajusta: dprCap (resolución;
// sustituye a RENDER_P.dprCap) · bloom (intensidad del glow; 0 lo apaga junto con plancton/nieve) · atmos (densidad de
// plancton/nieve) · umbrales de LOD en px para silueta bézier (lodSil) / volumen-gradiente (lodVol) / costillas (lodRib) / ojos (lodEye).
export const QUALITY = {
  alta:  { dprCap: 2,   bloom: 1, atmos: 1,   lodSil: 1.6, lodVol: 4,   lodRib: 5,   lodEye: 1.2 },
  media: { dprCap: 1.5, bloom: 1, atmos: 0.5, lodSil: 2.4, lodVol: 8,   lodRib: 11,  lodEye: 1.8 },
  baja:  { dprCap: 1,   bloom: 0, atmos: 0,   lodSil: 3.2, lodVol: 1e9, lodRib: 1e9, lodEye: 2.6 },
};

// ===================== MUNDO (leyes físicas) =====================
export const WORLD_P = {
  cellRef: 20,          // NO UI — tamaño de celda (u) → rejilla ∝ tamaño de mundo
  lightBase: 0.06,      // NO UI — irradiancia base por defecto (el punto de operación lo fija START.lightBase; la UI multiplica vía world.lightMul)
  lightContrast: 0.7,   // NO UI — heterogeneidad espacial de la luz (0 uniforme · 1 muy en parches)
  lightFlow: 0.0004,    // UI: Corriente del abismo — velocidad de deriva del campo de luz: el fondo fluye formando zonas que se
                        // reorganizan (vagabundeo de fases, no traslación). 0 = estático (byte-idéntico).
  lightFlowEvery: 5,    // NO UI — cada cuántos ticks se re-hornea el campo de luz al derivar
  dayNightAmp: 0.0,     // NO UI — amplitud del ciclo día/noche (0 = sin ciclo)
  dayNightPeriod: 2000, // NO UI — periodo del ciclo (ticks)
  diffuseN: 0.12,       // NO UI — difusión del nutriente (conservativa)
  diffuseDet: 0.05,     // NO UI — difusión del detrito (conservativa)
  decompose: 0.02,      // NO UI — descomposición del detrito/tick: materia → nutriente, energía → calor
  // --- VEGETACIÓN (productor parametrizado, no genético): base trófica. Capta luz (energía) creciendo logísticamente y consume
  // nutriente (materia); los animales la pastan. Conserva nutriente↔veg↔detrito (materia); luz→veg→animal/calor (energía). ---
  vegGrowth: 0.12,      // NO UI — ritmo de crecimiento logístico de la vegetación/tick
  patchiness: 0.7,      // NO UI — dinámica de rebrote: 0 = logístico simple · 1 = + difusión de semilla al vecindario (parches que migran)
  vegKcoef: 6.0,        // NO UI — capacidad de carga por celda = vegKcoef · luz local (biomasa máx donde hay luz)
  vegEcoef: 1.0,        // NO UI — energía embebida por unidad de biomasa vegetal
  vegDecay: 0.02,       // NO UI — senescencia vegetal/tick: biomasa → detrito (materia), energía → calor
  vegSeed: 0.05,        // NO UI — colonización: brote mínimo para que celdas vacías con luz recolonicen (semilla logística)
  vegDiffuse: 0.04,     // NO UI — difusión espacial de la vegetación (conservativa)
};

// ===================== GENOMA / DESARROLLO / MUTACIÓN =====================
export const GENOME_P = {
  partBudget: 32,      // NO UI — tope de partes del cuerpo (acota recursión)
  recCap: 8,           // NO UI — tope del límite de recursión por módulo
  modCap: 12,          // NO UI — tope de módulos del genoma
  radMin: 1.0, radMax: 6.0,   // NO UI — gen size → radio de parte (u)
  mutRate: 1,          // UI: Ritmo de mutación — multiplicador global de las probabilidades de mutación (1 = base · 0 = clones)
  // r/K: genes de historia de vida (umbral de cría reproK e inversión por cría investFrac).
  reproKMin: 0.5, reproKMax: 2.0,        // NO UI — rango del gen reproK (umbral_i = SIM_P.reproE · reproK)
  investFracMin: 0.2, investFracMax: 0.8, // NO UI — rango del gen investFrac (investE_i = investFrac · umbral_i)
};

// ===================== FENOTIPO (forma → función) =====================
export const PHENO_P = {
  massCoef: 0.04,      // NO UI — masa estructural ∝ área de las partes
  dragBase: 1.0, dragCoef: 0.3, streamline: 0.4,   // NO UI — arrastre (forma); elongado arrastra menos
  thrustGain: 1.2,     // NO UI — ganancia de empuje (MUSCLE)
  mouthGain: 1.0,      // NO UI — ganancia de ingesta (MOUTH)
  vGain: 3.0, vMax: 4.0,   // NO UI — velocidad emergente = vGain·empuje/arrastre, acotada
};

// ===================== SIMULACIÓN (energética · reproducción · ingesta) =====================
export const SIM_P = {
  // --- expuestos en el LABORATORIO (en vivo) ---
  baseCost: 0.015,     // UI: Metabolismo basal — coste metabólico basal/tick
  reproE: 16,          // UI: Umbral de cría — energía mínima para reproducirse; baseline (slider hasta 40). Umbral real_i = reproE · gen reproK.
  grazeRate: 0.5,      // UI: Pastoreo — biomasa vegetal que una boca pasta por tick ∝ mouthCap (la misma boca pasta, caza y carroñea)
  grazeRefuge: 0.06,   // NO UI — reserva de rebrote: fracción de K intocable por el pastoreo (no se pasta veg < grazeRefuge·K)
  forageReach: 3,      // NO UI — forrajeo por área: radio (celdas) del que pasta a talla máx (∝ mass/forageMassRef); 0 = solo su celda
  forageMassRef: 4,    // NO UI — masa a la que el radio de forrajeo llega al máximo (forageReach)
  reproMode: 'sexual',   // UI: Reproducción — 'both' (sexual con respaldo asexual) · 'asexual' · 'sexual' (obligada)
  senesce: 0.00005,    // UI: Senescencia/vejez — coste metabólico ∝ edad
  fatWeight: 0.15,     // UI: Lastre de reservas — la energía almacenada penaliza vmax (vmax/(1+fatWeight·E/masa))
  // --- resto (NO UI) ---
  scavRate: 0.5,       // UI: Carroñeo — energía de detrito (de muertos) ingerible por tick ∝ mouthCap. 0 = apagado.
  massCost: 0.004,     // NO UI — coste metabólico ∝ masa^massCostExp
  massCostExp: 1.2,    // NO UI — exponente del coste de masa (super-lineal; 1 = lineal)
  moveCost: 0.004,     // NO UI — coste de nado ∝ drag·v² (energía → calor)
  mouthCost: 0.001,    // NO UI — coste de mantenimiento de boca ∝ mouthCap (→ calor)
  cooldown: 50,        // NO UI — enfriamiento reproductivo (ticks)
  eDensity: 0,         // NO UI — energía-en-biomasa; 0 = separación limpia materia/energía
  birthR: 1,           // NO UI — radio (celdas) del vecindario del que la cría reúne materia
  gutBase: 4, gutPerMass: 4, digestRate: 0.6,   // NO UI — tripa: tope ∝ masa + ritmo de digestión
  eatReach: 4,         // NO UI — alcance extra de captura (u)
  preyMassMax: 1.6,    // NO UI — presa manejable si su masa ≤ maxMouthR·este
  fleeSpeed: 1.0,      // UI: Escape por velocidad — la presa escapa si corre más que el depredador (×este factor)
  coverStrength: 0.25, // UI: Cobertura del refugio — prob_escape = coverStrength·cover_local (regla física, no un gen)
  ηene: 0.85,          // NO UI — eficiencia energética de la ingesta
  initE: 10,           // NO UI — reservas iniciales de los fundadores
  mateRadius: 50,      // NO UI — radio de búsqueda de pareja (u)
  mateCompat: 0.5,     // NO UI — aislamiento pre-cigótico: umbral = distancia fenotípica (masa/boca/presa) normalizada
};
