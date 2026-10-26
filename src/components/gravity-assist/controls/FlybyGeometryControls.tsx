import React from 'react';
import { FlybyPassType } from '../../../physics/FlybyEngine';
import {
  EncounterDistanceMode,
  syncAltitudeAndImpactParameter,
  checkClosestApproachHazards,
} from '../../../physics/FlybyScenario';
import { ParameterTooltip, UnitBadge } from './ParameterTooltip';
import { Compass, ShieldAlert, AlertTriangle, ArrowRight, Zap, Target } from 'lucide-react';

export interface FlybyGeometryControlsProps {
  planetRadiusM: number;
  planetMu: number;
  vInfSpeedMPerS: number;
  onChangeVInf: (speed: number) => void;
  approachAngleDeg: number;
  onChangeApproachAngle: (angle: number) => void;
  passType: FlybyPassType;
  onChangePassType: (pass: FlybyPassType) => void;
  distanceMode: EncounterDistanceMode;
  onChangeDistanceMode: (mode: EncounterDistanceMode) => void;
  periapsisAltitudeKm: number;
  onChangePeriapsisAltitude: (altKm: number) => void;
  impactParameterKm: number;
  onChangeImpactParameter: (bKm: number) => void;
  spacecraftMassKg: number;
  onChangeSpacecraftMass: (mass: number) => void;
}

