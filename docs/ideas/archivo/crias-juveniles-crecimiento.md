# Crías juveniles que crecen — diferentes de los adultos

**Estado: opción A IMPLEMENTADA (2026-06-21) · opción B = spike futuro. ARCHIVADA.**

> Idea de usuario: las crías deberían verse DISTINTAS de los adultos — pequeñas y CRECIENDO hasta el tamaño adulto. Se puede
> hacer desde lo más básico (solo render) o adaptando el modelo. El usuario apuesta por solo-render; me pide pensarlo.

## Estado actual (no hay ontogenia)
La cría nace ya con su **cuerpo adulto completo**: en `sim.js`, reproducción → `develop(childG)` + `computePhenotype` → masa/v.máx/boca
FINALES desde el tick 0. `age` se cuenta (`this.age[i]++`) pero **no la usa nadie** (ni la dinámica ni el render — `age` solo viaja
en el `detail` del inspeccionado, no en el snapshot por agente). No hay madurez por tamaño: una cría se reproduce en cuanto reúne
energía (reproE) y pasa el cooldown. Es decir: hoy una "cría" es un adulto en miniatura-cero — nace adulta.

## Opción A — SOLO RENDER (la apuesta del usuario) ✅ recomendada como primer paso
Escalar el tamaño DIBUJADO por un factor de crecimiento derivado de la `age` REAL. La simulación no cambia.
- **Mecánica:** el worker manda un `aGrow` por agente (write-only, como `aE`/`aspd`): `grow = MIN + (1-MIN)·min(1, age/MADURA)`
  (p.ej. MIN≈0.45, MADURA≈250-400 ticks). En `drawOrgs`, multiplicar el radio de nodo (`pr`) por `aGrow[a]` → la cría se dibuja
  pequeña y crece visiblemente. Opcional con encanto: ojos/cabeza **proporcionalmente** mayores de cría (los bebés "tiernos").
- **Coste/riesgo:** trivial. Render PURO → **dorado intacto** (`age` es real; `aGrow` es lectura write-only, como brillo=energía).
- **Honestidad (el límite a asumir):** es un READOUT FIEL de la edad (de verdad es joven), pero **mecánicamente sigue siendo adulta**:
  come, nada, caza y se reproduce a plena potencia aunque se vea diminuta. Un espectador que abra el inspector verá una "cría" con
  masa/v.máx de adulto. Para una pecera contemplativa es un compromiso aceptable (y coherente con que el render ya muestra
  lecturas — ojos, glow — que no son genes). Pero NO crea juventud ecológica (vulnerabilidad, madurez retardada).

## Opción B — ADAPTAR EL MODELO (ontogenia real) — más jugo, más coste
La cría nace PEQUEÑA y CRECE: su fenotipo escala con un estado `grow` (0→1) que sube con el tiempo/energía.
- **Mecánica:** `grow` por agente (nace ~0.4). El fenotipo efectivo escala con el tamaño lineal: como aquí masa ∝ área (r²),
  `mass_ef ≈ mass·grow²`; v.máx, arrastre, boca y presa-manejable se derivan de r → escalan también. El crecimiento **cuesta**
  (energía y MATERIA: acretar cuerpo = tomar nutriente, como un "nacimiento continuo" → el libro mayor debe seguir conservando).
  **Madurez:** no se reproduce hasta `grow≈1` (o reproE escala con el tamaño adulto).
- **Lo ecológicamente rico:** una cría con `mass_ef` pequeña es **presa manejable por MÁS depredadores** (`preyMassMax` mira la masa)
  → **vulnerabilidad juvenil** y mortalidad por edad emergentes; estructura de tallas real (bancos de crías, etc.).
- **Coste/riesgo:** ALTO. Cambia la dinámica → re-captura del dorado + re-validación ecológica (m9). Cuidado de conservación con la
  materia que se acreta al crecer. Más superficie de test.

### El ángulo que lo hace tentador: podría DESATASCAR el r/K
La auditoría dejó documentado que el eje **r/K queda near-neutral** en la pecera cerrada (no diverge). Falta precisamente la
estructura de **historia de vida** que da sentido a r vs K: crías pequeñas-baratas-vulnerables-muchas (r) frente a
grandes-caras-protegidas-pocas (K). **La ontogenia + madurez + mortalidad juvenil es justo ese sustrato.** B no es solo cosmético:
es candidato a hacer SIGNIFICATIVO un gen hoy inerte. Por eso, si se hace B, hacerlo como **SPIKE con hipótesis falsable** (al
estilo del proyecto): *¿con crecimiento+madurez+vulnerabilidad juvenil, el r/K diverge y aparece estructura de tallas?* — y, si
sale NULO, revertir (como nidada/barrera post-cigótica).

## Recomendación (piensa tú)
1. **Hacer A ya.** Es barato, seguro (dorado intacto), da el ciclo de vida VISIBLE que pides y es un readout honesto de la edad real.
   Coincide con tu apuesta. (Variante con encanto: ojos un punto mayores de cría.)
2. **Reservar B como spike de mayor valor**, NO como add cosmético: su premio real no es "verse pequeña" (eso lo da A) sino
   **un eje r/K que por fin muerda** y estructura de tallas/vulnerabilidad. Con criterios de muerte. Es donde está la profundidad,
   pero cuesta y debe demostrar que paga.
3. Punto medio descartado ("B-lite": escalar solo v.máx/boca sin masa) — toca el dorado igual que B pero sin el beneficio
   ecológico (la depredación no ve crías más pequeñas si la masa no escala). No vale la pena: o A (gratis) o B (completo).

## Implementado (A — solo render, 2026-06-21)
El worker manda `aGrow` por agente (write-only): `growMin + (1-growMin)·min(1, age/growMature)` (config `growMin=0.45`,
`growMature=320`). En `drawOrgs`, el cuerpo ENTERO (posiciones + radios, alrededor del centro) se escala por `aGrow` → la cría
nace al 45% y crece hasta adulto con la EDAD REAL; ojos proporcionalmente mayores en crías (toque tierno). **Dorado intacto**
(verificado `0x4bcdaeaa` con reproMode=both: es write-only, la dinámica no cambia). Límite asumido: mecánicamente la cría ya es adulta.
Archivos: `worker.js` (`aGrow`), `main.js` (`drawOrgs` escala por `grow`), `config.js` (`growMin`/`growMature`).

## Pendiente (B — spike de ontogenia real, NO hecho)
Crecimiento que escala el FENOTIPO (mass/v.máx/boca ∝ tamaño) + madurez (no cría hasta crecida) + vulnerabilidad juvenil
(cría = presa para más depredadores). **Hipótesis falsable: ¿desatasca el r/K near-neutral?** Cuesta (re-captura dorado +
re-validación ecológica + conservación de la masa que se acreta) → abrir como spike con criterios de muerte. Anotado en el staging del índice.
