import React, { useState, useEffect, useCallback } from 'react';
import { Header, WorkspaceMode } from './components/layout/Header';
import { FlybySandbox } from './components/gravity-assist/FlybySandbox';
import { MissionControl } from './components/simulator/MissionControl';
import { MissionWorkspace } from './components/mission/MissionWorkspace';
import { PrinciplesDrawer } from './components/layout/PrinciplesDrawer';
import { VerificationModal } from './components/layout/VerificationModal';
import { SettingsModal } from './components/layout/SettingsModal';
import { Footer } from './components/layout/Footer';
import { GraphicsQuality } from './components/gravity-assist/viewport/Flyby3DCanvas';

export const App: React.FC = () => {
  // Authoritative Application Navigation State
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceMode>('GRAVITY_ASSIST');

  // Modals & Drawers
  const [isPrinciplesOpen, setIsPrinciplesOpen] = useState<boolean>(false);
  const [isVerificationOpen, setIsVerificationOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Client-Side Hardware & Rendering Preferences
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>('HIGH');
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [spacecraftModel, setSpacecraftModel] = useState<'PROBE' | 'ROCKET'>('PROBE');

  // Detect OS prefers-reduced-motion preference on initial mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) {
        setReducedMotion(true);
      }
    }
  }, []);

  // Global Keyboard Shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsPrinciplesOpen(false);
        setIsVerificationOpen(false);
        setIsSettingsOpen(false);
      } else if (e.altKey || e.metaKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveWorkspace('GRAVITY_ASSIST');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveWorkspace('ORBITAL_ASCENT');
        } else if (e.key === '3') {
          e.preventDefault();
          setActiveWorkspace('INTERPLANETARY');
        } else if (e.key === '4') {
          e.preventDefault();
          setActiveWorkspace('ANALYSIS_LAB');
        }
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-[#263247] flex flex-col font-sans antialiased selection:bg-[#A9D4F5] selection:text-[#1E5F8A]">
      {/* 1. Aerospace Mission Control Header */}
      <Header
        activeWorkspace={activeWorkspace}
        onChangeWorkspace={setActiveWorkspace}
        onOpenPrinciples={() => setIsPrinciplesOpen(true)}
        onOpenVerification={() => setIsVerificationOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        simStatus="NOMINAL // DOPRI5 / RK4 CONVERGED"
      />

      {/* 2. Main Active Mission Workspace */}
      <main className="flex-1 w-full flex flex-col">
        {activeWorkspace === 'GRAVITY_ASSIST' && (
          <FlybySandbox
            initialView="SIMULATION"
            graphicsQuality={graphicsQuality}
            reducedMotion={reducedMotion}
            spacecraftModel={spacecraftModel}
            onChangeSpacecraftModel={setSpacecraftModel}
          />
        )}

        {activeWorkspace === 'ORBITAL_ASCENT' && (
          <div className="w-full relative">
            <div className="bg-white text-[#263247] px-4 sm:px-8 py-3 border-b border-[#DCE3EE] flex flex-wrap items-center justify-between gap-4 font-mono text-xs shadow-xs">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-[#AEE5D0] border border-[#2D8A68] animate-pulse" />
                <span className="font-bold uppercase tracking-wider text-[#263247]">
                  ORBITAL ASCENT COCKPIT // MULTI-STAGE PROPULSION & LEO INSERTION
                </span>
              </div>
              <div className="text-[11px] text-[#68758A]">
                DRAG MOUSE TO ORBIT CAMERA • SCROLL TO ZOOM • 10 UNITS = R_EARTH
              </div>
            </div>
            <MissionControl
              onProceedToInterplanetary={() => setActiveWorkspace('INTERPLANETARY')}
            />
          </div>
        )}

        {activeWorkspace === 'INTERPLANETARY' && (
          <MissionWorkspace />
        )}

        {activeWorkspace === 'ANALYSIS_LAB' && (
          <FlybySandbox
            initialView="ANALYSIS"
            graphicsQuality={graphicsQuality}
            reducedMotion={reducedMotion}
            spacecraftModel={spacecraftModel}
            onChangeSpacecraftModel={setSpacecraftModel}
          />
        )}
      </main>

      {/* 3. Global Drawers & Modals */}
      <PrinciplesDrawer
        isOpen={isPrinciplesOpen}
        onClose={() => setIsPrinciplesOpen(false)}
      />

      <VerificationModal
        isOpen={isVerificationOpen}
        onClose={() => setIsVerificationOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        graphicsQuality={graphicsQuality}
        onChangeGraphicsQuality={setGraphicsQuality}
        reducedMotion={reducedMotion}
        onToggleReducedMotion={() => setReducedMotion((prev) => !prev)}
        spacecraftModel={spacecraftModel}
        onChangeSpacecraftModel={setSpacecraftModel}
      />

      {/* 4. Astrodynamic Specifications & Invariants Ledger */}
      <Footer />
    </div>
  );
};

export default App;
