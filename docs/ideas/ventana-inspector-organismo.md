# Ventana del inspector — dibujar el organismo, seguir siempre, congelar el cadáver

**Estado: PROCESADA (analizada; pendiente de confirmar UX + implementar).** 2026-06-21.

> Idea de usuario: (1) dibujar el organismo dentro de la ventana del inspector; (2) seguir SIEMPRE con la cámara (eliminar el
> botón "seguir cámara"); (3) si el organismo muere, dejar fijo el dibujo de su cadáver hasta cerrar el visor o cambiar de organismo.

## Estado actual (`src/main.js` `updateInspector` + `index.html` `#inspector`)
La tarjeta muestra escalares (rol, energía, dieta, masa, partes, v.máx, edad, boca/presa) + barras de energía/dieta + botón
**"seguir cámara"** (toggle `following`). Al morir el seleccionado: muestra "† murió" y vacía. El `detail` que manda el worker
trae solo escalares — **NO** la geometría del cuerpo.

## Análisis por punto
1. **Dibujar el organismo en la ventana.** Falta la geometría del seleccionado. Opciones:
   - (a) el worker añade al `detail` las partes del cuerpo del seleccionado (`lx,ly,r,tissue,aspect,dir,…`) → robusto, vale aunque esté fuera de cámara. **Recomendado.**
   - (b) el cliente reutiliza el `partData` del frame para ese `id` → gratis, pero solo si está EN PANTALLA.
   Con la geometría, un **mini-canvas** en la tarjeta dibuja la silueta (reusando `silPath`/una versión reducida de `drawOrgs`, sin
   ondulación, encajada al recuadro). Render puro.
2. **Seguir siempre (sin botón).** Al seleccionar → `following=true`; quitar el botón `#inspFollow`. **Choque de UX:** hoy panear
   cancela el follow (`pointermove`). "Seguir SIEMPRE" entra en conflicto con poder panear. Decisión a confirmar:
   - (A) follow inquebrantable (recentра cada frame; el usuario no panea mientras hay selección), o
   - (B) follow automático pero panear lo cancela sin perder la selección (como ahora, solo que sin botón). **Recomiendo (B)** salvo que se quiera "siempre" literal.
3. **Congelar el cadáver.** Al morir el seleccionado, en vez de "† murió" + vaciar, **conservar y seguir dibujando su última forma**
   (congelada) en la ventana hasta deselect/cambio. La forma sale de (1) (último `detail.body` guardado, no borrarlo al morir).
   Mostrar la etiqueta "†" pero mantener el dibujo. La cámara deja de seguir (no hay a quién).

## Alcance
Todo render/UI puro → **dorado intacto**. El único cambio de contrato es añadir el cuerpo al `detail` del worker (write-only, no lo lee la dinámica).

## Siguiente acción
Confirmar UX del follow (A vs B). Implementar: cuerpo del seleccionado en `detail` → mini-canvas en la tarjeta · follow automático sin botón · congelar el dibujo al morir.
