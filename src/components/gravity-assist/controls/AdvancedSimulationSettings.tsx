import React from 'react';
import { AU } from '../../../physics/constants';
import { computeCircularOrbitalSpeed, PlanetVelocityMode } from '../../../physics/FlybyScenario';
import { ParameterTooltip, UnitBadge } from './ParameterTooltip';
import { Settings2, Cpu, Compass } from 'lucide-react';

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
    <div className="bg-[#F8FAFD] border border-[#DCE3EE] p-4 rounded-xl flex flex-col gap-4 font-mono text-[#263247] text-xs shadow-2xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE3EE] pb-2">
        <div className="flex items-center gap-2">
          <Settings2 size={14} className="text-[#7C3AED]" />
          <span className="font-bold text-[#4A347F] uppercase">
            ADVANCED SIMULATION SETTINGS & ASTRODYNAMIC CONSTANTS
          </span>
          <ParameterTooltip
            title="Advanced Simulation Parameters"
            description="Fine-tune numerical integrator tolerance, discrete fixed/adaptive time steps, integration boundary distances, and planetary heliocentric orbital kinematics."
          />
        </div>
        <span className="text-[10px] text-[#68758A]">SI Units (m, s, kg, rad)</span>
      </div>

      {/* Row 1: Integrator Method & Time Stepping */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Trajectory Calculation Mode */}
        <div className="flex flex-col gap-1.5 bg-white p-3 rounded-lg border border-[#DCE3EE] shadow-2xs">
          <div className="flex items-center justify-between">
            <label className="text-[#68758A] font-bold uppercase text-[10px]">
              CALCULATION METHOD
            </label>
            <Cpu size={12} className="text-[#7C3AED]" />
          </div>
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => {
                onChangeAdvanced((prev: any) => ({
                  ...prev,
                  trajectoryMode: 'NUMERICAL_RK4',
                }));
              }}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                advanced.trajectoryMode === 'NUMERICAL_RK4'
                  ? 'bg-[#C9BDF2]/50 text-[#4A347F] border-[#C9BDF2] shadow-2xs'
                  : 'bg-[#F8FAFD] text-[#68758A] border-[#DCE3EE] hover:text-[#263247]'
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
              className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                advanced.trajectoryMode === 'ANALYTICAL_IDEAL'
                  ? 'bg-[#A9D4F5] text-[#14426B] border-[#A9D4F5] shadow-2xs'
                  : 'bg-[#F8FAFD] text-[#68758A] border-[#DCE3EE] hover:text-[#263247]'
              }`}
            >
              ANALYTICAL
            </button>
          </div>
          <span className="text-[9px] text-[#68758A]">
            {advanced.trajectoryMode === 'NUMERICAL_RK4'
              ? 'Fourth-order Runge-Kutta numerical integrator'
              : 'Exact Keplerian hyperbolic conic equations'}
          </span>
        </div>

        {/* Adaptive Integration Time Step Coefficient */}
        <div className="flex flex-col gap-1.5 bg-white p-3 rounded-lg border border-[#DCE3EE] shadow-2xs">
          <div className="flex items-center justify-between">
            <label className="text-[#68758A] font-bold uppercase text-[10px]">
              TIME STEP FACTOR (η)
            </label>
            <UnitBadge unit="ratio" />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0.005"
              max="0.1"
              step="0.005"
              value={advanced.timeStepCoeff}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onChangeAdvanced((prev: any) => ({
                  ...prev,
                  timeStepCoeff: val,
                }));
              }}
              className="w-full accent-[#0284C7] bg-[#EEF2F8] h-1.5 rounded-sm cursor-pointer"
            />
            <span className="text-xs font-bold text-[#14426B] w-12 text-right">
              {advanced.timeStepCoeff.toFixed(3)}
            </span>
          </div>

          <span className="text-[9px] text-[#68758A]">
            Lower = higher precision around periapsis
          </span>
        </div>

        {/* Simulation Duration Overrides */}
        <div className="flex flex-col gap-1.5 bg-white p-3 rounded-lg border border-[#DCE3EE] shadow-2xs">
          <div className="flex items-center justify-between">
            <label className="text-[#68758A] font-bold uppercase text-[10px]">
              MAX PROPAGATION DURATION
            </label>
            <UnitBadge unit="s" />
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step="1000"
              placeholder="Auto duration"
              value={advanced.simulationDurationS || ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onChangeAdvanced((prev: any) => ({
                  ...prev,
                  simulationDurationS: !isNaN(val) && val > 0 ? val : undefined,
                }));
              }}
              className="w-full bg-[#F8FAFD] border border-[#DCE3EE] px-2 py-1 rounded-lg text-[#263247]"
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
                className="text-[9px] text-[#68758A] hover:text-[#263247] px-2 py-1 bg-[#EEF2F8] rounded-lg border border-[#DCE3EE]"
                title="Reset to automatic duration"
              >
                Auto
              </button>
            )}
          </div>

          <span className="text-[9px] text-[#68758A]">
            {advanced.simulationDurationS !== undefined
              ? `${(advanced.simulationDurationS / 3600).toFixed(1)} hours`
              : 'Auto: Asymptotic entry to exit window'}
          </span>
        </div>
      </div>

      {/* Row 2: Heliocentric Planetary Motion & Kinematics */}
      <div className="border-t border-[#DCE3EE] pt-3 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Compass size={13} className="text-[#0284C7]" />
            <span className="text-[11px] font-bold text-[#263247] uppercase">
              HELIOCENTRIC PLANETARY ORBIT KINEMATICS:
            </span>
          </div>

          <div className="flex items-center gap-1 bg-[#EEF2F8] p-0.5 rounded-lg border border-[#DCE3EE]">
            <button
              type="button"
              onClick={() => onChangePlanetVelocityMode('CIRCULAR_ORBIT')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                planetVelocityMode === 'CIRCULAR_ORBIT'
                  ? 'bg-[#A9D4F5] text-[#14426B] shadow-2xs'
                  : 'text-[#68758A] hover:text-[#263247]'
              }`}
            >
              CIRCULAR ORBIT APPROXIMATION
            </button>
            <button
              type="button"
              onClick={() => onChangePlanetVelocityMode('CUSTOM_VECTOR')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                planetVelocityMode === 'CUSTOM_VECTOR'
                  ? 'bg-[#C9BDF2] text-[#4A347F] shadow-2xs'
                  : 'text-[#68758A] hover:text-[#263247]'
              }`}
            >
              CUSTOM SUN VELOCITY VECTOR
            </button>
          </div>
        </div>

        {planetVelocityMode === 'CIRCULAR_ORBIT' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-[#DCE3EE] shadow-2xs">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#68758A] font-bold">SEMI-MAJOR AXIS (a)</span>
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
                className="bg-[#F8FAFD] border border-[#DCE3EE] px-2 py-1 rounded-lg text-[#263247]"
              />
              <span className="text-[9px] text-[#68758A]">
                {(semiMajorAxisM / 1e9).toFixed(1)} million km from Sun
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#68758A] font-bold">ORBITAL SPEED (v_orb)</span>
                <UnitBadge unit="km/s" />
              </div>
              <div className="bg-[#F8FAFD] border border-[#DCE3EE] px-2 py-1 rounded-lg text-[#059669] font-bold">
                {(orbitalSpeedMPerS / 1000).toFixed(2)} km/s
              </div>
              <span className="text-[9px] text-[#68758A]">
                Derived via v = √(μ_sun / a)
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#68758A] font-bold">ENTRY DISTANCE MULTIPLE</span>
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
                className="bg-[#F8FAFD] border border-[#DCE3EE] px-2 py-1 rounded-lg text-[#263247]"
              />
              <span className="text-[9px] text-[#68758A]">
                Asymptotic integration start boundary (default 20×)
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-[#DCE3EE] shadow-2xs">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#68758A] font-bold">V_planet X</span>
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
                className="bg-[#F8FAFD] border border-[#DCE3EE] px-2 py-1 rounded-lg text-[#263247] font-bold"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#68758A] font-bold">V_planet Y</span>
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
                className="bg-[#F8FAFD] border border-[#DCE3EE] px-2 py-1 rounded-lg text-[#263247] font-bold"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#68758A] font-bold">V_planet Z</span>
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
                className="bg-[#F8FAFD] border border-[#DCE3EE] px-2 py-1 rounded-lg text-[#263247] font-bold"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
