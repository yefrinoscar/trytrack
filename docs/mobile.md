# Adaptación a móvil

Validado con Chrome en emulación de teléfono (390×844, DPR 3, táctil) contra
páginas con datos reales. Herramientas en `scripts/`:

| Script                     | Para qué                                                        |
| -------------------------- | --------------------------------------------------------------- |
| `mobile-audit.mjs`         | Desbordes horizontales y ancho real del documento               |
| `mobile-targets.mjs`       | Área táctil **real** de cada control (incluye el `::after`)     |
| `mobile-check-columns.mjs` | Recorre columnas y toca botones, reporta errores de consola     |
| `mobile-tap-menu.mjs`      | Abre el menú de cuenta con toque real (Radix ignora `.click()`) |
| `dialog-check.mjs`         | Abre un diálogo y mide dónde cae                                |

## Lo que estaba roto

**El desborde horizontal.** El documento medía **591 px** en un viewport de
**390 px**.

La causa no era el ancho de ningún contenedor, sino **un ítem de grid**: en CSS
un hijo de `grid` tiene `min-width: auto`, así que nunca se encoge por debajo de
su contenido. Una `<section class="grid">` medía 366 px mientras su hijo medía
579 px, y eso arrastraba toda la página.

| Problema                          | Medición                                       |
| --------------------------------- | ---------------------------------------------- |
| Desborde horizontal               | documento **591 px** en viewport de **390 px** |
| Cabecera duplicada                | 2 bloques de identidad y los enlaces 2 veces   |
| Menú flotando sobre el contenido  | restaba **~250 px** de alto útil               |
| Scroll hasta "Logout"             | **15 992 px**                                  |
| Controles con área táctil < 40 px | **9**                                          |

## Los cambios

1. **`debts-page.tsx`** — cada columna va dentro de un `<div class="min-w-0">`.
   Este es el arreglo real: permite que el ítem de grid se encoja.

2. **`styles.css`**
   - `.page-wrap` usa `padding` lateral en vez de un ancho en `calc()`.
   - `body` usa `overflow-x: clip`.
   - `.sidebar-link-icon`: área de 44 px para el menú de iconos.
   - `.tap-target`: agranda a ~44 px el área de pulsación con un `::after`
     invisible, sin agrandar el dibujo. Se desactiva desde `lg`.
   - `.touch-tall`: sube a 40 px la altura de los botones de texto cortos
     (solo en pantallas táctiles).

3. **`Header.tsx`** — por debajo de `lg` es **una barra fija**: la marca, el menú
   de iconos y el avatar con Configuración/Cerrar sesión. En `lg` hacia arriba
   queda el menú lateral de siempre.

4. **`ui/dialog.tsx`** — en móvil el diálogo se ancla abajo (al alcance del
   pulgar), con `88dvh` máximo y scroll interno; desde `sm` vuelve a centrarse.

5. **Botones sin etiqueta** — el botón "+" para añadir un gasto y el menú de
   cada tarjeta no tenían `aria-label`. Ahora lo tienen.

## Verificación en producción

| Medición                              | Antes                | Ahora                                      |
| ------------------------------------- | -------------------- | ------------------------------------------ |
| Ancho del documento (móvil)           | 591 px               | **390 px**                                 |
| Desborde horizontal                   | sí                   | **no**                                     |
| Controles con área < 40 px            | 9                    | **0** (223 en `/debts`, 15 en `/settings`) |
| Errores de consola recorriendo la app | —                    | **0**                                      |
| Menú de cuenta                        | se abría desalineado | anclado, 208×95 dentro de pantalla         |
| Rutas verificadas                     | —                    | `/debts`, `/settings`, `/login`            |

Recorrido funcional (tocando de verdad, no solo leyendo el DOM): abrir y cerrar
el diálogo de deuda, abrir el alta de deuda, cambiar a la pestaña de gráficos,
marcar y desmarcar un recurrente como pagado, borrar un gasto, abrir el menú de
cuenta y navegar a Configuración. Los cambios se confirmaron después en D1.

Escritorio a 1440×900: sin desborde y con el menú lateral intacto.
Tiempos sin cambios: TTFB ~300 ms, primer pintado ~850 ms.
