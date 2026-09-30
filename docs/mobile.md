# Adaptación a móvil

Medido con `scripts/mobile-audit.mjs` y `scripts/dialog-check.mjs` (Chrome con
emulación de teléfono: 390×844, DPR 3, táctil) contra páginas con datos reales.

## Lo que estaba roto

La página entera se desbordaba a lo ancho: el documento medía **591 px** en un
viewport de **390 px**, así que todo se veía desplazado y cortado.

La causa no era el ancho de ningún contenedor, sino **un ítem de grid**. Una
`<section class="grid">` mide 366 px, pero su hijo medía 579 px, porque el
`min-width` por defecto de un ítem de grid es `auto`: nunca se encoge por debajo
de su ancho mínimo de contenido (`min-content`). El hijo rebelde era un
`<div class="flex items-center justify-between">` con `min-content` de 579 px.

Otros problemas, medidos:

| Problema                                    | Medición                                       |
| ------------------------------------------- | ---------------------------------------------- |
| Desborde horizontal de toda la página       | documento **591 px** en viewport de **390 px** |
| Cabecera: logo y usuario duplicaban el menú | 2 bloques de identidad y los enlaces 2 veces   |
| Menú superior flotando encima del contenido | restaba **~250 px** de alto útil               |
| Navegación al final de la página            | **15 992 px** de scroll hasta "Logout"         |
| Área táctil de los iconos de acción         | botones de **24×24 px**                        |

## Lo que se cambió

1. **`src/features/debts/debts-page.tsx`** — cada columna va envuelta en un
   `<div class="min-w-0">`. Esto es el arreglo real del desborde: permite que el
   ítem de grid se encoja. Sin esto, ninguna otra medida sirve.

2. **`src/styles.css`**
   - `.page-wrap` y `.debts-page-wrap` usan `padding` lateral en vez de un ancho
     en `calc()`, para que ningún contenedor exceda el viewport.
   - `body` usa `overflow-x: clip` en vez de `hidden`.
   - Se añade `.sidebar-link-icon` (área táctil de 44 px) y `.tap-target`
     (agranda el área de pulsación de los iconos pequeños sin agrandar el dibujo).

3. **`src/components/Header.tsx`** — por debajo de `lg` la cabecera es **una sola
   barra**: la marca, el menú de solo iconos (que ya no se corta) y el avatar con
   Configuración/Cerrar sesión. En `lg` hacia arriba queda el menú lateral de
   siempre, sin cambios.

4. **`src/routes/__root.tsx`** — el contenido ya no reserva `pt-16` en móvil.

5. **`src/components/ui/dialog.tsx`** — los diálogos se anclan abajo en móvil
   (más cerca del pulgar) y vuelven a centrarse desde `sm`. Máximo `88dvh` con
   scroll interno.

6. **Botones de acción** (`debt-list-item`, `daily-expenses-column`,
   `recurring-payments-column`) — pasan a tener `aria-label` y área táctil
   ampliada.

## Verificación

| Medición                          | Antes   | Después                         |
| --------------------------------- | ------- | ------------------------------- |
| Ancho del documento (móvil)       | 591 px  | **390 px**                      |
| Desborde horizontal               | sí      | **no**                          |
| Menús de identidad en la cabecera | 2       | **1**                           |
| Alto útil perdido en cabecera     | ~250 px | **0** (barra fija)              |
| Rutas verificadas                 | —       | `/debts`, `/settings`, `/login` |
| Diálogo de deuda                  | —       | 63→832 px, dentro del viewport  |

El escritorio se comprobó aparte a 1440×900: sin desborde y con el menú lateral
intacto. Los tiempos de carga en móvil no cambiaron (TTFB ~750 ms, primer
pintado ~1.3 s, igual que antes del cambio).
