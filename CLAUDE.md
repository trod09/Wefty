# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Cómo trabajar conmigo (leer primero)

El dueño es un fundador no-técnico que está aprendiendo a programar. Responde siempre **en español** y adapta tu forma de trabajar:

1. **Cambios pequeños y revisables — una cosa cada vez.** No juntes varias modificaciones en un cambio grande. Haz un cambio concreto, confirma que funciona y luego pasa al siguiente.
2. **Explica en lenguaje sencillo qué vas a hacer ANTES de hacerlo.** Antes de cada cambio, di qué vas a hacer y por qué, sin tecnicismos. Después, hazlo.
3. **No instales librerías nuevas sin avisar.** Si algo parece necesitar un paquete nuevo, párate, explica en palabras simples por qué hace falta y para qué sirve, y espera aprobación antes de instalar nada.
4. **Recuerda hacer commit a git tras cada cambio que funcione.** Cuando un cambio esté hecho y confirmado, recuérdale al dueño que haga commit (y ofrécele el comando exacto).

Ante la duda, mejor hacer una pregunta corta que adivinar.

## What this is

Wefty — predicción de stock para marcas de moda (mercado: España, todo en español). App Next.js 14 (App Router) con dos mundos que comparten la misma estética "dark editorial premium":

- **Landing de marketing** (`/`): estilo cyberpunk con CSS propio aislado, en `app/_landing/`.
- **Producto "Loop"** (`/login`, `/upload`): subida de CSV de ventas, dashboard y el motor de stock (ver "Producto y Motor de stock" más abajo). Backend: Supabase (auth + tabla `ventas` con RLS).

Las pruebas del motor viven en `scripts/test-engine.mjs` (Node puro, sin framework).

## Commands

```bash
npm run dev      # local dev server at http://localhost:3000
npm run build    # production build
npm start        # serve the production build (after build)
npm run lint     # next lint
```

Requires Node 18.18+ (20+ recommended). JavaScript only (`.jsx`) — no TypeScript despite the Tailwind globs including `ts`/`tsx`.

## Architecture

**Landing (`/`)**: `app/page.jsx` (server component con los metadatos) → `app/_landing/`:

- `Landing.jsx` — todo el marcado (client). Carga sus propias fuentes vía `next/font` (Space Grotesk + JetBrains Mono) como variables CSS locales.
- `CtaLink.jsx` — los CTA con lógica de sesión: por defecto `/login`, con sesión Supabase → `/upload` (usa la instancia de `lib/supabase.js`). No romper ese contrato.
- `effects.js` — `initLanding(root)` arranca las animaciones (terminal, canvas del hero, esfera de la red, glitch, cursor/HUD) y devuelve una función de **cleanup** que desmonta todo (rAF, observers, timers, nodos inyectados) al navegar.
- `landing.css` — TODO el CSS de la landing, aislado bajo `.wefty-root` (más 5 reglas `html:has(.wefty-root)` para scroll/scrollbar que se autodesactivan fuera). La landing NO usa Tailwind; no añadir reglas globales aquí.

Los canvas pintan fotograma estático con `prefers-reduced-motion` y pausan fuera de pantalla. La landing v1 anterior (componentes `components/landing/` + clases `lp-*`) fue retirada; vive en el historial (commit `1d1eeaa`).

Módulos compartidos (los usa también el producto — tocar con cuidado):

- **`components/hooks.jsx`** — `useReveal`/`Reveal` (clases `.reveal`/`.in`), `useScrollProgress`, `useCountUp`, `useMagnetic`, constante `EASE`.
- **`components/primitives.jsx`** — `MonoLabel`, `SectionLabel`, `MagneticButton`, `UnderlineLink`, `Hairline`, `Stat`.
- **`components/decor.jsx`** — `CornerCrosshairs`, `Annotation`, `Fn` (y exports legacy sin uso).
- **`components/EnterAppButton.jsx`** + **`useProductHref.js`** — el CTA consciente de sesión: con sesión → `/upload`, sin sesión → `/login`. No romper esa lógica.

### Client components

Nearly every component is `'use client'` — they rely on hooks, `IntersectionObserver`, scroll listeners, and `<canvas>` (e.g. `NetworkEffect.jsx`). Keep new interactive components client-side. Only `app/layout.jsx` and `app/page.jsx` are server components.

### Styling

Tailwind + a large block of hand-written CSS in **`app/globals.css`** (~270 lines: the reveal animations, hairlines, grid-noise, word-reveal, `.emph` highlight spans, etc.). The animation classes that `hooks.jsx` toggles live here — JS sets the class, CSS defines the transition. When adding motion, prefer this class-toggle pattern over inline JS animation.

- Custom colors live in `tailwind.config.js`: `bone`, `cream`, `sand`, `ink`, `electric`, `navy`, `clay`, `ember`, and the `ash.50–700` scale. Use these names rather than raw hex.
- Fonts are loaded via `next/font/google` in `app/layout.jsx` (Fraunces serif, Inter sans, JetBrains Mono) and exposed as CSS vars (`--font-fraunces`, `--font-inter`, `--font-jetbrains`) wired into Tailwind's `fontFamily` (`font-serif`/`font-sans`/`font-mono`). Do not add `<link>` font tags.

