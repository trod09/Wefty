import './globals.css';
import { Fraunces, Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';

const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});

const inter = Inter({
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
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable}`}
    >
      <body className="font-sans">{children}</body>
    </html>
  );
}
