import React, { useState } from 'react';
import { FlybySimulationResult, ReferenceFrame, TrajectoryPoint } from '../../../physics/FlybyEngine';
import { getHistoricalReferenceForPlanet } from '../../../physics/HistoricalEphemeris';
import {
  Activity,
  ShieldCheck,
  ShieldAlert,
  Clock,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
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

  if (!simResult) {
    return (
      <div className="w-full bg-white border border-[#DCE3EE] p-4 rounded-xl flex items-center justify-center gap-2 text-xs font-mono text-[#68758A] shadow-xs">
        <div className="w-2 h-2 rounded-full bg-[#B45309] animate-ping" />
        AWAITING SIMULATION TELEMETRY DATA...
      </div>
    );
  }

  if (simResult.status === 'RUNNING') {
    return (
      <div className="w-full bg-white border border-[#DCE3EE] p-4 rounded-xl flex items-center justify-center gap-2 text-xs font-mono text-[#B45309] shadow-xs">
        <div className="w-2 h-2 rounded-full bg-[#B45309] animate-spin" />
        INTEGRATING TRAJECTORY (RK4 NUMERICAL INTEGRATION IN PROGRESS)...
      </div>
    );
  }

  if (simResult.trajectory.length === 0) {
    return (
      <div className="w-full bg-white border border-[#DCE3EE] p-4 rounded-xl text-xs font-mono text-[#68758A] shadow-xs">
        NO TELEMETRY DATA AVAILABLE (EMPTY TRAJECTORY)
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
  const historicalRef = planet.id ? getHistoricalReferenceForPlanet(planet.id) : undefined;

  // Provisional vs Confirmed Closest Approach state
  const hasPassedPeriapsis = currentPt.timeS >= closestApproach.timeS;
  const periCountdownS = closestApproach.timeS - currentPt.timeS;

  // Spacecraft coordinates in current active frame (in km)
  const isSunFrame = referenceFrame === 'HELIOCENTRIC';
  const coordsKm = isSunFrame
    ? {
        x: (currentPt.posSunM.x / 1000.0).toFixed(0),
        y: (currentPt.posSunM.y / 1000.0).toFixed(0),
        z: (currentPt.posSunM.z / 1000.0).toFixed(0),
      }
    : {
        x: (currentPt.posPlanetM.x / 1000.0).toFixed(0),
        y: (currentPt.posPlanetM.y / 1000.0).toFixed(0),
        z: (currentPt.posPlanetM.z / 1000.0).toFixed(0),
      };

  // Trajectory Flight Status
  let trajectoryStatusText = 'INCOMING ASYMPTOTE';
  let trajectoryStatusColor = 'text-[#0284C7]';
  if (collisionDetected && simResult.collisionTimeS !== undefined && currentPt.timeS >= simResult.collisionTimeS) {
    trajectoryStatusText = 'SURFACE COLLISION IMPACT';
    trajectoryStatusColor = 'text-[#DC2626]';
  } else if (Math.abs(currentPt.timeS - closestApproach.timeS) < 2.0) {
    trajectoryStatusText = 'PERIAPSIS PASS (CLOSEST APPROACH)';
    trajectoryStatusColor = 'text-[#D97706]';
  } else if (currentPt.timeS > closestApproach.timeS) {
    trajectoryStatusText = 'OUTGOING ASYMPTOTE (DEFLECTED)';
    trajectoryStatusColor = 'text-[#059669]';
  } else {
    trajectoryStatusText = 'INCOMING HYPERBOLIC APPROACH';
    trajectoryStatusColor = 'text-[#0284C7]';
  }

  return (
    <div className="w-full bg-white border border-[#DCE3EE] p-4 rounded-xl flex flex-col gap-4 text-[#263247] shadow-xs">
      {/* 1. Real-Time Status & Time Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EE] pb-2.5">
        <div className="flex items-center gap-2">
          <Activity size={14} className={collisionDetected ? 'text-[#DC2626]' : 'text-[#059669]'} />
          <span className="font-mono text-xs font-bold tracking-wider uppercase text-[#263247]">
            OFFLINE NUMERICAL SIMULATION TELEMETRY
          </span>
          <span className="text-[10px] font-mono text-[#68758A] bg-[#EEF2F8] px-2 py-0.5 rounded-md border border-[#DCE3EE]">
            RK4 INTEGRATION
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
          {/* Surface Collision / Nominal Indicator */}
          {collisionDetected ? (
            <span className="px-2 py-0.5 bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] rounded-md flex items-center gap-1 font-bold">
              <ShieldAlert size={12} /> SURFACE IMPACT DETECTED
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-[#AEE5D0]/35 border border-[#AEE5D0] text-[#1D6C50] rounded-md flex items-center gap-1 font-bold">
              <ShieldCheck size={12} /> HYPERBOLIC ENCOUNTER NOMINAL
            </span>
          )}

          {/* Coordinate Elapsed Time */}
          <div className="flex items-center gap-1 text-[#263247]">
            <Clock size={12} className="text-[#B45309]" />
            <span>T + {currentPt.timeS.toLocaleString(undefined, { maximumFractionDigits: 1 })} s</span>
          </div>

          {/* Archival Reference Comparison Button */}
          {historicalRef && (
            <button
              onClick={() => setShowArchivalComparison((prev) => !prev)}
              className="px-2 py-0.5 bg-[#EEF2F8] hover:bg-[#E2E8F0] text-[#14426B] border border-[#DCE3EE] rounded-md flex items-center gap-1 text-[10px] cursor-pointer transition-colors"
            >
              <BookOpen size={11} /> ARCHIVAL REFERENCE {showArchivalComparison ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}
        </div>
      </div>

      {/* Optional Historical Ephemeris Comparison Drawer */}
      {showArchivalComparison && historicalRef && (
        <div className="bg-[#F8FAFD] border border-[#DCE3EE] p-3.5 rounded-xl text-xs font-mono text-[#263247] flex flex-col gap-2 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE3EE] pb-1.5">
            <span className="text-[#0284C7] font-bold flex items-center gap-1.5">
              <BookOpen size={13} /> {historicalRef.missionName} ({historicalRef.encounterEpochUTC.slice(0, 10)})
            </span>
            <span className="text-[10px] text-[#68758A]">
              FRAME: {historicalRef.coordinateFrame} • UNITS: {historicalRef.units}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] pt-1">
            <div>
              <span className="text-[#68758A] text-[10px]">ARCHIVAL PERIAPSIS ALTITUDE:</span>
              <div className="text-[#263247] font-bold">{historicalRef.periapsisAltitudeKm.toLocaleString()} km</div>
            </div>
            <div>
              <span className="text-[#68758A] text-[10px]">ARCHIVAL EXCESS SPEED (v_∞):</span>
              <div className="text-[#B45309] font-bold">{historicalRef.asymptoticExcessSpeedKmPerS.toFixed(1)} km/s</div>
            </div>
            <div>
              <span className="text-[#68758A] text-[10px]">HISTORICAL DEFLECTION (δ):</span>
              <div className="text-[#0284C7] font-bold">{historicalRef.deflectionAngleDeg.toFixed(1)}°</div>
            </div>
            <div>
              <span className="text-[#68758A] text-[10px]">NET SUN ΔV BOOST:</span>
              <div className="text-[#059669] font-bold">+{historicalRef.sunSpeedBoostKmPerS.toFixed(1)} km/s</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#68758A] pt-1 border-t border-[#DCE3EE]">
            <span>SOURCE: {historicalRef.archivalSource}</span>
            <a
              href={historicalRef.documentationUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[#0284C7] hover:underline flex items-center gap-1 font-medium"
            >
              NASA ARCHIVES <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}

      {/* 2. Primary Telemetry Readouts Grid */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px] font-mono tracking-wider text-[#68758A] uppercase border-b border-[#DCE3EE] pb-1 font-semibold">
          <span className="text-[#0284C7]">1. INSTANTANEOUS STATE TELEMETRY</span>
          <span>FRAME: {referenceFrame} • COORDS: [X: {coordsKm.x}, Y: {coordsKm.y}, Z: {coordsKm.z}] km</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Planet-Centric Speed */}
          <div className="bg-[#F8FAFD] border border-[#DCE3EE] p-3 rounded-xl flex flex-col gap-1 shadow-2xs">
            <span className="text-[10px] font-mono text-[#68758A] uppercase font-medium">
              PLANET SPEED (v_rel)
            </span>
            <span className="text-base font-mono font-bold text-[#B45309]">
              {(currentPlanetSpeed / 1000.0).toFixed(2)} km/s
            </span>
            <span className="text-[9px] font-mono text-[#68758A] truncate" title={`v_x: ${(currentPt.velPlanetMPerS.x / 1000).toFixed(2)}, v_y: ${(currentPt.velPlanetMPerS.y / 1000).toFixed(2)} km/s`}>
              [{ (currentPt.velPlanetMPerS.x / 1000).toFixed(1) }, { (currentPt.velPlanetMPerS.y / 1000).toFixed(1) }] km/s
            </span>
          </div>

          {/* Sun-Centric Speed */}
          <div className="bg-[#F8FAFD] border border-[#DCE3EE] p-3 rounded-xl flex flex-col gap-1 shadow-2xs">
            <span className="text-[10px] font-mono text-[#68758A] uppercase font-medium">
              SUN SPEED (v_⊙)
            </span>
            <span className="text-base font-mono font-bold text-[#0284C7]">
              {(currentSunSpeed / 1000.0).toFixed(2)} km/s
            </span>
            <span className="text-[9px] font-mono text-[#68758A] truncate" title={`v_x: ${(currentPt.velSunMPerS.x / 1000).toFixed(2)}, v_y: ${(currentPt.velSunMPerS.y / 1000).toFixed(2)} km/s`}>
              [{ (currentPt.velSunMPerS.x / 1000).toFixed(1) }, { (currentPt.velSunMPerS.y / 1000).toFixed(1) }] km/s
            </span>
          </div>

          {/* Altitude Above Surface */}
          <div className="bg-[#F8FAFD] border border-[#DCE3EE] p-3 rounded-xl flex flex-col gap-1 shadow-2xs">
            <span className="text-[10px] font-mono text-[#68758A] uppercase font-medium">
              ALTITUDE (h)
            </span>
            <span className={`text-base font-mono font-bold ${currentAltKm <= 0 ? 'text-[#DC2626]' : 'text-[#263247]'}`}>
              {currentAltKm <= 0 ? '0 km (IMPACT)' : `${currentAltKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`}
            </span>
            <span className="text-[9px] font-mono text-[#68758A]">
              r_center: {currentDistKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
            </span>
          </div>

          {/* Current Gravitational Acceleration g(r) */}
          <div className="bg-[#F8FAFD] border border-[#DCE3EE] p-3 rounded-xl flex flex-col gap-1 shadow-2xs">
            <span className="text-[10px] font-mono text-[#68758A] uppercase font-medium">
              GRAVITY g(r)
            </span>
            <span className="text-base font-mono font-bold text-[#7C3AED]">
              {currentGravAccel < 100 ? currentGravAccel.toFixed(2) : currentGravAccel.toFixed(0)} m/s²
            </span>
            <span className="text-[9px] font-mono text-[#68758A]">
              {currentGForce.toFixed(2)} g_earth
            </span>
          </div>

          {/* Spacecraft Coordinates */}
          <div className="bg-[#F8FAFD] border border-[#DCE3EE] p-3 rounded-xl flex flex-col gap-1 shadow-2xs">
            <span className="text-[10px] font-mono text-[#68758A] uppercase font-medium">
              COORDINATES (X, Y)
            </span>
            <span className="text-xs font-mono font-bold text-[#263247] truncate">
              {coordsKm.x}, {coordsKm.y}
            </span>
            <span className="text-[9px] font-mono text-[#68758A]">
              Z: {coordsKm.z} km
            </span>
          </div>

          {/* Current Trajectory Status */}
          <div className="bg-[#F8FAFD] border border-[#DCE3EE] p-3 rounded-xl flex flex-col gap-1 shadow-2xs">
            <span className="text-[10px] font-mono text-[#68758A] uppercase font-medium">
              TRAJECTORY STATUS
            </span>
            <span className={`text-xs font-mono font-bold ${trajectoryStatusColor} truncate`}>
              {trajectoryStatusText}
            </span>
            <span className="text-[9px] font-mono text-[#68758A]">
              {hasPassedPeriapsis ? 'POST-PERIAPSIS' : 'PRE-PERIAPSIS'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Deep Analytical & Event Confirmation Box (Final Mission Results) */}
      <div className="flex flex-col gap-2 border-t border-[#DCE3EE] pt-2">
        <div className="text-[10px] font-mono tracking-wider uppercase font-semibold">
          <span className="text-[#B45309]">2. FINAL FLYBY & ASYMPTOTIC ENCOUNTER RESULTS</span>
        </div>

        <div className="bg-[#F8FAFD] border border-[#DCE3EE] p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs font-mono shadow-2xs">
          <div className="flex flex-wrap items-center gap-6 text-[#68758A]">
            {/* Closest Approach with Provisional vs Confirmed Badge */}
            <div>
              <span>CLOSEST APPROACH: </span>
              <strong className="text-[#263247]">
                {(closestApproach.distanceM / 1000.0).toLocaleString(undefined, { maximumFractionDigits: 0 })} km
              </strong>{' '}
              <span className={hasPassedPeriapsis ? 'text-[#059669] font-bold' : 'text-[#D97706] font-bold'}>
                {hasPassedPeriapsis
                  ? `[CONFIRMED AT T + ${closestApproach.timeS.toFixed(1)}s]`
                  : `[PROVISIONAL — IN ${Math.max(0, periCountdownS).toFixed(1)}s]`}
              </span>
            </div>

            <div>
              <span>IMPACT PARAMETER (b): </span>
              <strong className="text-[#263247]">
                {(analytical.impactParameterM / 1000.0).toLocaleString(undefined, { maximumFractionDigits: 0 })} km
              </strong>
            </div>

            <div>
              <span>DEFLECTION (δ): </span>
              <strong className="text-[#B45309]">
                {analytical.deflectionAngleDeg.toFixed(2)}°
              </strong>
            </div>

            <div>
              <span>NET SUN ΔV BOOST: </span>
              <strong className={analytical.isAcceleration ? 'text-[#059669]' : 'text-[#DC2626]'}>
                {analytical.isAcceleration ? '+' : ''}
                {(analytical.deltaVSunSpeedMPerS / 1000.0).toFixed(2)} km/s
              </strong>
            </div>

            <div>
              <span>KINETIC ENERGY (ΔK): </span>
              <strong className={analytical.isAcceleration ? 'text-[#059669]' : 'text-[#DC2626]'}>
                {(analytical.deltaTotalKineticEnergyJ / 1e9).toFixed(2)} GJ
              </strong>
            </div>

            <div>
              <span>SPEED CONSERVATION ERROR: </span>
              <strong className="text-[#059669]">
                {simResult.speedConservationErrorPercent.toFixed(4)}%
              </strong>
            </div>
          </div>

          <div className="text-[10px] text-[#68758A]">
            PROBE MASS: {simResult.config.spacecraftMassKg.toLocaleString()} kg • SI METRIC
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlybyTelemetryHUD;
