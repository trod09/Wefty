import LandingWefty from '@/components/landing/LandingWefty';

// Metadatos de la landing en español (el title se completa con la plantilla
// del layout en el resto de páginas; aquí va el titular completo).
export const metadata = {
  title: 'Wefty — Deja de adivinar cuánto stock pedir',
  description:
    'Wefty predice cuántas unidades fabricar de cada producto, talla y color — incluso de los que aún no has lanzado. Sube un CSV de ventas y recibe tu pedido óptimo.',
  openGraph: {
    title: 'Wefty — Deja de adivinar cuánto stock pedir',
    description:
      'Predicción de stock para marcas de moda: unidades por producto, talla y color, a partir de tus ventas y de la inteligencia de la red.',
    siteName: 'Wefty',
    locale: 'es_ES',
    type: 'website',
  },
};

export default function Page() {
  return <LandingWefty />;
}
