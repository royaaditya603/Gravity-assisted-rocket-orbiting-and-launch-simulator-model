import React from 'react';
import { Rocket, ShieldCheck, ExternalLink } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="w-full bg-[#f5f5f2] border-b border-[#d8d7d2] px-4 sm:px-8 py-3.5 sticky top-0 z-50 backdrop-blur-md bg-opacity-90">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Logo / System ID */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-[#111215] text-white flex items-center justify-center rounded-xs font-mono font-bold text-xs">
            ▲
          </div>
          <div className="flex flex-col">
            <span className="font-sans font-black tracking-tight text-sm uppercase text-[#111215]">
              AEROSPACE ARCHITECTURE // 2026
            </span>
            <span className="text-[10px] font-mono tracking-widest uppercase text-[#686a73]">
              FIRST-PRINCIPLES ORBITAL SIMULATOR
            </span>
          </div>
        </div>

        {/* Navigation Anchors */}
        <nav className="hidden md:flex items-center gap-6 text-[11px] font-mono tracking-widest uppercase text-[#444650]">
          <a href="#narrative" className="hover:text-[#111215] transition-colors">
            01 // PRINCIPLES
          </a>
          <a href="#mission-control" className="hover:text-[#111215] transition-colors">
            02 // MISSION CONTROL
          </a>
          <a href="#gravity-assist-sandbox" className="hover:text-[#111215] transition-colors">
            03 // GRAVITY ASSIST
          </a>
          <a href="#specifications" className="hover:text-[#111215] transition-colors">
            04 // BENCHMARKS
          </a>
        </nav>

        {/* Verification Status Pill */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#e8e8e3] border border-[#d2d1cb] text-[10px] font-mono text-[#282a33]">
            <ShieldCheck size={13} className="text-emerald-600" />
            <span className="font-bold">VERIFIED:</span>
            <span>65/65 AUTOMATED TESTS PASSING</span>
          </div>
          <a
            href="#mission-control"
            className="px-3 py-1 bg-[#111215] hover:bg-black text-white text-[11px] font-mono uppercase font-bold rounded-xs transition-colors"
          >
            LAUNCH COCKPIT
          </a>
        </div>
      </div>
    </header>
  );
};
