import LandingFlashly from '../_landing-flashly/LandingFlashly';

// Ruta de VISTA PREVIA del rediseño de la landing (piloto). No se indexa y no
// reemplaza a la landing real (/). Sirve para revisar el hero + «El problema»
// en los dos modos antes de propagar el cambio.
export const metadata = {
  title: 'Vista previa · rediseño landing',
  robots: { index: false, follow: false },
};

export default function PreviewLandingPage() {
  return <LandingFlashly />;
}
