import React from 'react';
import { AU } from '../../../physics/constants';
import { computeCircularOrbitalSpeed, PlanetVelocityMode } from '../../../physics/FlybyScenario';
import { ParameterTooltip, UnitBadge } from './ParameterTooltip';
import { Settings2, Sliders, Cpu, Compass, Info } from 'lucide-react';

export interface AdvancedSimulationSettingsProps {
  advanced: {
    timeStepCoeff: number;
    fixedTimeStepS?: number;
    numericalTolerance?: number;
    entryDistanceMultiple: number;
    simulationDurationS?: number;
    trajectoryMode: 'NUMERICAL_RK4' | 'ANALYTICAL_IDEAL';
  };
  onChangeAdvanced: (updater: (prev: any) => any) => void;
  planetVelocityMode: PlanetVelocityMode;
  onChangePlanetVelocityMode: (mode: PlanetVelocityMode) => void;
  semiMajorAxisM: number;
  orbitalSpeedMPerS: number;
  customVelocityVectorMPerS: { x: number; y: number; z: number };
  onChangeOrbitalParams: (updater: (prev: any) => any) => void;
}

export const AdvancedSimulationSettings: React.FC<AdvancedSimulationSettingsProps> = ({
  advanced,
  onChangeAdvanced,
  planetVelocityMode,
  onChangePlanetVelocityMode,
  semiMajorAxisM,
  orbitalSpeedMPerS,
  customVelocityVectorMPerS,
  onChangeOrbitalParams,
}) => {
  return (
    <div className="bg-[#0b0c13] border border-[#23293d] p-4 rounded-xs flex flex-col gap-4 font-mono text-white text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2234] pb-2">
        <div className="flex items-center gap-2">
          <Settings2 size={14} className="text-purple-400" />
          <span className="font-bold text-purple-300 uppercase">
            ADVANCED SIMULATION SETTINGS & ASTRODYNAMIC CONSTANTS
          </span>
          <ParameterTooltip
            title="Advanced Simulation Parameters"
            description="Fine-tune numerical integrator tolerance, discrete fixed/adaptive time steps, integration boundary distances, and planetary heliocentric orbital kinematics."
          />
        </div>
        <span className="text-[10px] text-neutral-400">SI Units (m, s, kg, rad)</span>
      </div>

      {/* Row 1: Integrator Method & Time Stepping */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Trajectory Calculation Mode */}
        <div className="flex flex-col gap-1.5 bg-[#121522] p-2.5 rounded-xs border border-[#1e2538]">
          <div className="flex items-center justify-between">
            <label className="text-neutral-400 font-bold uppercase text-[10px]">
              CALCULATION METHOD
            </label>
            <Cpu size={12} className="text-purple-400" />
          </div>
          <div className="grid grid-cols-2 gap-1 pt-0.5">
            <button
              type="button"
              onClick={() => {
                onChangeAdvanced((prev: any) => ({
                  ...prev,
                  trajectoryMode: 'NUMERICAL_RK4',
                }));
              }}
              className={`py-1 px-1.5 rounded-xs text-[10px] font-bold border transition-colors cursor-pointer ${
                advanced.trajectoryMode === 'NUMERICAL_RK4'
                  ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                  : 'bg-[#151928] text-neutral-400 border-[#252d42] hover:text-white'
              }`}
            >
              NUMERICAL (RK4)
            </button>
            <button
              type="button"
              onClick={() => {
                onChangeAdvanced((prev: any) => ({
                  ...prev,
                  trajectoryMode: 'ANALYTICAL_IDEAL',
                }));
              }}
              className={`py-1 px-1.5 rounded-xs text-[10px] font-bold border transition-colors cursor-pointer ${
                advanced.trajectoryMode === 'ANALYTICAL_IDEAL'
                  ? 'bg-amber-500 text-black border-amber-400 shadow-sm'
                  : 'bg-[#151928] text-neutral-400 border-[#252d42] hover:text-white'
              }`}
            >
              ANALYTICAL
            </button>
          </div>
          <span className="text-[9px] text-neutral-500">
            {advanced.trajectoryMode === 'NUMERICAL_RK4'
              ? 'Fourth-order Runge-Kutta numerical integrator'
              : 'Exact Keplerian hyperbolic conic equations'}
          </span>
        </div>

        {/* Adaptive Time Step Coefficient / Fixed Step */}
        <div className="flex flex-col gap-1.5 bg-[#121522] p-2.5 rounded-xs border border-[#1e2538]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <label className="text-neutral-400 font-bold uppercase text-[10px]">
                TIME-STEP COEFF (η)
              </label>
              <ParameterTooltip
                title="Adaptive Time-Step Coefficient (η)"
                description="Controls sub-step discretization near periapsis. Smaller values yield finer numerical resolution and higher energy conservation, at the cost of more computation."
                formula="dt ~ η · r / ||v||"
              />
            </div>
            <span className="text-purple-300 font-bold text-[10px]">
              {advanced.timeStepCoeff}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0.002"
              max="0.1"
              step="0.002"
              value={advanced.timeStepCoeff}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (val > 0) {
                  onChangeAdvanced((prev: any) => ({
                    ...prev,
                    timeStepCoeff: val,
                  }));
                }
              }}
              className="w-full accent-purple-500 bg-neutral-800 h-1.5 rounded-sm cursor-pointer"
            />
            <input
              type="number"
              step="0.005"
              min="0.001"
              max="0.2"
              value={advanced.timeStepCoeff}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) {
                  onChangeAdvanced((prev: any) => ({
                    ...prev,
                    timeStepCoeff: val,
                  }));
                }
              }}
              className="w-16 bg-[#161a29] border border-[#273046] px-1 py-0.5 rounded-xs text-right text-white text-[10px]"
            />
          </div>

          <div className="flex justify-between text-[9px] text-neutral-500">
            <span>Fine (0.005)</span>
            <span>Default: 0.015</span>
            <span>Coarse (0.05)</span>
          </div>
        </div>

        {/* Simulation Duration / Window */}
        <div className="flex flex-col gap-1.5 bg-[#121522] p-2.5 rounded-xs border border-[#1e2538]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <label className="text-neutral-400 font-bold uppercase text-[10px]">
                SIMULATION DURATION
              </label>
              <ParameterTooltip
                title="Simulation Duration"
                description="Total integration duration in seconds. If left blank, ASTRA calculates the asymptotic transit window automatically from entry to exit of SOI."
                unit="s"
              />
            </div>
            <UnitBadge unit="s" />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              step="1000"
              min="500"
              placeholder="Auto-calculated"
              value={advanced.simulationDurationS ?? ''}
              onChange={(e) => {
                const val = e.target.value ? parseFloat(e.target.value) : undefined;
                onChangeAdvanced((prev: any) => ({
                  ...prev,
                  simulationDurationS: val && !isNaN(val) && val > 0 ? val : undefined,
                }));
              }}
              className="w-full bg-[#161a29] border border-[#273046] px-2 py-1 rounded-xs text-white placeholder-neutral-600"
            />
            {advanced.simulationDurationS !== undefined && (
              <button
                type="button"
                onClick={() => {
                  onChangeAdvanced((prev: any) => ({
                    ...prev,
                    simulationDurationS: undefined,
                  }));
                }}
                className="text-[9px] text-neutral-400 hover:text-white px-1.5 py-1 bg-[#1a1f30] rounded-xs border border-[#2b344c]"
                title="Reset to automatic duration"
              >
                Auto
              </button>
            )}
          </div>

          <span className="text-[9px] text-neutral-500">
            {advanced.simulationDurationS !== undefined
              ? `${(advanced.simulationDurationS / 3600).toFixed(1)} hours`
              : 'Auto: Asymptotic entry to exit window'}
          </span>
        </div>
      </div>

      {/* Row 2: Heliocentric Planetary Motion & Kinematics */}
      <div className="border-t border-[#1c2234] pt-3 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Compass size={13} className="text-sky-400" />
            <span className="text-[11px] font-bold text-neutral-300 uppercase">
              HELIOCENTRIC PLANETARY ORBIT KINEMATICS:
            </span>
          </div>

          <div className="flex items-center gap-1 bg-[#131624] p-0.5 rounded-xs border border-[#22293c]">
            <button
              type="button"
              onClick={() => onChangePlanetVelocityMode('CIRCULAR_ORBIT')}
              className={`px-2.5 py-0.5 rounded-xs text-[10px] font-bold transition-colors cursor-pointer ${
                planetVelocityMode === 'CIRCULAR_ORBIT'
                  ? 'bg-sky-500 text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              CIRCULAR ORBIT APPROXIMATION
            </button>
            <button
              type="button"
              onClick={() => onChangePlanetVelocityMode('CUSTOM_VECTOR')}
              className={`px-2.5 py-0.5 rounded-xs text-[10px] font-bold transition-colors cursor-pointer ${
                planetVelocityMode === 'CUSTOM_VECTOR'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              CUSTOM SUN VELOCITY VECTOR
            </button>
          </div>
        </div>

        {planetVelocityMode === 'CIRCULAR_ORBIT' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#111420] p-2.5 rounded-xs border border-[#1d2336]">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-400 font-bold">SEMI-MAJOR AXIS (a)</span>
                <UnitBadge unit="AU" />
              </div>
              <input
                type="number"
                step="0.05"
                min="0.1"
                value={(semiMajorAxisM / AU).toFixed(3)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    const aM = val * AU;
                    const spd = computeCircularOrbitalSpeed(aM);
                    onChangeOrbitalParams((prev: any) => ({
                      ...prev,
                      semiMajorAxisM: aM,
                      orbitalSpeedMPerS: spd,
                      customVelocityVectorMPerS: { x: 0, y: spd, z: 0 },
                    }));
                  }
                }}
                className="bg-[#161a29] border border-[#28324a] px-2 py-1 rounded-xs text-white"
              />
              <span className="text-[9px] text-neutral-500">
                {(semiMajorAxisM / 1e9).toFixed(1)} million km from Sun
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-400 font-bold">ORBITAL SPEED (v_orb)</span>
                <UnitBadge unit="km/s" />
              </div>
              <div className="bg-[#161a29] border border-[#28324a] px-2 py-1 rounded-xs text-emerald-400 font-bold">
                {(orbitalSpeedMPerS / 1000).toFixed(2)} km/s
              </div>
              <span className="text-[9px] text-neutral-500">
                Derived via v = √(μ_sun / a)
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-400 font-bold">ENTRY DISTANCE MULTIPLE</span>
                <UnitBadge unit="× r_p" />
              </div>
              <input
                type="number"
                step="5"
                min="5"
                max="100"
                value={advanced.entryDistanceMultiple}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 5) {
                    onChangeAdvanced((prev: any) => ({
                      ...prev,
                      entryDistanceMultiple: val,
                    }));
                  }
                }}
                className="bg-[#161a29] border border-[#28324a] px-2 py-1 rounded-xs text-white"
              />
              <span className="text-[9px] text-neutral-500">
                Asymptotic integration start boundary (default 20×)
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 bg-[#111420] p-2.5 rounded-xs border border-[#1d2336]">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-400 font-bold">V_planet X</span>
                <UnitBadge unit="km/s" />
              </div>
              <input
                type="number"
                step="0.5"
                value={(customVelocityVectorMPerS.x / 1000).toFixed(2)}
                onChange={(e) => {
                  const vx = parseFloat(e.target.value) * 1000.0;
                  onChangeOrbitalParams((prev: any) => ({
                    ...prev,
                    customVelocityVectorMPerS: { ...prev.customVelocityVectorMPerS, x: vx },
                  }));
                }}
                className="bg-[#161a29] border border-[#28324a] px-2 py-1 rounded-xs text-white font-bold"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-400 font-bold">V_planet Y</span>
                <UnitBadge unit="km/s" />
              </div>
              <input
                type="number"
                step="0.5"
                value={(customVelocityVectorMPerS.y / 1000).toFixed(2)}
                onChange={(e) => {
                  const vy = parseFloat(e.target.value) * 1000.0;
                  onChangeOrbitalParams((prev: any) => ({
                    ...prev,
                    customVelocityVectorMPerS: { ...prev.customVelocityVectorMPerS, y: vy },
                  }));
                }}
                className="bg-[#161a29] border border-[#28324a] px-2 py-1 rounded-xs text-white font-bold"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-400 font-bold">V_planet Z</span>
                <UnitBadge unit="km/s" />
              </div>
              <input
                type="number"
                step="0.5"
                value={(customVelocityVectorMPerS.z / 1000).toFixed(2)}
                onChange={(e) => {
                  const vz = parseFloat(e.target.value) * 1000.0;
                  onChangeOrbitalParams((prev: any) => ({
                    ...prev,
                    customVelocityVectorMPerS: { ...prev.customVelocityVectorMPerS, z: vz },
                  }));
                }}
                className="bg-[#161a29] border border-[#28324a] px-2 py-1 rounded-xs text-white font-bold"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
