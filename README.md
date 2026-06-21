# Zenote 2

Simulador de **evolución emergente** en el navegador: un abismo donde la **morfología y la conducta** de los organismos
emergen de herencia + mutación + selección sobre una física conservativa (materia cerrada · energía luz→calor). Sin
backend y sin build — HTML/CSS/JS vanilla con el motor en un Web Worker.

🌊 **Demo:** _(añadir aquí la URL de Vercel)_

## Correr en local
```bash
python3 -m http.server 8732      # o:  npm run serve
# abrir http://localhost:8732
```
Es estático: sirve la carpeta con cualquier servidor.

## Tests
```bash
npm test      # = node test/run-all.mjs — gate de correctitud (9/9)
```
Verifica conservación de materia/energía, **determinismo** (checksum dorado) y **regresión ecológica** (coexistencia
trófica + anti-bloat). El motor corre headless en Node, sin dependencias.

## Cómo funciona (breve)
- **Mundo:** la **vegetación** (productor parametrizado) capta luz y crece; los **animales** la pastan, cazan o carroñean.
  La materia se conserva (nutriente↔vegetación↔organismo↔detrito); la energía entra como luz y sale como calor.
- **Organismos:** todos animales. El **genoma son reglas de desarrollo** → cuerpo (forma = función) + **cerebro neuronal**
  (pesos = genes). Reproducción asexual/sexual con mutación y recombinación homóloga.
- **Emergen:** la morfología, el eje herbívoro↔carnívoro (por dieta realizada) y la estructura de linajes. La conducta
  arranca de un cerebro semilla competente y evoluciona desde ahí.

Detalle completo en [`docs/MODELO-ACTUAL.md`](docs/MODELO-ACTUAL.md) · diseño desde primeros principios en
[`docs/02-Redesign/`](docs/02-Redesign/) · backlog de ideas en [`docs/ideas/`](docs/ideas/) · historia del desarrollo
(M0–M8) en [`HISTORIAL.md`](HISTORIAL.md).

## Estructura
- `src/engine/` — motor (world · genome · phenotype · sim · hash · worker); corre también headless en Node
- `src/main.js` — render + cámara + UI · `src/config.js` — **todos los parámetros** (fuente única)
- `test/` — gate de correctitud · `spikes/` — exploraciones (a mano) · `docs/` — modelo, rediseño, ideas

## Pila
Vanilla JS (ES modules) · Canvas 2D · Web Worker. Sin framework ni dependencias. Desplegable como estáticos
(Vercel / GitHub Pages / cualquier hosting).
