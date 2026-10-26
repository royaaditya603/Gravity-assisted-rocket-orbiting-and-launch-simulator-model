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
  ArrowLeft,
  Calendar,
  Flame,
  CheckCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';

export type MissionPhaseId = 'PHASE_A' | 'PHASE_B' | 'PHASE_C' | 'PHASE_D' | 'PHASE_E';

export interface CourseCorrectionManeuver {
  id: string;
  name: string;
  epochUTC: string;
  metDays: number;
  deltaVMPerS: number;
  objective: string;
  notes: string;
}

export const VOYAGER_2_TCMS: CourseCorrectionManeuver[] = [
  {
    id: 'TCM-1',
    name: 'TCM-1 Post-Injection Correction',
    epochUTC: '1977-08-25',
    metDays: 5.0,
    deltaVMPerS: 14.2,
    objective: 'Cancel Titan IIIE-Centaur launch vehicle injection dispersions',
    notes: 'Hydrazine thruster burn aligning trajectory toward Jupiter B-plane aimpoint.',
  },
  {
    id: 'TCM-B',
    name: 'TCM-B Jupiter Targeting',
    epochUTC: '1979-02-14',
    metDays: 543.0,
    deltaVMPerS: 16.3,
    objective: 'Precise periapsis targeting for Jupiter closest approach (570,000 km)',
    notes: 'Established optimal gravity-assist deflection toward Saturn.',
  },
  {
    id: 'TCM-C',
    name: 'TCM-C Saturn Targeting & Ring Crossing',
    epochUTC: '1980-11-15',
    metDays: 1183.0,
    deltaVMPerS: 2.1,
    objective: 'Post-Jupiter trajectory cleanup and Saturn ring-plane passage targeting',
    notes: 'Ensured safe passage through G-ring gap while preserving Uranus flyby geometry.',
  },
  {
    id: 'TCM-D',
    name: 'TCM-D Uranus Targeting',
    epochUTC: '1985-05-19',
    metDays: 2829.0,
    deltaVMPerS: 8.4,
    objective: 'Fine-tune Uranus encounter geometry (81,500 km periapsis)',
    notes: 'Compensated for small unmodeled RTG thermal radiation thrust over 4-year cruise.',
  },
  {
    id: 'TCM-E',
    name: 'TCM-E Neptune Polar Flyby & Triton Alignment',
    epochUTC: '1989-03-10',
    metDays: 4220.0,
    deltaVMPerS: 11.8,
    objective: 'Aim for close polar pass (4,950 km) and close Triton flyby',
    notes: 'Bent flight path 48° south of ecliptic plane into the interstellar medium.',
  },
];

interface MissionWorkspaceProps {
  onNavigateToAscent?: () => void;
}

