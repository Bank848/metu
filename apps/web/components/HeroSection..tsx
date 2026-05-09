"use client";
import React, { useRef, useState } from 'react';
import type { CSSProperties } from "react";
import { LightSweepText } from "@/components/visual/LightSweepText";
import { Store, ArrowDown } from 'lucide-react';

type Stats = { sellers: number; products: number; orders: number; reviews: number };

function mouseLightStyle(x: number, y: number, visible: boolean): CSSProperties {
  return {
    left: x,
    top: y,
    opacity: visible ? 1 : 0,
    background: "radial-gradient(circle at center, rgba(245,200,66,0.10) 0%, rgba(245,200,66,0.05) 25%, rgba(180,120,20,0.03) 50%, transparent 70%)",
  };
}

function mouseDotStyle(x: number, y: number, visible: boolean): CSSProperties {
  return { left: x, top: y, opacity: visible ? 1 : 0, zIndex: 60 };
}

const dotGridStyle: CSSProperties = {
  backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.9) 1px, transparent 0)",
  backgroundSize: "40px 40px",
};

export default function Hero({ stats }: { stats: Stats }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isInside, setIsInside] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsInside(true)}
      onMouseLeave={() => setIsInside(false)}
      className="select-none cursor-none relative overflow-hidden bg-[#050505] min-h-[85vh] flex flex-col justify-center border-b border-white/5"
    >

      <div aria-hidden className="pointer-events-none absolute z-10 size-[700px] rounded-full -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500" style={mouseLightStyle(mousePos.x, mousePos.y, isInside)} />
      <div aria-hidden className="pointer-events-none absolute z-10 size-1.5 rounded-full -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300 shadow-[0_0_12px_4px_rgba(245,200,66,0.25)] bg-[rgba(255,240,160,0.8)]" style={mouseDotStyle(mousePos.x, mousePos.y, isInside)} />
      <div className="absolute inset-0 opacity-[0.15]" style={dotGridStyle} />

      {/* Static gold bloom */}
      <div aria-hidden className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-yellow-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div aria-hidden className="absolute bottom-[-20%] right-[0%] w-[900px] h-[900px] bg-yellow-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 py-20 w-full z-20">
        <div className="grid lg:grid-cols-12 gap-12 items-start">

          {/* LEFT */}
          <div className="lg:col-span-7">
            <h1 className="font-serif text-6xl md:text-8xl text-white leading-[0.9] tracking-tight my-8">
                Digital <br />
                <LightSweepText>Marketplace</LightSweepText>
            </h1>
            
            <p className="text-lg text-neutral-400 max-w-lg mb-6 leading-relaxed">
                A premium marketplace for high-end templates, soundscapes, and digital art.
                Built by Thai visionaries, delivered instantly to your workflow.
            </p>

            {/* GLASS PILL TAGS */}
            <div className="flex flex-wrap gap-3 mb-10">
                {["Profitable", "Fast", "Trustful"].map((text) => (
                    <div 
                        key={text}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md"
                    >
                        {/* The Glow Dot */}
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]"></span>
                        </span>
                        <span className="text-xs font-medium tracking-wide text-neutral-300 uppercase">
                            {text}
                        </span>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-4">
                <button className="px-8 py-4 bg-yellow-500 text-black font-bold rounded-sm hover:bg-yellow-400 transition-all uppercase text-sm tracking-wider">
                    Browse Collection
                </button>
                <button 
                    className="inline-flex items-center justify-center gap-3 px-8 py-4 border border-white/20 text-white font-medium rounded-sm hover:bg-white/5 transition-all text-sm tracking-wider group"
                >
                    <Store className="h-5 w-5 sm:h-6 sm:w-6 text-white transition-transform group-hover:scale-110" />
                    <span>Start Selling</span>
                </button>
            </div>

            <p className="inline-flex items-center justify-center text-md text-neutral-400 max-w-lg my-6 leading-relaxed underline my-5">
               Explore More
               <ArrowDown/>
            </p>
        </div>

          {/* RIGHT */}
        <div className="lg:col-span-5 relative group">
            <div className="relative w-full max-w-[450px] mx-auto perspective-1000">

                {/* LAYER 1: The Glass Frame */}
                <div 
                className="absolute inset-0 border border-white/10 backdrop-blur-sm bg-gradient-to-b from-white/5 to-metu-yellow/15 -rotate-3 transition-transform duration-300 ease-out"
                style={{ transform: `translate3d(${mousePos.x * -0.01}px, ${mousePos.y * -0.01}px, 0)` }}
                />

                {/* LAYER 2: Main Image Card */}
                <div 
                className="relative z-10 aspect-[4/5] bg-gradient-to-b from-neutral-900 to-black bg- border border-white/20 p-3 shadow-2xl transition-transform duration-200 ease-out"
                style={{ transform: `translate3d(${mousePos.x * 0.01}px, ${mousePos.y * 0.01}px, 0) rotate(2deg)` }}
                >
                    {/* DOLLAR SIGN - Moving UP and RIGHT */}
                    <div className="absolute h-[360px] w-[360px] bottom-10 right-[60px] transform -translate-y-18 -translate-x-20 z-5 rotate-12"> 
                        <img
                            src="/HeroSection/DollarSign.png"
                            className="w-full h-full object-contain drop-shadow-2xl" 
                        />
                    </div>

                    {/* WIRE HAND - Pushed much higher */}
                    <div className="absolute h-[620px] w-[620px] -top-40 -right-10 z-4">
                        <img
                            src="/HeroSection/WireHand.png"
                            className="w-full h-full object-contain opacity-80"
                        />
                    </div>

                    {/* Floating Label Layer */}
                    <div 
                        className="absolute bottom-8 right-10 bg-white text-black p-5 shadow-[20px_20px_60px_rgba(0,0,0,0.5)] -rotate-3 transition-transform duration-150"
                        style={{ transform: `translate3d(${mousePos.x * 0.03}px, ${mousePos.y * 0.03}px, 0)` }}
                    >
                        <p className="text-md font-black tracking-tighter mb-1 text-bold">Sell  &  Earn</p>
                        <p className="text-2xl font-serif leading-none text-metu-secondary italic">Join us now!!</p>
                    </div>
                </div>


            </div>
            </div>
        </div>

      </div>
    </section>
  );
}