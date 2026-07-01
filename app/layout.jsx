import './globals.css';
import { Fraunces, Figtree, JetBrains_Mono, Space_Grotesk } from 'next/font/google';

const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});

// Figtree es la sans del PRODUCTO (sustituye a Inter). Mantengo el nombre de la
// variable CSS (--font-inter) a propósito: así Tailwind, el body y el resto del
// CSS reciben Figtree sin tener que tocar nada más.
const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

// La display de la landing, compartida con el producto para la sintonía visual.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata = {
  title: {
    default: 'Wefty — Predicción de stock para marcas de moda',
    template: '%s · Wefty',
  },
  description:
    'Wefty predice cuántas unidades fabricar de cada producto, talla y color a partir de tus ventas — incluso de los productos que aún no has lanzado.',
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${figtree.variable} ${fraunces.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable}`}
    >
      <head>
        {/* Fija el tema del producto ANTES de pintar (sin parpadeo). Por
            defecto OSCURO; si el usuario eligió claro, se recuerda. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('wefty-tema');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');var l=localStorage.getItem('wefty-tema-landing');if(l==='claro'){document.documentElement.classList.add('lz-claro');}}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();",
          }}
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
