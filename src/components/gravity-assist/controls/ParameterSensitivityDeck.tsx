import React, { useState, useMemo } from 'react';
import {
  FlybyScenarioConfig,
  SensitivityVariable,
  SensitivitySweepResult,
  runSensitivitySweep,
} from '../../../physics/FlybyScenario';
import { Sliders, ShieldAlert, CheckCircle2, LineChart, Table } from 'lucide-react';

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
    const minX = pts[0].parameterValue;
    const maxX = pts[pts.length - 1].parameterValue;

    let maxDeltaDeg = 0;
    let minDeltaV = 0;
    let maxDeltaV = 0;

    pts.forEach((p) => {
      if (p.deflectionAngleDeg > maxDeltaDeg) maxDeltaDeg = p.deflectionAngleDeg;
      if (p.deltaVSunSpeedKmPerS < minDeltaV) minDeltaV = p.deltaVSunSpeedKmPerS;
      if (p.deltaVSunSpeedKmPerS > maxDeltaV) maxDeltaV = p.deltaVSunSpeedKmPerS;
    });

    maxDeltaDeg = Math.max(10, maxDeltaDeg * 1.15);
    const vMargin = Math.max(1, (maxDeltaV - minDeltaV) * 0.15);
    minDeltaV -= vMargin;
    maxDeltaV += vMargin;

    return { pts, minX, maxX, maxDeltaDeg, minDeltaV, maxDeltaV };
  }, [sweepResult]);

  return (
    <div className="bg-[#F8FAFD] border border-[#DCE3EE] p-4 rounded-xl flex flex-col gap-4 font-mono text-[#263247] shadow-2xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE3EE] pb-2.5">
        <div className="flex items-center gap-2">
          <Sliders size={15} className="text-[#0284C7]" />
          <span className="font-bold text-xs uppercase text-[#14426B]">
            PARAMETER SENSITIVITY SWEEP (WHAT-IF FLIGHT LAB)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#EEF2F8] p-0.5 rounded-lg border border-[#DCE3EE]">
            <button
              onClick={() => setViewMode('CHART')}
              className={`px-2 py-0.5 text-[10px] rounded-md transition-colors flex items-center gap-1 cursor-pointer ${
                viewMode === 'CHART'
                  ? 'bg-white text-[#263247] font-bold shadow-2xs'
                  : 'text-[#68758A] hover:text-[#263247]'
              }`}
            >
              <LineChart size={11} /> GRAPH
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`px-2 py-0.5 text-[10px] rounded-md transition-colors flex items-center gap-1 cursor-pointer ${
                viewMode === 'TABLE'
                  ? 'bg-white text-[#263247] font-bold shadow-2xs'
                  : 'text-[#68758A] hover:text-[#263247]'
              }`}
            >
              <Table size={11} /> TABLE
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="text-[#68758A] hover:text-[#263247] px-2 py-0.5 rounded-lg border border-[#DCE3EE] bg-white text-[10px] cursor-pointer"
            >
              CLOSE
            </button>
          )}
        </div>
      </div>

      {/* Sweep Configuration Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-[#DCE3EE] shadow-2xs">
        {/* Variable Selection */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#68758A] uppercase font-bold">SWEEP VARIABLE</label>
          <select
            value={selectedVar}
            onChange={(e) => setSelectedVar(e.target.value as SensitivityVariable)}
            className="bg-[#F8FAFD] border border-[#DCE3EE] px-2 py-1 text-xs text-[#263247] rounded-lg focus:outline-none focus:border-[#0284C7]"
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
          <label className="text-[10px] text-[#68758A] uppercase font-bold">MIN VALUE ({defaultBounds.unit})</label>
          <input
            type="number"
            step="any"
            value={minVal}
            onChange={(e) => setMinVal(parseFloat(e.target.value) || 0)}
            className="bg-[#F8FAFD] border border-[#DCE3EE] px-2 py-1 text-xs text-[#263247] rounded-lg focus:outline-none focus:border-[#0284C7]"
          />
        </div>

        {/* Max Value */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#68758A] uppercase font-bold">MAX VALUE ({defaultBounds.unit})</label>
          <input
            type="number"
            step="any"
            value={maxVal}
            onChange={(e) => setMaxVal(parseFloat(e.target.value) || 0)}
            className="bg-[#F8FAFD] border border-[#DCE3EE] px-2 py-1 text-xs text-[#263247] rounded-lg focus:outline-none focus:border-[#0284C7]"
          />
        </div>

        {/* Sample Steps */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#68758A] uppercase font-bold">SAMPLE POINTS ({steps})</label>
          <input
            type="range"
            min="5"
            max="25"
            value={steps}
            onChange={(e) => setSteps(parseInt(e.target.value, 10))}
            className="accent-[#0284C7] bg-[#EEF2F8] h-1.5 rounded-sm mt-2 cursor-pointer"
          />
        </div>
      </div>

      {/* Strict Invariance Verification Bar */}
      <div className="bg-[#EEF2F8] px-3 py-2 rounded-lg border border-[#DCE3EE] flex flex-wrap items-center justify-between gap-2 text-[10px]">
        <div className="flex items-center gap-2">
          <span className="text-[#B45309] font-bold">HOLDING FIXED (NO SILENT CHANGES):</span>
          <span className="text-[#263247]">
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
        <div className="text-[#68758A]">BASELINE: {sweepResult.baselineValue.toLocaleString()} {sweepResult.unit}</div>
      </div>

      {/* Main Visual Display (Chart or Table) */}
      {viewMode === 'CHART' && chartData && (
        <div className="bg-white p-4 rounded-xl border border-[#DCE3EE] flex flex-col gap-3 shadow-2xs">
          <div className="flex justify-between items-center text-[10px] text-[#68758A]">
            <span className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#D97706]" /> Deflection Angle δ (deg, left axis)
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#0284C7] ml-3" /> Sun-Relative Δv (km/s, right axis)
            </span>
            <span>Range: {chartData.minX.toFixed(1)} to {chartData.maxX.toFixed(1)} {sweepResult.unit}</span>
          </div>

          {/* Responsive SVG Chart */}
          <div className="w-full h-56 sm:h-64 relative overflow-hidden">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
              {/* Grid Lines */}
              <line x1="0" y1="20" x2="500" y2="20" stroke="#EEF2F8" strokeDasharray="3 3" />
              <line x1="0" y1="70" x2="500" y2="70" stroke="#EEF2F8" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="#EEF2F8" strokeDasharray="3 3" />
              <line x1="0" y1="170" x2="500" y2="170" stroke="#EEF2F8" strokeDasharray="3 3" />

              {/* Zero line for Delta-V */}
              {chartData.minDeltaV < 0 && (
                <line
                  x1="0"
                  y1={20 + ((chartData.maxDeltaV - 0) / (chartData.maxDeltaV - chartData.minDeltaV || 1)) * 150}
                  x2="500"
                  y2={20 + ((chartData.maxDeltaV - 0) / (chartData.maxDeltaV - chartData.minDeltaV || 1)) * 150}
                  stroke="#94A3B8"
                  strokeWidth="1.5"
                />
              )}

              {/* Curve 1: Deflection Angle (Amber) */}
              <polyline
                fill="none"
                stroke="#D97706"
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
                stroke="#0284C7"
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
                      fill={p.isCollision ? '#EF4444' : '#D97706'}
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex justify-between items-center text-[9px] text-[#68758A] border-t border-[#DCE3EE] pt-2">
            <span>Left Axis: Max Deflection = {chartData.maxDeltaDeg.toFixed(1)}°</span>
            <span className="text-[#D97706] font-bold">Solid Amber: Turning Angle δ</span>
            <span className="text-[#0284C7] font-bold">Dashed Blue: Sun Δv</span>
            <span>Right Axis: Δv Range = [{chartData.minDeltaV.toFixed(2)}, {chartData.maxDeltaV.toFixed(2)}] km/s</span>
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'TABLE' && (
        <div className="bg-white rounded-xl border border-[#DCE3EE] overflow-x-auto shadow-2xs">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-[#EEF2F8] border-b border-[#DCE3EE] text-[10px] text-[#68758A]">
                <th className="p-2.5">{defaultBounds.label} ({defaultBounds.unit})</th>
                <th className="p-2.5">Altitude (km)</th>
                <th className="p-2.5">Impact b (km)</th>
                <th className="p-2.5">Deflection (δ)</th>
                <th className="p-2.5">Sun Δv (km/s)</th>
                <th className="p-2.5">Δv Vector (km/s)</th>
                <th className="p-2.5">Peak Speed (km/s)</th>
                <th className="p-2.5">Status</th>
                {onApplyParameterValue && <th className="p-2.5 text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {sweepResult.points.map((pt, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-[#DCE3EE] hover:bg-[#F8FAFD] ${
                    pt.isCollision ? 'bg-[#FEE2E2]/40 text-[#991B1B]' : 'text-[#263247]'
                  }`}
                >
                  <td className="p-2.5 font-bold text-[#263247]">
                    {pt.parameterValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5">{pt.periapsisAltitudeKm.toFixed(1)}</td>
                  <td className="p-2.5">{pt.impactParameterKm.toFixed(1)}</td>
                  <td className="p-2.5 text-[#B45309] font-bold">{pt.deflectionAngleDeg.toFixed(2)}°</td>
                  <td className={`p-2.5 font-bold ${pt.deltaVSunSpeedKmPerS >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                    {pt.deltaVSunSpeedKmPerS >= 0 ? '+' : ''}{pt.deltaVSunSpeedKmPerS.toFixed(3)}
                  </td>
                  <td className="p-2.5">{pt.deltaVVectorMagnitudeKmPerS.toFixed(3)}</td>
                  <td className="p-2.5">{pt.maxSpeedPlanetKmPerS.toFixed(2)}</td>
                  <td className="p-2.5">
                    {pt.isCollision ? (
                      <span className="text-[#DC2626] flex items-center gap-1 font-bold">
                        <ShieldAlert size={11} /> COLLISION
                      </span>
                    ) : (
                      <span className="text-[#059669] flex items-center gap-1 font-semibold">
                        <CheckCircle2 size={11} /> SAFE
                      </span>
                    )}
                  </td>
                  {onApplyParameterValue && (
                    <td className="p-2.5 text-right">
                      <button
                        onClick={() => onApplyParameterValue(selectedVar, pt.parameterValue)}
                        className="px-2 py-0.5 bg-[#EEF2F8] hover:bg-[#AEE5D0] text-[#14426B] hover:text-[#1D6C50] rounded-md text-[10px] font-bold transition-colors cursor-pointer"
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
