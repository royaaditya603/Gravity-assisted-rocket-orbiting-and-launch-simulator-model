import React from 'react';
import { ParameterTooltip, UnitBadge } from './ParameterTooltip';
import { Target, Zap, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';

export interface NumericalStateControlsProps {
  customInitialState?: {
    enabled: boolean;
    positionKm: { x: number; y: number; z: number };
    velocityKmPerS: { x: number; y: number; z: number };
  };
  planetRadiusM: number;
  planetMu: number;
  periapsisAltitudeKm: number;
  impactParameterKm: number;
  vInfSpeedMPerS: number;
  onChangeCustomInitialState: (
    updater: (prev: {
      enabled: boolean;
      positionKm: { x: number; y: number; z: number };
      velocityKmPerS: { x: number; y: number; z: number };
    }) => {
      enabled: boolean;
      positionKm: { x: number; y: number; z: number };
      velocityKmPerS: { x: number; y: number; z: number };
    }
  ) => void;
}

export const NumericalStateControls: React.FC<NumericalStateControlsProps> = ({
  customInitialState,
  planetRadiusM,
  planetMu,
  periapsisAltitudeKm,
  impactParameterKm,
  vInfSpeedMPerS,
  onChangeCustomInitialState,
}) => {
  const planetRadiusKm = planetRadiusM / 1000.0;

  const state = customInitialState || {
    enabled: false,
    positionKm: { x: -planetRadiusKm * 10, y: impactParameterKm || 40000, z: 0 },
    velocityKmPerS: { x: vInfSpeedMPerS / 1000.0, y: 0, z: 0 },
  };

  const currentRadiusKm = Math.sqrt(
    state.positionKm.x ** 2 + state.positionKm.y ** 2 + state.positionKm.z ** 2
  );
  const currentSpeedKmPerS = Math.sqrt(
    state.velocityKmPerS.x ** 2 + state.velocityKmPerS.y ** 2 + state.velocityKmPerS.z ** 2
  );

  const isInsidePlanet = state.enabled && currentRadiusKm < planetRadiusKm;

  // Preset generators
  const handleSetAsymptoticState = () => {
    const entryDistKm = Math.max(planetRadiusKm * 15, 200000);
    const bKm = impactParameterKm || 50000;
    const xInit = -Math.sqrt(Math.max(1, entryDistKm ** 2 - bKm ** 2));
    const vKmS = vInfSpeedMPerS / 1000.0;

    onChangeCustomInitialState(() => ({
      enabled: true,
      positionKm: { x: parseFloat(xInit.toFixed(1)), y: parseFloat(bKm.toFixed(1)), z: 0 },
      velocityKmPerS: { x: parseFloat(vKmS.toFixed(2)), y: 0, z: 0 },
    }));
  };

  const handleSetPeriapsisState = () => {
    const rpKm = planetRadiusKm + Math.max(100, periapsisAltitudeKm);
    const rpM = rpKm * 1000.0;
    const vpMPerS = Math.sqrt(vInfSpeedMPerS ** 2 + (2.0 * planetMu) / rpM);
    const vpKmS = vpMPerS / 1000.0;

    onChangeCustomInitialState(() => ({
      enabled: true,
      positionKm: { x: 0, y: parseFloat(rpKm.toFixed(1)), z: 0 },
      velocityKmPerS: { x: parseFloat(vpKmS.toFixed(2)), y: 0, z: 0 },
    }));
  };

  return (
    <div className="bg-[#0b0c13] border border-[#1f2538] p-3.5 rounded-xs flex flex-col gap-3 font-mono text-white text-xs">
      {/* Header and Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1b2132] pb-2">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-purple-400" />
          <span className="font-bold text-purple-300 uppercase">
            NUMERICAL INTEGRATION INITIAL STATE OVERRIDE (r₀, v₀)
          </span>
          <ParameterTooltip
            title="Custom Numerical Initial State"
            description="Allows direct definition of Cartesian position (x, y, z) and velocity (vx, vy, vz) state vectors in the planet-centric frame. Overrides asymptotic inflow and seeds the numerical integrator directly."
            formula="r₀ = [x, y, z] km,  v₀ = [v_x, v_y, v_z] km/s"
          />
        </div>

        <label className="flex items-center gap-1.5 cursor-pointer bg-[#141826] px-2.5 py-1 rounded-xs border border-[#273046]">
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(e) => {
              const checked = e.target.checked;
              onChangeCustomInitialState((prev) => ({
                ...prev,
                enabled: checked,
              }));
            }}
            className="accent-purple-500 cursor-pointer"
          />
          <span className="font-bold text-neutral-300 text-[10px]">
            {state.enabled ? 'OVERRIDE ACTIVE' : 'ENABLE CUSTOM (r₀, v₀)'}
          </span>
        </label>
      </div>

      {state.enabled && (
        <div className="flex flex-col gap-3">
          <div className="text-[10px] text-neutral-400 leading-relaxed bg-[#101320] p-2 rounded-xs border border-[#1c2236]">
            When active, numerical integration starts precisely at these 3D coordinates rather than
            generating an asymptotic hyperbolic approach from SOI. All values are in the planet-centric
            inertial frame.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Position Vector [x, y, z] */}
            <div className="flex flex-col gap-1.5 bg-[#121522] p-2.5 rounded-xs border border-[#1f263a]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-400 font-bold uppercase">
                  INITIAL POSITION VECTOR (r₀)
                </span>
                <UnitBadge unit="km" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[9px] text-neutral-500">X (km)</span>
                  <input
                    type="number"
                    step="1000"
                    value={state.positionKm.x}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      onChangeCustomInitialState((prev) => ({
                        ...prev,
                        positionKm: { ...prev.positionKm, x: val },
                      }));
                    }}
                    className="w-full bg-[#161a29] border border-[#28324a] px-2 py-1 rounded-xs text-white"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-neutral-500">Y (km)</span>
                  <input
                    type="number"
                    step="1000"
                    value={state.positionKm.y}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      onChangeCustomInitialState((prev) => ({
                        ...prev,
                        positionKm: { ...prev.positionKm, y: val },
                      }));
                    }}
                    className="w-full bg-[#161a29] border border-[#28324a] px-2 py-1 rounded-xs text-white"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-neutral-500">Z (km)</span>
                  <input
                    type="number"
                    step="1000"
                    value={state.positionKm.z}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      onChangeCustomInitialState((prev) => ({
                        ...prev,
                        positionKm: { ...prev.positionKm, z: val },
                      }));
                    }}
                    className="w-full bg-[#161a29] border border-[#28324a] px-2 py-1 rounded-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-between text-[9px] text-neutral-400 pt-1">
                <span>||r₀||: {currentRadiusKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km</span>
                <span className={isInsidePlanet ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                  {isInsidePlanet ? 'INSIDE PLANET (Collision)' : 'OUTSIDE SURFACE'}
                </span>
              </div>
            </div>

            {/* Velocity Vector [vx, vy, vz] */}
            <div className="flex flex-col gap-1.5 bg-[#121522] p-2.5 rounded-xs border border-[#1f263a]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-400 font-bold uppercase">
                  INITIAL VELOCITY VECTOR (v₀)
                </span>
                <UnitBadge unit="km/s" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[9px] text-neutral-500">Vx (km/s)</span>
                  <input
                    type="number"
                    step="0.5"
                    value={state.velocityKmPerS.x}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      onChangeCustomInitialState((prev) => ({
                        ...prev,
                        velocityKmPerS: { ...prev.velocityKmPerS, x: val },
                      }));
                    }}
                    className="w-full bg-[#161a29] border border-[#28324a] px-2 py-1 rounded-xs text-amber-300 font-bold"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-neutral-500">Vy (km/s)</span>
                  <input
                    type="number"
                    step="0.5"
                    value={state.velocityKmPerS.y}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      onChangeCustomInitialState((prev) => ({
                        ...prev,
                        velocityKmPerS: { ...prev.velocityKmPerS, y: val },
                      }));
                    }}
                    className="w-full bg-[#161a29] border border-[#28324a] px-2 py-1 rounded-xs text-amber-300 font-bold"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-neutral-500">Vz (km/s)</span>
                  <input
                    type="number"
                    step="0.5"
                    value={state.velocityKmPerS.z}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      onChangeCustomInitialState((prev) => ({
                        ...prev,
                        velocityKmPerS: { ...prev.velocityKmPerS, z: val },
                      }));
                    }}
                    className="w-full bg-[#161a29] border border-[#28324a] px-2 py-1 rounded-xs text-amber-300 font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-between text-[9px] text-neutral-400 pt-1">
                <span>Speed ||v₀||: {currentSpeedKmPerS.toFixed(2)} km/s</span>
                <span className="text-sky-400">{(currentSpeedKmPerS * 1000).toLocaleString()} m/s</span>
              </div>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1a1f2e] pt-2">
            <span className="text-[10px] text-neutral-500">QUICK VECTOR PRESETS:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSetAsymptoticState}
                className="px-2 py-1 bg-[#161a29] hover:bg-[#20273d] text-neutral-200 border border-[#273046] rounded-xs text-[10px] cursor-pointer"
              >
                Inflow at Ingress
              </button>
              <button
                type="button"
                onClick={handleSetPeriapsisState}
                className="px-2 py-1 bg-[#161a29] hover:bg-[#20273d] text-neutral-200 border border-[#273046] rounded-xs text-[10px] cursor-pointer"
              >
                Periapsis Point (r_p, v_p)
              </button>
            </div>
          </div>

          {isInsidePlanet && (
            <div className="p-2 bg-rose-950/70 border border-rose-600/70 rounded-xs flex items-center gap-2 text-rose-200 text-[11px]">
              <AlertTriangle size={14} className="text-rose-400 flex-shrink-0" />
              <span>
                Warning: Initial position magnitude ({currentRadiusKm.toFixed(0)} km) is inside the planet's
                physical surface radius ({planetRadiusKm.toLocaleString()} km).
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