### Producto (Loop) y Motor de stock

Además de la landing (`/`), existe el producto: `/login` (Supabase auth) y `/upload`
(estética "dark editorial premium"). `/upload` monta `components/ProductoShell.jsx`:
**navegación lateral** por secciones — Resumen, Insights, Reposición, Lanzamiento,
Plan de compra y Datos y ajustes — con TODO siempre montado (las secciones inactivas
se ocultan con CSS para no perder filtros, plan generado ni costes al navegar). Una
sola instancia de `SalesDashboard` (prop `seccion`: resumen/insights, filtros
compartidos) y de `StockEngine` (prop `pestana` controlada por el sidebar); el motor
se prepara UNA vez en el shell y se comparte con los paneles de Datos y ajustes
(subida/guardado de CSV, costes de producto, configuración y validación). Móvil:
barra inferior fija; tablet: sidebar colapsado a iconos. El pie del sidebar lleva
email y cerrar sesión. Los datos viajan como `records` ya parseados: `{fecha, producto,
categoria, talla, color, unidades, precio, ingresos}`. Tablas Supabase: `ventas`
(RLS por user_id) y `costes_producto` (coste unitario real por producto, único
por user_id+producto, RLS select/insert/update/delete; la edita el panel
`components/CostesProducto.jsx` dentro del Motor de stock y la consumen el plan
de compra y el prellenado del modo economía de Reposición).

El **motor de recomendación de stock** vive en `lib/engine/` (módulos `.mjs` de
matemática pura, sin React — ejecutables desde Node) y su pantalla es
`components/StockEngine.jsx` (la UI no calcula nada, solo pinta):

- `datos.mjs` — series semanales por producto/variante/categoría/marca, perfil del
  dataset y panel de configuración honesta (qué técnica está activa y por qué).
- `limpieza.mjs` — outliers (>3 MAD sobre mediana móvil, winsorizados) y roturas de
  stock (ceros sostenidos con hermanas vendiendo → demanda repuesta), con avisos.
- `forecast.mjs` / `modelos.mjs` / `backtest.mjs` — banco de modelos (ingenuo, EWMA,
  Holt amortiguado, Holt-Winters, naive estacional, Croston/SBA) y selección por
  backtest rolling-origin (WAPE, mínimo 3 cortes; robusto = ≥26 semanas y ≥500 uds).
- `estacionalidad.mjs` — índices semanales por categoría (solo con ≥52 semanas).
- `bootstrap.mjs` — 500 simulaciones deterministas (semilla fija) remuestreando los
  errores reales del modelo; percentiles empíricos, riesgos por talla.
- `economia.mjs` — newsvendor: ratio crítico, margen esperado, riesgos en euros.
- `ciclo.mjs` — lanzamiento/crecimiento/maduro/declive; en declive ajusta a la baja.
- `curvas.mjs` — curva de tallas jerárquica con shrinkage n/(n+K), K=200; redondeo
  por mayor resto (suma exacta); matriz talla×color por IPF.
- `lanzamiento.mjs` — modo B: análogos con score transparente y curva de lanzamiento.
- `motor.mjs` — orquestador: `prepararMotor(records)` una vez por dataset,
  `recomendarReposicion(...)` por producto bajo demanda, `validacionGlobal(...)`,
  `demandaProducto(motor, nombre, horizonte)` (pipeline completo memoizado en
  `motor.cacheDemanda`, lo usa el plan de compra).
- `plan.mjs` — plan de compra global (open-to-buy): curva de valor marginal
  newsvendor por unidad y asignación por NIVELES de rentabilidad (margen POR
  EURO, tolerancia 1e-9; el nivel que no cabe se raciona proporcionalmente —
  invariante al orden del CSV); acepta `costesReales` (Map nombre → €/ud, del
  panel de costes) y usa la estimación por margen global donde no haya;
  baseline "proporcional al histórico" para la comparación honesta; frontera
  (última unidad comprada / primera descartada); desglose talla×color por fila
  con las mismas curvas de `curvas.mjs`. Solo recalcula al pulsar "Generar plan".

Reglas del motor: todo determinista; el motor usa SIEMPRE el dataset completo
(ignora los filtros del dashboard); honestidad configurable (si una técnica no tiene
datos suficientes se desactiva CON AVISO); cada resultado lleva su explicación
("¿Por qué esta recomendación?") cuyos números cuadran con el resultado final.

**Pruebas del motor**: `node scripts/test-engine.mjs` (181 casos con resultados
calculados a mano + extremo a extremo con `ventas_ejemplo_loop.csv`). Ejecútalas
tras tocar cualquier fichero de `lib/engine/`.

### Conventions

- Import via the `@/*` alias (e.g. `import App from '@/components/App'`) — configured in `jsconfig.json`.
- Section layout uses a recurring 12-column grid pattern: `max-w-[1440px] mx-auto px-8 md:px-12` containers with `grid grid-cols-12 gap-6`.
- Copy 100% en español de España (de tú, sin anglicismos), con tipografía editorial intencionada (rayas, comillas curvas, etiquetas mono tipo `[02] · El problema`). Todo el copy va hardcodeado en los componentes — no hay CMS.
