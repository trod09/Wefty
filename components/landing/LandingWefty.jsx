// Landing de Wefty — composición de la página / (y solo de esa página).
// 5 secciones, ni una más: hero, el problema, cómo funciona, la red y cierre.
// Estética "dark editorial premium" en continuidad con el producto (/upload):
// mismo fondo radial, misma textura de rejilla, tipografía y acentos.
import HeroWefty from './HeroWefty';
import { Problema, ComoFunciona, LaRed, CierreCta } from './Secciones';

export default function LandingWefty() {
  return (
    <div
      className="relative min-h-screen overflow-x-clip text-[#F5F5F7]"
      style={{ background: 'radial-gradient(140% 100% at 50% 0%, #0F1014 0%, #0A0A0B 60%)' }}
    >
      <div className="absolute inset-0 grid-noise-dark opacity-70 pointer-events-none" />
      <div className="relative">
        <HeroWefty />
        <Problema />
        <ComoFunciona />
        <LaRed />
        <CierreCta />
      </div>
    </div>
  );
}
