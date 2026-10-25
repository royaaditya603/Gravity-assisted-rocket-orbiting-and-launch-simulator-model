import React, { useState } from 'react';
import { FlybySimulationResult, ReferenceFrame, TrajectoryPoint } from '../../../physics/FlybyEngine';
import { getHistoricalReferenceForPlanet, HistoricalMissionReference } from '../../../physics/HistoricalEphemeris';
import {
  Activity,
  Gauge,
  ArrowUpRight,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Clock,
  Compass,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
} from 'lucide-react';

export interface FlybyTelemetryHUDProps {
  simResult: FlybySimulationResult | null;
  currentPlaybackIndex: number;
  referenceFrame: ReferenceFrame;
}

export const FlybyTelemetryHUD: React.FC<FlybyTelemetryHUDProps> = ({
  simResult,
  currentPlaybackIndex,
  referenceFrame,
}) => {
  const [showArchivalComparison, setShowArchivalComparison] = useState<boolean>(false);

  if (!simResult || simResult.trajectory.length === 0) {
    return (
      <div className="w-full bg-[#12141c] border border-[#232736] p-4 rounded-xs text-xs font-mono text-neutral-400">
        NO TELEMETRY DATA AVAILABLE
      </div>
    );
  }

  const idx = Math.min(currentPlaybackIndex, simResult.trajectory.length - 1);
  const currentPt: TrajectoryPoint = simResult.trajectory[idx];
  const { analytical, closestApproach, collisionDetected } = simResult;
  const planet = simResult.config.planet;

  const currentDistKm = currentPt.distanceFromCenterM / 1000.0;
  const currentAltKm = currentPt.altitudeM / 1000.0;
  const currentPlanetSpeed = currentPt.speedPlanetMPerS;
  const currentSunSpeed = currentPt.speedSunMPerS;
  const currentGravAccel = currentPt.gravitationalAccelerationMPerS2 || 0;
  const currentGForce = currentGravAccel / 9.80665; // Relative to Earth 1g

  // Historical reference lookup
  const historicalRef = getHistoricalReferenceForPlanet(planet.id);

  // Provisional vs Confirmed Closest Approach state
  const hasPassedPeriapsis = currentPt.timeS >= closestApproach.timeS;
  const periCountdownS = closestApproach.timeS - currentPt.timeS;

  return (
    <div className="w-full bg-[#0d0e14] border border-[#202434] p-4 rounded-xs flex flex-col gap-4 text-white">
      {/* 1. Real-Time Status & Time Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#202434] pb-2.5">
        <div className="flex items-center gap-2">
          <Activity size={14} className={collisionDetected ? 'text-rose-500' : 'text-emerald-400'} />
          <span className="font-mono text-xs font-bold tracking-wider uppercase text-neutral-200">
            OFFLINE NUMERICAL SIMULATION TELEMETRY
          </span>
          <span className="text-[10px] font-mono text-neutral-500 bg-[#141724] px-1.5 py-0.5 rounded-xs border border-[#23293c]">
            RK4 INTEGRATION
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
          {/* Surface Collision / Nominal Indicator */}
          {collisionDetected ? (
            <span className="px-2 py-0.5 bg-rose-950 border border-rose-600 text-rose-300 rounded-xs flex items-center gap-1 font-bold">
              <ShieldAlert size={12} /> SURFACE IMPACT DETECTED
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-600 text-emerald-300 rounded-xs flex items-center gap-1 font-bold">
              <ShieldCheck size={12} /> HYPERBOLIC ENCOUNTER NOMINAL
            </span>
          )}

          {/* Coordinate Elapsed Time */}
          <div className="flex items-center gap-1 text-neutral-300">
            <Clock size={12} className="text-amber-400" />
            <span>T + {currentPt.timeS.toLocaleString(undefined, { maximumFractionDigits: 1 })} s</span>
          </div>

          {/* Archival Reference Comparison Button */}
          {historicalRef && (
            <button
              onClick={() => setShowArchivalComparison((prev) => !prev)}
              className="px-2 py-0.5 bg-[#171b29] hover:bg-[#22283c] text-sky-400 border border-[#2b354e] rounded-xs flex items-center gap-1 text-[10px]"
            >
              <BookOpen size={11} /> ARCHIVAL REFERENCE {showArchivalComparison ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}
        </div>
      </div>

      {/* Optional Historical Ephemeris Comparison Drawer */}
      {showArchivalComparison && historicalRef && (
        <div className="bg-[#0b0d14] border border-[#1f283e] p-3 rounded-xs text-xs font-mono text-neutral-300 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2438] pb-1.5">
            <span className="text-sky-400 font-bold flex items-center gap-1.5">
              <BookOpen size={13} /> {historicalRef.missionName} ({historicalRef.encounterEpochUTC.slice(0, 10)})
            </span>
            <span className="text-[10px] text-neutral-500">
              FRAME: {historicalRef.coordinateFrame} • UNITS: {historicalRef.units}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] pt-1">
            <div>
              <span className="text-neutral-500 text-[10px]">ARCHIVAL PERIAPSIS ALTITUDE:</span>
              <div className="text-white font-bold">{historicalRef.periapsisAltitudeKm.toLocaleString()} km</div>
            </div>
            <div>
              <span className="text-neutral-500 text-[10px]">ARCHIVAL EXCESS SPEED (v_∞):</span>
              <div className="text-amber-400 font-bold">{historicalRef.asymptoticExcessSpeedKmPerS.toFixed(1)} km/s</div>
            </div>
            <div>
              <span className="text-neutral-500 text-[10px]">HISTORICAL DEFLECTION (δ):</span>
              <div className="text-sky-400 font-bold">{historicalRef.deflectionAngleDeg.toFixed(1)}°</div>
            </div>
            <div>
              <span className="text-neutral-500 text-[10px]">NET SUN ΔV BOOST:</span>
              <div className="text-emerald-400 font-bold">+{historicalRef.sunSpeedBoostKmPerS.toFixed(1)} km/s</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-neutral-500 pt-1 border-t border-[#182030]">
            <span>SOURCE: {historicalRef.archivalSource}</span>
            <a
              href={historicalRef.documentationUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:underline flex items-center gap-1"
            >
              NASA ARCHIVES <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}

      {/* 2. Primary Telemetry Readouts Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Planet-Centric Speed */}
        <div className="bg-[#141620] border border-[#252a3d] p-3 rounded-xs flex flex-col gap-1">
          <span className="text-[10px] font-mono text-neutral-400 uppercase">
            PLANET SPEED
          </span>
          <span className="text-base font-mono font-bold text-amber-400">
            {(currentPlanetSpeed / 1000.0).toFixed(2)} km/s
          </span>
          <span className="text-[9px] font-mono text-neutral-500">
            v_∞: {(analytical.vInfMPerS / 1000.0).toFixed(2)} km/s
          </span>
        </div>

        {/* Sun-Centric Speed */}
        <div className="bg-[#141620] border border-[#252a3d] p-3 rounded-xs flex flex-col gap-1">
          <span className="text-[10px] font-mono text-neutral-400 uppercase">
            SUN SPEED
          </span>
          <span className="text-base font-mono font-bold text-sky-400">
            {(currentSunSpeed / 1000.0).toFixed(2)} km/s
          </span>
          <span className="text-[9px] font-mono text-neutral-500">
            V_planet: {(planet.orbitalSpeedMPerS / 1000.0).toFixed(2)} km/s
          </span>
        </div>

        {/* Altitude Above Surface */}
        <div className="bg-[#141620] border border-[#252a3d] p-3 rounded-xs flex flex-col gap-1">
          <span className="text-[10px] font-mono text-neutral-400 uppercase">
            ALTITUDE (h)
          </span>
          <span className={`text-base font-mono font-bold ${currentAltKm <= 0 ? 'text-rose-400' : 'text-white'}`}>
            {currentAltKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
          </span>
          <span className="text-[9px] font-mono text-neutral-500">
            r: {currentDistKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
          </span>
        </div>

        {/* Current Gravitational Acceleration g(r) */}
        <div className="bg-[#141620] border border-[#252a3d] p-3 rounded-xs flex flex-col gap-1">
          <span className="text-[10px] font-mono text-neutral-400 uppercase">
            GRAVITY g(r)
          </span>
          <span className="text-base font-mono font-bold text-purple-400">
            {currentGravAccel < 100 ? currentGravAccel.toFixed(2) : currentGravAccel.toFixed(0)} m/s²
          </span>
          <span className="text-[9px] font-mono text-neutral-500">
            {currentGForce.toFixed(2)} g_earth
          </span>
        </div>

        {/* Net Sun-Relative Boost */}
        <div className="bg-[#141620] border border-[#252a3d] p-3 rounded-xs flex flex-col gap-1">
          <span className="text-[10px] font-mono text-neutral-400 uppercase">
            SUN-FRAME ΔV (SPEED)
          </span>
          <span
            className={`text-base font-mono font-bold ${
              analytical.isAcceleration ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {analytical.isAcceleration ? '+' : ''}
            {(analytical.deltaVSunSpeedMPerS / 1000.0).toFixed(2)} km/s
          </span>
          <span className="text-[9px] font-mono text-neutral-500">
            {analytical.isAcceleration ? 'ACCEL' : 'BRAKE'} • |Δv_vec|: {(analytical.deltaVVectorMagnitudeMPerS / 1000.0).toFixed(2)} km/s
          </span>
        </div>

        {/* Kinetic Energy Change */}
        <div className="bg-[#141620] border border-[#252a3d] p-3 rounded-xs flex flex-col gap-1">
          <span className="text-[10px] font-mono text-neutral-400 uppercase">
            ENERGY CHANGE (ΔK)
          </span>
          <span
            className={`text-base font-mono font-bold ${
              analytical.isAcceleration ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {(analytical.deltaTotalKineticEnergyJ / 1e9).toFixed(2)} GJ
          </span>
          <span className="text-[9px] font-mono text-neutral-500">
            {(analytical.deltaKineticEnergyJPerKg / 1e6).toFixed(2)} MJ/kg
          </span>
        </div>
      </div>

      {/* 3. Deep Analytical & Event Confirmation Box */}
      <div className="bg-[#11131c] border border-[#23283a] p-3 rounded-xs flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-6 text-neutral-400">
          {/* Closest Approach with Provisional vs Confirmed Badge */}
          <div>
            <span>CLOSEST APPROACH: </span>
            <strong className="text-white">
              {(closestApproach.distanceM / 1000.0).toLocaleString(undefined, { maximumFractionDigits: 0 })} km
            </strong>{' '}
            <span className={hasPassedPeriapsis ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {hasPassedPeriapsis
                ? `[CONFIRMED AT T + ${closestApproach.timeS.toFixed(1)}s]`
                : `[PROVISIONAL — IN ${periCountdownS.toFixed(1)}s]`}
            </span>
          </div>

          <div>
            <span>IMPACT PARAMETER (b): </span>
            <strong className="text-white">
              {(analytical.impactParameterM / 1000.0).toLocaleString(undefined, { maximumFractionDigits: 0 })} km
            </strong>
          </div>

          <div>
            <span>DEFLECTION (δ): </span>
            <strong className="text-amber-400">
              {analytical.deflectionAngleDeg.toFixed(2)}°
            </strong>
          </div>

          <div>
            <span>REST-FRAME SPEED ERROR: </span>
            <strong className="text-emerald-400">
              {simResult.speedConservationErrorPercent.toFixed(4)}%
            </strong>
          </div>

          <div>
            <span>ENERGY IDENTITY: </span>
            <strong className="text-emerald-400">
              Δε ≡ V_p · Δv
            </strong>
          </div>
        </div>

        <div className="text-[10px] text-neutral-500">
          PROBE MASS: {simResult.config.spacecraftMassKg.toLocaleString()} kg • SI METRIC
        </div>
      </div>
    </div>
  );
};
