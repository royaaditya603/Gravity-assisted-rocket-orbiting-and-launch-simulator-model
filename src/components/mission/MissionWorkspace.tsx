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
    <section id="mission-mode" className="w-full bg-[#F5F7FB] border-t border-[#DCE3EE] text-[#263247] py-6 px-4 sm:px-8 flex flex-col gap-6">
      <div className="max-w-7xl mx-auto w-full flex flex-col gap-6">
        
        {/* 1. Header Bar: Navigation back to Ascent, Mission Title & Controls */}
        <div className="flex flex-col gap-3 border-b border-[#DCE3EE] pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {onNavigateToAscent && (
                <button
                  onClick={onNavigateToAscent}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#EEF2F8] text-[#0284C7] border border-[#DCE3EE] rounded-lg font-mono text-xs transition-colors shadow-2xs font-bold"
                >
                  <ArrowLeft size={13} />
                  <span>ASCENT COCKPIT</span>
                </button>
              )}
              <div className="w-8 h-8 rounded-lg bg-[#A9D4F5] text-[#14426B] flex items-center justify-center font-bold shadow-2xs">
                <Compass size={20} />
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#0284C7]">
                  CONNECTED MISSION MODE // SOLAR SYSTEM FLYBY ENGINE
                </span>
                <h2 className="font-sans font-black text-xl tracking-tight text-[#263247]">
                  INTERPLANETARY MISSION SUITE & VOYAGER 2 REPLAY
                </h2>
              </div>
            </div>

            {/* Planetary Motion Mode Switcher */}
            <div className="flex items-center gap-1 bg-[#EEF2F8] p-1 rounded-lg border border-[#DCE3EE] text-xs font-mono">
              <span className="text-[10px] text-[#68758A] uppercase px-2 font-bold">EPHEMERIS:</span>
              <button
                onClick={() => handleMotionModeChange('SIMPLIFIED')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  motionMode === 'SIMPLIFIED'
                    ? 'bg-[#FFD2B8] text-[#7A3E1D] font-bold shadow-2xs'
                    : 'text-[#68758A] hover:text-[#263247]'
                }`}
              >
                SIMPLIFIED CIRCULAR
              </button>
              <button
                onClick={() => handleMotionModeChange('EPHEMERIS')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  motionMode === 'EPHEMERIS'
                    ? 'bg-[#A9D4F5] text-[#14426B] font-bold shadow-2xs'
                    : 'text-[#68758A] hover:text-[#263247]'
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
                  className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white border-[#A9D4F5] shadow-xs ring-2 ring-[#A9D4F5]/50'
                      : 'bg-[#EEF2F8] border-[#DCE3EE] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                      isActive ? 'text-[#14426B]' : 'text-[#68758A]'
                    }`}>
                      {p.name}
                    </span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#0284C7] animate-pulse" />}
                  </div>
                  <p className="text-[10px] text-[#68758A] leading-tight">
                    {p.desc}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Scenario Tabs & Spacecraft Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono pt-2 border-t border-[#DCE3EE]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleScenarioChange('VOYAGER_2_REFERENCE')}
                className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  scenarioType === 'VOYAGER_2_REFERENCE'
                    ? 'bg-white border-[#FFD2B8] text-[#7A3E1D] font-bold shadow-2xs'
                    : 'bg-[#EEF2F8] border-[#DCE3EE] text-[#68758A] hover:text-[#263247]'
                }`}
              >
                <ShieldCheck size={13} className="text-[#B45309]" />
                <span>1. VOYAGER 2 GRAND TOUR (HISTORICAL)</span>
              </button>

              <button
                onClick={() => handleScenarioChange('CONCEPTUAL_JUPITER_SATURN')}
                className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  scenarioType === 'CONCEPTUAL_JUPITER_SATURN'
                    ? 'bg-white border-[#A9D4F5] text-[#14426B] font-bold shadow-2xs'
                    : 'bg-[#EEF2F8] border-[#DCE3EE] text-[#68758A] hover:text-[#263247]'
                }`}
              >
                <Sparkles size={13} className="text-[#0284C7]" />
                <span>2. JUPITER-SATURN TRANSFER</span>
              </button>

              <button
                onClick={() => handleScenarioChange('CASSINI_VVEJGA_REFERENCE')}
                className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  scenarioType === 'CASSINI_VVEJGA_REFERENCE'
                    ? 'bg-white border-[#C9BDF2] text-[#4A347F] font-bold shadow-2xs'
                    : 'bg-[#EEF2F8] border-[#DCE3EE] text-[#68758A] hover:text-[#263247]'
                }`}
              >
                <Layers size={13} className="text-[#7C3AED]" />
                <span>3. CASSINI VVEJGA RESONANT TOUR</span>
              </button>
            </div>

            {/* Spacecraft Selection Dropdown */}
            <div className="flex items-center gap-2">
              <Rocket size={14} className="text-[#68758A]" />
              <span className="text-[10px] text-[#68758A] uppercase font-semibold">PROBE:</span>
              <select
                value={spacecraftId}
                onChange={(e) => setSpacecraftId(e.target.value)}
                className="bg-white border border-[#DCE3EE] px-2.5 py-1 rounded-lg text-xs text-[#263247] outline-none cursor-pointer shadow-2xs"
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
          className={`p-3.5 rounded-xl border text-xs font-mono flex items-start gap-3 shadow-2xs ${
            missionResult.isConceptual
              ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
              : 'bg-[#F0F9FF] border-[#BAE6FD] text-[#0369A1]'
          }`}
        >
          {missionResult.isConceptual ? (
            <AlertTriangle size={18} className="text-[#D97706] shrink-0 mt-0.5" />
          ) : (
            <ShieldCheck size={18} className="text-[#0284C7] shrink-0 mt-0.5" />
          )}
          <div className="flex flex-col gap-0.5">
            <span className="font-bold uppercase tracking-wider text-[11px]">
              {missionResult.isConceptual
                ? 'HYPOTHETICAL EDUCATIONAL MISSION SCENARIO'
                : 'REAL MISSION REFERENCE DOSSIER // NASA JPL ARCHIVAL MEASUREMENTS'}
            </span>
            <p className="text-[11px] leading-relaxed opacity-95">{missionResult.conceptualDisclaimer}</p>
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
          <div className="w-full bg-white border border-[#DCE3EE] p-5 rounded-xl text-[#263247] font-mono flex flex-col gap-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EE] pb-3">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-[#B45309]" />
                <span className="font-bold text-xs uppercase tracking-wider text-[#14426B]">
                  VOYAGER 2 GRAND TOUR: HISTORICAL TIMELINE & TRAJECTORY CORRECTION MANEUVERS (TCMS)
                </span>
              </div>
              <span className="text-[11px] text-[#68758A]">
                TITAN IIIE-CENTAUR LAUNCH // AUG 20, 1977
              </span>
            </div>

            {/* Trajectory Correction Maneuver (TCM) Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {VOYAGER_2_TCMS.map((tcm) => (
                <div
                  key={tcm.id}
                  onClick={() => handleSeekDays(tcm.metDays)}
                  className="bg-[#F8FAFD] border border-[#DCE3EE] hover:border-[#A9D4F5] p-3.5 rounded-xl flex flex-col justify-between gap-2 cursor-pointer transition-all shadow-2xs hover:shadow-xs"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#B45309] text-xs">{tcm.id}</span>
                      <span className="text-[10px] text-[#68758A]">T+{tcm.metDays} D</span>
                    </div>
                    <span className="text-[11px] font-bold text-[#263247] leading-tight">{tcm.name}</span>
                    <span className="text-[10px] text-[#0284C7]">Epoch: {tcm.epochUTC}</span>
                    <span className="text-[10px] text-[#059669] font-bold">ΔV = {tcm.deltaVMPerS} m/s</span>
                    <p className="text-[10px] text-[#68758A] leading-tight pt-1 border-t border-[#DCE3EE]">
                      {tcm.objective}
                    </p>
                  </div>
                  <span className="text-[9px] text-[#0284C7] font-bold uppercase tracking-widest mt-1 hover:underline">
                    SEEK TO MANEUVER →
                  </span>
                </div>
              ))}
            </div>

            {/* Side-by-Side Physical Analysis: Patched-Conic vs Documented Reality */}
            <div className="bg-[#F8FAFD] border border-[#DCE3EE] p-4 rounded-xl flex flex-col gap-3 shadow-2xs">
              <span className="font-bold text-xs uppercase tracking-wider text-[#14426B] border-b border-[#DCE3EE] pb-2">
                ASTRODYNAMICS VERIFICATION: SIMPLIFIED 2-BODY CONIC VS. NASA DE EPHEMERIS REALITY
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px] leading-relaxed text-[#263247]">
                <div className="bg-white p-3 rounded-lg border border-[#DCE3EE] flex flex-col gap-1 shadow-2xs">
                  <span className="font-bold text-[#B45309] uppercase text-[10px]">1. Oblateness Harmonics (J2/J4)</span>
                  <p className="text-[#68758A] text-[10px]">
                    Rapidly rotating gas giants have massive equatorial bulges (Jupiter J2 = 1.47×10⁻²). This non-spherical gravity field creates nodal precession during periapsis that cannot be modeled by simple point-mass equations.
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-[#DCE3EE] flex flex-col gap-1 shadow-2xs">
                  <span className="font-bold text-[#0284C7] uppercase text-[10px]">2. Major Moon Perturbations</span>
                  <p className="text-[#68758A] text-[10px]">
                    Simultaneous gravitational pulls from Galilean moons (Io, Europa, Ganymede, Callisto), Titan, and Triton slightly altered the hyperbola deflection angles, requiring fine-tuned trim burns.
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-[#DCE3EE] flex flex-col gap-1 shadow-2xs">
                  <span className="font-bold text-[#059669] uppercase text-[10px]">3. 3D Out-of-Ecliptic Targeting</span>
                  <p className="text-[#68758A] text-[10px]">
                    Voyager 2’s trajectory was deliberately 3D non-coplanar: the Neptune flyby passed over the north pole, bending the outbound trajectory 48° south of the solar plane to observe Triton.
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-[#DCE3EE] flex flex-col gap-1 shadow-2xs">
                  <span className="font-bold text-[#7C3AED] uppercase text-[10px]">4. Non-Linear ΔV Mechanics</span>
                  <p className="text-[#68758A] text-[10px]">
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
