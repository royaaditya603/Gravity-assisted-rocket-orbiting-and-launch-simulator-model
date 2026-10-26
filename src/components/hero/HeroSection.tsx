import React from 'react';
import { ArrowDownRight, Compass, Gauge, Play } from 'lucide-react';

export const HeroSection: React.FC = () => {
  return (
    <section className="w-full bg-[#F5F7FB] border-b border-[#DCE3EE] pt-14 pb-16 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-12">
        {/* Top Metadata Ticker */}
        <div className="flex flex-wrap items-center justify-between border-b border-[#DCE3EE] pb-3 text-[11px] font-mono tracking-widest uppercase text-[#68758A]">
          <div>SYS.ID // ORBITAL-PHYSICS-2026</div>
          <div className="hidden sm:inline">EARTH RADIUS: 6,371.0 KM // MU: 3.986E14 M³/S²</div>
          <div className="text-[#059669] font-bold">STATUS // FLIGHT-READY</div>
        </div>

        {/* Hero Title Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <h1 className="text-5xl sm:text-7xl lg:text-9xl font-sans font-black tracking-[-0.04em] uppercase text-[#263247] leading-[0.88]">
              FROM LAUNCH<br />TO ORBIT.
            </h1>
            <p className="text-base sm:text-xl text-[#475569] max-w-2xl font-normal leading-relaxed pt-3">
              A first-principles orbital mechanics and launch simulation governed by variable-mass momentum conservation,
              barometric atmospheric drag, and Hamiltonian celestial mechanics.
            </p>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-4 border-l-0 lg:border-l border-[#DCE3EE] lg:pl-8">
            <div className="text-[11px] font-mono text-[#68758A] uppercase tracking-wider font-bold">
              [ DIRECT ACTION ]
            </div>
            <a
              href="#mission-control"
              className="group inline-flex items-center justify-between p-4 bg-[#263247] hover:bg-[#1a233a] text-white font-mono uppercase text-xs font-bold transition-all shadow-md rounded-xl"
            >
              <div className="flex items-center gap-2">
                <Play size={14} className="fill-white" />
                <span>ENTER MISSION CONTROL</span>
              </div>
              <ArrowDownRight size={18} className="transform group-hover:translate-x-1 group-hover:translate-y-1 transition-transform" />
            </a>

            <div className="grid grid-cols-2 gap-3 pt-2 text-[10px] font-mono text-[#68758A]">
              <div className="border border-[#DCE3EE] p-2.5 bg-white rounded-lg shadow-xs">
                <div className="text-[#68758A]">INTEGRATOR</div>
                <div className="text-[#263247] font-bold text-xs pt-0.5">HYBRID RK4 / VERLET</div>
              </div>
              <div className="border border-[#DCE3EE] p-2.5 bg-white rounded-lg shadow-xs">
                <div className="text-[#68758A]">COLLISION MODEL</div>
                <div className="text-[#263247] font-bold text-xs pt-0.5">EXACT QUADRATIC ROOT</div>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Highlights Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-[#DCE3EE] pt-6 text-xs font-mono">
          <div className="p-3 bg-white border border-[#DCE3EE] rounded-xl shadow-xs">
            <div className="text-[10px] text-[#68758A] uppercase">CIRCULAR ORBIT SPEED (400KM)</div>
            <div className="font-bold text-[#263247] text-sm pt-1">7,672.60 m/s</div>
            <div className="text-[10px] text-[#68758A]">Period: 92.41 min</div>
          </div>
          <div className="p-3 bg-white border border-[#DCE3EE] rounded-xl shadow-xs">
            <div className="text-[10px] text-[#68758A] uppercase">EARTH ESCAPE SPEED (SURFACE)</div>
            <div className="font-bold text-[#263247] text-sm pt-1">11,186.13 m/s</div>
            <div className="text-[10px] text-[#68758A]">Parabolic ε = 0</div>
          </div>
          <div className="p-3 bg-white border border-[#DCE3EE] rounded-xl shadow-xs">
            <div className="text-[10px] text-[#68758A] uppercase">ATMOSPHERIC CUTOFF</div>
            <div className="font-bold text-[#263247] text-sm pt-1">100.0 km</div>
            <div className="text-[10px] text-[#68758A]">Kármán Line Boundary</div>
          </div>
          <div className="p-3 bg-white border border-[#DCE3EE] rounded-xl shadow-xs">
            <div className="text-[10px] text-[#68758A] uppercase">GEOSTATIONARY RADIUS</div>
            <div className="font-bold text-[#263247] text-sm pt-1">42,164.17 km</div>
            <div className="text-[10px] text-[#68758A]">Period: 1 Sidereal Day</div>
          </div>
        </div>
      </div>
    </section>
  );
};
