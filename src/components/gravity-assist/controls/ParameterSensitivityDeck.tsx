import React, { useState, useMemo } from 'react';
import {
  FlybyScenarioConfig,
  SensitivityVariable,
  SensitivitySweepResult,
  runSensitivitySweep,
} from '../../../physics/FlybyScenario';
import { Sliders, Play, RotateCcw, ShieldAlert, CheckCircle2, ArrowRight, Table, LineChart, Info } from 'lucide-react';

export interface ParameterSensitivityDeckProps {
  scenario: FlybyScenarioConfig;
  onApplyParameterValue?: (variable: SensitivityVariable, value: number) => void;
  onClose?: () => void;
}

export const ParameterSensitivityDeck: React.FC<ParameterSensitivityDeckProps> = ({
  scenario,
  onApplyParameterValue,
  onClose,
}) => {
  const [selectedVar, setSelectedVar] = useState<SensitivityVariable>('V_INF');

  // Intelligent default bounds tailored to the current planet and scenario
  const defaultBounds = useMemo(() => {
    const pRadiusKm = scenario.planet.radiusM / 1000.0;
    const currentVInfKmS = scenario.encounter.vInfSpeedMPerS / 1000.0;
    const currentAltKm = scenario.encounter.periapsisAltitudeKm;
    const currentBKm = scenario.encounter.impactParameterKm;

    switch (selectedVar) {
      case 'V_INF':
        return {
          min: Math.max(1.0, currentVInfKmS * 0.3),
          max: currentVInfKmS * 2.5,
          steps: 12,
          unit: 'km/s',
          label: 'Incoming Asymptotic Speed (v_∞)',
        };
      case 'PERIAPSIS_ALTITUDE':
        return {
          min: Math.max(0, currentAltKm * 0.1),
          max: Math.max(pRadiusKm * 3.0, currentAltKm * 2.5),
          steps: 12,
          unit: 'km',
          label: 'Closest-Approach Altitude (h)',
        };
      case 'IMPACT_PARAMETER':
        return {
          min: Math.max(pRadiusKm * 0.5, currentBKm * 0.2),
          max: currentBKm * 2.5,
          steps: 12,
          unit: 'km',
          label: 'Impact Parameter (b)',
        };
      case 'APPROACH_ANGLE':
        return {
          min: -90,
          max: 90,
          steps: 13,
          unit: 'deg',
          label: 'Incoming Direction Angle (ψ)',
        };
      case 'PLANET_MASS':
        return {
          min: scenario.planet.massKg * 0.2,
          max: scenario.planet.massKg * 5.0,
          steps: 10,
          unit: 'kg',
          label: 'Planet Mass (M)',
        };
      case 'SPACECRAFT_MASS':
        return {
          min: 100,
          max: 10000,
          steps: 10,
          unit: 'kg',
          label: 'Spacecraft Mass (m_sc)',
        };
    }
  }, [selectedVar, scenario]);

  const [minVal, setMinVal] = useState<number>(defaultBounds.min);
  const [maxVal, setMaxVal] = useState<number>(defaultBounds.max);
  const [steps, setSteps] = useState<number>(defaultBounds.steps);
  const [viewMode, setViewMode] = useState<'CHART' | 'TABLE'>('CHART');

  // Update inputs whenever selected variable changes
  React.useEffect(() => {
    setMinVal(parseFloat(defaultBounds.min.toPrecision(4)));
    setMaxVal(parseFloat(defaultBounds.max.toPrecision(4)));
    setSteps(defaultBounds.steps);
  }, [defaultBounds]);

  // Compute sweep result deterministically without mutating anything
  const sweepResult: SensitivitySweepResult = useMemo(() => {
    return runSensitivitySweep(scenario, selectedVar, minVal, maxVal, steps);
  }, [scenario, selectedVar, minVal, maxVal, steps]);

  // SVG Chart Metrics
  const chartData = useMemo(() => {
    if (!sweepResult || sweepResult.points.length === 0) return null;
    const pts = sweepResult.points;
    const xVals = pts.map((p) => p.parameterValue);
    const deltaDegs = pts.map((p) => p.deflectionAngleDeg);
    const deltaVs = pts.map((p) => p.deltaVSunSpeedKmPerS);

    const minX = Math.min(...xVals);
    const maxX = Math.max(...xVals);
    const maxDeltaDeg = Math.max(10, ...deltaDegs);
    const minDeltaV = Math.min(0, ...deltaVs);
    const maxDeltaV = Math.max(1, ...deltaVs);

    return { pts, minX, maxX, maxDeltaDeg, minDeltaV, maxDeltaV };
  }, [sweepResult]);

  return (
    <div className="w-full bg-[#0d0f17] border border-[#23283c] p-4 sm:p-5 rounded-xs flex flex-col gap-4 text-white font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2436] pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="text-amber-400" size={16} />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            PARAMETER SENSITIVITY EXPERIMENT ENGINE
          </span>
          <span className="text-[10px] bg-[#1a1e2d] px-2 py-0.5 rounded-xs text-neutral-400 border border-[#2b334a]">
            CONTROLLED 1-VARIABLE SWEEP
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#131622] p-0.5 rounded-xs border border-[#242b3e]">
            <button
              onClick={() => setViewMode('CHART')}
              className={`px-2.5 py-1 text-[10px] rounded-xs font-bold flex items-center gap-1 ${
                viewMode === 'CHART' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <LineChart size={12} /> CHART
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`px-2.5 py-1 text-[10px] rounded-xs font-bold flex items-center gap-1 ${
                viewMode === 'TABLE' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Table size={12} /> TABLE
            </button>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-neutral-500 hover:text-white px-2 py-1 text-xs border border-[#242b3e] rounded-xs"
            >
              ✕ CLOSE
            </button>
          )}
        </div>
      </div>

      {/* Control Configuration Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#111420] p-3 rounded-xs border border-[#1d2233]">
        {/* Variable Selection */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-neutral-400 uppercase font-bold">SWEEP VARIABLE</label>
          <select
            value={selectedVar}
            onChange={(e) => setSelectedVar(e.target.value as SensitivityVariable)}
            className="bg-[#181c2b] border border-[#2a3246] px-2 py-1 text-xs text-white rounded-xs focus:outline-none focus:border-amber-500"
          >
            <option value="V_INF">Incoming Speed v_∞ (km/s)</option>
            <option value="PERIAPSIS_ALTITUDE">Closest Altitude h (km)</option>
            <option value="IMPACT_PARAMETER">Impact Parameter b (km)</option>
            <option value="APPROACH_ANGLE">Approach Angle ψ (deg)</option>
            <option value="PLANET_MASS">Planet Mass M (kg)</option>
            <option value="SPACECRAFT_MASS">Spacecraft Mass (kg)</option>
          </select>
        </div>

        {/* Min Value */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-neutral-400 uppercase font-bold">MIN VALUE ({defaultBounds.unit})</label>
          <input
            type="number"
            step="any"
            value={minVal}
            onChange={(e) => setMinVal(parseFloat(e.target.value) || 0)}
            className="bg-[#181c2b] border border-[#2a3246] px-2 py-1 text-xs text-white rounded-xs focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Max Value */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-neutral-400 uppercase font-bold">MAX VALUE ({defaultBounds.unit})</label>
          <input
            type="number"
            step="any"
            value={maxVal}
            onChange={(e) => setMaxVal(parseFloat(e.target.value) || 0)}
            className="bg-[#181c2b] border border-[#2a3246] px-2 py-1 text-xs text-white rounded-xs focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Sample Steps */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-neutral-400 uppercase font-bold">SAMPLE POINTS ({steps})</label>
          <input
            type="range"
            min="5"
            max="25"
            value={steps}
            onChange={(e) => setSteps(parseInt(e.target.value, 10))}
            className="accent-amber-500 mt-2"
          />
        </div>
      </div>

      {/* Strict Invariance Verification Bar */}
      <div className="bg-[#090b11] px-3 py-2 rounded-xs border border-[#1a1f2e] flex flex-wrap items-center justify-between gap-2 text-[10px]">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold">HOLDING FIXED (NO SILENT CHANGES):</span>
          <span className="text-neutral-300">
            Planet: <strong>{scenario.planet.name}</strong> • Orientation: <strong>{scenario.encounter.passType}</strong>
            {selectedVar !== 'V_INF' && (
              <> • v_∞ = <strong>{(scenario.encounter.vInfSpeedMPerS / 1000).toFixed(1)} km/s</strong></>
            )}
            {selectedVar !== 'PERIAPSIS_ALTITUDE' && selectedVar !== 'IMPACT_PARAMETER' && (
              <> • Alt = <strong>{scenario.encounter.periapsisAltitudeKm.toFixed(0)} km</strong></>
            )}
            {selectedVar !== 'APPROACH_ANGLE' && (
              <> • ψ = <strong>{scenario.encounter.approachAngleDeg.toFixed(1)}°</strong></>
            )}
            {selectedVar !== 'SPACECRAFT_MASS' && (
              <> • m_sc = <strong>{scenario.encounter.spacecraftMassKg.toLocaleString()} kg</strong></>
            )}
          </span>
        </div>
        <div className="text-neutral-500">BASELINE: {sweepResult.baselineValue.toLocaleString()} {sweepResult.unit}</div>
      </div>

      {/* Main Visual Display (Chart or Table) */}
      {viewMode === 'CHART' && chartData && (
        <div className="bg-[#090b10] p-4 rounded-xs border border-[#1b2030] flex flex-col gap-3">
          <div className="flex justify-between items-center text-[10px] text-neutral-400">
            <span className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" /> Deflection Angle δ (deg, left axis)
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-400 ml-3" /> Sun-Relative Δv (km/s, right axis)
            </span>
            <span>Range: {chartData.minX.toFixed(1)} to {chartData.maxX.toFixed(1)} {sweepResult.unit}</span>
          </div>

          {/* Responsive SVG Chart */}
          <div className="w-full h-56 sm:h-64 relative overflow-hidden">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
              {/* Grid Lines */}
              <line x1="0" y1="20" x2="500" y2="20" stroke="#1c2130" strokeDasharray="3 3" />
              <line x1="0" y1="70" x2="500" y2="70" stroke="#1c2130" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="#1c2130" strokeDasharray="3 3" />
              <line x1="0" y1="170" x2="500" y2="170" stroke="#1c2130" strokeDasharray="3 3" />

              {/* Zero line for Delta-V */}
              {chartData.minDeltaV < 0 && (
                <line
                  x1="0"
                  y1={20 + ((chartData.maxDeltaV - 0) / (chartData.maxDeltaV - chartData.minDeltaV || 1)) * 150}
                  x2="500"
                  y2={20 + ((chartData.maxDeltaV - 0) / (chartData.maxDeltaV - chartData.minDeltaV || 1)) * 150}
                  stroke="#374151"
                  strokeWidth="1.5"
                />
              )}

              {/* Curve 1: Deflection Angle (Amber) */}
              <polyline
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                points={chartData.pts
                  .map((p, idx) => {
                    const x = (idx / (chartData.pts.length - 1)) * 500;
                    const y = 180 - (p.deflectionAngleDeg / (chartData.maxDeltaDeg || 1)) * 150;
                    return `${x},${Math.max(10, Math.min(190, y))}`;
                  })
                  .join(' ')}
              />

              {/* Curve 2: Sun Delta-V (Sky Blue) */}
              <polyline
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeDasharray="4 2"
                points={chartData.pts
                  .map((p, idx) => {
                    const x = (idx / (chartData.pts.length - 1)) * 500;
                    const spanV = chartData.maxDeltaV - chartData.minDeltaV || 1;
                    const normV = (p.deltaVSunSpeedKmPerS - chartData.minDeltaV) / spanV;
                    const y = 180 - normV * 150;
                    return `${x},${Math.max(10, Math.min(190, y))}`;
                  })
                  .join(' ')}
              />

              {/* Data points & Collision markers */}
              {chartData.pts.map((p, idx) => {
                const x = (idx / (chartData.pts.length - 1)) * 500;
                const yDelta = 180 - (p.deflectionAngleDeg / (chartData.maxDeltaDeg || 1)) * 150;
                return (
                  <g key={idx}>
                    <circle
                      cx={x}
                      cy={Math.max(10, Math.min(190, yDelta))}
                      r={p.isCollision ? 5 : 3}
                      fill={p.isCollision ? '#ef4444' : '#f59e0b'}
                      stroke="#000"
                      strokeWidth="1"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex justify-between items-center text-[9px] text-neutral-500 border-t border-[#1a1f2e] pt-2">
            <span>Left Axis: Max Deflection = {chartData.maxDeltaDeg.toFixed(1)}°</span>
            <span className="text-amber-400 font-bold">Solid Amber: Turning Angle δ</span>
            <span className="text-sky-400 font-bold">Dashed Blue: Sun Δv</span>
            <span>Right Axis: Δv Range = [{chartData.minDeltaV.toFixed(2)}, {chartData.maxDeltaV.toFixed(2)}] km/s</span>
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'TABLE' && (
        <div className="bg-[#090b10] rounded-xs border border-[#1b2030] overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-[#121522] border-b border-[#212739] text-[10px] text-neutral-400">
                <th className="p-2">{defaultBounds.label} ({defaultBounds.unit})</th>
                <th className="p-2">Altitude (km)</th>
                <th className="p-2">Impact b (km)</th>
                <th className="p-2">Deflection (δ)</th>
                <th className="p-2">Sun Δv (km/s)</th>
                <th className="p-2">Δv Vector (km/s)</th>
                <th className="p-2">Peak Speed (km/s)</th>
                <th className="p-2">Status</th>
                {onApplyParameterValue && <th className="p-2 text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {sweepResult.points.map((pt, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-[#161a27] hover:bg-[#141824] ${
                    pt.isCollision ? 'bg-rose-950/20 text-rose-200' : 'text-neutral-300'
                  }`}
                >
                  <td className="p-2 font-bold text-white">
                    {pt.parameterValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-2">{pt.periapsisAltitudeKm.toFixed(1)}</td>
                  <td className="p-2">{pt.impactParameterKm.toFixed(1)}</td>
                  <td className="p-2 text-amber-300 font-bold">{pt.deflectionAngleDeg.toFixed(2)}°</td>
                  <td className={`p-2 font-bold ${pt.deltaVSunSpeedKmPerS >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {pt.deltaVSunSpeedKmPerS >= 0 ? '+' : ''}{pt.deltaVSunSpeedKmPerS.toFixed(3)}
                  </td>
                  <td className="p-2">{pt.deltaVVectorMagnitudeKmPerS.toFixed(3)}</td>
                  <td className="p-2">{pt.maxSpeedPlanetKmPerS.toFixed(2)}</td>
                  <td className="p-2">
                    {pt.isCollision ? (
                      <span className="text-rose-400 flex items-center gap-1 font-bold">
                        <ShieldAlert size={11} /> COLLISION
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={11} /> SAFE
                      </span>
                    )}
                  </td>
                  {onApplyParameterValue && (
                    <td className="p-2 text-right">
                      <button
                        onClick={() => onApplyParameterValue(selectedVar, pt.parameterValue)}
                        className="px-2 py-0.5 bg-[#1e2436] hover:bg-amber-500 hover:text-black rounded-xs text-[10px] text-neutral-300 transition-colors"
                        title="Adopt this parameter value into the active scenario"
                      >
                        Apply →
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
