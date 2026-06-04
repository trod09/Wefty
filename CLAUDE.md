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

Weft's single-page marketing/landing site — "the data co-op for DTC fashion." It is a one-route Next.js 14 (App Router) app, migrated from a single-file in-browser HTML prototype (React+Babel via CDN, Tailwind via CDN). There is no backend, no routing beyond `/`, and no tests. The product is essentially a static, heavily-animated landing page.

## Commands

```bash
npm run dev      # local dev server at http://localhost:3000
npm run build    # production build
npm start        # serve the production build (after build)
npm run lint     # next lint
```

Requires Node 18.18+ (20+ recommended). JavaScript only (`.jsx`) — no TypeScript despite the Tailwind globs including `ts`/`tsx`.

## Architecture

The whole page renders through one chain: `app/page.jsx` → `components/App.jsx` → the section components. `App.jsx` is the page composition — it imports each section in order and also defines the inline "glue" sections (`BrandMarqueeSection`, `PullQuoteSection`, `WordmarkSection`) including their copy/data. To reorder or add a section, edit `App.jsx`.

Three shared modules underpin everything; understand these before touching any section:

- **`components/hooks.jsx`** — all behavior. `useReveal`/`Reveal` (IntersectionObserver scroll-in, toggles the `.reveal`/`.in` CSS classes), `useScrollProgress` (rAF-driven 0→1 scroll position for an element), `useCountUp`, `useMagnetic` (pointer-follow button effect), and the shared `EASE` cubic-bezier constant. Animations are CSS-class-driven from here, not a library.
- **`components/primitives.jsx`** — reusable UI atoms: `MonoLabel`, `SectionLabel`, `MagneticButton`, `UnderlineLink`, `Hairline`, `Stat`.
- **`components/decor.jsx`** — decorative/atmospheric elements: `CornerCrosshairs`, `BrandMarquee`, `PullQuote`, `WordmarkBand`, `Annotation`, `Fn`.

Each `Xxx.jsx` section (Hero, Problem, HowItWorks, NetworkEffect, Dashboard, Trust, Pricing, FAQ, Footer, Nav) is self-contained and composes the primitives/hooks/decor above.

### Client components

Nearly every component is `'use client'` — they rely on hooks, `IntersectionObserver`, scroll listeners, and `<canvas>` (e.g. `NetworkEffect.jsx`). Keep new interactive components client-side. Only `app/layout.jsx` and `app/page.jsx` are server components.

### Styling

Tailwind + a large block of hand-written CSS in **`app/globals.css`** (~270 lines: the reveal animations, hairlines, grid-noise, word-reveal, `.emph` highlight spans, etc.). The animation classes that `hooks.jsx` toggles live here — JS sets the class, CSS defines the transition. When adding motion, prefer this class-toggle pattern over inline JS animation.

- Custom colors live in `tailwind.config.js`: `bone`, `cream`, `sand`, `ink`, `electric`, `navy`, `clay`, `ember`, and the `ash.50–700` scale. Use these names rather than raw hex.
- Fonts are loaded via `next/font/google` in `app/layout.jsx` (Fraunces serif, Inter sans, JetBrains Mono) and exposed as CSS vars (`--font-fraunces`, `--font-inter`, `--font-jetbrains`) wired into Tailwind's `fontFamily` (`font-serif`/`font-sans`/`font-mono`). Do not add `<link>` font tags.

### Conventions

- Import via the `@/*` alias (e.g. `import App from '@/components/App'`) — configured in `jsconfig.json`.
- Section layout uses a recurring 12-column grid pattern: `max-w-[1440px] mx-auto px-8 md:px-12` containers with `grid grid-cols-12 gap-6`.
- Copy contains intentional editorial typography (em dashes, curly quotes, the `roster · q3 '26` mono labels). The brand roster, stats, and quotes are hardcoded as data arrays inside the relevant section/glue components — there is no CMS.
