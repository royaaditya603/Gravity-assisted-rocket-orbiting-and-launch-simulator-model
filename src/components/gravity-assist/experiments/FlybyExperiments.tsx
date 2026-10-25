import React, { useState, useMemo, useCallback } from 'react';
import { PlanetaryBodyData, PLANETARY_BODIES } from '../../../physics/constants';
import { FlybyEngine, FlybyPassType, FlybyInitialConditions } from '../../../physics/FlybyEngine';
import {
  FlybyExperimentEngine,
  SweepParameter,
  SweepConfig,
  ExperimentRecord,
  SavedExperiment,
} from '../../../physics/FlybyExperimentEngine';
import {
  FlaskConical,
  Play,
  Download,
  BookmarkPlus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  ArrowUpDown,
  Search,
} from 'lucide-react';

interface FlybyExperimentsProps {
  onLoadPreset: (config: Partial<FlybyInitialConditions>) => void;
}

type TabId = 'BUILDER' | 'EXP_A' | 'EXP_B' | 'EXP_C' | 'EXP_D' | 'EXP_E' | 'EXP_F';

export const FlybyExperiments: React.FC<FlybyExperimentsProps> = ({ onLoadPreset }) => {
  const [activeTab, setActiveTab] = useState<TabId>('BUILDER');

  // --- EXPERIMENT BUILDER STATE ---
  const [builderPlanet, setBuilderPlanet] = useState<PlanetaryBodyData>(PLANETARY_BODIES.JUPITER);
  const [builderParam, setBuilderParam] = useState<SweepParameter>('periapsisAltitudeKm');
  const [builderMin, setBuilderMin] = useState<number>(5000);
  const [builderMax, setBuilderMax] = useState<number>(250000);
  const [builderSamples, setBuilderSamples] = useState<number>(10);
  const [builderBaseVInf, setBuilderBaseVInf] = useState<number>(10000);
  const [builderBaseAltKm, setBuilderBaseAltKm] = useState<number>(50000);
  const [builderBasePass, setBuilderBasePass] = useState<FlybyPassType>('TRAILING');
  const [builderBaseMass, setBuilderBaseMass] = useState<number>(1000);

  // Sweep Results & Filtering
  const [sweepRecords, setSweepRecords] = useState<ExperimentRecord[]>(() => {
    return FlybyExperimentEngine.runExperimentA_ClosestApproach(PLANETARY_BODIES.JUPITER, 10000, 'TRAILING', 8);
  });
  const [sortField, setSortField] = useState<keyof ExperimentRecord>('stepIndex');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [tableFilter, setTableFilter] = useState<'ALL' | 'SAFE_ONLY' | 'COLLISION_ONLY'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Saved Experiments
  const [savedExperiments, setSavedExperiments] = useState<SavedExperiment[]>(() => {
    return FlybyExperimentEngine.getSavedExperiments();
  });
  const [showSavedDrawer, setShowSavedDrawer] = useState<boolean>(false);

  // Validation
  const validationResult = useMemo(() => {
    return FlybyExperimentEngine.validateSweepConfig(
      {
        parameter: builderParam,
        minValue: builderMin,
        maxValue: builderMax,
        sampleCount: builderSamples,
      },
      builderPlanet.radiusM / 1000.0
    );
  }, [builderParam, builderMin, builderMax, builderSamples, builderPlanet]);

  // Handle Preset Parameter Presets in Builder
  const handleSelectParam = (param: SweepParameter) => {
    setBuilderParam(param);
    switch (param) {
      case 'periapsisAltitudeKm':
        setBuilderMin(5000);
        setBuilderMax(250000);
        break;
      case 'periapsisRadiusKm':
        setBuilderMin((builderPlanet.radiusM * 0.8) / 1000.0);
        setBuilderMax((builderPlanet.radiusM * 5.0) / 1000.0);
        break;
      case 'vInfMPerS':
        setBuilderMin(3000);
        setBuilderMax(25000);
        break;
      case 'planetMu':
        setBuilderMin(builderPlanet.mu * 0.2);
        setBuilderMax(builderPlanet.mu * 3.0);
        break;
      case 'spacecraftMassKg':
        setBuilderMin(100);
        setBuilderMax(50000);
        break;
    }
  };

  // Run Custom Sweep
  const handleRunSweep = useCallback(() => {
    if (!validationResult.isValid) return;

    const sweepConfig: SweepConfig = {
      parameter: builderParam,
      minValue: builderMin,
      maxValue: builderMax,
      sampleCount: builderSamples,
      scale: 'LINEAR',
    };

    const baseline: FlybyInitialConditions = {
      planet: builderPlanet,
      vInfSpeedMPerS: builderBaseVInf,
      targetPeriapsisM: builderPlanet.radiusM + builderBaseAltKm * 1000.0,
      passType: builderBasePass,
      spacecraftMassKg: builderBaseMass,
    };

    const results = FlybyExperimentEngine.runParameterSweep(baseline, sweepConfig);
    setSweepRecords(results);
  }, [
    validationResult,
    builderParam,
    builderMin,
    builderMax,
    builderSamples,
    builderPlanet,
    builderBaseVInf,
    builderBaseAltKm,
    builderBasePass,
    builderBaseMass,
  ]);

  // Export CSV
  const handleExportCSV = useCallback(() => {
    const csvContent = FlybyExperimentEngine.exportExperimentToCSV(sweepRecords, {
      title: `${builderPlanet.name} ${builderParam} Parameter Sweep`,
      baselinePlanet: builderPlanet.name,
      baselineVInfMPerS: builderBaseVInf,
      baselineAltKm: builderBaseAltKm,
      baselinePassType: builderBasePass,
      baselineMassKg: builderBaseMass,
      assumptions: [
        'Point-mass Newtonian gravitational potential with unperturbed central force',
        'Patch-conic asymptotic matching within planet sphere of influence (SOI)',
        'Neglected atmospheric entry ablation and nonspherical gravitational perturbations (J2/J4)',
      ],
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `astra-experiment-${builderPlanet.name.toLowerCase()}-${builderParam}-${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [sweepRecords, builderPlanet, builderParam, builderBaseVInf, builderBaseAltKm, builderBasePass, builderBaseMass]);

  // Save Experiment
  const handleSaveExperiment = useCallback(() => {
    const exp: SavedExperiment = {
      id: `exp-${Date.now()}`,
      title: `${builderPlanet.name} ${builderParam} Sweep (${builderSamples} samples)`,
      timestamp: new Date().toISOString(),
      baseline: {
        planetName: builderPlanet.name,
        vInfSpeedMPerS: builderBaseVInf,
        periapsisAltitudeKm: builderBaseAltKm,
        passType: builderBasePass,
        spacecraftMassKg: builderBaseMass,
      },
      sweepConfig: {
        parameter: builderParam,
        minValue: builderMin,
        maxValue: builderMax,
        sampleCount: builderSamples,
      },
      records: sweepRecords,
      assumptions: ['2-Body Kepler-Newton Patched Conic', 'Conserved Hyperbolic Energy'],
    };

    FlybyExperimentEngine.saveExperimentToStorage(exp);
    setSavedExperiments(FlybyExperimentEngine.getSavedExperiments());
    alert('Experiment configuration and records successfully saved!');
  }, [
    builderPlanet,
    builderParam,
    builderSamples,
    builderBaseVInf,
    builderBaseAltKm,
    builderBasePass,
    builderBaseMass,
    builderMin,
    builderMax,
    sweepRecords,
  ]);

  // Filtered & Sorted Sweep Records
  const displayRecords = useMemo(() => {
    return sweepRecords
      .filter((r) => {
        if (tableFilter === 'SAFE_ONLY' && r.isCollision) return false;
        if (tableFilter === 'COLLISION_ONLY' && !r.isCollision) return false;
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          return (
            r.planetName.toLowerCase().includes(q) ||
            r.inputParamName.toLowerCase().includes(q) ||
            r.collisionStatus.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        return sortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
  }, [sweepRecords, tableFilter, searchQuery, sortField, sortAsc]);

  // Standard static suites for Tabs A - F
  const expAData = useMemo(() => FlybyExperimentEngine.runExperimentA_ClosestApproach(), []);
  const expBData = useMemo(() => FlybyExperimentEngine.runExperimentB_SpeedSweep(), []);
  const expCData = useMemo(() => FlybyExperimentEngine.runExperimentC_GravityStrength(), []);
  const expDData = useMemo(() => FlybyExperimentEngine.runExperimentD_Orientation(), []);
  const expEData = useMemo(() => FlybyExperimentEngine.runExperimentE_JupiterVsSaturnComparison(), []);
  const expFData = useMemo(() => FlybyExperimentEngine.runExperimentF_MassInvariance(), []);

  return (
    <div className="w-full bg-[#10121a] border border-[#222638] p-5 rounded-xs flex flex-col gap-5 text-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222638] pb-3">
        <div className="flex items-center gap-2">
          <FlaskConical size={18} className="text-amber-400" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-200">
            CONTROLLED EXPERIMENTS & PARAMETRIC SWEEP SUITE
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400">
          <span className="bg-[#1b1f2e] px-2 py-0.5 rounded-xs border border-[#2d344d] text-amber-300">
            SUITES A — F + CUSTOM BUILDER
          </span>
          <button
            onClick={() => setShowSavedDrawer((prev) => !prev)}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#1a1e2d] hover:bg-[#252b40] text-sky-400 rounded-xs border border-sky-800/40 transition-colors"
          >
            <BookmarkPlus size={11} />
            SAVED EXPERIMENTS ({savedExperiments.length})
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 font-mono text-[11px]">
        {[
          { id: 'BUILDER', label: '⚡ EXPERIMENT BUILDER' },
          { id: 'EXP_A', label: 'EXP A: DISTANCE (rp)' },
          { id: 'EXP_B', label: 'EXP B: SPEED (v_∞)' },
          { id: 'EXP_C', label: 'EXP C: GRAVITY (μ)' },
          { id: 'EXP_D', label: 'EXP D: ORIENTATION' },
          { id: 'EXP_E', label: 'EXP E: JUPITER vs SATURN' },
          { id: 'EXP_F', label: 'EXP F: PROBE MASS' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabId)}
            className={`py-2 px-2 rounded-xs border text-center transition-colors ${
              activeTab === tab.id
                ? 'bg-amber-500 text-black font-bold border-amber-400 shadow-sm'
                : 'bg-[#161824] text-neutral-400 border-[#252a3d] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Saved Experiments Drawer */}
      {showSavedDrawer && (
        <div className="bg-[#0b0d14] border border-[#282f45] p-3 rounded-xs flex flex-col gap-2 font-mono text-xs">
          <div className="flex justify-between items-center border-b border-[#202538] pb-1.5 text-neutral-300">
            <span className="font-bold text-sky-400">ARCHIVED EXPERIMENT RUNS</span>
            <button
              onClick={() => setShowSavedDrawer(false)}
              className="text-neutral-500 hover:text-white text-[10px]"
            >
              CLOSE ✕
            </button>
          </div>
          {savedExperiments.length === 0 ? (
            <div className="text-neutral-500 py-3 text-center text-[11px]">
              No saved experiments yet. Configure a sweep below and click "SAVE EXPERIMENT".
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {savedExperiments.map((exp) => (
                <div
                  key={exp.id}
                  className="bg-[#121520] border border-[#22283a] p-2 rounded-xs flex items-center justify-between text-[11px]"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-white">{exp.title}</span>
                    <span className="text-[10px] text-neutral-400">
                      {new Date(exp.timestamp).toLocaleString()} • {exp.records.length} records • Baseline:{' '}
                      {exp.baseline.planetName} ({exp.baseline.passType})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSweepRecords(exp.records);
                        setShowSavedDrawer(false);
                      }}
                      className="px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xs text-[10px]"
                    >
                      RESTORE
                    </button>
                    <button
                      onClick={() => {
                        setSavedExperiments(FlybyExperimentEngine.deleteSavedExperiment(exp.id));
                      }}
                      className="p-1 hover:text-rose-400 text-neutral-500"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- TAB CONTENT --- */}
      <div className="bg-[#0b0c12] border border-[#1d212f] p-4 rounded-xs flex flex-col gap-4">
        {/* TAB 1: REUSABLE CONTROLLED EXPERIMENT BUILDER */}
        {activeTab === 'BUILDER' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2436] pb-3">
              <div>
                <h4 className="font-mono text-sm font-bold text-amber-400 uppercase flex items-center gap-2">
                  <Sliders size={16} /> REUSABLE PARAMETRIC SWEEP BUILDER
                </h4>
                <p className="text-xs text-neutral-400 max-w-3xl leading-relaxed mt-1">
                  Isolate one independent variable while holding all other physical parameters strictly invariant.
                  Computes turning angles, energy momentum exchange, surface clearance, and exports full tabular data.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveExperiment}
                  className="px-3 py-1.5 bg-[#1e2334] hover:bg-[#2c334d] text-neutral-200 text-xs font-mono rounded-xs border border-[#353d5a] flex items-center gap-1.5 transition-colors"
                >
                  <BookmarkPlus size={13} className="text-sky-400" /> SAVE EXPERIMENT
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-mono font-bold rounded-xs flex items-center gap-1.5 transition-colors"
                >
                  <Download size={13} /> EXPORT CSV
                </button>
              </div>
            </div>

            {/* Sweep Configuration Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#11131c] p-3.5 rounded-xs border border-[#212638] text-xs font-mono">
              {/* Column 1: Baseline Environment */}
              <div className="flex flex-col gap-2">
                <span className="font-bold text-amber-400 uppercase text-[11px]">1. Baseline Planet & Geometry</span>
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-0.5">PLANET BASELINE</label>
                  <select
                    value={builderPlanet.id}
                    onChange={(e) => {
                      const p = (PLANETARY_BODIES as any)[e.target.value] || PLANETARY_BODIES.JUPITER;
                      setBuilderPlanet(p);
                    }}
                    className="w-full bg-[#181c2b] border border-[#2d344d] rounded-xs px-2 py-1 text-white"
                  >
                    {Object.values(PLANETARY_BODIES).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name.toUpperCase()} (μ: {p.mu.toExponential(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">FLYBY PASS TYPE</label>
                    <select
                      value={builderBasePass}
                      onChange={(e) => setBuilderBasePass(e.target.value as FlybyPassType)}
                      className="w-full bg-[#181c2b] border border-[#2d344d] rounded-xs px-2 py-1 text-white"
                    >
                      <option value="TRAILING">TRAILING (+ΔV)</option>
                      <option value="LEADING">LEADING (-ΔV)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">BASE MASS (kg)</label>
                    <input
                      type="number"
                      value={builderBaseMass}
                      onChange={(e) => setBuilderBaseMass(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-[#181c2b] border border-[#2d344d] rounded-xs px-2 py-1 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">BASE v_∞ (m/s)</label>
                    <input
                      type="number"
                      value={builderBaseVInf}
                      onChange={(e) => setBuilderBaseVInf(Number(e.target.value))}
                      className="w-full bg-[#181c2b] border border-[#2d344d] rounded-xs px-2 py-1 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">BASE ALT (km)</label>
                    <input
                      type="number"
                      value={builderBaseAltKm}
                      onChange={(e) => setBuilderBaseAltKm(Number(e.target.value))}
                      className="w-full bg-[#181c2b] border border-[#2d344d] rounded-xs px-2 py-1 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Column 2: Independent Variable to Vary */}
              <div className="flex flex-col gap-2">
                <span className="font-bold text-sky-400 uppercase text-[11px]">2. Variable Under Test</span>
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-0.5">PARAMETER TO VARY</label>
                  <select
                    value={builderParam}
                    onChange={(e) => handleSelectParam(e.target.value as SweepParameter)}
                    className="w-full bg-[#181c2b] border border-[#2d344d] rounded-xs px-2 py-1 text-amber-300 font-bold"
                  >
                    <option value="periapsisAltitudeKm">Periapsis Altitude (hp) [km]</option>
                    <option value="periapsisRadiusKm">Periapsis Radius (rp) [km]</option>
                    <option value="vInfMPerS">Incoming Speed (v_inf) [m/s]</option>
                    <option value="planetMu">Gravitational Parameter (mu) [m³/s²]</option>
                    <option value="spacecraftMassKg">Spacecraft Mass (m) [kg]</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">MIN VALUE</label>
                    <input
                      type="number"
                      value={builderMin}
                      onChange={(e) => setBuilderMin(Number(e.target.value))}
                      className="w-full bg-[#181c2b] border border-[#2d344d] rounded-xs px-2 py-1 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">MAX VALUE</label>
                    <input
                      type="number"
                      value={builderMax}
                      onChange={(e) => setBuilderMax(Number(e.target.value))}
                      className="w-full bg-[#181c2b] border border-[#2d344d] rounded-xs px-2 py-1 text-white"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <label className="text-[10px] text-neutral-400">SAMPLE RESOLUTION</label>
                    <span className="text-[10px] text-sky-400 font-bold">{builderSamples} POINTS</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="25"
                    value={builderSamples}
                    onChange={(e) => setBuilderSamples(Number(e.target.value))}
                    className="w-full accent-sky-400 h-1 bg-[#1a1f30] rounded-xs cursor-pointer"
                  />
                </div>
              </div>

              {/* Column 3: Run Execution & Validation Feedback */}
              <div className="flex flex-col justify-between gap-2 bg-[#0d0f17] p-2.5 rounded-xs border border-[#1b2030]">
                <div className="flex flex-col gap-1.5">
                  <span className="font-bold text-neutral-300 uppercase text-[11px]">Execution Status</span>
                  {validationResult.isValid ? (
                    <div className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                      <CheckCircle2 size={14} /> Ready to compute {builderSamples} data points.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 text-rose-400 text-[10px]">
                      <div className="flex items-center gap-1 font-bold">
                        <AlertTriangle size={13} /> Sweep configuration rejected:
                      </div>
                      {validationResult.errors.map((err, i) => (
                        <div key={i} className="pl-4 leading-tight">
                          • {err}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-[10px] text-neutral-500 mt-1">
                    All non-selected parameters remain strictly held constant to isolate causality.
                  </div>
                </div>

                <button
                  disabled={!validationResult.isValid}
                  onClick={handleRunSweep}
                  className={`w-full py-2.5 rounded-xs font-mono font-bold text-xs flex items-center justify-center gap-2 transition-colors ${
                    validationResult.isValid
                      ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-md cursor-pointer'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  <Play size={13} /> EXECUTE PARAMETRIC SWEEP
                </button>
              </div>
            </div>

            {/* Sweep Quick Visualizer (Inline SVG Chart) */}
            {sweepRecords.length > 0 && (
              <div className="bg-[#0e1017] border border-[#1b2030] p-3 rounded-xs flex flex-col gap-2">
                <div className="flex justify-between items-center text-[11px] font-mono">
                  <span className="font-bold text-neutral-300">
                    SWEEP VISUALIZATION: Deflection Angle (δ) vs. {builderParam}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    Min: {Math.min(...sweepRecords.map((r) => r.deflectionAngleDeg)).toFixed(1)}° | Max:{' '}
                    {Math.max(...sweepRecords.map((r) => r.deflectionAngleDeg)).toFixed(1)}°
                  </span>
                </div>
                <div className="h-28 w-full relative flex items-end">
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                    {/* Gridlines */}
                    <line x1="0" y1="25" x2="100" y2="25" stroke="#1d2336" strokeDasharray="2,2" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="#1d2336" strokeDasharray="2,2" />
                    <line x1="0" y1="75" x2="100" y2="75" stroke="#1d2336" strokeDasharray="2,2" />

                    {/* Deflection Angle Curve */}
                    <polyline
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="2"
                      points={sweepRecords
                        .map((r, i) => {
                          const x = (i / (sweepRecords.length - 1)) * 100;
                          const maxDelta = Math.max(...sweepRecords.map((s) => s.deflectionAngleDeg), 1);
                          const y = 95 - (r.deflectionAngleDeg / maxDelta) * 90;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />

                    {/* Data Points */}
                    {sweepRecords.map((r, i) => {
                      const x = (i / (sweepRecords.length - 1)) * 100;
                      const maxDelta = Math.max(...sweepRecords.map((s) => s.deflectionAngleDeg), 1);
                      const y = 95 - (r.deflectionAngleDeg / maxDelta) * 90;
                      return (
                        <circle
                          key={i}
                          cx={x}
                          cy={y}
                          r={r.isCollision ? '3.5' : '2.5'}
                          fill={r.isCollision ? '#e11d48' : '#38bdf8'}
                          stroke="#000"
                          strokeWidth="0.8"
                        />
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}

            {/* Sweep Results Controls & Filtering Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1f2436] text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-neutral-400 text-[10px]">FILTER:</span>
                <button
                  onClick={() => setTableFilter('ALL')}
                  className={`px-2 py-0.5 rounded-xs text-[10px] ${
                    tableFilter === 'ALL' ? 'bg-amber-500 text-black font-bold' : 'bg-[#181c2b] text-neutral-300'
                  }`}
                >
                  ALL ({sweepRecords.length})
                </button>
                <button
                  onClick={() => setTableFilter('SAFE_ONLY')}
                  className={`px-2 py-0.5 rounded-xs text-[10px] ${
                    tableFilter === 'SAFE_ONLY' ? 'bg-emerald-600 text-white font-bold' : 'bg-[#181c2b] text-neutral-300'
                  }`}
                >
                  SAFE ONLY
                </button>
                <button
                  onClick={() => setTableFilter('COLLISION_ONLY')}
                  className={`px-2 py-0.5 rounded-xs text-[10px] ${
                    tableFilter === 'COLLISION_ONLY' ? 'bg-rose-700 text-white font-bold' : 'bg-[#181c2b] text-neutral-300'
                  }`}
                >
                  IMPACT ONLY
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={11} className="absolute left-2 top-2 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Search results..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-[#141724] border border-[#2b3147] rounded-xs pl-6 pr-2 py-1 text-[11px] text-white"
                  />
                </div>
                <span className="text-[10px] text-neutral-500">
                  Showing {displayRecords.length} of {sweepRecords.length}
                </span>
              </div>
            </div>

            {/* Rich Sweep Results Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#222838] text-neutral-400 text-[10px] uppercase">
                    <th
                      className="py-2 px-2.5 cursor-pointer hover:text-white"
                      onClick={() => {
                        setSortField('inputParamValue');
                        setSortAsc((prev) => !prev);
                      }}
                    >
                      <div className="flex items-center gap-1">
                        VALUE ({builderParam}) <ArrowUpDown size={10} />
                      </div>
                    </th>
                    <th
                      className="py-2 px-2.5 cursor-pointer hover:text-white"
                      onClick={() => {
                        setSortField('deflectionAngleDeg');
                        setSortAsc((prev) => !prev);
                      }}
                    >
                      <div className="flex items-center gap-1">
                        DEFLECTION (δ) <ArrowUpDown size={10} />
                      </div>
                    </th>
                    <th className="py-2 px-2.5">IMPACT PARAM (b)</th>
                    <th className="py-2 px-2.5">ALTITUDE (hp)</th>
                    <th
                      className="py-2 px-2.5 cursor-pointer hover:text-white"
                      onClick={() => {
                        setSortField('deltaVSpeedKmPerS');
                        setSortAsc((prev) => !prev);
                      }}
                    >
                      <div className="flex items-center gap-1">
                        SUN ΔV (km/s) <ArrowUpDown size={10} />
                      </div>
                    </th>
                    <th className="py-2 px-2.5">VECTOR ||ΔV||</th>
                    <th className="py-2 px-2.5">ENERGY (Δε)</th>
                    <th className="py-2 px-2.5">STATUS</th>
                    <th className="py-2 px-2.5 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181d2b]">
                  {displayRecords.map((row) => (
                    <tr
                      key={row.stepIndex}
                      className={row.isCollision ? 'bg-rose-950/20 text-rose-300' : 'text-neutral-200'}
                    >
                      <td className="py-2 px-2.5 font-bold text-amber-300">
                        {row.inputParamValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
                        {row.inputParamUnit}
                      </td>
                      <td className="py-2 px-2.5 font-semibold text-amber-400">
                        {row.deflectionAngleDeg.toFixed(2)}°
                      </td>
                      <td className="py-2 px-2.5 text-neutral-300">
                        {row.impactParameterKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
                      </td>
                      <td className="py-2 px-2.5 text-sky-300">
                        {row.closestApproachAltitudeKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
                      </td>
                      <td className="py-2 px-2.5 font-bold text-emerald-400">
                        {row.deltaVSpeedKmPerS >= 0 ? '+' : ''}
                        {row.deltaVSpeedKmPerS.toFixed(2)} km/s
                      </td>
                      <td className="py-2 px-2.5 text-cyan-400">
                        {row.deltaVVectorMagKmPerS.toFixed(2)} km/s
                      </td>
                      <td className="py-2 px-2.5 text-neutral-400">
                        {row.deltaSpecificEnergyMJPerKg.toFixed(2)} MJ/kg
                      </td>
                      <td className="py-2 px-2.5">
                        {row.isCollision ? (
                          <span className="px-2 py-0.5 rounded-xs bg-rose-900/60 text-rose-300 border border-rose-600 text-[10px] font-bold">
                            SURFACE IMPACT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-xs bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]">
                            SAFE FLYBY
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 text-right">
                        <button
                          onClick={() => {
                            onLoadPreset({
                              planet: builderPlanet,
                              vInfSpeedMPerS: builderBaseVInf,
                              targetPeriapsisM: row.closestApproachRadiusKm * 1000.0,
                              passType: builderBasePass,
                              spacecraftMassKg: builderBaseMass,
                            });
                          }}
                          className="px-2 py-1 bg-[#1a1f30] hover:bg-amber-500 hover:text-black rounded-xs text-[10px] font-mono transition-colors"
                        >
                          LOAD ROW
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: EXPERIMENT A — CLOSEST APPROACH DISTANCE */}
        {activeTab === 'EXP_A' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-mono text-sm font-bold text-amber-400 uppercase">
                  Experiment A — Closest-Approach Distance (rp) Sweep
                </h4>
                <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed mt-1">
                  Holding planet (Jupiter) and incoming speed (10.0 km/s) constant, we vary periapsis radius from sub-surface
                  (0.8 Rp) to distant flybys (6.0 Rp). Demonstrates turning angle growth (sin(δ/2) = 1/e) and flags collisions.
                </p>
              </div>
              <button
                onClick={() =>
                  onLoadPreset({
                    planet: PLANETARY_BODIES.JUPITER,
                    vInfSpeedMPerS: 10000.0,
                    targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM * 1.5,
                    passType: 'TRAILING',
                  })
                }
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold rounded-xs flex items-center gap-1.5 transition-colors"
              >
                <Play size={12} /> LOAD INTO 3D SIMULATOR
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#222838] text-neutral-400 text-[10px] uppercase">
                    <th className="py-2 px-3">PERIAPSIS (rp)</th>
                    <th className="py-2 px-3">ALTITUDE (hp)</th>
                    <th className="py-2 px-3">DEFLECTION (δ)</th>
                    <th className="py-2 px-3">SUN ΔV (km/s)</th>
                    <th className="py-2 px-3">SPECIFIC ENERGY (MJ/kg)</th>
                    <th className="py-2 px-3">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181d2b]">
                  {expAData.map((row) => (
                    <tr
                      key={row.stepIndex}
                      className={row.isCollision ? 'bg-rose-950/20 text-rose-300' : 'text-neutral-200'}
                    >
                      <td className="py-2 px-3 font-bold">
                        {(row.closestApproachRadiusKm / (PLANETARY_BODIES.JUPITER.radiusM / 1000.0)).toFixed(2)} R_J
                      </td>
                      <td className="py-2 px-3">{row.closestApproachAltitudeKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km</td>
                      <td className="py-2 px-3 font-semibold text-amber-400">{row.deflectionAngleDeg.toFixed(1)}°</td>
                      <td className="py-2 px-3 text-sky-400">+{row.deltaVSpeedKmPerS.toFixed(2)} km/s</td>
                      <td className="py-2 px-3">{row.deltaSpecificEnergyMJPerKg.toFixed(2)} MJ/kg</td>
                      <td className="py-2 px-3">
                        {row.isCollision ? (
                          <span className="px-2 py-0.5 rounded-xs bg-rose-900/60 text-rose-300 border border-rose-600 text-[10px] font-bold">
                            SURFACE IMPACT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-xs bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]">
                            SAFE FLYBY
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: EXPERIMENT B — INCOMING SPEED */}
        {activeTab === 'EXP_B' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-mono text-sm font-bold text-amber-400 uppercase">
                  Experiment B — Incoming Excess Speed (v_∞) Sweep
                </h4>
                <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed mt-1">
                  Holding periapsis constant at 1.5 R_J, we increase incoming speed from 3.0 km/s to 30.0 km/s.
                  As v_∞ increases, eccentricity e = 1 + rp·v_∞² / μ surges, causing the deflection angle to sharply decline.
                </p>
              </div>
              <button
                onClick={() =>
                  onLoadPreset({
                    planet: PLANETARY_BODIES.JUPITER,
                    vInfSpeedMPerS: 5000.0,
                    targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM * 1.5,
                    passType: 'TRAILING',
                  })
                }
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold rounded-xs flex items-center gap-1.5 transition-colors"
              >
                <Play size={12} /> LOAD INTO 3D SIMULATOR
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#222838] text-neutral-400 text-[10px] uppercase">
                    <th className="py-2 px-3">INCOMING SPEED (v_∞)</th>
                    <th className="py-2 px-3">DEFLECTION ANGLE (δ)</th>
                    <th className="py-2 px-3">SUN BOOST (+ΔV)</th>
                    <th className="py-2 px-3">VECTOR ||ΔV||</th>
                    <th className="py-2 px-3">SPECIFIC ENERGY (MJ/kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181d2b]">
                  {expBData.map((row) => (
                    <tr key={row.stepIndex} className="text-neutral-200">
                      <td className="py-2 px-3 font-bold">{(row.inputParamValue / 1000.0).toFixed(1)} km/s</td>
                      <td className="py-2 px-3 font-semibold text-amber-400">{row.deflectionAngleDeg.toFixed(1)}°</td>
                      <td className="py-2 px-3 text-sky-400">+{row.deltaVSpeedKmPerS.toFixed(2)} km/s</td>
                      <td className="py-2 px-3 text-cyan-400">{row.deltaVVectorMagKmPerS.toFixed(2)} km/s</td>
                      <td className="py-2 px-3">{row.deltaSpecificEnergyMJPerKg.toFixed(2)} MJ/kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: EXPERIMENT C — PLANETARY GRAVITY STRENGTH */}
        {activeTab === 'EXP_C' && (
          <div className="flex flex-col gap-4">
            <h4 className="font-mono text-sm font-bold text-amber-400 uppercase">
              Experiment C — Planetary Gravitational Strength Comparison
            </h4>
            <div className="bg-[#121522] border border-[#23293d] p-3 rounded-xs text-xs text-neutral-300 leading-relaxed font-mono">
              <strong>ASTRODYNAMIC PRINCIPLE:</strong> {expCData.explanation}
            </div>

            {/* Controlled Comparison 1: Equal Periapsis Radius */}
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs font-bold text-sky-400">
                COMPARISON 1: EQUAL PERIAPSIS RADIUS (rp = 104,866 km)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {expCData.equalRadiusRecords.map((r) => (
                  <div key={r.planetName} className="bg-[#141622] border border-[#23283c] p-3 rounded-xs flex flex-col gap-1.5 font-mono text-xs">
                    <span className="font-bold text-white text-xs">{r.planetName.toUpperCase()}</span>
                    <div className="text-neutral-400 text-[11px]">Altitude: {r.closestApproachAltitudeKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km</div>
                    <div className="text-amber-400 font-bold">Deflection: {r.deflectionAngleDeg.toFixed(1)}°</div>
                    <div className="text-emerald-400 font-bold">Sun ΔV: +{r.deltaVSpeedKmPerS.toFixed(2)} km/s</div>
                    <div className="text-cyan-400">Vector ||ΔV||: {r.deltaVVectorMagKmPerS.toFixed(2)} km/s</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Controlled Comparison 2: Equal Surface Altitude */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[#1f2436]">
              <span className="font-mono text-xs font-bold text-emerald-400">
                COMPARISON 2: EQUAL PHYSICAL SURFACE ALTITUDE (hp = 50,000 km)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {expCData.equalAltitudeRecords.map((r) => (
                  <div key={r.planetName} className="bg-[#141622] border border-[#23283c] p-3 rounded-xs flex flex-col gap-1.5 font-mono text-xs">
                    <span className="font-bold text-white text-xs">{r.planetName.toUpperCase()}</span>
                    <div className="text-neutral-400 text-[11px]">Radius (rp): {r.closestApproachRadiusKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km</div>
                    <div className="text-amber-400 font-bold">Deflection: {r.deflectionAngleDeg.toFixed(1)}°</div>
                    <div className="text-emerald-400 font-bold">Sun ΔV: +{r.deltaVSpeedKmPerS.toFixed(2)} km/s</div>
                    <div className="text-cyan-400">Vector ||ΔV||: {r.deltaVVectorMagKmPerS.toFixed(2)} km/s</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: EXPERIMENT D — FLYBY ORIENTATION */}
        {activeTab === 'EXP_D' && (
          <div className="flex flex-col gap-4">
            <h4 className="font-mono text-sm font-bold text-amber-400 uppercase">
              Experiment D — Flyby Orientation Geometry (Trailing vs. Leading)
            </h4>
            <p className="text-xs text-neutral-400 max-w-3xl leading-relaxed">
              In the planet's rest frame, both passes conserve incoming speed strictly: ||v_inf(+)|| = ||v_inf(-)||.
              However, in the Sun's frame, momentum exchange V_p · Δv_vector produces either accelerated slingshots (+ΔV)
              or planetary gravity-braking drops (-ΔV).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Trailing */}
              <div className="bg-[#141622] border border-amber-500/40 p-4 rounded-xs flex flex-col gap-3 font-mono text-xs">
                <div className="flex justify-between items-center border-b border-[#23283c] pb-2">
                  <span className="font-bold text-amber-400">TRAILING PASS (ACCELERATION +)</span>
                  <button
                    onClick={() =>
                      onLoadPreset({
                        planet: PLANETARY_BODIES.JUPITER,
                        vInfSpeedMPerS: 12000.0,
                        targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM + 50000000.0,
                        passType: 'TRAILING',
                      })
                    }
                    className="px-2 py-1 bg-amber-500 text-black text-[10px] font-bold rounded-xs"
                  >
                    SIMULATE
                  </button>
                </div>
                <div className="space-y-1.5 text-neutral-300">
                  <div>• Spacecraft crosses behind the planet in its orbital trail</div>
                  <div>• V_p · Δv_vector: <strong className="text-emerald-400">+{expDData.vectorAnalysis.dotProductTrailingMPerS2.toExponential(2)} m²/s²</strong></div>
                  <div>• Sun Speed Change: <strong className="text-emerald-400">+{(expDData.vectorAnalysis.speedGainTrailingMPerS / 1000.0).toFixed(2)} km/s</strong></div>
                  <div>• Specific Energy Shift: <strong className="text-emerald-400">+{expDData.vectorAnalysis.energyGainTrailingMJPerKg.toFixed(2)} MJ/kg</strong></div>
                  <div className="text-neutral-500 text-[10px]">Used by: Voyager 1 & 2, New Horizons (solar escape)</div>
                </div>
              </div>

              {/* Leading */}
              <div className="bg-[#141622] border border-rose-500/40 p-4 rounded-xs flex flex-col gap-3 font-mono text-xs">
                <div className="flex justify-between items-center border-b border-[#23283c] pb-2">
                  <span className="font-bold text-rose-400">LEADING PASS (GRAVITY BRAKE -)</span>
                  <button
                    onClick={() =>
                      onLoadPreset({
                        planet: PLANETARY_BODIES.JUPITER,
                        vInfSpeedMPerS: 12000.0,
                        targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM + 50000000.0,
                        passType: 'LEADING',
                      })
                    }
                    className="px-2 py-1 bg-rose-500 text-white text-[10px] font-bold rounded-xs"
                  >
                    SIMULATE
                  </button>
                </div>
                <div className="space-y-1.5 text-neutral-300">
                  <div>• Spacecraft crosses ahead of the planet in its orbital path</div>
                  <div>• V_p · Δv_vector: <strong className="text-rose-400">{expDData.vectorAnalysis.dotProductLeadingMPerS2.toExponential(2)} m²/s²</strong></div>
                  <div>• Sun Speed Change: <strong className="text-rose-400">{(expDData.vectorAnalysis.speedGainLeadingMPerS / 1000.0).toFixed(2)} km/s</strong></div>
                  <div>• Specific Energy Shift: <strong className="text-rose-400">{expDData.vectorAnalysis.energyGainLeadingMJPerKg.toFixed(2)} MJ/kg</strong></div>
                  <div className="text-neutral-500 text-[10px]">Used by: Mariner 10, MESSENGER, Parker Solar Probe</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: EXPERIMENT E — JUPITER VS SATURN */}
        {activeTab === 'EXP_E' && (
          <div className="flex flex-col gap-3">
            <h4 className="font-mono text-sm font-bold text-amber-400 uppercase">
              Experiment E — Jupiter versus Saturn Astrodynamic Comparison
            </h4>
            <p className="text-xs text-neutral-400 max-w-3xl leading-relaxed">
              Matched comparison at excess speed v_∞ = 12.0 km/s and surface altitude hp = 50,000 km.
              {expEData.explanation}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div className="bg-[#141622] border border-[#23283c] p-4 rounded-xs flex flex-col gap-2 font-mono text-xs">
                <span className="font-bold text-amber-400">JUPITER (5.20 AU)</span>
                <div>Standard μ: {PLANETARY_BODIES.JUPITER.mu.toExponential(4)} m³/s²</div>
                <div>Orbital Speed (V_p): {(PLANETARY_BODIES.JUPITER.orbitalSpeedMPerS / 1000.0).toFixed(2)} km/s</div>
                <div>Turning Angle: <strong className="text-amber-400">{expEData.jupiter.deflectionAngleDeg.toFixed(1)}°</strong></div>
                <div>Sun-Frame Boost: <strong className="text-emerald-400">+{(expEData.jupiter.deltaVSunSpeedMPerS / 1000.0).toFixed(2)} km/s</strong></div>
                <div>Vector ||ΔV||: <strong className="text-cyan-400">+{(expEData.jupiter.deltaVVectorMagnitudeMPerS / 1000.0).toFixed(2)} km/s</strong></div>
              </div>

              <div className="bg-[#141622] border border-[#23283c] p-4 rounded-xs flex flex-col gap-2 font-mono text-xs">
                <span className="font-bold text-[#e0cda9]">SATURN (9.58 AU)</span>
                <div>Standard μ: {PLANETARY_BODIES.SATURN.mu.toExponential(4)} m³/s²</div>
                <div>Orbital Speed (V_p): {(PLANETARY_BODIES.SATURN.orbitalSpeedMPerS / 1000.0).toFixed(2)} km/s</div>
                <div>Turning Angle: <strong className="text-amber-400">{expEData.saturn.deflectionAngleDeg.toFixed(1)}°</strong></div>
                <div>Sun-Frame Boost: <strong className="text-emerald-400">+{(expEData.saturn.deltaVSunSpeedMPerS / 1000.0).toFixed(2)} km/s</strong></div>
                <div>Vector ||ΔV||: <strong className="text-cyan-400">+{(expEData.saturn.deltaVVectorMagnitudeMPerS / 1000.0).toFixed(2)} km/s</strong></div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: EXPERIMENT F — SPACECRAFT MASS INVARIANCE */}
        {activeTab === 'EXP_F' && (
          <div className="flex flex-col gap-3">
            <h4 className="font-mono text-sm font-bold text-amber-400 uppercase">
              Experiment F — Spacecraft Mass Invariance Principle
            </h4>
            <p className="text-xs text-neutral-400 max-w-3xl leading-relaxed">
              In Newton's universal gravitation, F = G(M·m)/r² = m·a implies a = -μ/r² r̂.
              The probe's mass m cancels completely from the acceleration equation! Consequently, a 1 kg CubeSat
              and a 100,000 kg transport follow the EXACT identical geometric trajectory, while total kinetic energy
              ΔK = 0.5·m(v_out² - v_in²) scales strictly linearly with mass.
            </p>

            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#222838] text-neutral-400 text-[10px] uppercase">
                    <th className="py-2 px-3">PROBE MASS (m)</th>
                    <th className="py-2 px-3">PERIAPSIS (rp)</th>
                    <th className="py-2 px-3">DEFLECTION (δ)</th>
                    <th className="py-2 px-3">SUN ΔV</th>
                    <th className="py-2 px-3">TOTAL KINETIC ENERGY (ΔK)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181d2b]">
                  {expFData.map((row) => (
                    <tr key={row.stepIndex} className="text-neutral-200">
                      <td className="py-2 px-3 font-bold text-amber-300">
                        {row.inputParamValue.toLocaleString()} kg
                      </td>
                      <td className="py-2 px-3 text-sky-400">
                        {row.closestApproachRadiusKm.toLocaleString()} km (IDENTICAL)
                      </td>
                      <td className="py-2 px-3 font-semibold text-amber-400">
                        {row.deflectionAngleDeg.toFixed(2)}° (IDENTICAL)
                      </td>
                      <td className="py-2 px-3 text-emerald-400">
                        +{row.deltaVSpeedKmPerS.toFixed(2)} km/s (IDENTICAL)
                      </td>
                      <td className="py-2 px-3 text-cyan-400 font-bold">
                        {row.deltaTotalKineticEnergyGJ.toFixed(4)} GJ
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
