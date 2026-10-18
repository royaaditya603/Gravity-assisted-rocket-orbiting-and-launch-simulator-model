import React from 'react';
import { ArrowDownRight, Compass, Gauge, Play } from 'lucide-react';

export const HeroSection: React.FC = () => {
  return (
    <section className="w-full bg-[#f5f5f2] border-b border-[#d8d7d2] pt-14 pb-16 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-12">
        {/* Top Metadata Ticker */}
        <div className="flex flex-wrap items-center justify-between border-b border-[#d8d7d2] pb-3 text-[11px] font-mono tracking-widest uppercase text-[#686a73]">
          <div>SYS.ID // ORBITAL-PHYSICS-2026</div>
          <div className="hidden sm:inline">EARTH RADIUS: 6,371.0 KM // MU: 3.986E14 M³/S²</div>
          <div>STATUS // FLIGHT-READY</div>
        </div>

        {/* Hero Title Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <h1 className="text-5xl sm:text-7xl lg:text-9xl font-sans font-black tracking-[-0.04em] uppercase text-[#111215] leading-[0.88]">
              FROM LAUNCH<br />TO ORBIT.
            </h1>
            <p className="text-base sm:text-xl text-[#444650] max-w-2xl font-normal leading-relaxed pt-3">
              A first-principles orbital mechanics and launch simulation governed by variable-mass momentum conservation,
              barometric atmospheric drag, and Hamiltonian celestial mechanics.
            </p>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-4 border-l-0 lg:border-l border-[#d8d7d2] lg:pl-8">
            <div className="text-[11px] font-mono text-[#686a73] uppercase tracking-wider">
              [ DIRECT ACTION ]
            </div>
            <a
              href="#mission-control"
              className="group inline-flex items-center justify-between p-4 bg-[#111215] hover:bg-black text-white font-mono uppercase text-xs font-bold transition-all shadow-md"
            >
              <div className="flex items-center gap-2">
                <Play size={14} className="fill-white" />
                <span>ENTER MISSION CONTROL</span>
              </div>
              <ArrowDownRight size={18} className="transform group-hover:translate-x-1 group-hover:translate-y-1 transition-transform" />
            </a>

            <div className="grid grid-cols-2 gap-3 pt-2 text-[10px] font-mono text-[#555866]">
              <div className="border border-[#d8d7d2] p-2.5 bg-[#ebebe6]">
                <div className="text-[#888b99]">INTEGRATOR</div>
                <div className="text-[#111215] font-bold text-xs pt-0.5">HYBRID RK4 / VERLET</div>
              </div>
              <div className="border border-[#d8d7d2] p-2.5 bg-[#ebebe6]">
                <div className="text-[#888b99]">COLLISION MODEL</div>
                <div className="text-[#111215] font-bold text-xs pt-0.5">EXACT QUADRATIC ROOT</div>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Highlights Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-[#d8d7d2] pt-6 text-xs font-mono">
          <div>
            <div className="text-[10px] text-[#686a73] uppercase">CIRCULAR ORBIT SPEED (400KM)</div>
            <div className="font-bold text-[#111215] text-sm pt-1">7,672.60 m/s</div>
            <div className="text-[10px] text-[#888b99]">Period: 92.41 min</div>
          </div>
          <div>
            <div className="text-[10px] text-[#686a73] uppercase">EARTH ESCAPE SPEED (SURFACE)</div>
            <div className="font-bold text-[#111215] text-sm pt-1">11,186.13 m/s</div>
            <div className="text-[10px] text-[#888b99]">Parabolic ε = 0</div>
          </div>
          <div>
            <div className="text-[10px] text-[#686a73] uppercase">ATMOSPHERIC CUTOFF</div>
            <div className="font-bold text-[#111215] text-sm pt-1">100.0 km</div>
            <div className="text-[10px] text-[#888b99]">Kármán Line Boundary</div>
          </div>
          <div>
            <div className="text-[10px] text-[#686a73] uppercase">GEOSTATIONARY RADIUS</div>
            <div className="font-bold text-[#111215] text-sm pt-1">42,164.17 km</div>
            <div className="text-[10px] text-[#888b99]">Period: 1 Sidereal Day</div>
          </div>
        </div>
      </div>
    </section>
  );
};
