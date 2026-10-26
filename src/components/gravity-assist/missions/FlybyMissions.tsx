import React, { useState } from 'react';
import { FlybyInitialConditions } from '../../../physics/FlybyEngine';
import {
  HISTORICAL_MISSION_DOSSIERS,
  HistoricalMissionDossier,
  HistoricalMissionLeg,
  propagateMissionLeg,
  PropagatedLegResult,
} from '../../../physics/HistoricalEphemeris';
import {
  Compass,
  ExternalLink,
  Play,
  Sparkles,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';

interface FlybyMissionsProps {
  onLoadPreset: (config: Partial<FlybyInitialConditions>) => void;
}

type ViewMode = 'DOSSIERS' | 'SEQUENTIAL_TOUR';

export const FlybyMissions: React.FC<FlybyMissionsProps> = ({ onLoadPreset }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('DOSSIERS');
  const [selectedMissionId, setSelectedMissionId] = useState<string>('VOYAGER_2');
  const [selectedLegIndex, setSelectedLegIndex] = useState<number>(0);

  const activeMission: HistoricalMissionDossier =
    HISTORICAL_MISSION_DOSSIERS[selectedMissionId] || HISTORICAL_MISSION_DOSSIERS.VOYAGER_2;

  const activeLeg: HistoricalMissionLeg =
    activeMission.legs[selectedLegIndex] || activeMission.legs[0];

  const propagatedActiveLeg: PropagatedLegResult = propagateMissionLeg(activeLeg);

  return (
    <div className="w-full bg-white border border-[#DCE3EE] p-5 rounded-xl flex flex-col gap-5 text-[#263247] shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EE] pb-3">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-[#0284C7]" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#14426B]">
            HISTORICAL MISSION DOSSIERS & MULTI-PLANET SEQUENCE MODE
          </span>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <button
            onClick={() => setViewMode('DOSSIERS')}
            className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
              viewMode === 'DOSSIERS'
                ? 'bg-[#A9D4F5] text-[#14426B] font-bold border-[#A9D4F5] shadow-2xs'
                : 'bg-[#EEF2F8] text-[#68758A] border-[#DCE3EE] hover:text-[#263247]'
            }`}
          >
            MISSION DOSSIERS
          </button>
          <button
            onClick={() => setViewMode('SEQUENTIAL_TOUR')}
            className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'SEQUENTIAL_TOUR'
                ? 'bg-[#FFD2B8] text-[#7A3E1D] font-bold border-[#FFD2B8] shadow-2xs'
                : 'bg-[#EEF2F8] text-[#68758A] border-[#DCE3EE] hover:text-[#263247]'
            }`}
          >
            <Layers size={12} />
            SEQUENTIAL PROPAGATION MODE
          </button>
        </div>
      </div>

      {/* Mission Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
        {Object.values(HISTORICAL_MISSION_DOSSIERS).map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setSelectedMissionId(m.id);
              setSelectedLegIndex(0);
            }}
            className={`p-3 rounded-xs border text-left flex flex-col gap-1 transition-colors ${
              selectedMissionId === m.id
                ? 'bg-[#161a28] border-sky-400 text-white shadow-sm'
                : 'bg-[#12141e] border-[#222638] text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-bold text-sky-400 text-[11px]">{m.shortCode}</span>
              <span className="text-[10px] text-neutral-500">{m.legs.length} ENCOUNTERS</span>
            </div>
            <span className="font-bold text-white text-xs leading-snug">{m.name.split('—')[0].trim()}</span>
            <span className="text-[10px] text-neutral-400 truncate">{m.trajectoryClass}</span>
          </button>
        ))}
      </div>

      {/* VIEW MODE 1: INDIVIDUAL MISSION DOSSIERS & LEGS */}
      {viewMode === 'DOSSIERS' && (
        <div className="flex flex-col gap-4">
          {/* Mission Overview Banner */}
          <div className="bg-[#121522] border border-[#20263a] p-4 rounded-xs flex flex-col gap-2 font-mono text-xs">
            <div className="flex flex-wrap justify-between items-center gap-2 border-b border-[#21273c] pb-2">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-bold text-sm uppercase">{activeMission.name}</span>
                <span className="px-2 py-0.5 rounded-xs bg-[#1a2133] border border-[#2f3954] text-neutral-300 text-[10px]">
                  Launched: {activeMission.launchDate} ({activeMission.launchVehicle})
                </span>
              </div>
              <span className="text-[10px] text-neutral-400">OPERATOR: {activeMission.operator}</span>
            </div>
            <p className="text-neutral-300 text-xs leading-relaxed font-sans mt-1">
              {activeMission.overview}
            </p>
          </div>

          {/* Encounter Legs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {activeMission.legs.map((leg, idx) => (
              <div
                key={leg.id}
                className="bg-[#141622] border border-[#23283c] p-3.5 rounded-xs flex flex-col justify-between gap-3 font-mono text-xs"
              >
                <div className="flex flex-col gap-2">
                  {/* Leg Header & Status Badge */}
                  <div className="flex items-center justify-between gap-1 border-b border-[#202538] pb-1.5">
                    <span className="text-[10px] text-sky-400 font-bold">LEG #{leg.legNumber}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-xs text-[9px] font-bold ${
                        leg.classification === 'HISTORICAL_FACT'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : leg.classification === 'SIMPLIFIED_CALCULATION'
                          ? 'bg-amber-950 text-amber-300 border border-amber-700'
                          : 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                      }`}
                    >
                      {leg.classification.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Target & Epoch */}
                  <div className="flex flex-col">
                    <span className="font-bold text-white text-xs">{leg.name}</span>
                    <span className="text-[10px] text-amber-400 mt-0.5">{leg.encounterEpochUTC}</span>
                  </div>

                  {/* Physical Parameters Card */}
                  <div className="bg-[#0b0c12] p-2.5 rounded-xs border border-[#1b1f2e] flex flex-col gap-1 text-[11px] text-neutral-300">
                    <div>
                      Target: <strong className="text-white">{leg.targetPlanet.name}</strong>
                    </div>
                    <div>
                      v_∞: <strong className="text-amber-400">{leg.asymptoticExcessSpeedKmPerS.toFixed(1)} km/s</strong>
                    </div>
                    <div>
                      Periapsis Alt:{' '}
                      <strong className="text-sky-300">
                        {leg.periapsisAltitudeKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
                      </strong>
                    </div>
                    <div>
                      Deflection (δ): <strong className="text-amber-400">{leg.deflectionAngleDeg.toFixed(1)}°</strong>
                    </div>
                    <div>
                      Sun ΔV:{' '}
                      <strong className={leg.sunSpeedBoostKmPerS >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {leg.sunSpeedBoostKmPerS >= 0 ? '+' : ''}
                        {leg.sunSpeedBoostKmPerS.toFixed(1)} km/s
                      </strong>
                    </div>
                  </div>

                  <p className="text-[11px] text-neutral-400 font-sans leading-relaxed line-clamp-3">
                    {leg.physicalSignificance}
                  </p>
                </div>

                {/* Bottom Actions */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-[#202538]">
                  <a
                    href={leg.documentationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <span className="truncate">{leg.archivalSource}</span>
                    <ExternalLink size={10} className="shrink-0" />
                  </a>

                  <button
                    onClick={() =>
                      onLoadPreset({
                        planet: leg.targetPlanet,
                        vInfSpeedMPerS: leg.asymptoticExcessSpeedKmPerS * 1000.0,
                        targetPeriapsisM: leg.periapsisRadiusKm * 1000.0,
                        passType: leg.flybyPassType,
                      })
                    }
                    className="w-full py-1.5 bg-sky-600 hover:bg-sky-500 text-black text-[10px] font-bold rounded-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Play size={10} /> SIMULATE THIS LEG
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: SEQUENTIAL MISSION PROPAGATION MODE */}
      {viewMode === 'SEQUENTIAL_TOUR' && (
        <div className="flex flex-col gap-4 font-mono text-xs">
          {/* Methodological Warning: Why Scalar Summing is Prohibited */}
          <div className="bg-[#14120a] border border-amber-600/50 p-4 rounded-xs flex flex-col gap-2 text-amber-200">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase">
              <AlertCircle size={16} /> ASTRODYNAMIC INTEGRITY: WHY SCALAR DELTA-Vs CANNOT BE SUMMED LINEARLY
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed font-sans">
              A common misconception is that multiple gravity assists simply add scalar speed gains together (e.g., ΔV_total = Δv_1 + Δv_2).
              In genuine orbital mechanics, each planet flyby rotates the spacecraft's heliocentric velocity vector in 3D space.
              This reshapes the heliocentric conic section (changing semi-major axis a, eccentricity e, aphelion, and perihelion).
              Each subsequent leg requires rigorous heliocentric Lambert arc propagation and resonance phasing with the target planet.
            </p>
          </div>

          {/* Sequential Leg Stepper Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {activeMission.legs.map((leg, idx) => (
              <button
                key={leg.id}
                onClick={() => setSelectedLegIndex(idx)}
                className={`px-3 py-2 rounded-xs border text-left shrink-0 transition-colors ${
                  selectedLegIndex === idx
                    ? 'bg-amber-500 text-black font-bold border-amber-400'
                    : 'bg-[#141724] text-neutral-400 border-[#23283c] hover:text-white'
                }`}
              >
                <div className="text-[10px] uppercase">LEG #{leg.legNumber}</div>
                <div className="text-xs font-bold">{leg.targetPlanet.name}</div>
              </button>
            ))}
          </div>

          {/* Propagated Heliocentric Stage Analysis */}
          <div className="bg-[#0e1018] border border-[#202538] p-4 rounded-xs flex flex-col gap-4">
            <div className="flex flex-wrap justify-between items-center gap-2 border-b border-[#202538] pb-3">
              <div>
                <span className="text-amber-400 font-bold text-sm uppercase">
                  Sequential Leg #{activeLeg.legNumber}: {activeLeg.name}
                </span>
                <div className="text-neutral-400 text-[11px] mt-0.5">
                  Target: {activeLeg.targetPlanet.name} • Epoch: {activeLeg.encounterEpochUTC} • Pass: {activeLeg.flybyPassType}
                </div>
              </div>

              <button
                onClick={() =>
                  onLoadPreset({
                    planet: activeLeg.targetPlanet,
                    vInfSpeedMPerS: activeLeg.asymptoticExcessSpeedKmPerS * 1000.0,
                    targetPeriapsisM: activeLeg.periapsisRadiusKm * 1000.0,
                    passType: activeLeg.flybyPassType,
                  })
                }
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xs flex items-center gap-1.5 transition-colors"
              >
                <Play size={12} /> LOAD INTO 3D SIMULATOR
              </button>
            </div>

            {/* Side-by-Side: Pre-Flyby vs Post-Flyby Heliocentric Orbit */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pre-Flyby Conic */}
              <div className="bg-[#131622] border border-[#22273a] p-3.5 rounded-xs flex flex-col gap-2">
                <span className="font-bold text-sky-400 text-xs border-b border-[#22273a] pb-1">
                  1. PRE-ENCOUNTER HELIOCENTRIC ORBIT
                </span>
                <div className="space-y-1 text-[11px] text-neutral-300">
                  <div>Heliocentric Speed: <strong className="text-white">{propagatedActiveLeg.preFlybySunSpeedKmPerS.toFixed(2)} km/s</strong></div>
                  <div>Semi-Major Axis (a): <strong className="text-white">{propagatedActiveLeg.preOrbit.semiMajorAxisAU.toFixed(2)} AU</strong></div>
                  <div>Eccentricity (e): <strong className="text-white">{propagatedActiveLeg.preOrbit.eccentricity.toFixed(3)}</strong></div>
                  <div>Perihelion (r_p): <strong className="text-white">{propagatedActiveLeg.preOrbit.perihelionAU.toFixed(2)} AU</strong></div>
                  <div>Aphelion (r_a): <strong className="text-white">{propagatedActiveLeg.preOrbit.aphelionAU.toFixed(2)} AU</strong></div>
                  <div>Orbital Period: <strong className="text-white">{propagatedActiveLeg.preOrbit.orbitalPeriodYears.toFixed(2)} years</strong></div>
                </div>
              </div>

              {/* Post-Flyby Conic */}
              <div className="bg-[#131622] border border-[#22273a] p-3.5 rounded-xs flex flex-col gap-2">
                <span className="font-bold text-emerald-400 text-xs border-b border-[#22273a] pb-1">
                  2. POST-ENCOUNTER HELIOCENTRIC ORBIT (TRANSFORMED)
                </span>
                <div className="space-y-1 text-[11px] text-neutral-300">
                  <div>Heliocentric Speed: <strong className="text-emerald-400">{propagatedActiveLeg.postFlybySunSpeedKmPerS.toFixed(2)} km/s</strong></div>
                  <div>Semi-Major Axis (a): <strong className="text-emerald-400">{propagatedActiveLeg.postOrbit.semiMajorAxisAU.toFixed(2)} AU</strong></div>
                  <div>Eccentricity (e): <strong className="text-emerald-400">{propagatedActiveLeg.postOrbit.eccentricity.toFixed(3)}</strong></div>
                  <div>Perihelion (r_p): <strong className="text-emerald-400">{propagatedActiveLeg.postOrbit.perihelionAU.toFixed(2)} AU</strong></div>
                  <div>Aphelion (r_a): <strong className="text-emerald-400">{propagatedActiveLeg.postOrbit.aphelionAU.toFixed(2)} AU</strong></div>
                  <div>Specific Energy Shift: <strong className="text-cyan-400">+{propagatedActiveLeg.specificEnergyChangeMJPerKg.toFixed(2)} MJ/kg</strong></div>
                </div>
              </div>
            </div>

            {/* Educational Principle Callout */}
            <div className="p-3 bg-[#11131c] rounded-xs border border-[#1f2434] text-[11px] text-neutral-400 leading-relaxed">
              <strong>PHYSICAL MECHANISM:</strong> {propagatedActiveLeg.whyLinearSumIsInvalid}
            </div>
          </div>
        </div>
      )}

      {/* Ephemeris & Archival Fidelity Notice */}
      <div className="p-3 bg-[#0c0d14] rounded-xs border border-[#1c2030] text-[11px] font-mono text-neutral-400 leading-relaxed">
        <strong>DATA CLASSIFICATION & METHODOLOGY:</strong>
        <ul className="list-disc pl-5 mt-1 space-y-0.5 text-[10px]">
          <li>
            <strong className="text-emerald-400">HISTORICAL FACT:</strong> Grounded in peer-reviewed mission reports (NASA SP-424, NASA JPL SP-446, ESA SP-1502).
          </li>
          <li>
            <strong className="text-amber-400">SIMPLIFIED CALCULATION:</strong> Local 2-body hyperbolic patched-conic analytical integration inside planetary sphere of influence (SOI).
          </li>
          <li>
            <strong className="text-indigo-400">HYPOTHETICAL CONCEPT:</strong> Unconstrained theoretical flyby configurations without verified multi-year interplanetary transfer phasing.
          </li>
        </ul>
      </div>
    </div>
  );
};