export const MissionWorkspace: React.FC<MissionWorkspaceProps> = ({ onNavigateToAscent }) => {
  // Authoritative Mission Scenario State
  const [scenarioType, setScenarioType] = useState<MissionScenarioType>('VOYAGER_2_REFERENCE');
  const [motionMode, setMotionMode] = useState<PlanetaryMotionMode>('EPHEMERIS');
  const [spacecraftId, setSpacecraftId] = useState<string>('VOYAGER_2');
  const [activePhase, setActivePhase] = useState<MissionPhaseId>('PHASE_C');

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

  const handleSeekDays = (days: number) => {
    setCurrentTimeDays(days);
  };

  // Connected Phases metadata
  const phases = [
    {
      id: 'PHASE_A',
      name: 'PHASE A: LAUNCH & POWERED ASCENT',
      desc: 'Cape Canaveral liftoff, booster burn, gravity turn, and multi-stage separation.',
      action: onNavigateToAscent,
      isExternal: true,
    },
    {
      id: 'PHASE_B',
      name: 'PHASE B: ORBITAL INSERTION & DEPARTURE',
      desc: 'LEO parking orbit stabilization and Trans-Planetary Injection (TPI) burn.',
      seekDay: 0,
    },
    {
      id: 'PHASE_C',
      name: 'PHASE C: INTERPLANETARY CRUISE',
      desc: 'Heliocentric transfer propagation with Trajectory Correction Maneuvers (TCMs).',
      seekDay: 200,
    },
    {
      id: 'PHASE_D',
      name: 'PHASE D: GRAVITY-ASSIST ENCOUNTERS',
      desc: 'Sequential outer gas-giant flybys (Jupiter, Saturn, Uranus, Neptune).',
      seekDay: 688,
    },
    {
      id: 'PHASE_E',
      name: 'PHASE E: REVIEW & VERIFICATION',
      desc: 'Patched-conic model vs NASA JPL DE archival ephemeris & historical validation.',
      seekDay: 4388,
    },
  ];

  return (
    <section id="mission-mode" className="w-full bg-[#080910] border-t border-[#1e2338] text-white py-6 px-4 sm:px-8 flex flex-col gap-6">
      <div className="max-w-7xl mx-auto w-full flex flex-col gap-6">
        
        {/* 1. Header Bar: Navigation back to Ascent, Mission Title & Controls */}
        <div className="flex flex-col gap-3 border-b border-[#20263b] pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {onNavigateToAscent && (
                <button
                  onClick={onNavigateToAscent}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#141826] hover:bg-[#20273d] text-cyan-400 border border-[#27304a] rounded-xs font-mono text-xs transition-colors"
                >
                  <ArrowLeft size={13} />
                  <span>ASCENT COCKPIT</span>
                </button>
              )}
              <div className="w-8 h-8 rounded-xs bg-cyan-500 text-black flex items-center justify-center font-bold">
                <Compass size={20} />
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-cyan-400">
                  CONNECTED MISSION MODE // SOLAR SYSTEM FLYBY ENGINE
                </span>
                <h2 className="font-sans font-black text-xl tracking-tight text-white">
                  INTERPLANETARY MISSION SUITE & VOYAGER 2 REPLAY
                </h2>
              </div>
            </div>

            {/* Planetary Motion Mode Switcher */}
            <div className="flex items-center gap-2 bg-[#121624] p-1 rounded-xs border border-[#262f48] text-xs font-mono">
              <span className="text-[10px] text-neutral-400 uppercase px-2 font-bold">EPHEMERIS:</span>
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

          {/* 5 Connected Mission Phases Progress Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2">
            {phases.map((p) => {
              const isActive = activePhase === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setActivePhase(p.id as MissionPhaseId);
                    if (p.action) {
                      p.action();
                    } else if (p.seekDay !== undefined) {
                      handleSeekDays(p.seekDay);
                    }
                  }}
                  className={`p-2.5 rounded-xs border text-left flex flex-col gap-1 transition-all ${
                    isActive
                      ? 'bg-[#151c30] border-cyan-400 shadow-md'
                      : 'bg-[#10131e] border-[#202538] hover:border-[#333d59]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                      isActive ? 'text-cyan-300' : 'text-neutral-400'
                    }`}>
                      {p.name}
                    </span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-tight">
                    {p.desc}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Scenario Tabs & Spacecraft Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono pt-2 border-t border-[#1c2235]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleScenarioChange('VOYAGER_2_REFERENCE')}
                className={`px-3 py-1.5 rounded-xs border transition-colors flex items-center gap-1.5 ${
                  scenarioType === 'VOYAGER_2_REFERENCE'
                    ? 'bg-[#181d2e] border-amber-400 text-amber-300 font-bold'
                    : 'bg-[#10131e] border-[#22273a] text-neutral-400 hover:text-white'
                }`}
              >
                <ShieldCheck size={13} className="text-amber-400" />
                <span>1. VOYAGER 2 GRAND TOUR (HISTORICAL)</span>
              </button>

              <button
                onClick={() => handleScenarioChange('CONCEPTUAL_JUPITER_SATURN')}
                className={`px-3 py-1.5 rounded-xs border transition-colors flex items-center gap-1.5 ${
                  scenarioType === 'CONCEPTUAL_JUPITER_SATURN'
                    ? 'bg-[#181d2e] border-cyan-400 text-cyan-300 font-bold'
                    : 'bg-[#10131e] border-[#22273a] text-neutral-400 hover:text-white'
                }`}
              >
                <Sparkles size={13} className="text-cyan-400" />
                <span>2. JUPITER-SATURN TRANSFER</span>
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
                : 'REAL MISSION REFERENCE DOSSIER // NASA JPL ARCHIVAL MEASUREMENTS'}
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

        {/* 5. VOYAGER 2 GRAND TOUR HISTORICAL DOSSIER & COURSE CORRECTIONS (TCMs) */}
        {scenarioType === 'VOYAGER_2_REFERENCE' && (
          <div className="w-full bg-[#0d0f17] border border-[#222538] p-4 rounded-xs text-white font-mono flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2436] pb-3">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-amber-400" />
                <span className="font-bold text-xs uppercase tracking-wider text-amber-300">
                  VOYAGER 2 GRAND TOUR: HISTORICAL TIMELINE & TRAJECTORY CORRECTION MANEUVERS (TCMS)
                </span>
              </div>
              <span className="text-[11px] text-neutral-400">
                TITAN IIIE-CENTAUR LAUNCH // AUG 20, 1977
              </span>
            </div>

            {/* Trajectory Correction Maneuver (TCM) Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {VOYAGER_2_TCMS.map((tcm) => (
                <div
                  key={tcm.id}
                  onClick={() => handleSeekDays(tcm.metDays)}
                  className="bg-[#121624] border border-[#232c44] hover:border-amber-400/80 p-3 rounded-xs flex flex-col justify-between gap-2 cursor-pointer transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-400 text-xs">{tcm.id}</span>
                      <span className="text-[10px] text-neutral-400">T+{tcm.metDays} D</span>
                    </div>
                    <span className="text-[11px] font-bold text-white leading-tight">{tcm.name}</span>
                    <span className="text-[10px] text-cyan-300">Epoch: {tcm.epochUTC}</span>
                    <span className="text-[10px] text-emerald-400 font-bold">ΔV = {tcm.deltaVMPerS} m/s</span>
                    <p className="text-[10px] text-neutral-400 leading-tight pt-1 border-t border-[#1e2538]">
                      {tcm.objective}
                    </p>
                  </div>
                  <span className="text-[9px] text-amber-500 uppercase tracking-widest mt-1 hover:underline">
                    SEEK TO MANEUVER →
                  </span>
                </div>
              ))}
            </div>

            {/* Side-by-Side Physical Analysis: Patched-Conic vs Documented Reality */}
            <div className="bg-[#121624] border border-[#232a3f] p-4 rounded-xs flex flex-col gap-3">
              <span className="font-bold text-xs uppercase tracking-wider text-cyan-300 border-b border-[#1f2538] pb-2">
                ASTRODYNAMICS VERIFICATION: SIMPLIFIED 2-BODY CONIC VS. NASA DE EPHEMERIS REALITY
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px] leading-relaxed text-neutral-300">
                <div className="bg-[#161a29] p-3 rounded-xs border border-[#27304a] flex flex-col gap-1">
                  <span className="font-bold text-amber-300 uppercase text-[10px]">1. Oblateness Harmonics (J2/J4)</span>
                  <p className="text-neutral-400 text-[10px]">
                    Rapidly rotating gas giants have massive equatorial bulges (Jupiter J2 = 1.47×10⁻²). This non-spherical gravity field creates nodal precession during periapsis that cannot be modeled by simple point-mass equations.
                  </p>
                </div>
                <div className="bg-[#161a29] p-3 rounded-xs border border-[#27304a] flex flex-col gap-1">
                  <span className="font-bold text-cyan-300 uppercase text-[10px]">2. Major Moon Perturbations</span>
                  <p className="text-neutral-400 text-[10px]">
                    Simultaneous gravitational pulls from Galilean moons (Io, Europa, Ganymede, Callisto), Titan, and Triton slightly altered the hyperbola deflection angles, requiring fine-tuned trim burns.
                  </p>
                </div>
                <div className="bg-[#161a29] p-3 rounded-xs border border-[#27304a] flex flex-col gap-1">
                  <span className="font-bold text-emerald-300 uppercase text-[10px]">3. 3D Out-of-Ecliptic Targeting</span>
                  <p className="text-neutral-400 text-[10px]">
                    Voyager 2’s trajectory was deliberately 3D non-coplanar: the Neptune flyby passed over the north pole, bending the outbound trajectory 48° south of the solar plane to observe Triton.
                  </p>
                </div>
                <div className="bg-[#161a29] p-3 rounded-xs border border-[#27304a] flex flex-col gap-1">
                  <span className="font-bold text-purple-300 uppercase text-[10px]">4. Non-Linear ΔV Mechanics</span>
                  <p className="text-neutral-400 text-[10px]">
                    In orbital mechanics, vector rotations alter heliocentric energy non-linearly. The scalar sum of planetary boosts (43.8 km/s) does not equal the vector resultant, as each flyby rotates the orbital ellipse in 3D space.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. Encounter Sequence Ledger & States Table */}
        <MissionEncounterTable
          mission={missionResult}
          selectedEncounterIndex={selectedEncounterIndex}
          onSelectEncounter={setSelectedEncounterIndex}
        />

        {/* 7. Astrodynamics Diagnostics, Non-Linear ΔV Proof & Data Export */}
        <MissionDiagnostics mission={missionResult} />
      </div>
    </section>
  );
};
