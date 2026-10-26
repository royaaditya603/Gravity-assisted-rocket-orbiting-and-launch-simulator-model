import React from 'react';
import {
  Orbit,
  Rocket,
  Compass,
  LineChart,
  BookOpen,
  ShieldCheck,
  Settings,
  Cpu,
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
    <header className="w-full bg-[#070a12]/95 border-b border-[#182033] px-3 sm:px-6 py-2.5 sticky top-0 z-40 backdrop-blur-md select-none">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand Identity / System Callout */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-gradient-to-br from-sky-400 to-blue-600 text-black flex items-center justify-center rounded-xs font-mono font-black text-xs shadow-sm">
            ▲
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-sans font-black tracking-tight text-sm uppercase text-white">
                ASTRA
              </span>
              <span className="text-[10px] font-mono text-cyan-400 font-bold px-1.5 py-0.2 bg-cyan-950/60 border border-cyan-500/30 rounded-xs">
                V2.0
              </span>
            </div>
            <span className="text-[9px] font-mono tracking-widest uppercase text-neutral-400">
              ORBITAL & LAUNCH FLIGHT SIMULATOR
            </span>
          </div>
        </div>

        {/* Workspace Switcher Tabs */}
        <nav className="flex items-center gap-1 sm:gap-1.5 text-[11px] font-mono tracking-wider uppercase bg-[#0b0f1a] p-1 border border-[#1b253b] rounded-xs">
          <button
            onClick={() => onChangeWorkspace?.('GRAVITY_ASSIST')}
            className={`px-2.5 py-1 rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeWorkspace === 'GRAVITY_ASSIST'
                ? 'bg-[#18233c] text-sky-300 font-bold border border-sky-500/40'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#101626]'
            }`}
          >
            <Orbit size={13} className="text-sky-400" />
            <span>GRAVITY ASSIST</span>
          </button>

          <button
            onClick={() => onChangeWorkspace?.('ORBITAL_ASCENT')}
            className={`px-2.5 py-1 rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeWorkspace === 'ORBITAL_ASCENT'
                ? 'bg-[#18233c] text-sky-300 font-bold border border-sky-500/40'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#101626]'
            }`}
          >
            <Rocket size={13} className="text-amber-400" />
            <span className="hidden sm:inline">ORBITAL</span> ASCENT
          </button>

          <button
            onClick={() => onChangeWorkspace?.('INTERPLANETARY')}
            className={`px-2.5 py-1 rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeWorkspace === 'INTERPLANETARY'
                ? 'bg-[#18233c] text-sky-300 font-bold border border-sky-500/40'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#101626]'
            }`}
          >
            <Compass size={13} className="text-purple-400" />
            <span className="hidden md:inline">INTERPLANETARY</span>
            <span className="md:hidden">MISSIONS</span>
          </button>

          <button
            onClick={() => onChangeWorkspace?.('ANALYSIS_LAB')}
            className={`px-2.5 py-1 rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeWorkspace === 'ANALYSIS_LAB'
                ? 'bg-[#18233c] text-sky-300 font-bold border border-sky-500/40'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#101626]'
            }`}
          >
            <LineChart size={13} className="text-emerald-400" />
            <span>ANALYSIS</span>
          </button>
        </nav>

        {/* Global Actions & Status Strip */}
        <div className="flex items-center gap-2">
          {/* Verification Ledger Pill */}
          <button
            onClick={onOpenVerification}
            title="Inspect 271 Automated Tests & Analytical Benchmarks"
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#0b0f1a] hover:bg-[#12192b] border border-[#1b253b] text-[10px] font-mono text-neutral-300 transition-colors cursor-pointer"
          >
            <ShieldCheck size={13} className="text-emerald-400" />
            <span className="font-bold text-white">271/271</span>
            <span className="text-neutral-400">VERIFIED</span>
          </button>

          {/* Principles Dossier Drawer Button */}
          <button
            onClick={onOpenPrinciples}
            title="Open Astrodynamics Mathematical Principles Dossier"
            className="flex items-center gap-1 px-2.5 py-1 bg-[#0b0f1a] hover:bg-[#12192b] border border-[#1b253b] text-neutral-300 hover:text-white text-[11px] font-mono rounded-xs transition-colors cursor-pointer"
          >
            <BookOpen size={13} className="text-sky-400" />
            <span className="hidden sm:inline">PRINCIPLES</span>
          </button>

          {/* Settings Modal Button */}
          <button
            onClick={onOpenSettings}
            title="Display, Hardware & Control Settings"
            className="p-1.5 bg-[#0b0f1a] hover:bg-[#12192b] border border-[#1b253b] text-neutral-300 hover:text-white rounded-xs transition-colors cursor-pointer"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>
    </header>
  );
};
