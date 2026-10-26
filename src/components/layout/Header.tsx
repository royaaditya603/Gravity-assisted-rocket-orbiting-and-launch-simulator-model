import React from 'react';
import {
  Orbit,
  Rocket,
  Compass,
  LineChart,
  BookOpen,
  ShieldCheck,
  Settings,
} from 'lucide-react';

export type WorkspaceMode = 'GRAVITY_ASSIST' | 'ORBITAL_ASCENT' | 'INTERPLANETARY' | 'ANALYSIS_LAB';

export interface HeaderProps {
  activeWorkspace?: WorkspaceMode;
  onChangeWorkspace?: (ws: WorkspaceMode) => void;
  onOpenPrinciples?: () => void;
  onOpenVerification?: () => void;
  onOpenSettings?: () => void;
  simStatus?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeWorkspace = 'GRAVITY_ASSIST',
  onChangeWorkspace,
  onOpenPrinciples,
  onOpenVerification,
  onOpenSettings,
  simStatus = 'NOMINAL // DOPRI5 & RK4 CONVERGED',
}) => {
  return (
    <header className="w-full bg-white/95 border-b border-[#DCE3EE] px-3 sm:px-6 py-2.5 sticky top-0 z-40 backdrop-blur-md select-none shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand Identity / System Callout */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-gradient-to-br from-[#A9D4F5] to-[#7BB6E8] text-[#1D4F7A] flex items-center justify-center rounded-lg font-mono font-black text-xs shadow-xs border border-[#89C3EE]">
            ▲
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-sans font-black tracking-tight text-sm uppercase text-[#263247]">
                ASTRA
              </span>
              <span className="text-[10px] font-mono text-[#1E5F8A] font-bold px-1.5 py-0.2 bg-[#EEF2F8] border border-[#CAD5E4] rounded-md">
                V2.1
              </span>
            </div>
            <span className="text-[9px] font-mono tracking-widest uppercase text-[#68758A]">
              ORBITAL & LAUNCH FLIGHT SIMULATOR
            </span>
          </div>
        </div>

        {/* Workspace Switcher Tabs (Soft pastel surface) */}
        <nav className="flex items-center gap-1 sm:gap-1.5 text-[11px] font-mono tracking-wider uppercase bg-[#EEF2F8] p-1 border border-[#DCE3EE] rounded-xl shadow-xs">
          <button
            onClick={() => onChangeWorkspace?.('GRAVITY_ASSIST')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeWorkspace === 'GRAVITY_ASSIST'
                ? 'bg-white text-[#1D4F7A] font-bold border border-[#A9D4F5] shadow-xs'
                : 'text-[#68758A] hover:text-[#263247] hover:bg-white/60'
            }`}
          >
            <Orbit size={13} className="text-[#3882B6]" />
            <span>GRAVITY ASSIST</span>
          </button>

          <button
            onClick={() => onChangeWorkspace?.('ORBITAL_ASCENT')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeWorkspace === 'ORBITAL_ASCENT'
                ? 'bg-white text-[#8C3A0F] font-bold border border-[#FFD2B8] shadow-xs'
                : 'text-[#68758A] hover:text-[#263247] hover:bg-white/60'
            }`}
          >
            <Rocket size={13} className="text-[#B86230]" />
            <span className="hidden sm:inline">ORBITAL</span> ASCENT
          </button>

          <button
            onClick={() => onChangeWorkspace?.('INTERPLANETARY')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeWorkspace === 'INTERPLANETARY'
                ? 'bg-white text-[#5B478F] font-bold border border-[#C9BDF2] shadow-xs'
                : 'text-[#68758A] hover:text-[#263247] hover:bg-white/60'
            }`}
          >
            <Compass size={13} className="text-[#6D5AA6]" />
            <span className="hidden md:inline">INTERPLANETARY</span>
            <span className="md:hidden">MISSIONS</span>
          </button>

          <button
            onClick={() => onChangeWorkspace?.('ANALYSIS_LAB')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeWorkspace === 'ANALYSIS_LAB'
                ? 'bg-white text-[#1D6C50] font-bold border border-[#AEE5D0] shadow-xs'
                : 'text-[#68758A] hover:text-[#263247] hover:bg-white/60'
            }`}
          >
            <LineChart size={13} className="text-[#2D8A68]" />
            <span>ANALYSIS</span>
          </button>
        </nav>

        {/* Global Actions & Status Strip */}
        <div className="flex items-center gap-2">
          {/* Verification Ledger Pill */}
          <button
            onClick={onOpenVerification}
            title="Inspect 296 Automated Tests & Analytical Benchmarks"
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-[#EEF2F8] border border-[#DCE3EE] text-[10px] font-mono text-[#263247] transition-colors cursor-pointer shadow-xs"
          >
            <ShieldCheck size={13} className="text-[#2D8A68]" />
            <span className="font-bold text-[#263247]">296/296</span>
            <span className="text-[#68758A]">VERIFIED</span>
          </button>

          {/* Principles Dossier Drawer Button */}
          <button
            onClick={onOpenPrinciples}
            title="Open Astrodynamics Mathematical Principles Dossier"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#EEF2F8] border border-[#DCE3EE] text-[#263247] text-[11px] font-mono rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <BookOpen size={13} className="text-[#3882B6]" />
            <span className="hidden sm:inline">PRINCIPLES</span>
          </button>

          {/* Settings Modal Button */}
          <button
            onClick={onOpenSettings}
            title="Display, Hardware & Control Settings"
            className="p-2 bg-white hover:bg-[#EEF2F8] border border-[#DCE3EE] text-[#68758A] hover:text-[#263247] rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>
    </header>
  );
};
