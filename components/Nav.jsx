'use client';

import React from 'react';
import { EASE } from './hooks';
import { UnderlineLink, MagneticButton, Hairline } from './primitives';

export default function Nav() {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        backdropFilter: scrolled ? 'saturate(140%) blur(14px)' : 'none',
        background: scrolled ? 'rgba(250,250,247,0.78)' : 'transparent',
        transition: 'background 400ms ' + EASE + ', backdrop-filter 400ms ' + EASE,
      }}
    >
      <div className="max-w-[1440px] mx-auto px-8 md:px-12 h-16 flex items-center justify-between">
        <a href="#" className="flex items-baseline gap-2">
          <span className="font-serif text-[22px] tracking-[-0.03em] leading-none">Wefty</span>
          <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-ash-400 mt-px">/ DTC data co-op</span>
        </a>
        <nav className="hidden md:flex items-center gap-9 font-mono text-[11px] tracking-[0.18em] uppercase">
          <UnderlineLink href="#how">How it works</UnderlineLink>
          <UnderlineLink href="#network">Network</UnderlineLink>
          <UnderlineLink href="#product">Product</UnderlineLink>
          <UnderlineLink href="#pricing">Pricing</UnderlineLink>
        </nav>
        <div className="flex items-center gap-5">
          <a href="/login" className="hidden md:inline-block font-mono text-[11px] tracking-[0.18em] uppercase ul-anim">Iniciar sesión</a>
          <MagneticButton as="a" href="#join" className="h-10 px-5 text-[13px]">Join the pool</MagneticButton>
        </div>
      </div>
      <Hairline />
    </header>
  );
}
