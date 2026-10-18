import React from 'react';
import { FlybySimulationResult, ReferenceFrame, TrajectoryPoint } from '../../../physics/FlybyEngine';
import { Activity, Gauge, ArrowUpRight, ShieldCheck, ShieldAlert, Zap } from 'lucide-react';

interface FlybyTelemetryHUDProps {
  simResult: FlybySimulationResult | null;
  currentPlaybackIndex: number;
  referenceFrame: ReferenceFrame;
}

export const FlybyTelemetryHUD: React.FC<FlybyTelemetryHUDProps> = ({
  simResult,
  currentPlaybackIndex,
  referenceFrame,
}) => {
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

  return (
    <div className="w-full bg-[#0d0e14] border border-[#202434] p-4 rounded-xs flex flex-col gap-4 text-white">
      {/* 1. Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#202434] pb-2.5">
        <div className="flex items-center gap-2">
          <Activity size={14} className={collisionDetected ? 'text-rose-500' : 'text-emerald-400'} />
          <span className="font-mono text-xs font-bold tracking-wider uppercase text-neutral-200">
            REAL-TIME TELEMETRY STREAM
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          {collisionDetected ? (
            <span className="px-2 py-0.5 bg-rose-950 border border-rose-600 text-rose-300 rounded-xs flex items-center gap-1 font-bold">
              <ShieldAlert size={12} /> SURFACE IMPACT DETECTED
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-600 text-emerald-300 rounded-xs flex items-center gap-1 font-bold">
              <ShieldCheck size={12} /> HYPERBOLIC ENCOUNTER NOMINAL
            </span>
          )}
          <span className="text-neutral-500">T + {currentPt.timeS.toFixed(1)} s</span>
        </div>
      </div>

      {/* 2. Primary Telemetry Readouts Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Planet-Centric Speed */}
        <div className="bg-[#141620] border border-[#252a3d] p-3 rounded-xs flex flex-col gap-1">
          <span className="text-[10px] font-mono text-neutral-400 uppercase">
            PLANET-FRAME SPEED
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
            SUN-FRAME SPEED
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
            CURRENT ALTITUDE
          </span>
          <span className={`text-base font-mono font-bold ${currentAltKm <= 0 ? 'text-rose-400' : 'text-white'}`}>
            {currentAltKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
          </span>
          <span className="text-[9px] font-mono text-neutral-500">
            r: {currentDistKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
          </span>
        </div>

        {/* Deflection Angle */}
        <div className="bg-[#141620] border border-[#252a3d] p-3 rounded-xs flex flex-col gap-1">
          <span className="text-[10px] font-mono text-neutral-400 uppercase">
            TURNING ANGLE (δ)
          </span>
          <span className="text-base font-mono font-bold text-amber-400">
            {analytical.deflectionAngleDeg.toFixed(2)}°
          </span>
          <span className="text-[9px] font-mono text-neutral-500">
            e = {analytical.eccentricity.toFixed(3)}
          </span>
        </div>

        {/* Net Sun-Relative Boost */}
        <div className="bg-[#141620] border border-[#252a3d] p-3 rounded-xs flex flex-col gap-1">
          <span className="text-[10px] font-mono text-neutral-400 uppercase">
            SUN-FRAME ΔV
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
            {analytical.isAcceleration ? 'ACCELERATION' : 'GRAVITY BRAKE'}
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

      {/* 3. Deep Analytical & Conservation Validation Box */}
      <div className="bg-[#11131c] border border-[#23283a] p-3 rounded-xs flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-6 text-neutral-400">
          <div>
            <span>CLOSEST APPROACH: </span>
            <strong className="text-white">
              {(closestApproach.distanceM / 1000.0).toLocaleString(undefined, { maximumFractionDigits: 0 })} km
            </strong>{' '}
            <span className="text-neutral-500">
              (Alt: {(closestApproach.altitudeM / 1000.0).toLocaleString(undefined, { maximumFractionDigits: 0 })} km)
            </span>
          </div>

          <div>
            <span>IMPACT PARAMETER (b): </span>
            <strong className="text-white">
              {(analytical.impactParameterM / 1000.0).toLocaleString(undefined, { maximumFractionDigits: 0 })} km
            </strong>
          </div>

          <div>
            <span>REST-FRAME SPEED ERROR: </span>
            <strong className="text-emerald-400">
              {simResult.speedConservationErrorPercent.toFixed(4)}%
            </strong>
          </div>

          <div>
            <span>DEFLECTION DRIFT: </span>
            <strong className="text-emerald-400">
              {simResult.deflectionErrorPercent.toFixed(2)}%
            </strong>
          </div>
        </div>

        <div className="text-[10px] text-neutral-500">
          INTEGRATOR: RK4 ADAPTIVE SUB-STEPPED • SI UNITS
        </div>
      </div>
    </div>
  );
};
