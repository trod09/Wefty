import LandingWefty from '@/components/landing/LandingWefty';

// Título en español para la pestaña; los metadatos completos (description,
// Open Graph…) se rematan en la parte 3 del rediseño.
export const metadata = {
  title: 'Wefty — Deja de adivinar cuánto stock pedir',
};

export default function Page() {
  return <LandingWefty />;
}
