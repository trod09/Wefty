"use client";

import { useEffect, useRef } from "react";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import CtaLink from "./CtaLink";
import TemaLanding from "./TemaLanding";
import { initLanding } from "./effects";
import "./landing.css";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "700"], display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], display: "swap" });

export default function Landing() {
  const rootRef = useRef(null);

  useEffect(() => {
    const cleanup = initLanding(rootRef.current);
    return cleanup;
  }, []);

  return (
    <div
      ref={rootRef}
      className="wefty-root"
      style={{
        "--font-display": display.style.fontFamily + ", system-ui, sans-serif",
        "--font-mono": mono.style.fontFamily + ", ui-monospace, monospace",
        fontFamily: "var(--font-display)",
      }}
    >
      <div className="scanlines" aria-hidden="true"></div>
      <div className="vignette" aria-hidden="true"></div>
      <div className="noise" aria-hidden="true"></div>

      {/* ── nav ── */}
      <header className="nav" data-screen-label="Navegación">
        <div className="nav-inner">
          <a className="wordmark" href="#"><span className="mark"></span>Wefty</a>
          <span className="nav-status"><span className="dot"></span>RED ACTIVA · 2026</span>
          <nav className="nav-links">
            <a href="#problema">El problema</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#la-red">La red</a>
            <TemaLanding />
            <CtaLink className="btn btn-ghost">Probar Wefty</CtaLink>
          </nav>
        </div>
      </header>

      {/* ── hero ── */}
      <section className="hero" data-screen-label="Hero">
        <div className="wrap">
          <div>
            <p className="kicker"><span className="idx">00 //</span> predicción de stock · moda online</p>
            <h1 data-scramble="1100">
              <span className="glitch" data-text="Deja de adivinar">Deja de adivinar</span> cuánto stock <em>pedir.</em>
            </h1>
            <p className="lede">Wefty predice cuántas unidades producir de cada producto, talla y color. Incluso de los que aún no has lanzado.</p>
            <div className="hero-ctas">
              <CtaLink className="btn btn-solid">Probar Wefty <span className="arrow">→</span></CtaLink>
              <p className="hero-note">sin integraciones · funciona con un <span className="csv">.csv</span> de ventas</p>
            </div>
          </div>
          <div className="terminal reveal" data-delay="1">
            <div className="term-bar">
              <span className="lights"><span></span><span></span><span></span></span>
              <span>wefty://motor-de-pedidos</span>
              <span>v2.6</span>
            </div>
            <div className="term-body">
              <div id="term-lines"></div>
              <div className="term-result" id="term-result">
                <div className="scenarios" role="tablist" aria-label="Escenario de pedido">
                  <button className="scenario" data-scenario="conservador" type="button">Conservador</button>
                  <button className="scenario active" data-scenario="esperado" type="button">Esperado</button>
                  <button className="scenario" data-scenario="agresivo" type="button">Agresivo</button>
                </div>
                <div className="size-rows" aria-hidden="true">
                  <div className="size-row"><span className="sz">XS</span><span className="bar-track"><span className="bar"></span></span><span className="units">52</span></div>
                  <div className="size-row"><span className="sz">S</span><span className="bar-track"><span className="bar"></span></span><span className="units">128</span></div>
                  <div className="size-row peak"><span className="sz">M</span><span className="bar-track"><span className="bar"></span></span><span className="units">204</span></div>
                  <div className="size-row"><span className="sz">L</span><span className="bar-track"><span className="bar"></span></span><span className="units">156</span></div>
                  <div className="size-row"><span className="sz">XL</span><span className="bar-track"><span className="bar"></span></span><span className="units">80</span></div>
                </div>
                <div className="term-total">
                  <p className="n"><span id="term-total-n">620</span><small>UDS</small></p>
                  <p className="risk" id="term-risk">liquidación <b>2.100 €</b><br />venta perdida <b>3.200 €</b></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── problema ── */}
      <section className="block problema" id="problema" data-screen-label="El problema">
        <div className="wrap">
          <div className="section-head">
            <p className="kicker reveal"><span className="idx">01 //</span> el problema</p>
            <h2 className="reveal">Pedir a ojo acaba siempre en una de estas <em>dos facturas.</em></h2>
          </div>
          <div className="facturas">
            <article className="holo reveal" data-delay="1">
              <span className="corner tl"></span><span className="corner br"></span>
              <span className="scanbeam"></span>
              <p className="holo-num">FACTURA_01</p>
              <h3>Producir de más</h3>
              <p>Stock que no rota y acaba liquidado en rebajas. Dinero muerto durmiendo en el almacén.</p>
              <div className="holo-visual">
                <span className="sale-tag"><span className="was">89 €</span><span className="now">35 €</span><span className="pct">−61%</span></span>
              </div>
            </article>
            <article className="holo reveal" data-delay="2">
              <span className="corner tl"></span><span className="corner br"></span>
              <span className="scanbeam"></span>
              <p className="holo-num">FACTURA_02</p>
              <h3>Producir de menos</h3>
              <p>Tallas agotadas a las dos semanas. Venta perdida y clientes que querían comprar y no volverán.</p>
              <div className="holo-visual">
                <div className="size-picker">
                  <span className="size-pill">XS</span>
                  <span className="size-pill out">S</span>
                  <span className="size-pill out">M</span>
                  <span className="size-pill out">L</span>
                  <span className="size-pill">XL</span>
                </div>
                <span className="agotado">Agotado</span>
              </div>
            </article>
          </div>
          <p className="problema-cierre reveal">
            Dos caras del mismo error: <em>pedir a ojo.</em>
            <span className="sub">Y la decisión más difícil sigue siendo la del producto que aún no has lanzado.</span>
          </p>
        </div>
      </section>

      {/* ── cómo funciona ── */}
      <section className="block como" id="como-funciona" data-screen-label="Cómo funciona">
        <div className="wrap">
          <div className="section-head">
            <p className="kicker reveal"><span className="idx">02 //</span> cómo funciona</p>
            <h2 className="reveal">De un CSV de ventas a tu pedido óptimo, <em>en tres pasos.</em></h2>
          </div>
          <div className="steps">
            <span className="flujo-linea" aria-hidden="true"><span className="flujo-pulso"></span></span>
            <div className="step reveal" data-delay="1">
              <div className="step-vignette">
                <div className="file-chip archivo-cae">
                  <svg className="icono-csv" viewBox="0 0 20 24" aria-hidden="true">
                    <path d="M3 1 h9 l5 5 v17 h-14 z" fill="oklch(1 0 0 / 0.06)" stroke="var(--neon-a)" strokeWidth="1.2" strokeLinejoin="round" />
                    <path d="M12 1 v5 h5" fill="none" stroke="var(--neon-a)" strokeWidth="1.2" strokeLinejoin="round" />
                    <path d="M6 13 h8 M6 16.5 h8 M6 20 h5" stroke="oklch(1 0 0 / 0.45)" strokeWidth="1.1" strokeLinecap="round" />
                  </svg>
                  ventas_2025.csv
                </div>
                <div className="col-chips">
                  <span className="col-chip">fecha <b>✓</b></span>
                  <span className="col-chip">referencia <b>✓</b></span>
                  <span className="col-chip">talla <b>✓</b></span>
                  <span className="col-chip">color <b>✓</b></span>
                  <span className="col-chip">unidades <b>✓</b></span>
                </div>
              </div>
              <span className="step-num">PASO_01</span>
              <h3>Sube tu CSV de ventas</h3>
              <p>Sin integraciones ni configuración. Wefty reconoce tus columnas automáticamente.</p>
            </div>
            <div className="step reveal" data-delay="2">
              <div className="step-vignette">
                <svg className="mini-chart" viewBox="0 0 280 120" aria-hidden="true">
                  <line x1="0" y1="100" x2="280" y2="100" stroke="rgba(180,195,215,0.15)" strokeWidth="1"></line>
                  <line className="linea-rotura" x1="168" y1="14" x2="168" y2="100" stroke="var(--neon-b)" strokeWidth="1" strokeDasharray="3 4" opacity="0.6"></line>
                  <polyline className="trazo-demanda" pathLength="100" points="0,86 28,80 56,84 84,68 112,72 140,52 168,60 196,38 224,46 252,28 280,34" fill="none" stroke="var(--neon-a)" strokeWidth="1.5" opacity="0.85"></polyline>
                  <circle className="punto-demanda" cx="168" cy="60" r="4" fill="var(--neon-b)"></circle>
                  <circle className="punto-demanda" cx="252" cy="28" r="4" fill="var(--neon-b)"></circle>
                </svg>
                <p className="chart-caption"><span className="k"><span className="swatch"></span>rotura detectada</span><span className="k">— tendencia</span></p>
              </div>
              <span className="step-num">PASO_02</span>
              <h3>El motor analiza tu histórico</h3>
              <p>Estacionalidad, tendencias, curvas de talla y roturas de stock detectadas. Todo validado contra tus propias ventas.</p>
            </div>
            <div className="step reveal" data-delay="3">
              <div className="step-vignette">
                <table className="mini-table">
                  <thead>
                    <tr><th>Talla</th><th>Uds</th><th>Por qué</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>S</td><td>128</td><td>curva estable</td></tr>
                    <tr><td>M</td><td className="up">204</td><td className="up">rotura en abril</td></tr>
                    <tr><td>L</td><td>156</td><td>tendencia +8%</td></tr>
                  </tbody>
                </table>
              </div>
              <span className="step-num">PASO_03</span>
              <h3>Recibe tu pedido óptimo</h3>
              <p>Por talla y color, con tres escenarios, los riesgos traducidos a euros y la explicación de cada número.</p>
            </div>
          </div>
          <div className="capacidades reveal">
            <div className="capacidad">
              <span className="t">Validación real</span>
              <span className="d">Cada predicción se contrasta con tu propio histórico antes de llegar a ti.</span>
            </div>
            <div className="capacidad">
              <span className="t">Roturas y picos</span>
              <span className="d">Detecta roturas de stock y picos atípicos para no aprender de datos contaminados.</span>
            </div>
            <div className="capacidad">
              <span className="t">Máximo margen</span>
              <span className="d">La recomendación pondera coste, PVP y precio de liquidación: maximiza margen, no unidades.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── modo lanzamiento ── */}
      <section className="block lanzamiento" id="modo-lanzamiento" data-screen-label="Modo lanzamiento">
        <div className="wrap lz-grid">
          <div>
            <p className="kicker reveal"><span className="idx">03 //</span> modo lanzamiento</p>
            <h2 className="reveal">Lo más difícil de predecir: <em>lo que aún no has lanzado.</em></h2>
            <p className="lede reveal" data-delay="1">Un producto nuevo no tiene histórico — y ahí es donde más caro sale adivinar. Wefty localiza sus análogos en la red: productos parecidos, en marcas similares a la tuya.</p>
            <p className="lz-note reveal" data-delay="2">Con cómo se vendieron ellos, construye tu <b>previsión inicial por talla y color</b> — antes de tu primera venta.</p>
          </div>
          <div className="terminal lz-panel reveal" data-delay="1">
            <div className="term-bar">
              <span className="lights"><span></span><span></span><span></span></span>
              <span>wefty://modo-lanzamiento</span>
              <span>SS26</span>
            </div>
            <div className="lz-body" id="lz">
              <div className="lz-new">
                <span className="lz-ref">REF NUEVA-001 · VESTIDO MIDI</span>
                <span className="lz-tag">sin histórico</span>
              </div>
              <p className="lz-status"><span className="lz-status-text">buscando análogos en la red</span><span className="lz-dots"><span>.</span><span>.</span><span>.</span></span></p>
              <div className="lz-analogs">
                <div className="lz-analog" style={{ "--sim": "92%" }}>
                  <span className="lz-a-name">ANÁLOGO_01 · marca anónima #214</span>
                  <span className="lz-a-track"><span className="lz-a-bar"></span></span>
                  <span className="lz-a-pct">92%</span>
                </div>
                <div className="lz-analog" style={{ "--sim": "87%" }}>
                  <span className="lz-a-name">ANÁLOGO_02 · marca anónima #122</span>
                  <span className="lz-a-track"><span className="lz-a-bar"></span></span>
                  <span className="lz-a-pct">87%</span>
                </div>
                <div className="lz-analog" style={{ "--sim": "81%" }}>
                  <span className="lz-a-name">ANÁLOGO_03 · marca anónima #078</span>
                  <span className="lz-a-track"><span className="lz-a-bar"></span></span>
                  <span className="lz-a-pct">81%</span>
                </div>
              </div>
              <div className="lz-result">
                <div className="lz-q" aria-hidden="true">?</div>
                <div className="lz-bars" aria-hidden="true">
                  <div className="lz-col" style={{ "--h": "30%" }}><span className="lz-units">36</span><span className="lz-bar"></span><span className="lz-size">XS</span></div>
                  <div className="lz-col" style={{ "--h": "66%" }}><span className="lz-units">78</span><span className="lz-bar"></span><span className="lz-size">S</span></div>
                  <div className="lz-col" style={{ "--h": "100%" }}><span className="lz-units">118</span><span className="lz-bar"></span><span className="lz-size">M</span></div>
                  <div className="lz-col" style={{ "--h": "71%" }}><span className="lz-units">84</span><span className="lz-bar"></span><span className="lz-size">L</span></div>
                  <div className="lz-col" style={{ "--h": "37%" }}><span className="lz-units">44</span><span className="lz-bar"></span><span className="lz-size">XL</span></div>
                </div>
                <div className="lz-total">
                  <span className="lz-total-label">previsión inicial · escenario esperado</span>
                  <span className="lz-total-n"><span id="lz-n">0</span><small>UDS</small></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── la red ── */}
      <section className="red" id="la-red" data-screen-label="La red">
        <canvas className="red-canvas" aria-hidden="true"></canvas>
        <canvas id="pool-sphere" className="pool-sphere-canvas" aria-hidden="true"></canvas>
        <div className="wrap">
          <div className="red-head">
            <div>
              <p className="kicker reveal"><span className="idx">04 //</span> la red</p>
              <h2 className="red-quote reveal">Tus datos solos valen poco. <em>La inteligencia de cientos de marcas vale mucho.</em></h2>
            </div>
            <div className="pool-wrap reveal" data-delay="1">
              <p className="pool-label">POOL COMPARTIDA<br /><span>ventas anonimizadas de toda la red</span></p>
            </div>
          </div>
          <div className="red-circle">
            <div className="red-step reveal" data-delay="1">
              <span className="n">NODO_01</span>
              <p className="t">Las marcas aportan sus ventas, anonimizadas</p>
              <p className="d">Cada marca de la red comparte su histórico sin nombres, sin precios, sin identidad.</p>
            </div>
            <span className="arrow-cell reveal" data-delay="1">→</span>
            <div className="red-step reveal" data-delay="2">
              <span className="n">NODO_02</span>
              <p className="t">La red aprende los patrones</p>
              <p className="d">Cómo se comporta cada categoría, cada curva de talla, cada temporada — a una escala que ninguna marca alcanza sola.</p>
            </div>
            <span className="arrow-cell reveal" data-delay="2">→</span>
            <div className="red-step reveal" data-delay="3">
              <span className="n">NODO_03</span>
              <p className="t">Cada marca predice lo que nunca ha lanzado</p>
              <p className="d">Un producto nuevo, una categoría nueva: la red ya sabe cómo se vendieron sus análogos.</p>
            </div>
          </div>
          <div className="red-foot reveal">
            <p className="red-claim">Cada marca que entra mejora las predicciones de todas.</p>
            <p className="trust-chip"><b>ANONIMIZADO + AGREGADO</b> · nadie ve los datos de nadie</p>
          </div>
        </div>
      </section>

      {/* ── cierre ── */}
      <section className="cierre" id="empieza" data-screen-label="Cierre">
        <div className="wrap">
          <p className="kicker reveal"><span className="idx">05 //</span> acceso anticipado</p>
          <h2 className="reveal">Deja de adivinar. <em>Empieza hoy.</em></h2>
          <div className="cierre-ctas reveal" data-delay="1">
            <CtaLink className="btn btn-solid">Probar Wefty <span className="arrow">→</span></CtaLink>
            <p className="cierre-note">gratis durante el acceso anticipado · con un simple CSV de ventas</p>
          </div>
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="mega-footer" data-screen-label="Pie">
        <div className="wrap">
          <div className="footer-grid">
            <div className="footer-brand">
              <a className="wordmark" href="#" style={{ fontSize: "19px" }}><span className="mark"></span>Wefty</a>
              <p className="footer-claim">Predicción de stock para marcas de moda que venden online.</p>
              <p className="status-chip"><span className="status-dot"></span>ACCESO ANTICIPADO ABIERTO</p>
            </div>
            <nav className="footer-col" aria-label="Producto">
              <p className="footer-col-title">Producto</p>
              <a href="#problema">El problema</a>
              <a href="#como-funciona">Cómo funciona</a>
              <a href="#modo-lanzamiento">Modo lanzamiento</a>
              <a href="#la-red">La red</a>
              <a href="#empieza">Empieza hoy</a>
            </nav>
            <nav className="footer-col" aria-label="Cuenta">
              <p className="footer-col-title">Cuenta</p>
              <CtaLink>Entrar</CtaLink>
              <CtaLink>Probar Wefty</CtaLink>
            </nav>
            <nav className="footer-col" aria-label="Legal">
              <p className="footer-col-title">Legal</p>
              <a href="#">Privacidad</a>
              <a href="#">Términos</a>
              <a href="mailto:hola@wefty.co">hola@wefty.co</a>
            </nav>
          </div>
          <div className="footer-bottom">
            <p className="tag">© 2026 Wefty · Hecho en España</p>
            <p className="tag">Datos anonimizados y agregados · nadie ve los datos de nadie</p>
          </div>
        </div>
        <div className="footer-giant" aria-hidden="true"><span className="footer-giant-text">Wefty</span></div>
      </footer>
    </div>
  );
}
