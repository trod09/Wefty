// Landing de Wefty — composición de la página / (y solo de esa página).
// 5 secciones, ni una más: hero, el problema, cómo funciona, la red y cierre.
// Debajo de todo vive «el hilo de demanda» (HiloDemanda): un lienzo fijo
// conducido por el scroll que narra el producto de punta a punta — caos →
// errores → patrón → red → pedido resuelto. La brújula de fases (escritorio)
// marca el capítulo activo. Los div[data-fase] delimitan cada capítulo.
import HeroWefty from './HeroWefty';
import HiloDemanda from './HiloDemanda';
import BrujulaFases from './BrujulaFases';
import { Problema } from './Problema';
import { ComoFunciona, LaRed, CierreCta } from './Secciones';

export default function LandingWefty() {
  return (
    <div
      className="relative min-h-screen overflow-x-clip text-[#F5F5F7]"
      style={{ background: 'radial-gradient(140% 100% at 50% 0%, #0F1014 0%, #0A0A0B 60%)' }}
    >
      <div className="absolute inset-0 grid-noise-dark opacity-70 pointer-events-none" />

      <HiloDemanda />
      <BrujulaFases />

      <div className="relative z-10">
        <div data-fase="0"><HeroWefty /></div>
        <div data-fase="1"><Problema /></div>
        <div data-fase="2"><ComoFunciona /></div>
        <div data-fase="3"><LaRed /></div>
        <div data-fase="4"><CierreCta /></div>
      </div>
    </div>
  );
}
