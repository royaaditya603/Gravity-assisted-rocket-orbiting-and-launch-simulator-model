import React from 'react';
import { FlybyPassType } from '../../../physics/FlybyEngine';
import {
  EncounterDistanceMode,
  syncAltitudeAndImpactParameter,
  checkClosestApproachHazards,
} from '../../../physics/FlybyScenario';
import { ParameterTooltip, UnitBadge } from './ParameterTooltip';
import { Compass, ShieldAlert, AlertTriangle } from 'lucide-react';

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
      'PERIAPSIS_ALTITUDE',
      planetRadiusM,
      val,
      planetMu
    );
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
    onChangeImpactParameter(newBKm);

    const synced = syncAltitudeAndImpactParameter(
      periapsisAltitudeKm,
      newBKm,
      'IMPACT_PARAMETER',
      planetRadiusM,
      vInfSpeedMPerS,
      planetMu
    );
    onChangePeriapsisAltitude(synced.periapsisAltitudeKm);
  };

  return (
    <div className="flex flex-col gap-4 font-mono text-[#263247]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE3EE] pb-2">
        <div className="flex items-center gap-1.5">
          <Compass size={14} className="text-[#0284C7]" />
          <span className="text-[11px] font-bold text-[#263247] uppercase">
            FLYBY ENCOUNTER GEOMETRY & TRAJECTORY PARAMETERS:
          </span>
          <ParameterTooltip
            title="Flyby Geometry Specification"
            description="Defines the incoming hyperbolic trajectory relative to the planet: excess speed v_inf, closest approach periapsis altitude h_p, impact parameter b, and orbital pass type."
            formula="rp = Rp + hp,  b = rp · √(1 + 2μ / (rp · v_∞²))"
          />
        </div>
        <span className="text-[10px] text-[#68758A]">
          Two-Body Patched Conic / Planar Hyperbolic Encounter
        </span>
      </div>

      {/* Grid of Encounter Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* 1. Flyby Side / Orientation */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <label className="text-[#68758A] font-bold uppercase text-[10px]">
                FLYBY ORIENTATION
              </label>
              <ParameterTooltip
                title="Flyby Orientation"
                description="Trailing pass passes behind the planet along its orbital motion vector, gaining heliocentric velocity (+ΔV boost). Leading pass passes in front, braking and losing heliocentric velocity (-ΔV drop)."
                formula="Trailing: +ΔV (Gain) | Leading: -ΔV (Braking)"
              />
            </div>
            <span className="text-[9px] text-[#68758A] font-bold">PASS TYPE</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onChangePassType('TRAILING')}
              className={`py-2 px-2 text-[11px] font-bold rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                passType === 'TRAILING'
                  ? 'bg-[#FFD2B8] text-[#7A3E1D] border-[#FFD2B8] shadow-xs ring-2 ring-[#FFD2B8]/60'
                  : 'bg-[#F8FAFD] text-[#68758A] hover:bg-[#EEF2F8] border-[#DCE3EE]'
              }`}
            >
              <span>TRAILING (+ΔV)</span>
              <span className={`text-[8px] ${passType === 'TRAILING' ? 'text-[#7A3E1D]/80' : 'text-[#68758A]'}`}>
                ACCELERATION
              </span>
            </button>

            <button
              type="button"
              onClick={() => onChangePassType('LEADING')}
              className={`py-2 px-2 text-[11px] font-bold rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                passType === 'LEADING'
                  ? 'bg-[#F2B9C6] text-[#83263E] border-[#F2B9C6] shadow-xs ring-2 ring-[#F2B9C6]/60'
                  : 'bg-[#F8FAFD] text-[#68758A] hover:bg-[#EEF2F8] border-[#DCE3EE]'
              }`}
            >
              <span>LEADING (-ΔV)</span>
              <span className={`text-[8px] ${passType === 'LEADING' ? 'text-[#83263E]/80' : 'text-[#68758A]'}`}>
                DECELERATION
              </span>
            </button>
          </div>

          <span className="text-[9px] text-[#68758A] leading-tight">
            {passType === 'TRAILING'
              ? 'Behind planet: pulls probe forward along orbit'
              : 'Ahead of planet: pulls probe backward against orbit'}
          </span>
        </div>

        {/* 2. Incoming Asymptotic Speed v_inf */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <label className="text-[#68758A] font-bold uppercase text-[10px]">
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
              <span className="text-[#B45309] font-bold">{vInfKmS.toFixed(2)}</span>
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
              className="w-full accent-[#0284C7] bg-[#EEF2F8] h-1.5 rounded-sm cursor-pointer"
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
              className="w-16 bg-white border border-[#DCE3EE] px-1.5 py-0.5 rounded-lg text-right text-[#14426B] font-bold text-xs shadow-2xs"
            />
          </div>

          <div className="flex justify-between text-[9px] text-[#68758A]">
            <span>Range: 1.0 – 35.0 km/s</span>
            <span>{(vInfSpeedMPerS).toLocaleString()} m/s</span>
          </div>
        </div>

        {/* 3. Encounter Distance Mode Toggle & Inputs (Altitude vs Impact Parameter) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <label className="text-[#68758A] font-bold uppercase text-[10px]">
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
              className="text-[9px] text-[#0284C7] hover:underline font-bold cursor-pointer"
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
                  hazards.isCollision ? 'accent-[#DC2626] bg-[#FEE2E2]' : 'accent-[#0284C7] bg-[#EEF2F8]'
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
                  className={`w-20 bg-white border px-1.5 py-0.5 rounded-lg text-right font-bold text-xs shadow-2xs ${
                    hazards.isCollision
                      ? 'border-[#FCA5A5] text-[#DC2626]'
                      : 'border-[#DCE3EE] text-[#14426B]'
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
                className="w-full accent-[#0284C7] bg-[#EEF2F8] h-1.5 rounded-sm cursor-pointer"
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
                  className="w-20 bg-white border border-[#DCE3EE] px-1.5 py-0.5 rounded-lg text-right text-[#14426B] font-bold text-xs shadow-2xs"
                />
                <UnitBadge unit="km" />
              </div>
            </div>
          )}

          {/* Coupling feedback display */}
          <div className="flex justify-between items-center text-[9px] text-[#68758A]">
            <span>
              {distanceMode === 'PERIAPSIS_ALTITUDE'
                ? `Derived Impact Param b: ${impactParameterKm.toFixed(0)} km`
                : `Derived Altitude h_p: ${periapsisAltitudeKm.toFixed(0)} km`}
            </span>
            <span className={hazards.isCollision ? 'text-[#DC2626] font-bold' : 'text-[#059669]'}>
              r_p: {periapsisRadiusKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
            </span>
          </div>
        </div>

        {/* 4. Approach Angle & Informational Spacecraft Mass */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <label className="text-[#68758A] font-bold uppercase text-[10px]">
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
              <span className="text-[#B45309] font-bold">{approachAngleDeg}°</span>
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
              className="w-full accent-[#0284C7] bg-[#EEF2F8] h-1.5 rounded-sm cursor-pointer"
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
              className="w-14 bg-white border border-[#DCE3EE] px-1.5 py-0.5 rounded-lg text-right text-[#263247] font-bold text-xs shadow-2xs"
            />
          </div>

          <div className="flex items-center justify-between text-[9px] pt-0.5 border-t border-[#DCE3EE]">
            <span className="text-[#68758A]">Spacecraft Mass:</span>
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
                className="w-16 bg-white border border-[#DCE3EE] px-1 py-0.5 rounded-lg text-right text-[#263247] text-[10px] shadow-2xs"
              />
              <UnitBadge unit="kg" />
            </div>
          </div>
        </div>
      </div>

      {/* Surface Collision & Hazard Banners */}
      {hazards.isCollision && (
        <div className="p-3 bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl flex items-center gap-2.5 text-[#991B1B] text-xs shadow-2xs">
          <ShieldAlert size={18} className="text-[#DC2626] flex-shrink-0" />
          <div className="flex flex-col">
            <span className="font-bold text-[#991B1B]">
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
        <div className="p-2.5 bg-[#FEF3C7] border border-[#FCD34D] rounded-xl flex items-center gap-2 text-[#92400E] text-xs shadow-2xs">
          <AlertTriangle size={16} className="text-[#D97706] flex-shrink-0" />
          <div className="flex flex-col">
            <span className="font-bold text-[#92400E]">
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
