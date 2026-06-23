# Zenote 2 — MODELO ACTUAL 

Describe lo que zenote2 **ES hoy**. En docs de la carpeta `archivo` están el histórico de assessments y rediseños.
Parámetros exactos y sus valores: `src/config.js` (fuente única).
La fuente de verdad, en cualquier caso, siempre es el código fuente de la aplicación. 

## Qué es
- **Todos los organismos son ANIMALES** (heterótrofos; no fotosintetizan). Tejidos del genoma: `STRUCTURE · MUSCLE · MOUTH`.
  Cerebro neuronal (pesos = genes), morfología por reglas de desarrollo (genoma → `develop` → cuerpo), reproducción
  sexual/asexual con mutación y recombinación homóloga. Genes de historia de vida r/K: `reproK` (umbral de cría) e
  `investFrac` (inversión por cría); el eje r↔K es near-neutral en la pecera cerrada.
- **La VEGETACIÓN es el productor parametrizado (no genético).** Campo `world.veg` por celda: crece captando LUZ (entrada
  de energía) y consumiendo NUTRIENTE (materia), con capacidad ∝ luz local; senesce a detrito. Rebrote en parches
  (`patchiness`). Productividad ∝ luz local → las zonas frondosas siguen al campo de luz (que deriva con `lightFlow`).
  Pastoreo con reserva de rebrote (`grazeRefuge`, anti-sobrepastoreo) y forrajeo por área ∝ talla (`forageReach`).
- **Los animales comen** (única vía de energía): **pastan** vegetación · **cazan** presa viva · **carroñean** detrito, todo
  con el mismo gesto neuronal de abrir boca. El eje **herbívoro↔carnívoro emerge de la DIETA realizada**, no de reglas fijas.
- **La caza depende de la velocidad relativa** (`fleeSpeed`): la presa escapa si corre más que el depredador → la velocidad
  es defensa y ataque, y mantiene el músculo bajo selección.
- **Vida finita y nichos (ON por defecto):** senescencia (`senesce`, coste ∝ edad) · lastre adiposo (`fatWeight`, la energía
  almacenada penaliza `vmax`) · refugio no comestible (campo `cover` + sensor de cerebro → nicho separable esconderse≠comer).
  Los campos de luz y cover usan ruido fractal (fBm) → zonas irregulares; la luz deriva, el cover es estático.
- **Sensores del cerebro (12):** ∇vegetación · dir-presa · dir-amenaza · hambre · velocidad propia · ∇detrito · ∇cobertura.

## Libro mayor (conserva; verificado por el gate)
- **MATERIA (cerrada):** `nutriente + vegetación + detritoM + masa_animales = constante`. Cicla: nutriente→veg→(pastoreo)→
  nutriente / veg→detrito (senescencia) / animal→detrito (muerte) / detrito→nutriente (descomposición).
- **ENERGÍA (abierta):** entra como LUZ (capturada por la vegetación), se almacena (`veg·vegEcoef + reservas + tripa +
  detritoE`), sale como CALOR (metabolismo, digestión, descomposición). Sin luz → la vegetación se apaga → todo muere.

## Parámetros (en `config.js`). Laboratorio en vivo, agrupado:
- **Luz y vegetación:** Luz solar (`lightMul`) · Corriente del abismo (`lightFlow`) · Productividad (`vegGrowth`) · Comida en
  parches (`patchiness`) · Reserva de rebrote (`grazeRefuge`).
- **Alimentación:** Pastoreo (`grazeRate`) · Alcance de forrajeo (`forageReach`) · Carroñeo (`scavRate`) · Escape por velocidad
  (`fleeSpeed`) · Cobertura del refugio (`coverStrength`; `prob_escape = coverStrength·cover_local`).
- **Metabolismo y cría:** Metabolismo basal (`baseCost`) · Umbral de cría (`reproE`; el umbral real de cada organismo =
  `reproE·reproK`) · Reproducción (`reproMode`: `both`/`asexual`/`sexual`, default `sexual`) · Senescencia (`senesce`) ·
  Lastre de reservas (`fatWeight`).
- **Evolución:** Ritmo de mutación (`mutRate`).
- **Arranque (reinicio):** Tamaño de mundo · Sembrado inicial · Extensión · Diversidad (`START.diversity`: 0 = fundadores
  clones · 1 = diversos; perturba morfología + r/K con tejidos fijos = suelo de viabilidad).
- El worker (`set`) acepta claves de `SIM_P`, `GENOME_P` (mutRate), `world.lightMul` y `world.P` → efecto en vivo.

## Render y observación (render puro: no toca la sim ni el dorado)
- **Fondo = campo de vegetación** con paleta hex editable (`abyssColor`/`pastoColor`/`refugioColor`) + contraste-auto por
  relieve; fluye con la luz. Encima, parches de cobertura (refugio) en verde alga.
- **Organismos:** siluetas bézier por nodo (afilan según `aspect`) con sombreado volumétrico, costillas y contorno suave
  (reborde = linaje oscurecido). Color por modo: Natural (linaje + tinte de tejido) · Oficio (por dieta) · Linaje. Ojos =
  lectura de percepción (miran al estímulo). Crías: tamaño dibujado ∝ edad. Cadáveres que se desvanecen. Inspector con
  retrato del organismo + dieta + r/K; la cámara sigue al seleccionado.
- **Abismo vivo:** nebulosa de vegetación con profundidad + plancton + nieve marina; GLOW por downsample aditivo (no
  `ctx.filter blur`). **Calidad gráfica (alta/media/baja):** preset de LOD + resolución (`dprCap`) + atmósfera + glow, en vivo.
- **Gráficas en vivo (se computan en el worker):** población · nacimientos · muertes · talla media por oficio · histograma
  de un rasgo seleccionable, apilado por oficio.

## Resultados medidos (headless, 3-5 semillas, 30-50k ticks)
- **Conserva** materia (deriva ~0.004% = ruido f32) + energía: gate 9/9 verde.
- **Estructura trófica robusta:** herbívoros/carnívoros/carroñeros coexisten (~65/15/20% por dieta); el cazador no se
  extingue. Con `reproMode='sexual'` el cazador queda más fino pero coexiste. Mortalidad depredación-dominante (~2:1).
- **Población estable** (~210-320 en mundo 1500), energía-limitada. **Locomoción viva** gracias al escape-por-velocidad.
- **Boca bajo selección** (`mouthCost`) → diferenciación de nicho (boca del carnívoro ~2× la del herbívoro).
- **Determinismo:** dorado `0x65f6795f` en `test/m8-determinism.mjs`. Cámbialo solo con cambios de física intencionados.
- **Rendimiento:** motor grid-bound; optimizado a ~1.7-1.85× (luz por sin/cos precomputado, difusión/vegStep sin módulo,
  escaneos O(pob)). Mide con `spikes/perf-bench.mjs`.

## Historia
El modelo PREVIO tenía fotosíntesis en el genoma (degeneraba a sesilidad). Las notas/memorias que mencionan `photoCap`,
"autótrofo↔heterótrofo" o "fotosíntesis" describen ese modelo obsoleto; hoy todos son animales y la energía entra por la vegetación.
