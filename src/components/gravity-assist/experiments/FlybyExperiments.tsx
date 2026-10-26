import React, { useState, useMemo, useCallback } from 'react';
import { PlanetaryBodyData, PLANETARY_BODIES } from '../../../physics/constants';
import { FlybyEngine, FlybyPassType, FlybyInitialConditions, Vector3D } from '../../../physics/FlybyEngine';
import {
  FlybyExperimentEngine,
  SweepParameter,
  SweepConfig,
  ExperimentRecord,
  SavedExperiment,
  NumericalValidationPoint,
  RunComparisonMetric,
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
  Copy,
  FileText,
  Layers,
  HelpCircle,
  RefreshCw,
  Check,
  Info,
} from 'lucide-react';

interface FlybyExperimentsProps {
  onLoadPreset: (config: Partial<FlybyInitialConditions>) => void;
}

type TabId =
  | 'BUILDER'
  | 'EXP_A'
  | 'EXP_B'
  | 'EXP_C'
  | 'EXP_D'
  | 'EXP_E'
  | 'EXP_F'
  | 'COMPARISON'
  | 'EXPLANATIONS'
  | 'REPORT';

export const FlybyExperiments: React.FC<FlybyExperimentsProps> = ({ onLoadPreset }) => {
  const [activeTab, setActiveTab] = useState<TabId>('BUILDER');

  // --- EXPERIMENT BUILDER STATE ---
  const [experimentTitle, setExperimentTitle] = useState<string>('Jupiter Periapsis Sweep #1');
  const [builderPlanet, setBuilderPlanet] = useState<PlanetaryBodyData>(PLANETARY_BODIES.JUPITER);
  const [builderParam, setBuilderParam] = useState<SweepParameter>('periapsisAltitudeKm');
  const [builderMin, setBuilderMin] = useState<number>(5000);
  const [builderMax, setBuilderMax] = useState<number>(250000);
  const [builderSamples, setBuilderSamples] = useState<number>(10);
  const [builderBaseVInf, setBuilderBaseVInf] = useState<number>(10000);
  const [builderBaseAltKm, setBuilderBaseAltKm] = useState<number>(50000);
  const [builderBasePass, setBuilderBasePass] = useState<FlybyPassType>('TRAILING');
  const [builderBaseMass, setBuilderBaseMass] = useState<number>(1000);
  const [builderScale, setBuilderScale] = useState<'LINEAR' | 'LOGARITHMIC'>('LINEAR');

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

  // Side-by-Side Comparison Selection
  const [selectedComparisonRuns, setSelectedComparisonRuns] = useState<ExperimentRecord[]>(() => {
    const defaultA = FlybyExperimentEngine.runExperimentA_ClosestApproach(PLANETARY_BODIES.JUPITER, 10000, 'TRAILING', 4);
    return defaultA.slice(0, 3);
  });
  const [selectedMetricCategories, setSelectedMetricCategories] = useState<string[]>([
    'CONFIG',
    'GEOMETRY',
    'VELOCITY',
    'ENERGY',
    'DIAGNOSTICS',
  ]);

  // Report Copy State
  const [reportCopied, setReportCopied] = useState<boolean>(false);

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
      case 'approachAngleDeg':
        setBuilderMin(0);
        setBuilderMax(315);
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
      scale: builderScale,
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
    builderScale,
    builderPlanet,
    builderBaseVInf,
    builderBaseAltKm,
    builderBasePass,
    builderBaseMass,
  ]);

  // Export CSV
  const handleExportCSV = useCallback(() => {
    const csvContent = FlybyExperimentEngine.exportExperimentToCSV(sweepRecords, {
      title: experimentTitle,
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
  }, [
    sweepRecords,
    experimentTitle,
    builderPlanet,
    builderParam,
    builderBaseVInf,
    builderBaseAltKm,
    builderBasePass,
    builderBaseMass,
  ]);

  // Save Experiment
  const handleSaveExperiment = useCallback(() => {
    const exp: SavedExperiment = {
      id: `exp-${Date.now()}`,
      title: experimentTitle || `${builderPlanet.name} ${builderParam} Sweep`,
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
    experimentTitle,
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

  // Repeat Saved Experiment with identical solver settings
  const handleRepeatExperiment = useCallback(
    (exp: SavedExperiment) => {
      const planetObj =
        Object.values(PLANETARY_BODIES).find(
          (p) => p.name.toLowerCase() === exp.baseline.planetName.toLowerCase()
        ) || PLANETARY_BODIES.JUPITER;

      setExperimentTitle(exp.title + ' (Repeated)');
      setBuilderPlanet(planetObj);
      setBuilderBaseVInf(exp.baseline.vInfSpeedMPerS);
      setBuilderBaseAltKm(exp.baseline.periapsisAltitudeKm);
      setBuilderBasePass(exp.baseline.passType);
      setBuilderBaseMass(exp.baseline.spacecraftMassKg);
      setBuilderParam(exp.sweepConfig.parameter);
      setBuilderMin(exp.sweepConfig.minValue);
      setBuilderMax(exp.sweepConfig.maxValue);
      setBuilderSamples(exp.sweepConfig.sampleCount);

      const baseline: FlybyInitialConditions = {
        planet: planetObj,
        vInfSpeedMPerS: exp.baseline.vInfSpeedMPerS,
        targetPeriapsisM: planetObj.radiusM + exp.baseline.periapsisAltitudeKm * 1000.0,
        passType: exp.baseline.passType,
        spacecraftMassKg: exp.baseline.spacecraftMassKg,
      };

      const freshResults = FlybyExperimentEngine.runParameterSweep(baseline, exp.sweepConfig);
      setSweepRecords(freshResults);
      setShowSavedDrawer(false);
      setActiveTab('BUILDER');
    },
    []
  );

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

  // --- EXPERIMENT TEMPLATES DATA ---
  // Template A: Planetary Mass (Equal Radius vs Equal Altitude toggle + Custom Mass)
  const [templateAMode, setTemplateAMode] = useState<'RADIUS' | 'ALTITUDE'>('RADIUS');
  const [templateACustomMassScale, setTemplateACustomMassScale] = useState<number>(1.0);
  const templateAData = useMemo(() => {
    return FlybyExperimentEngine.runTemplateA_PlanetaryMass(10000.0, 'TRAILING');
  }, []);

  const templateACustomPlanet = useMemo<PlanetaryBodyData>(() => {
    return {
      id: 'custom_planet',
      name: `Custom (${templateACustomMassScale.toFixed(2)}x Earth)`,
      massKg: PLANETARY_BODIES.EARTH.massKg * templateACustomMassScale,
      mu: PLANETARY_BODIES.EARTH.mu * templateACustomMassScale,
      radiusM: PLANETARY_BODIES.EARTH.radiusM * Math.cbrt(templateACustomMassScale),
      orbitalSpeedMPerS: PLANETARY_BODIES.EARTH.orbitalSpeedMPerS,
      semiMajorAxisM: PLANETARY_BODIES.EARTH.semiMajorAxisM,
      color: '#38bdf8',
      description: 'Hypothetical planetary mass variation test body',
    };
  }, [templateACustomMassScale]);

  const templateACustomRecord = useMemo<ExperimentRecord>(() => {
    const fixedRadiusKm = 104866.5;
    const fixedAltKm = 50000.0;
    const rpM =
      templateAMode === 'RADIUS'
        ? fixedRadiusKm * 1000.0
        : templateACustomPlanet.radiusM + fixedAltKm * 1000.0;

    const analytical = FlybyEngine.computeAnalytical({
      planet: templateACustomPlanet,
      vInfSpeedMPerS: 10000.0,
      targetPeriapsisM: rpM,
      passType: 'TRAILING',
      spacecraftMassKg: 1000,
    });

    return {
      stepIndex: 99,
      scenarioName: `Custom Mass: ${templateACustomPlanet.name}`,
      planetName: templateACustomPlanet.name,
      modelType: 'Newton-Kepler Patched Conic',
      inputParamName: templateAMode === 'RADIUS' ? 'Equal Radius' : 'Equal Altitude',
      inputParamValue: templateACustomMassScale,
      inputParamUnit: 'M_earth',
      deflectionAngleDeg: analytical.deflectionAngleDeg,
      deflectionAngleRad: analytical.deflectionAngleRad,
      impactParameterKm: analytical.impactParameterM / 1000.0,
      closestApproachRadiusKm: rpM / 1000.0,
      closestApproachAltitudeKm: (rpM - templateACustomPlanet.radiusM) / 1000.0,
      vInPlanetVectorMPerS: analytical.vInfMinusMPerS,
      vOutPlanetVectorMPerS: analytical.vInfPlusMPerS,
      vInSunVectorMPerS: analytical.vInSunMPerS,
      vOutSunVectorMPerS: analytical.vOutSunMPerS,
      vInfPlanetInKmPerS: 10.0,
      vInfPlanetOutKmPerS: 10.0,
      vSunInKmPerS: analytical.vInSunSpeedMPerS / 1000.0,
      vSunOutKmPerS: analytical.vOutSunSpeedMPerS / 1000.0,
      deltaVSpeedKmPerS: analytical.deltaVSunSpeedMPerS / 1000.0,
      deltaVVectorMagKmPerS: analytical.deltaVVectorMagnitudeMPerS / 1000.0,
      deltaSpecificEnergyMJPerKg: analytical.deltaSpecificEnergyJPerKg / 1e6,
      deltaTotalKineticEnergyGJ: analytical.deltaKineticEnergyJ / 1e9,
      isCollision: analytical.isPhysicalCollision,
      collisionStatus: analytical.isPhysicalCollision ? 'SURFACE_IMPACT' : 'SAFE_FLYBY',
    };
  }, [templateAMode, templateACustomPlanet, templateACustomMassScale]);

  // Template B: Flyby Distance
  const templateBData = useMemo(() => {
    return FlybyExperimentEngine.runTemplateB_FlybyDistance(PLANETARY_BODIES.JUPITER, 10000.0, 'TRAILING', 9);
  }, []);

  // Template C: Incoming Speed
  const templateCData = useMemo(() => {
    return FlybyExperimentEngine.runTemplateC_IncomingSpeed(
      PLANETARY_BODIES.JUPITER,
      PLANETARY_BODIES.JUPITER.radiusM * 1.5,
      'TRAILING',
      9
    );
  }, []);

  // Template D: Orientation
  const templateDData = useMemo(() => {
    return FlybyExperimentEngine.runTemplateD_FlybyOrientation(
      PLANETARY_BODIES.JUPITER,
      12000.0,
      50000.0,
      8
    );
  }, []);

  // Template E: Reference Frame Comparison
  const templateEData = useMemo(() => {
    return FlybyExperimentEngine.runTemplateE_ReferenceFrameComparison(
      PLANETARY_BODIES.JUPITER,
      12000.0,
      50000.0
    );
  }, []);

  // Template F: Numerical Validation
  const templateFData = useMemo(() => {
    return FlybyExperimentEngine.runTemplateF_NumericalValidation(
      PLANETARY_BODIES.JUPITER,
      12000.0,
      PLANETARY_BODIES.JUPITER.radiusM * 1.5,
      'TRAILING',
      [0.05, 0.02, 0.01, 0.005, 0.002]
    );
  }, []);

  // Scientific Explanations
  const scientificExplanations = useMemo(() => {
    return FlybyExperimentEngine.getScientificExplanations();
  }, []);

  // Comparison Metrics Catalog
  const comparisonMetricsCatalog = useMemo(() => {
    return FlybyExperimentEngine.getComparisonMetrics();
  }, []);

  // College Lab Report Generator Text
  const collegeLabReportText = useMemo(() => {
    const baseline: FlybyInitialConditions = {
      planet: builderPlanet,
      vInfSpeedMPerS: builderBaseVInf,
      targetPeriapsisM: builderPlanet.radiusM + builderBaseAltKm * 1000.0,
      passType: builderBasePass,
      spacecraftMassKg: builderBaseMass,
    };
    return FlybyExperimentEngine.generatePhysicsLabReport(
      experimentTitle || `${builderPlanet.name} Astrodynamics Study`,
      baseline,
      sweepRecords
    );
  }, [
    experimentTitle,
    builderPlanet,
    builderBaseVInf,
    builderBaseAltKm,
    builderBasePass,
    builderBaseMass,
    sweepRecords,
  ]);

  // Handle Add to Comparison
  const handleToggleComparisonRun = (record: ExperimentRecord) => {
    setSelectedComparisonRuns((prev) => {
      const exists = prev.some((r) => r.scenarioName === record.scenarioName && r.stepIndex === record.stepIndex);
      if (exists) {
        return prev.filter((r) => !(r.scenarioName === record.scenarioName && r.stepIndex === record.stepIndex));
      } else {
        if (prev.length >= 6) {
          alert('Maximum 6 runs can be compared side-by-side.');
          return prev;
        }
        return [...prev, record];
      }
    });
  };

  return (
    <div className="w-full bg-white border border-[#DCE3EE] p-5 rounded-xl flex flex-col gap-5 text-[#263247] shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EE] pb-3">
        <div className="flex items-center gap-2">
          <FlaskConical size={18} className="text-[#059669]" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#14426B]">
            ASTRA SCIENTIFIC EXPERIMENT & ANALYSIS DASHBOARD
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-[#68758A]">
          <span className="bg-[#EEF2F8] px-2.5 py-1 rounded-md border border-[#DCE3EE] text-[#1D6C50] font-semibold">
            PHASE 4: EXPERIMENTATION & VERIFICATION
          </span>
          <button
            onClick={() => setShowSavedDrawer((prev) => !prev)}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#EEF2F8] hover:bg-[#E2E8F0] text-[#0284C7] rounded-lg border border-[#DCE3EE] transition-colors cursor-pointer"
          >
            <BookmarkPlus size={11} />
            SAVED EXPERIMENTS ({savedExperiments.length})
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5 font-mono text-[10px]">
        {[
          { id: 'BUILDER', label: '⚡ BUILDER' },
          { id: 'EXP_A', label: 'EXP A: MASS' },
          { id: 'EXP_B', label: 'EXP B: DISTANCE' },
          { id: 'EXP_C', label: 'EXP C: SPEED' },
          { id: 'EXP_D', label: 'EXP D: GEOMETRY' },
          { id: 'EXP_E', label: 'EXP E: FRAMES' },
          { id: 'EXP_F', label: 'EXP F: VALIDATION' },
          { id: 'COMPARISON', label: '📊 COMPARE' },
          { id: 'EXPLANATIONS', label: '💡 THEORY' },
          { id: 'REPORT', label: '📝 REPORT' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabId)}
            className={`py-2 px-1 rounded-lg border text-center transition-colors truncate font-semibold cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#AEE5D0] text-[#1D6C50] font-bold border-[#AEE5D0] shadow-2xs'
                : 'bg-[#F8FAFD] text-[#68758A] border-[#DCE3EE] hover:text-[#263247] hover:bg-[#EEF2F8]'
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
                  className="bg-[#121520] border border-[#222838] p-2 rounded-xs flex items-center justify-between text-[11px]"
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
                      onClick={() => handleRepeatExperiment(exp)}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-xs text-[10px] flex items-center gap-1"
                      title="Repeat this experiment under identical solver settings"
                    >
                      <RefreshCw size={10} /> REPEAT RUN
                    </button>
                    <button
                      onClick={() => {
                        setSweepRecords(exp.records);
                        setShowSavedDrawer(false);
                      }}
                      className="px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xs text-[10px]"
                    >
                      RESTORE TABLE
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
        {/* ========================================================================= */}
        {/* TAB 1: REUSABLE CONTROLLED EXPERIMENT BUILDER */}
        {/* ========================================================================= */}
        {activeTab === 'BUILDER' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2436] pb-3">
              <div>
                <h4 className="font-mono text-sm font-bold text-amber-400 uppercase flex items-center gap-2">
                  <Sliders size={16} /> REUSABLE PARAMETRIC SWEEP BUILDER
                </h4>
                <p className="text-xs text-neutral-400 max-w-3xl leading-relaxed mt-1">
                  Design controlled astrodynamical experiments. Isolate one independent variable while holding all other physical parameters strictly invariant.
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

            {/* Experiment Name Field */}
            <div className="bg-[#11131c] p-2.5 rounded-xs border border-[#212638] flex flex-wrap items-center gap-3 text-xs font-mono">
              <label className="text-neutral-400 font-bold uppercase text-[10px]">EXPERIMENT NAME:</label>
              <input
                type="text"
                value={experimentTitle}
                onChange={(e) => setExperimentTitle(e.target.value)}
                placeholder="Enter unique experiment identifier..."
                className="flex-1 bg-[#181c2b] border border-[#2d344d] rounded-xs px-2.5 py-1 text-white text-xs"
              />
            </div>

            {/* Sweep Configuration Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#11131c] p-3.5 rounded-xs border border-[#212638] text-xs font-mono">
              {/* Column 1: Baseline Environment */}
              <div className="flex flex-col gap-2">
                <span className="font-bold text-amber-400 uppercase text-[11px]">1. Baseline Scenario</span>
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-0.5">TARGET CELESTIAL BODY</label>
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
                <span className="font-bold text-sky-400 uppercase text-[11px]">2. Independent Parameter</span>
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
                    <option value="approachAngleDeg">Approach Direction Angle (theta) [deg]</option>
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

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between items-center mb-0.5">
                      <label className="text-[10px] text-neutral-400">SAMPLES</label>
                      <span className="text-[10px] text-sky-400 font-bold">{builderSamples}</span>
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
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">SCALE</label>
                    <select
                      value={builderScale}
                      onChange={(e) => setBuilderScale(e.target.value as 'LINEAR' | 'LOGARITHMIC')}
                      className="w-full bg-[#181c2b] border border-[#2d344d] rounded-xs px-2 py-1 text-white"
                    >
                      <option value="LINEAR">LINEAR</option>
                      <option value="LOGARITHMIC">LOGARITHMIC</option>
                    </select>
                  </div>
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
                  {displayRecords.map((row) => {
                    const isCompared = selectedComparisonRuns.some(
                      (r) => r.scenarioName === row.scenarioName && r.stepIndex === row.stepIndex
                    );
                    return (
                      <tr
                        key={row.stepIndex}
                        className={row.isCollision ? 'bg-rose-950/20 text-rose-300' : 'text-neutral-200'}
                      >
                        <td className="py-2 px-2.5 font-bold text-amber-300">
                          {row.inputParamValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
                          {row.inputParamUnit}
                        </td>
                        <td className="py-2 px-2.5 font-semibold text-amber-400">
                          {row.isCollision ? (
                            <span>
                              {row.deflectionAngleDeg.toFixed(2)}°{' '}
                              <span className="text-[9px] text-rose-400 font-normal">(Unrealized)</span>
                            </span>
                          ) : (
                            `${row.deflectionAngleDeg.toFixed(2)}°`
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-neutral-300">
                          {row.impactParameterKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
                        </td>
                        <td className="py-2 px-2.5">
                          {row.closestApproachAltitudeKm < 0 ? (
                            <span className="text-rose-400 font-bold">
                              {row.closestApproachAltitudeKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km (Subsurface)
                            </span>
                          ) : (
                            <span className="text-sky-300">
                              {row.closestApproachAltitudeKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 font-bold">
                          {row.isCollision ? (
                            <span className="text-rose-400" title="Unavailable: spacecraft impacted surface prior to exit">
                              N/A (Impact)
                            </span>
                          ) : (
                            <span className={row.deltaVSpeedKmPerS >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {row.deltaVSpeedKmPerS >= 0 ? '+' : ''}
                              {row.deltaVSpeedKmPerS.toFixed(2)} km/s
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2.5">
                          {row.isCollision ? (
                            <span className="text-rose-400 font-bold" title="Unavailable: spacecraft impacted surface">
                              N/A (Impact)
                            </span>
                          ) : (
                            <span className="text-cyan-400 font-bold">
                              {row.deltaVVectorMagKmPerS.toFixed(2)} km/s
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2.5">
                          {row.isCollision ? (
                            <span className="text-rose-400 font-bold" title="Unavailable: spacecraft impacted surface">
                              N/A (Impact)
                            </span>
                          ) : (
                            <span className="text-neutral-400">
                              {row.deltaSpecificEnergyMJPerKg.toFixed(2)} MJ/kg
                            </span>
                          )}
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
                        <td className="py-2 px-2.5 text-right flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleComparisonRun(row)}
                            className={`px-2 py-1 rounded-xs text-[10px] font-mono border transition-colors ${
                              isCompared
                                ? 'bg-sky-500 text-black font-bold border-sky-400'
                                : 'bg-[#141724] hover:bg-[#1f2438] text-neutral-300 border-[#2b3147]'
                            }`}
                            title="Add/remove run from side-by-side comparison"
                          >
                            {isCompared ? 'COMPARING ✓' : '+ COMPARE'}
                          </button>
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
                            LOAD
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: TEMPLATE A — PLANETARY MASS */}
        {/* ========================================================================= */}
        {activeTab === 'EXP_A' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2436] pb-3">
              <div>
                <h4 className="font-mono text-sm font-bold text-amber-400 uppercase">
                  Experiment A — Planetary Mass & Geometric Constraints
                </h4>
                <p className="text-xs text-neutral-400 max-w-3xl leading-relaxed mt-1">
                  Compares planet presets and custom masses at the same incoming speed ($v_\infty = 10.0$ km/s) and geometry.
                  Demonstrates why physical planet radii and collision boundaries make equal-altitude comparisons inappropriate across planets, offering equal closest-approach radius ($r_p$) as the rigorous benchmark.
                </p>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center gap-1.5 bg-[#141724] p-1 rounded-xs border border-[#2b3147] text-xs font-mono">
                <span className="text-[10px] text-neutral-400 px-1.5">BENCHMARK:</span>
                <button
                  onClick={() => setTemplateAMode('RADIUS')}
                  className={`px-2.5 py-1 rounded-xs text-[10px] font-bold transition-colors ${
                    templateAMode === 'RADIUS'
                      ? 'bg-amber-500 text-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  EQUAL RADIUS (rp = 104,866 km)
                </button>
                <button
                  onClick={() => setTemplateAMode('ALTITUDE')}
                  className={`px-2.5 py-1 rounded-xs text-[10px] font-bold transition-colors ${
                    templateAMode === 'ALTITUDE'
                      ? 'bg-emerald-600 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  EQUAL ALTITUDE (hp = 50,000 km)
                </button>
              </div>
            </div>

            {/* Scientific Explanation Callout */}
            <div className="bg-[#121522] border border-[#23293d] p-3 rounded-xs text-xs text-neutral-300 leading-relaxed font-mono">
              <strong className="text-amber-400">PHYSICAL PRINCIPLE:</strong> {templateAData.explanation}
            </div>

            {/* Planet Preset Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(templateAMode === 'RADIUS'
                ? templateAData.equalRadiusRecords
                : templateAData.equalAltitudeRecords
              ).map((r) => (
                <div
                  key={r.planetName}
                  className="bg-[#141622] border border-[#23283c] p-3 rounded-xs flex flex-col gap-2 font-mono text-xs"
                >
                  <div className="flex justify-between items-center border-b border-[#23283c] pb-1.5">
                    <span className="font-bold text-white text-xs">{r.planetName.toUpperCase()}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-xs font-bold ${
                        r.isCollision
                          ? 'bg-rose-900/60 text-rose-300 border border-rose-600'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      {r.collisionStatus}
                    </span>
                  </div>
                  <div className="text-neutral-400 text-[11px]">
                    Periapsis (rp): {r.closestApproachRadiusKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
                  </div>
                  <div className="text-neutral-400 text-[11px]">
                    Altitude (hp): {r.closestApproachAltitudeKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
                  </div>
                  <div className="text-amber-400 font-bold">
                    Deflection (δ): {r.deflectionAngleDeg.toFixed(2)}°
                  </div>
                  <div className="text-emerald-400 font-bold">
                    Sun ΔV: +{r.deltaVSpeedKmPerS.toFixed(2)} km/s
                  </div>
                  <div className="text-cyan-400 text-[11px]">
                    Vector ||ΔV||: {r.deltaVVectorMagKmPerS.toFixed(2)} km/s
                  </div>
                  <button
                    onClick={() => handleToggleComparisonRun(r)}
                    className="mt-1 px-2 py-1 bg-[#1a1f30] hover:bg-sky-600 hover:text-white rounded-xs text-[10px] text-neutral-300 transition-colors"
                  >
                    + COMPARE IN DASHBOARD
                  </button>
                </div>
              ))}
            </div>

            {/* Custom Mass Interactive Explorer */}
            <div className="bg-[#11131c] border border-sky-900/40 p-3.5 rounded-xs flex flex-col gap-3 font-mono text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#23283c] pb-2">
                <span className="font-bold text-sky-400">HYPOTHETICAL CUSTOM PLANET EXPLORER</span>
                <span className="text-neutral-400 text-[11px]">
                  Mass Scale: <strong className="text-white">{templateACustomMassScale.toFixed(2)}x Earth Mass</strong>
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-neutral-500">0.05x</span>
                <input
                  type="range"
                  min="0.05"
                  max="10.0"
                  step="0.05"
                  value={templateACustomMassScale}
                  onChange={(e) => setTemplateACustomMassScale(Number(e.target.value))}
                  className="flex-1 accent-sky-400 h-1 bg-[#1a1f30] rounded-xs cursor-pointer"
                />
                <span className="text-[10px] text-neutral-500">10.0x</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#0c0e15] p-2.5 rounded-xs border border-[#1e2334] text-[11px]">
                <div>μ: {templateACustomPlanet.mu.toExponential(3)} m³/s²</div>
                <div>Radius: {(templateACustomPlanet.radiusM / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km</div>
                <div className="text-amber-400 font-bold">Deflection: {templateACustomRecord.deflectionAngleDeg.toFixed(2)}°</div>
                <div className="text-emerald-400 font-bold">Sun ΔV: +{templateACustomRecord.deltaVSpeedKmPerS.toFixed(2)} km/s</div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: TEMPLATE B — FLYBY DISTANCE */}
        {/* ========================================================================= */}
        {activeTab === 'EXP_B' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1f2436] pb-3">
              <div>
                <h4 className="font-mono text-sm font-bold text-amber-400 uppercase">
                  Experiment B — Flyby Distance vs Deflection & Collision Risk
                </h4>
                <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed mt-1">
                  Varying closest-approach altitude ($h_p$) from sub-surface impact ($h_p &lt; 0$) to distant flybys.
                  Reveals how decreasing flyby radius increases trajectory bending until encountering the physical planet surface.
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
                    <th className="py-2 px-3">IMPACT PARAMETER (b)</th>
                    <th className="py-2 px-3">SUN ΔV (km/s)</th>
                    <th className="py-2 px-3">COLLISION STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181d2b]">
                  {templateBData.map((row) => (
                    <tr
                      key={row.stepIndex}
                      className={row.isCollision ? 'bg-rose-950/20 text-rose-300' : 'text-neutral-200'}
                    >
                      <td className="py-2 px-3 font-bold">
                        {row.closestApproachRadiusKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
                      </td>
                      <td className="py-2 px-3">
                        {row.closestApproachAltitudeKm < 0 ? (
                          <span className="text-rose-400 font-bold">
                            {row.closestApproachAltitudeKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km (Subsurface)
                          </span>
                        ) : (
                          `${row.closestApproachAltitudeKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`
                        )}
                      </td>
                      <td className="py-2 px-3 font-semibold text-amber-400">
                        {row.isCollision ? (
                          <span>
                            {row.deflectionAngleDeg.toFixed(2)}°{' '}
                            <span className="text-[9px] text-rose-400 font-normal">(Unrealized)</span>
                          </span>
                        ) : (
                          `${row.deflectionAngleDeg.toFixed(2)}°`
                        )}
                      </td>
                      <td className="py-2 px-3">{row.impactParameterKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km</td>
                      <td className="py-2 px-3">
                        {row.isCollision ? (
                          <span className="text-rose-400 font-bold" title="Unavailable: Spacecraft impacted surface">
                            N/A (Impact)
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold">+{row.deltaVSpeedKmPerS.toFixed(2)} km/s</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {row.isCollision ? (
                          <span className="px-2 py-0.5 rounded-xs bg-rose-900/60 text-rose-300 border border-rose-600 text-[10px] font-bold">
                            SURFACE IMPACT (hp &lt; 0)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-xs bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]">
                            SAFE CLEARANCE
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

        {/* ========================================================================= */}
        {/* TAB 4: TEMPLATE C — INCOMING SPEED */}
        {/* ========================================================================= */}
        {activeTab === 'EXP_C' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1f2436] pb-3">
              <div>
                <h4 className="font-mono text-sm font-bold text-amber-400 uppercase">
                  Experiment C — Incoming Speed vs Deflection Angle
                </h4>
                <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed mt-1">
                  Holding planet (Jupiter) and closest approach radius ($r_p = 1.5 R_J$) strictly constant, we vary excess speed $v_\infty$ from 3 km/s to 35 km/s.
                  Demonstrates the steep inverse decay of turning angle: $\delta = 2\arcsin(1/e) \approx 2\mu / (r_p v_\infty^2)$.
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
                    <th className="py-2 px-3">IMPACT PARAMETER (b)</th>
                    <th className="py-2 px-3">SUN BOOST (+ΔV)</th>
                    <th className="py-2 px-3">VECTOR ||ΔV||</th>
                    <th className="py-2 px-3">SPECIFIC ENERGY (MJ/kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181d2b]">
                  {templateCData.map((row) => (
                    <tr key={row.stepIndex} className="text-neutral-200">
                      <td className="py-2 px-3 font-bold text-amber-300">
                        {(row.inputParamValue / 1000.0).toFixed(1)} km/s
                      </td>
                      <td className="py-2 px-3 font-semibold text-amber-400">{row.deflectionAngleDeg.toFixed(2)}°</td>
                      <td className="py-2 px-3">{row.impactParameterKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km</td>
                      <td className="py-2 px-3 text-emerald-400">+{row.deltaVSpeedKmPerS.toFixed(2)} km/s</td>
                      <td className="py-2 px-3 text-cyan-400">{row.deltaVVectorMagKmPerS.toFixed(2)} km/s</td>
                      <td className="py-2 px-3">{row.deltaSpecificEnergyMJPerKg.toFixed(2)} MJ/kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: TEMPLATE D — FLYBY ORIENTATION */}
        {/* ========================================================================= */}
        {activeTab === 'EXP_D' && (
          <div className="flex flex-col gap-4">
            <div className="border-b border-[#1f2436] pb-3">
              <h4 className="font-mono text-sm font-bold text-amber-400 uppercase">
                Experiment D — Flyby Orientation Geometry & Velocity Vector Dot Product
              </h4>
              <p className="text-xs text-neutral-400 max-w-3xl leading-relaxed mt-1">
                Demonstrates that the exact same deflection magnitude produces entirely different Sun-relative speed changes depending on approach direction and pass side.
              </p>
            </div>

            <div className="bg-[#121522] border border-[#23293d] p-3 rounded-xs text-xs text-neutral-300 leading-relaxed font-mono">
              <strong className="text-amber-400">MOMENTUM IDENTITY:</strong> {templateDData.explanation}
            </div>

            {/* Trailing vs Leading Direct Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#141622] border border-amber-500/40 p-4 rounded-xs flex flex-col gap-2.5 font-mono text-xs">
                <span className="font-bold text-amber-400 uppercase">TRAILING PASS (CROSSING BEHIND ORBIT)</span>
                <div className="text-neutral-300 space-y-1">
                  <div>Deflection Angle: <strong className="text-amber-300">{templateDData.trailing.deflectionAngleDeg.toFixed(2)}°</strong></div>
                  <div>Sun-Relative Velocity: { (templateDData.trailing.vInSunSpeedMPerS / 1000).toFixed(2) } km/s → <strong className="text-emerald-400">{(templateDData.trailing.vOutSunSpeedMPerS / 1000).toFixed(2)} km/s</strong></div>
                  <div>Scalar Speed Change: <strong className="text-emerald-400">+{(templateDData.trailing.deltaVSunSpeedMPerS / 1000).toFixed(2)} km/s</strong></div>
                  <div>V_p · Δv_rel: <strong className="text-emerald-400">+{templateDData.trailing.vPlanetDotDeltaVMPerS2.toExponential(2)} m²/s²</strong></div>
                </div>
              </div>

              <div className="bg-[#141622] border border-rose-500/40 p-4 rounded-xs flex flex-col gap-2.5 font-mono text-xs">
                <span className="font-bold text-rose-400 uppercase">LEADING PASS (CROSSING AHEAD OF ORBIT)</span>
                <div className="text-neutral-300 space-y-1">
                  <div>Deflection Angle: <strong className="text-amber-300">{templateDData.leading.deflectionAngleDeg.toFixed(2)}° (IDENTICAL)</strong></div>
                  <div>Sun-Relative Velocity: { (templateDData.leading.vInSunSpeedMPerS / 1000).toFixed(2) } km/s → <strong className="text-rose-400">{(templateDData.leading.vOutSunSpeedMPerS / 1000).toFixed(2)} km/s</strong></div>
                  <div>Scalar Speed Change: <strong className="text-rose-400">{(templateDData.leading.deltaVSunSpeedMPerS / 1000).toFixed(2)} km/s</strong></div>
                  <div>V_p · Δv_rel: <strong className="text-rose-400">{templateDData.leading.vPlanetDotDeltaVMPerS2.toExponential(2)} m²/s²</strong></div>
                </div>
              </div>
            </div>

            {/* Sweep Across Approach Angles */}
            <div className="flex flex-col gap-2 pt-2">
              <span className="font-mono text-xs font-bold text-neutral-300">
                PARAMETRIC SWEEP: APPROACH DIRECTION ANGLE (θ ∈ [0°, 315°])
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#222838] text-neutral-400 text-[10px] uppercase">
                      <th className="py-2 px-3">APPROACH ANGLE (θ)</th>
                      <th className="py-2 px-3">DEFLECTION (δ)</th>
                      <th className="py-2 px-3">SUN IN SPEED</th>
                      <th className="py-2 px-3">SUN OUT SPEED</th>
                      <th className="py-2 px-3">SUN ΔV</th>
                      <th className="py-2 px-3">VECTOR ||ΔV||</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#181d2b]">
                    {templateDData.records.map((r) => (
                      <tr key={r.stepIndex} className="text-neutral-200">
                        <td className="py-2 px-3 font-bold text-sky-400">{r.inputParamValue.toFixed(0)}°</td>
                        <td className="py-2 px-3 text-amber-400">{r.deflectionAngleDeg.toFixed(2)}°</td>
                        <td className="py-2 px-3">{r.vSunInKmPerS.toFixed(2)} km/s</td>
                        <td className="py-2 px-3">{r.vSunOutKmPerS.toFixed(2)} km/s</td>
                        <td
                          className={`py-2 px-3 font-bold ${
                            r.deltaVSpeedKmPerS >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {r.deltaVSpeedKmPerS >= 0 ? '+' : ''}
                          {r.deltaVSpeedKmPerS.toFixed(2)} km/s
                        </td>
                        <td className="py-2 px-3 text-cyan-400">{r.deltaVVectorMagKmPerS.toFixed(2)} km/s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: TEMPLATE E — REFERENCE-FRAME COMPARISON */}
        {/* ========================================================================= */}
        {activeTab === 'EXP_E' && (
          <div className="flex flex-col gap-4">
            <div className="border-b border-[#1f2436] pb-3">
              <h4 className="font-mono text-sm font-bold text-amber-400 uppercase">
                Experiment E — Planet-Relative vs Sun-Relative Velocity & Energy Identity
              </h4>
              <p className="text-xs text-neutral-400 max-w-3xl leading-relaxed mt-1">
                Compares asymptotic velocities across reference frames. In the planet frame, energy and speed are invariant (||v_rel,out|| = ||v_rel,in||). In the heliocentric frame, energy transfer satisfies Δε = V_p · Δv_rel.
              </p>
            </div>

            <div className="bg-[#121522] border border-[#23293d] p-3 rounded-xs text-xs text-neutral-300 leading-relaxed font-mono">
              <strong className="text-amber-400">FRAME INVARIANCE:</strong> {templateEData.explanation}
            </div>

            {/* Frame Comparison Tables */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Planet Frame */}
              <div className="bg-[#141622] border border-sky-500/40 p-4 rounded-xs flex flex-col gap-3 font-mono text-xs">
                <span className="font-bold text-sky-400 uppercase">PLANET REST FRAME (UNACCELERATED CONSERVATIVE FIELD)</span>
                <div className="space-y-1.5 text-neutral-300">
                  <div>Incoming Speed: <strong className="text-white">{templateEData.planetFrame.vInSpeedKmPerS.toFixed(3)} km/s</strong></div>
                  <div>Outgoing Speed: <strong className="text-white">{templateEData.planetFrame.vOutSpeedKmPerS.toFixed(3)} km/s</strong></div>
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <CheckCircle2 size={13} /> Speed Conserved Identically: Δv_rel = 0.000 km/s
                  </div>
                  <div className="text-[10px] text-neutral-400 pt-1 border-t border-[#23283c]">
                    v_in = ({ (templateEData.planetFrame.vInVectorMPerS.x / 1000).toFixed(2) }, { (templateEData.planetFrame.vInVectorMPerS.y / 1000).toFixed(2) }, 0.00) km/s
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    v_out = ({ (templateEData.planetFrame.vOutVectorMPerS.x / 1000).toFixed(2) }, { (templateEData.planetFrame.vOutVectorMPerS.y / 1000).toFixed(2) }, 0.00) km/s
                  </div>
                </div>
              </div>

              {/* Sun Frame */}
              <div className="bg-[#141622] border border-emerald-500/40 p-4 rounded-xs flex flex-col gap-3 font-mono text-xs">
                <span className="font-bold text-emerald-400 uppercase">SUN HELIOCENTRIC INERTIAL FRAME (MOMENTUM EXCHANGE)</span>
                <div className="space-y-1.5 text-neutral-300">
                  <div>Sun-Relative In: {templateEData.sunFrameTrailing.vInSpeedKmPerS.toFixed(3)} km/s</div>
                  <div>Sun-Relative Out: <strong className="text-emerald-400">{templateEData.sunFrameTrailing.vOutSpeedKmPerS.toFixed(3)} km/s</strong></div>
                  <div className="text-emerald-400 font-bold">
                    Net Speed Change: +{templateEData.sunFrameTrailing.deltaSpeedKmPerS.toFixed(3)} km/s
                  </div>
                  <div className="text-cyan-400">
                    Specific Energy Change: +{templateEData.sunFrameTrailing.deltaSpecificEnergyMJPerKg.toFixed(2)} MJ/kg
                  </div>
                  <div className="text-[10px] text-neutral-400 pt-1 border-t border-[#23283c]">
                    V_planet = (0.00, { (templateEData.sunFrameTrailing.vPlanetVectorMPerS.y / 1000).toFixed(2) }, 0.00) km/s
                  </div>
                </div>
              </div>
            </div>

            {/* Energy Identity Verification Box */}
            <div className="bg-[#0e1017] border border-[#262d40] p-3 rounded-xs flex flex-col gap-2 font-mono text-xs">
              <span className="font-bold text-amber-400">MATHEMATICAL IDENTITY VERIFICATION</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-neutral-300 text-[11px]">
                <div>
                  Δε_Sun = 0.5(v_out² - v_in²):
                  <div className="text-white font-bold">{templateEData.identityVerification.trailingDeltaEnergyJPerKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} J/kg</div>
                </div>
                <div>
                  V_p · Δv_rel:
                  <div className="text-white font-bold">{templateEData.identityVerification.trailingVpDotDeltaV.toLocaleString(undefined, { maximumFractionDigits: 1 })} J/kg</div>
                </div>
                <div>
                  Identity Difference (Error):
                  <div className="text-emerald-400 font-bold">{templateEData.identityVerification.errorJPerKg.toExponential(3)} J/kg</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: TEMPLATE F — NUMERICAL VALIDATION */}
        {/* ========================================================================= */}
        {activeTab === 'EXP_F' && (
          <div className="flex flex-col gap-3">
            <div className="border-b border-[#1f2436] pb-3">
              <h4 className="font-mono text-sm font-bold text-amber-400 uppercase">
                Experiment F — Numerical Integration Validation vs Analytical Hyperbolic Flyby
              </h4>
              <p className="text-xs text-neutral-400 max-w-3xl leading-relaxed mt-1">
                Compares 4th-order Runge-Kutta (RK4) numerical integration results against analytical Keplerian hyperbolic flyby formulas across step tolerance coefficients ($\eta \in [0.05, 0.002]$).
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#222838] text-neutral-400 text-[10px] uppercase">
                    <th className="py-2 px-3">TOLERANCE (η)</th>
                    <th className="py-2 px-3">STEP COUNT</th>
                    <th className="py-2 px-3">AVG DT (s)</th>
                    <th className="py-2 px-3">NUMERICAL δ</th>
                    <th className="py-2 px-3">ANALYTICAL δ</th>
                    <th className="py-2 px-3">DEFLECTION ERROR</th>
                    <th className="py-2 px-3">ENERGY DRIFT (|ΔE/E₀|)</th>
                    <th className="py-2 px-3">ANGULAR MOMENTUM ERROR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181d2b]">
                  {templateFData.map((pt, i) => (
                    <tr key={i} className="text-neutral-200">
                      <td className="py-2 px-3 font-bold text-sky-400">{pt.tolerance}</td>
                      <td className="py-2 px-3">{pt.stepCount} steps</td>
                      <td className="py-2 px-3">{pt.avgTimeStepS.toFixed(1)} s</td>
                      <td className="py-2 px-3 text-amber-300">{pt.numericalDeflectionDeg.toFixed(3)}°</td>
                      <td className="py-2 px-3 text-amber-400">{pt.analyticalDeflectionDeg.toFixed(3)}°</td>
                      <td className="py-2 px-3 text-emerald-400 font-bold">
                        {pt.deflectionErrorPercent.toFixed(4)}%
                      </td>
                      <td className="py-2 px-3 text-cyan-400">
                        {pt.energyConservationRelativeError.toExponential(3)}
                      </td>
                      <td className="py-2 px-3 text-neutral-400">
                        {pt.angularMomentumRelativeError.toExponential(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 8: SIDE-BY-SIDE RESULT COMPARISON */}
        {/* ========================================================================= */}
        {activeTab === 'COMPARISON' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2436] pb-3">
              <div>
                <h4 className="font-mono text-sm font-bold text-amber-400 uppercase flex items-center gap-2">
                  <Layers size={16} /> SIDE-BY-SIDE RESULT COMPARISON
                </h4>
                <p className="text-xs text-neutral-400 max-w-3xl leading-relaxed mt-1">
                  Side-by-side quantitative evaluation across multiple simulation runs. Filter metrics by category or add runs from any template or custom sweep.
                </p>
              </div>

              {/* Category Filter Chips */}
              <div className="flex flex-wrap items-center gap-1 font-mono text-[10px]">
                {['CONFIG', 'GEOMETRY', 'VELOCITY', 'ENERGY', 'DIAGNOSTICS'].map((cat) => {
                  const active = selectedMetricCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedMetricCategories((prev) =>
                          active ? prev.filter((c) => c !== cat) : [...prev, cat]
                        );
                      }}
                      className={`px-2 py-0.5 rounded-xs border transition-colors ${
                        active
                          ? 'bg-amber-500 text-black font-bold border-amber-400'
                          : 'bg-[#141624] text-neutral-400 border-[#252a3d]'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedComparisonRuns.length === 0 ? (
              <div className="bg-[#121522] border border-[#23283c] p-6 rounded-xs text-center font-mono text-xs text-neutral-400">
                No runs currently selected for comparison. Click "+ COMPARE" on any row in the Sweep Builder or Template tabs to add runs here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border border-[#22283a]">
                  <thead>
                    <tr className="bg-[#141624] border-b border-[#22283a] text-neutral-300">
                      <th className="py-2.5 px-3 w-56 text-[11px] font-bold">METRIC / SPECIFICATION</th>
                      {selectedComparisonRuns.map((run, idx) => (
                        <th key={idx} className="py-2.5 px-3 min-w-[160px] border-l border-[#22283a]">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-amber-300">RUN #{idx + 1}</span>
                            <button
                              onClick={() => handleToggleComparisonRun(run)}
                              className="text-neutral-500 hover:text-rose-400 text-[10px]"
                              title="Remove from comparison"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="text-[10px] text-neutral-400 font-normal truncate mt-0.5">
                            {run.scenarioName || `${run.planetName} (${run.inputParamValue} ${run.inputParamUnit})`}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#181d2c]">
                    {comparisonMetricsCatalog
                      .filter((m) => selectedMetricCategories.includes(m.category))
                      .map((metric) => (
                        <tr key={metric.key} className="hover:bg-[#121522]">
                          <td className="py-2 px-3 text-neutral-400 bg-[#0d0f17] font-semibold text-[11px]">
                            {metric.label} {metric.unit !== '-' && `[${metric.unit}]`}
                          </td>
                          {selectedComparisonRuns.map((run, idx) => {
                            const isCollision = run.isCollision;
                            const isPostImpactMetric =
                              metric.key === 'vSunOut' ||
                              metric.key === 'deltaVSunSpeed' ||
                              metric.key === 'deltaVVectorMag' ||
                              metric.key === 'deltaSpecificEnergy' ||
                              metric.key === 'deltaKineticEnergy' ||
                              metric.key === 'vOutPlanetVec' ||
                              metric.key === 'vOutSunVec';

                            if (isCollision && isPostImpactMetric) {
                              return (
                                <td key={idx} className="py-2 px-3 border-l border-[#1d2232]">
                                  <span
                                    className="text-rose-400 font-bold"
                                    title="Physically unavailable: spacecraft impacted planetary surface"
                                  >
                                    N/A (Surface Impact)
                                  </span>
                                </td>
                              );
                            }

                            if (metric.key === 'collisionStatus') {
                              return (
                                <td key={idx} className="py-2 px-3 border-l border-[#1d2232]">
                                  {isCollision ? (
                                    <span className="px-2 py-0.5 rounded-xs bg-rose-950 text-rose-300 border border-rose-600 font-bold text-[10px]">
                                      SURFACE_IMPACT
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-xs bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]">
                                      SAFE_FLYBY
                                    </span>
                                  )}
                                </td>
                              );
                            }

                            if (metric.key === 'periapsisAltitude' && run.closestApproachAltitudeKm < 0) {
                              return (
                                <td key={idx} className="py-2 px-3 border-l border-[#1d2232]">
                                  <span className="text-rose-400 font-bold">
                                    {run.closestApproachAltitudeKm.toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
                                    km (Subsurface)
                                  </span>
                                </td>
                              );
                            }

                            if (isCollision && metric.key === 'deflectionDeg') {
                              return (
                                <td key={idx} className="py-2 px-3 border-l border-[#1d2232]">
                                  <span className="text-amber-300 font-bold">
                                    {run.deflectionAngleDeg.toFixed(2)}°{' '}
                                    <span className="text-[9px] text-rose-400 font-normal">(Unrealized: Impact)</span>
                                  </span>
                                </td>
                              );
                            }

                            return (
                              <td key={idx} className="py-2 px-3 border-l border-[#1d2232] text-white">
                                {metric.format(run)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Scientific Correctness & Physical Integrity Notice */}
            <div className="bg-[#0e1017] border border-[#1d2234] p-3 rounded-xs text-[11px] font-mono text-neutral-400 leading-relaxed flex flex-col gap-1">
              <div className="text-amber-400 font-bold flex items-center gap-1.5">
                <Info size={13} /> ASTRODYNAMICS PHYSICAL INTEGRITY PRINCIPLES:
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-neutral-300">
                <li>
                  <strong>Scalar Speed vs. Vector Δv:</strong> Heliocentric scalar speed change (||v_out|| - ||v_in||) is NOT equal to vector delta-v (||v_out - v_in||). In the planet's rest frame, speed is strictly conserved (Δv = 0), yet momentum exchange with the orbiting planet enables heliocentric velocity gain or loss.
                </li>
                <li>
                  <strong>Planetary Mass &amp; Flyby Gains:</strong> Higher planetary mass alone does NOT guarantee a larger useful Sun-relative speed boost; orbital velocity (V_p), approach orientation (θ), and physical surface collision boundaries (r_p &gt; R_p) dictate realizable performance.
                </li>
                <li>
                  <strong>Collision Outcomes:</strong> Sub-surface periapses (h_p ≤ 0) result in atmospheric destruction or surface impact; post-encounter hyperbolic velocity and kinetic energy metrics are marked as physically unavailable (N/A).
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 9: SCIENTIFIC EXPLANATIONS */}
        {/* ========================================================================= */}
        {activeTab === 'EXPLANATIONS' && (
          <div className="flex flex-col gap-4">
            <div className="border-b border-[#1f2436] pb-3">
              <h4 className="font-mono text-sm font-bold text-amber-400 uppercase flex items-center gap-2">
                <HelpCircle size={16} /> SCIENTIFIC EXPLANATIONS & ASTRODYNAMICAL MECHANICS
              </h4>
              <p className="text-xs text-neutral-400 max-w-3xl leading-relaxed mt-1">
                Rigorous answers grounded in Newtonian mechanics, frame transformations, and real-world planetary exploration.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {scientificExplanations.map((note) => (
                <div
                  key={note.id}
                  className="bg-[#121522] border border-[#23293d] p-4 rounded-xs flex flex-col gap-2 font-mono text-xs"
                >
                  <span className="font-bold text-amber-400 uppercase text-xs">{note.title}</span>
                  <div className="text-white font-semibold text-xs mt-0.5">Q: {note.question}</div>
                  <p className="text-neutral-300 leading-relaxed mt-1">{note.shortAnswer}</p>

                  <div className="bg-[#0b0d14] p-2.5 rounded-xs border border-[#1b2030] text-[11px] text-sky-300 leading-relaxed mt-1">
                    <strong className="text-neutral-400">Mathematical Derivation:</strong> {note.derivation}
                  </div>

                  <div className="text-neutral-400 text-[11px] mt-1">
                    <strong className="text-emerald-400">Real-World Mission Evidence:</strong> {note.realWorldEvidence}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 10: COLLEGE PHYSICS LAB REPORT */}
        {/* ========================================================================= */}
        {activeTab === 'REPORT' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2436] pb-3">
              <div>
                <h4 className="font-mono text-sm font-bold text-amber-400 uppercase flex items-center gap-2">
                  <FileText size={16} /> COLLEGE PHYSICS LAB REPORT GENERATOR
                </h4>
                <p className="text-xs text-neutral-400 max-w-3xl leading-relaxed mt-1">
                  Exports a publication-ready, formatted Markdown experiment report complete with abstract, governing equations, quantitative tables, and theoretical conclusions.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(collegeLabReportText);
                    setReportCopied(true);
                    setTimeout(() => setReportCopied(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-[#1e2334] hover:bg-[#2c334d] text-neutral-200 text-xs font-mono rounded-xs border border-[#353d5a] flex items-center gap-1.5 transition-colors"
                >
                  {reportCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  {reportCopied ? 'COPIED TO CLIPBOARD' : 'COPY MARKDOWN'}
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([collegeLabReportText], { type: 'text/markdown;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', `ASTRA-Lab-Report-${builderPlanet.name}-${Date.now()}.md`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-mono font-bold rounded-xs flex items-center gap-1.5 transition-colors"
                >
                  <Download size={13} /> DOWNLOAD .MD FILE
                </button>
              </div>
            </div>

            {/* Markdown Report Preview Box */}
            <div className="bg-[#08090f] border border-[#1b2030] p-4 rounded-xs max-h-[500px] overflow-y-auto font-mono text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed select-text">
              {collegeLabReportText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