export const FlybyGeometryControls: React.FC<FlybyGeometryControlsProps> = ({
  planetRadiusM,
  planetMu,
  vInfSpeedMPerS,
  onChangeVInf,
  approachAngleDeg,
  onChangeApproachAngle,
  passType,
  onChangePassType,
  distanceMode,
  onChangeDistanceMode,
  periapsisAltitudeKm,
  onChangePeriapsisAltitude,
  impactParameterKm,
  onChangeImpactParameter,
  spacecraftMassKg,
  onChangeSpacecraftMass,
}) => {
  const planetRadiusKm = planetRadiusM / 1000.0;
  const periapsisRadiusKm = planetRadiusKm + periapsisAltitudeKm;

  // Hazard evaluation
  const hazards = checkClosestApproachHazards(periapsisAltitudeKm, planetRadiusM);

  // Incoming speed in km/s
  const vInfKmS = vInfSpeedMPerS / 1000.0;

  // Handlers with bi-directional coupling
  const handleVInfChange = (newVInfMPerS: number) => {
    const val = Math.max(100.0, newVInfMPerS);
    onChangeVInf(val);
    const synced = syncAltitudeAndImpactParameter(
      periapsisAltitudeKm,
      impactParameterKm,
      distanceMode,
      planetRadiusM,
      val,
      planetMu
    );
    onChangePeriapsisAltitude(synced.periapsisAltitudeKm);
    onChangeImpactParameter(synced.impactParameterKm);
  };

  const handleAltitudeChange = (newAltKm: number) => {
    onChangePeriapsisAltitude(newAltKm);
    const synced = syncAltitudeAndImpactParameter(
      newAltKm,
      impactParameterKm,
      'PERIAPSIS_ALTITUDE',
      planetRadiusM,
      vInfSpeedMPerS,
      planetMu
    );
    onChangeImpactParameter(synced.impactParameterKm);
  };

  const handleImpactParameterChange = (newBKm: number) => {
    const bSafe = Math.max(0, newBKm);
    onChangeImpactParameter(bSafe);
    const synced = syncAltitudeAndImpactParameter(
      periapsisAltitudeKm,
      bSafe,
      'IMPACT_PARAMETER',
      planetRadiusM,
      vInfSpeedMPerS,
      planetMu
    );
    onChangePeriapsisAltitude(synced.periapsisAltitudeKm);
  };

  return (
    <div className="bg-[#0b0c13] border border-[#1f2537] p-4 rounded-xs flex flex-col gap-4 font-mono text-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1b2132] pb-2">
        <div className="flex items-center gap-2">
          <Compass size={14} className="text-amber-400" />
          <span className="text-xs font-bold text-amber-300 uppercase">
            SPACECRAFT FLYBY TRAJECTORY CONTROLS
          </span>
          <ParameterTooltip
            title="Flyby Encounter Geometry"
            description="Controls the incoming hyperbolic excess velocity (v_∞), encounter orientation (trailing vs leading), and closest approach distance (periapsis altitude h_p or asymptotic impact parameter b)."
            formula="b = r_p · √(1 + 2μ / (r_p · v_∞²))"
          />
        </div>
        <div className="text-[10px] text-neutral-400">
          Two-Body Patched Conic / Numerical Integration
        </div>
      </div>

      {/* Grid of Encounter Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* 1. Flyby Side / Orientation */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <label className="text-neutral-400 font-bold uppercase text-[10px]">
                FLYBY ORIENTATION
              </label>
              <ParameterTooltip
                title="Flyby Orientation"
                description="Trailing pass passes behind the planet along its orbital motion vector, gaining heliocentric velocity (+ΔV boost). Leading pass passes in front, braking and losing heliocentric velocity (-ΔV drop)."
                formula="Trailing: +ΔV (Gain) | Leading: -ΔV (Braking)"
              />
            </div>
            <span className="text-[9px] text-neutral-500 font-bold">PASS TYPE</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onChangePassType('TRAILING')}
              className={`py-2 px-2 text-[11px] font-bold rounded-xs border transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                passType === 'TRAILING'
                  ? 'bg-amber-500 text-black border-amber-400 shadow-md ring-1 ring-amber-400'
                  : 'bg-[#141724] text-neutral-400 border-[#242b3e] hover:text-white'
              }`}
            >
              <span>TRAILING (+ΔV)</span>
              <span className={`text-[8px] ${passType === 'TRAILING' ? 'text-black/80' : 'text-neutral-500'}`}>
                ACCELERATION
              </span>
            </button>

            <button
              type="button"
              onClick={() => onChangePassType('LEADING')}
              className={`py-2 px-2 text-[11px] font-bold rounded-xs border transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                passType === 'LEADING'
                  ? 'bg-rose-500 text-white border-rose-400 shadow-md ring-1 ring-rose-400'
                  : 'bg-[#141724] text-neutral-400 border-[#242b3e] hover:text-white'
              }`}
            >
              <span>LEADING (-ΔV)</span>
              <span className={`text-[8px] ${passType === 'LEADING' ? 'text-white/80' : 'text-neutral-500'}`}>
                DECELERATION
              </span>
            </button>
          </div>

          <span className="text-[9px] text-neutral-500 leading-tight">
            {passType === 'TRAILING'
              ? 'Behind planet: pulls probe forward along orbit'
              : 'Ahead of planet: pulls probe backward against orbit'}
          </span>
        </div>

        {/* 2. Incoming Asymptotic Speed v_inf */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <label className="text-neutral-400 font-bold uppercase text-[10px]">
                ASYMPTOTIC SPEED (v_∞)
              </label>
              <ParameterTooltip
                title="Hyperbolic Excess Speed (v_∞)"
                description="Hyperbolic asymptotic velocity of the spacecraft relative to the planet outside its Sphere of Influence (SOI). Determines the turning angle and orbital energy."
                unit="km/s"
                formula="ε = +v_∞² / 2 > 0"
              />
            </div>
            <div className="flex items-center gap-1">
              <UnitBadge unit="km/s" />
              <span className="text-amber-400 font-bold">{vInfKmS.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1000"
              max="35000"
              step="250"
              value={vInfSpeedMPerS}
              onChange={(e) => handleVInfChange(parseFloat(e.target.value))}
              className="w-full accent-amber-500 bg-neutral-800 h-1.5 rounded-sm cursor-pointer"
            />
            <input
              type="number"
              step="0.25"
              min="0.1"
              max="100"
              value={vInfKmS.toFixed(2)}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) {
                  handleVInfChange(val * 1000.0);
                }
              }}
              className="w-16 bg-[#141826] border border-[#283148] px-1.5 py-0.5 rounded-xs text-right text-amber-300 font-bold text-xs"
            />
          </div>

          <div className="flex justify-between text-[9px] text-neutral-500">
            <span>Range: 1.0 – 35.0 km/s</span>
            <span>{(vInfSpeedMPerS).toLocaleString()} m/s</span>
          </div>
        </div>

        {/* 3. Encounter Distance Mode Toggle & Inputs (Altitude vs Impact Parameter) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <label className="text-neutral-400 font-bold uppercase text-[10px]">
                {distanceMode === 'PERIAPSIS_ALTITUDE' ? 'CLOSEST ALTITUDE (h_p)' : 'IMPACT PARAMETER (b)'}
              </label>
              <ParameterTooltip
                title="Altitude vs. Impact Parameter Coupling"
                description="Impact parameter b is the asymptotic miss distance. Due to gravitational attraction, the actual closest approach (periapsis) r_p is closer. Choosing either mode dynamically derives the corresponding parameter."
                unit="km"
                formula="b = r_p · √(1 + 2μ / (r_p · v_∞²))"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                onChangeDistanceMode(
                  distanceMode === 'PERIAPSIS_ALTITUDE' ? 'IMPACT_PARAMETER' : 'PERIAPSIS_ALTITUDE'
                );
              }}
              className="text-[9px] text-sky-400 hover:text-sky-300 underline font-bold cursor-pointer"
            >
              [SWITCH TO {distanceMode === 'PERIAPSIS_ALTITUDE' ? 'b' : 'h_p'}]
            </button>
          </div>

          {/* Conditional Input based on distanceMode */}
          {distanceMode === 'PERIAPSIS_ALTITUDE' ? (
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="-2000"
                max={Math.max(100000, planetRadiusKm * 3)}
                step="500"
                value={periapsisAltitudeKm}
                onChange={(e) => handleAltitudeChange(parseFloat(e.target.value))}
                className={`w-full h-1.5 rounded-sm cursor-pointer ${
                  hazards.isCollision ? 'accent-rose-500 bg-rose-950' : 'accent-sky-500 bg-neutral-800'
                }`}
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="500"
                  value={periapsisAltitudeKm.toFixed(0)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      handleAltitudeChange(val);
                    }
                  }}
                  className={`w-20 bg-[#141826] border px-1.5 py-0.5 rounded-xs text-right font-bold text-xs ${
                    hazards.isCollision
                      ? 'border-rose-500 text-rose-300'
                      : 'border-[#283148] text-sky-300'
                  }`}
                />
                <UnitBadge unit="km" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max={Math.max(150000, planetRadiusKm * 4)}
                step="1000"
                value={impactParameterKm}
                onChange={(e) => handleImpactParameterChange(parseFloat(e.target.value))}
                className="w-full accent-sky-500 bg-neutral-800 h-1.5 rounded-sm cursor-pointer"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="1000"
                  min="0"
                  value={impactParameterKm.toFixed(0)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0) {
                      handleImpactParameterChange(val);
                    }
                  }}
                  className="w-20 bg-[#141826] border border-[#283148] px-1.5 py-0.5 rounded-xs text-right text-sky-300 font-bold text-xs"
                />
                <UnitBadge unit="km" />
              </div>
            </div>
          )}

          {/* Coupling feedback display */}
          <div className="flex justify-between items-center text-[9px] text-neutral-400">
            <span>
              {distanceMode === 'PERIAPSIS_ALTITUDE'
                ? `Derived Impact Param b: ${impactParameterKm.toFixed(0)} km`
                : `Derived Altitude h_p: ${periapsisAltitudeKm.toFixed(0)} km`}
            </span>
            <span className={hazards.isCollision ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
              r_p: {periapsisRadiusKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
            </span>
          </div>
        </div>

        {/* 4. Approach Angle & Informational Spacecraft Mass */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <label className="text-neutral-400 font-bold uppercase text-[10px]">
                APPROACH ANGLE (ψ)
              </label>
              <ParameterTooltip
                title="Incoming Direction Angle (ψ)"
                description="Orientation of the incoming asymptotic velocity vector relative to planetary orbital motion in the ecliptic/orbit plane. Modulates heliocentric velocity vector addition."
                unit="deg"
              />
            </div>
            <div className="flex items-center gap-1">
              <UnitBadge unit="deg" />
              <span className="text-amber-400 font-bold">{approachAngleDeg}°</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min="-180"
              max="180"
              step="5"
              value={approachAngleDeg}
              onChange={(e) => onChangeApproachAngle(parseFloat(e.target.value))}
              className="w-full accent-amber-500 bg-neutral-800 h-1.5 rounded-sm cursor-pointer"
            />
            <input
              type="number"
              step="5"
              min="-360"
              max="360"
              value={approachAngleDeg}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) onChangeApproachAngle(val);
              }}
              className="w-14 bg-[#141826] border border-[#283148] px-1.5 py-0.5 rounded-xs text-right text-white font-bold text-xs"
            />
          </div>

          <div className="flex items-center justify-between text-[9px] pt-0.5 border-t border-[#181d2c]">
            <span className="text-neutral-500">Spacecraft Mass:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                step="100"
                value={spacecraftMassKg}
                onChange={(e) => {
                  const m = parseFloat(e.target.value);
                  if (!isNaN(m) && m > 0) onChangeSpacecraftMass(m);
                }}
                className="w-16 bg-[#121522] border border-[#252c40] px-1 py-0.5 rounded-xs text-right text-neutral-300 text-[10px]"
              />
              <UnitBadge unit="kg" />
            </div>
          </div>
        </div>
      </div>

      {/* Surface Collision & Hazard Banners */}
      {hazards.isCollision && (
        <div className="p-3 bg-rose-950/70 border border-rose-600/70 rounded-xs flex items-center gap-2.5 text-rose-200 text-xs">
          <ShieldAlert size={18} className="text-rose-400 flex-shrink-0" />
          <div className="flex flex-col">
            <span className="font-bold text-rose-300">
              DIRECT SURFACE COLLISION HAZARD:
            </span>
            <span className="text-[11px] leading-relaxed">
              Periapsis altitude is {periapsisAltitudeKm.toFixed(1)} km, which impacts inside the planet's physical surface
              radius ({planetRadiusKm.toLocaleString()} km). In numerical integration, trajectory terminates on collision.
            </span>
          </div>
        </div>
      )}

      {!hazards.isCollision && hazards.isUnrealisticClosestApproach && (
        <div className="p-2.5 bg-amber-950/60 border border-amber-600/60 rounded-xs flex items-center gap-2 text-amber-200 text-xs">
          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
          <div className="flex flex-col">
            <span className="font-bold text-amber-300">
              ATMOSPHERIC GRAZING / TIDAL HAZARD:
            </span>
            <span className="text-[11px] leading-relaxed">
              Closest approach altitude ({periapsisAltitudeKm.toFixed(0)} km) is within dense atmospheric entry boundaries
              or severe aerodynamic heating envelope (&lt; 100 km).
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
