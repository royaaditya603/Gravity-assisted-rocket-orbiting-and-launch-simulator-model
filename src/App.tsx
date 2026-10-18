import React from 'react';
import { Header } from './components/layout/Header';
import { HeroSection } from './components/hero/HeroSection';
import { NarrativeSection } from './components/narrative/NarrativeSection';
import { MissionControl } from './components/simulator/MissionControl';
import { FlybySandbox } from './components/gravity-assist/FlybySandbox';
import { Footer } from './components/layout/Footer';

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f5f5f2] text-[#111215] flex flex-col font-sans antialiased selection:bg-[#111215] selection:text-white">
      {/* 1. Aerospace Header */}
      <Header />

      {/* 2. Hero Section: Opening Sequence */}
      <HeroSection />

      {/* 3. Mission Control 3D Simulator (The Core Interactive Experience) */}
      <div className="w-full relative">
        <div className="bg-[#111215] text-white px-4 sm:px-8 py-4 border-t border-[#222530] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-neutral-200">
              MISSION CONTROL // ORBITAL SIMULATOR COCKPIT
            </span>
          </div>
          <div className="text-[11px] font-mono text-neutral-400">
            DRAG MOUSE TO ORBIT CAMERA • SCROLL TO ZOOM • SELECT CAMERA VIEWS BELOW
          </div>
        </div>
        <MissionControl />
      </div>

      {/* 4. The Physics Narrative: 5 Editorial Chapters */}
      <NarrativeSection />

      {/* 5. Dedicated Gravity Assist Sandbox */}
      <FlybySandbox />

      {/* 6. Footer: Technical Specifications & Verification Ledger */}
      <Footer />
    </div>
  );
};

export default App;
