import React, { useState, useMemo, useCallback } from 'react';
import {
  MissionEngine,
  MissionScenarioType,
  MISSION_SPACECRAFT_PRESETS,
  MissionAnalysisResult,
} from '../../physics/MissionEngine';
import { PlanetaryMotionMode } from '../../physics/PlanetaryEphemeris';
import { Mission3DCanvas } from './viewport/Mission3DCanvas';
import { MissionTimeline } from './controls/MissionTimeline';
import { MissionEncounterTable } from './tables/MissionEncounterTable';
import { MissionDiagnostics } from './diagnostics/MissionDiagnostics';
import {
  Compass,
  Rocket,
  Layers,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  BookOpen,
} from 'lucide-react';

export const MissionWorkspace: React.FC = () => {
  // Authoritative Mission Scenario State
  const [scenarioType, setScenarioType] = useState<MissionScenarioType>('CONCEPTUAL_JUPITER_SATURN');
  const [motionMode, setMotionMode] = useState<PlanetaryMotionMode>('EPHEMERIS');
  const [spacecraftId, setSpacecraftId] = useState<string>('VOYAGER_2');

  // Timeline & Playback State
  const [currentTimeDays, setCurrentTimeDays] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackWarp, setPlaybackWarp] = useState<number>(10);

  // Viewport Settings
  const [selectedEncounterIndex, setSelectedEncounterIndex] = useState<number | null>(null);
  const [selectedPlanetId, setSelectedPlanetId] = useState<string | null>(null);
  const [showOrbits, setShowOrbits] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showVectors, setShowVectors] = useState<boolean>(true);

  // Deterministically compute authoritative mission result
  const missionResult: MissionAnalysisResult = useMemo(() => {
    return MissionEngine.runMissionScenario(scenarioType, motionMode, spacecraftId);
  }, [scenarioType, motionMode, spacecraftId]);

  // Reset playback when scenario or motion mode changes
  const handleScenarioChange = (newType: MissionScenarioType) => {
    setScenarioType(newType);
    setCurrentTimeDays(0);
    setIsPlaying(false);
    setSelectedEncounterIndex(null);
  };

  const handleMotionModeChange = (newMode: PlanetaryMotionMode) => {
    setMotionMode(newMode);
    setCurrentTimeDays(0);
    setIsPlaying(false);
  };

  const handleResetTimeline = useCallback(() => {
    setIsPlaying(false);
    setCurrentTimeDays(0);
  }, []);

  return (
    <section id="mission-mode" className="w-full bg-[#080910] border-t border-[#1e2338] text-white py-8 px-4 sm:px-8 flex flex-col gap-6">
      <div className="max-w-7xl mx-auto w-full flex flex-col gap-6">
        {/* 1. Header Bar: Mission Title, Scenario Switcher & Controls */}
        <div className="flex flex-col gap-3 border-b border-[#20263b] pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xs bg-cyan-500 text-black flex items-center justify-center font-bold">
                <Compass size={20} />
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-cyan-400">
                  ASTRA MISSION WORKSPACE // PHASE 5
                </span>
                <h2 className="font-sans font-black text-xl tracking-tight text-white">
                  INTERPLANETARY MISSION ANALYSIS & EPHEMERIS SUITE
                </h2>
              </div>
            </div>

            {/* Planetary Motion Mode Switcher */}
            <div className="flex items-center gap-2 bg-[#121624] p-1 rounded-xs border border-[#262f48] text-xs font-mono">
              <span className="text-[10px] text-neutral-400 uppercase px-2 font-bold">MOTION MODE:</span>
              <button
                onClick={() => handleMotionModeChange('SIMPLIFIED')}
                className={`px-3 py-1 rounded-xs transition-colors ${
                  motionMode === 'SIMPLIFIED'
                    ? 'bg-amber-500 text-black font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                SIMPLIFIED CIRCULAR
              </button>
              <button
                onClick={() => handleMotionModeChange('EPHEMERIS')}
                className={`px-3 py-1 rounded-xs transition-colors ${
                  motionMode === 'EPHEMERIS'
                    ? 'bg-cyan-500 text-black font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                JPL EPHEMERIS (DE)
              </button>
            </div>
          </div>

          {/* Scenario Tabs & Spacecraft Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleScenarioChange('CONCEPTUAL_JUPITER_SATURN')}
                className={`px-3 py-1.5 rounded-xs border transition-colors flex items-center gap-1.5 ${
                  scenarioType === 'CONCEPTUAL_JUPITER_SATURN'
                    ? 'bg-[#181d2e] border-cyan-400 text-cyan-300 font-bold'
                    : 'bg-[#10131e] border-[#22273a] text-neutral-400 hover:text-white'
                }`}
              >
                <Sparkles size={13} className="text-cyan-400" />
                <span>1. CONCEPTUAL JUPITER-SATURN TRANSFER</span>
              </button>

              <button
                onClick={() => handleScenarioChange('VOYAGER_2_REFERENCE')}
                className={`px-3 py-1.5 rounded-xs border transition-colors flex items-center gap-1.5 ${
                  scenarioType === 'VOYAGER_2_REFERENCE'
                    ? 'bg-[#181d2e] border-amber-400 text-amber-300 font-bold'
                    : 'bg-[#10131e] border-[#22273a] text-neutral-400 hover:text-white'
                }`}
              >
                <ShieldCheck size={13} className="text-amber-400" />
                <span>2. VOYAGER 2 GRAND TOUR (HISTORICAL)</span>
              </button>

              <button
                onClick={() => handleScenarioChange('CASSINI_VVEJGA_REFERENCE')}
                className={`px-3 py-1.5 rounded-xs border transition-colors flex items-center gap-1.5 ${
                  scenarioType === 'CASSINI_VVEJGA_REFERENCE'
                    ? 'bg-[#181d2e] border-purple-400 text-purple-300 font-bold'
                    : 'bg-[#10131e] border-[#22273a] text-neutral-400 hover:text-white'
                }`}
              >
                <Layers size={13} className="text-purple-400" />
                <span>3. CASSINI VVEJGA RESONANT TOUR</span>
              </button>
            </div>

            {/* Spacecraft Selection Dropdown */}
            <div className="flex items-center gap-2">
              <Rocket size={14} className="text-neutral-400" />
              <span className="text-[10px] text-neutral-400 uppercase">PROBE:</span>
              <select
                value={spacecraftId}
                onChange={(e) => setSpacecraftId(e.target.value)}
                className="bg-[#121624] border border-[#252c42] px-2.5 py-1 rounded-xs text-xs text-white outline-none cursor-pointer"
              >
                {Object.values(MISSION_SPACECRAFT_PRESETS).map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name} ({sc.totalMassKg} kg)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 2. Scenario Classification & Physical Disclaimer Banner */}
        <div
          className={`p-3 rounded-xs border text-xs font-mono flex items-start gap-3 ${
            missionResult.isConceptual
              ? 'bg-[#19150d] border-amber-500/40 text-amber-200'
              : 'bg-[#0d161d] border-cyan-500/40 text-cyan-200'
          }`}
        >
          {missionResult.isConceptual ? (
            <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <ShieldCheck size={18} className="text-cyan-400 shrink-0 mt-0.5" />
          )}
          <div className="flex flex-col gap-0.5">
            <span className="font-bold uppercase tracking-wider text-[11px]">
              {missionResult.isConceptual
                ? 'HYPOTHETICAL EDUCATIONAL MISSION SCENARIO'
                : 'REAL MISSION REFERENCE DOSSIER // NASA JPL ARCHIVAL DATA'}
            </span>
            <p className="text-[11px] leading-relaxed opacity-90">{missionResult.conceptualDisclaimer}</p>
          </div>
        </div>

        {/* 3. 3D Heliocentric Solar System Orrery Viewport */}
        <Mission3DCanvas
          mission={missionResult}
          currentTimeDays={currentTimeDays}
          selectedPlanetId={selectedPlanetId}
          onSelectPlanet={setSelectedPlanetId}
          showOrbits={showOrbits}
          showLabels={showLabels}
          showVectors={showVectors}
          heightClass="h-[560px]"
        />

        {/* 4. Interactive Timeline & Mission Playback Deck */}
        <MissionTimeline
          mission={missionResult}
          currentTimeDays={currentTimeDays}
          onTimeChange={setCurrentTimeDays}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((prev) => !prev)}
          playbackWarp={playbackWarp}
          onChangePlaybackWarp={setPlaybackWarp}
          onReset={handleResetTimeline}
        />

        {/* 5. Encounter Sequence Ledger & States Table */}
        <MissionEncounterTable
          mission={missionResult}
          selectedEncounterIndex={selectedEncounterIndex}
          onSelectEncounter={setSelectedEncounterIndex}
        />

        {/* 6. Astrodynamics Diagnostics, Non-Linear ΔV Proof & Data Export */}
        <MissionDiagnostics mission={missionResult} />
      </div>
    </section>
  );
};
