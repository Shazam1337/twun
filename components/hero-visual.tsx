"use client";

import { useEffect, useRef } from "react";

/** A deliberately raster canvas layer: it adds grain and an 8-bit dither treatment behind CSS-composed tokens. */
// Pass imageSrc to replace the entire temporary composition with a cover image.
export function HeroVisual({ imageSrc, imageAlt = "Two stock ratio forms" }: { imageSrc?: string; imageAlt?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const draw = () => {
      const ratio = Math.min(window.devicePixelRatio, 2);
      const { width, height } = element.getBoundingClientRect();
      element.width = width * ratio; element.height = height * ratio;
      const ctx = element.getContext("2d"); if (!ctx) return;
      ctx.scale(ratio, ratio); ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < width * height / 38; i++) {
        const alpha = Math.random() * .09;
        ctx.fillStyle = `rgba(44,41,39,${alpha})`;
        ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
      }
      ctx.strokeStyle = "rgba(44,41,39,.16)"; ctx.lineWidth = 1;
      for (let x = 18; x < width; x += 14) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    };
    draw(); window.addEventListener("resize", draw); return () => window.removeEventListener("resize", draw);
  }, [imageSrc]);
  return <div className="relative h-[430px] overflow-hidden bg-[var(--taupe)] sm:h-[480px]">
    {imageSrc ? <img src={imageSrc} alt={imageAlt} className="absolute inset-0 h-full w-full object-cover"/> : <>
    <canvas ref={canvas} className="absolute inset-0 h-full w-full opacity-80" aria-hidden="true" />
    <div className="absolute left-[8%] top-[13%] h-[235px] w-[235px] sm:h-[315px] sm:w-[315px]"><div className="hero-orb hero-orb-a orbital h-full w-full"><span className="glyph">NV</span></div></div>
    <div className="absolute bottom-[8%] right-[5%] h-[195px] w-[195px] sm:h-[275px] sm:w-[275px]"><div className="hero-orb hero-orb-b orbital-late h-full w-full"><span className="glyph">TS</span></div></div>
    <p className="absolute bottom-5 left-5 mono text-[11px] font-medium text-[#49423c]">NVDA / TSLA · PERPETUAL</p>
    </>}
  </div>;
}
