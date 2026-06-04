# Weft — Next.js

Landing page de **Weft** (the data co-op for DTC fashion), migrada de un single-file HTML
(React + Babel en el navegador + Tailwind por CDN) a un proyecto **Next.js 14 (App Router)**.

## Requisitos

- Node.js 18.18+ (recomendado 20+)
- npm (o pnpm / yarn)

## Arrancar en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000

## Build de producción

```bash
npm run build
npm start
```

## Estructura

```
weft-nextjs/
├── app/
│   ├── globals.css      # Directivas de Tailwind + todo el CSS custom (animaciones, hairlines, grid-noise…)
│   ├── layout.jsx       # <html>/<body>, metadata y fuentes (next/font)
│   └── page.jsx         # Renderiza <App />
├── components/
│   ├── hooks.jsx        # useReveal, Reveal, useScrollProgress, useCountUp, useMagnetic, EASE
│   ├── primitives.jsx   # MonoLabel, SectionLabel, MagneticButton, UnderlineLink, Hairline, Stat
│   ├── decor.jsx        # CornerCrosshairs, BrandMarquee, PullQuote, WordmarkBand, Annotation, Fn
│   ├── App.jsx          # Composición de la página + secciones de marquee/quote/wordmark
│   ├── Nav.jsx
│   ├── Hero.jsx
│   ├── Problem.jsx
│   ├── HowItWorks.jsx
│   ├── NetworkEffect.jsx
│   ├── Dashboard.jsx
│   ├── Trust.jsx
│   ├── Pricing.jsx
│   ├── FAQ.jsx
│   └── Footer.jsx
├── tailwind.config.js   # Colores (bone, ink, electric, ash…) y fontFamily (vía CSS vars)
├── postcss.config.mjs
├── next.config.mjs
└── jsconfig.json        # alias @/*
```

## Qué cambió respecto al HTML original

- **Tailwind**: ya no se carga por CDN. Está integrado vía PostCSS (`tailwind.config.js`).
  Los colores y fuentes custom que estaban en `tailwind.config` inline se movieron al config real.
- **Fuentes**: Fraunces, Inter y JetBrains Mono se cargan con `next/font/google` (sin `<link>`),
  expuestas como CSS variables (`--font-fraunces`, `--font-inter`, `--font-jetbrains`) y conectadas
  en el `fontFamily` de Tailwind.
- **CSS**: el bloque `<style>` del HTML se trasladó íntegro a `app/globals.css`.
- **Módulos**: cada componente dejó de colgarse de `window` y ahora usa `import`/`export` ES.
- **`'use client'`**: los componentes usan hooks, canvas, `IntersectionObserver` y listeners de
  scroll, así que están marcados como Client Components.

El diseño, las animaciones y el contenido son idénticos al original.
