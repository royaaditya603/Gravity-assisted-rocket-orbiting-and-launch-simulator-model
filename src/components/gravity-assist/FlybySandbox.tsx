import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  FlybyEngine,
  FlybyInitialConditions,
  FlybySimulationResult,
  FlybyPassType,
  ReferenceFrame,
} from '../../physics/FlybyEngine';
import { PLANETARY_BODIES, PlanetaryBodyData } from '../../physics/constants';
import {
  FlybyScenarioConfig,
  DEFAULT_FLYBY_SCENARIO,
  createScenarioFromPreset,
  scenarioToInitialConditions,
  loadSavedScenarios,
  saveScenario,
  deleteScenario,
  duplicateScenario,
  exportScenarioToJSON,
  importScenarioFromJSON,
  validateScenario,
  detectScenarioChanges,
} from '../../physics/FlybyScenario';
import { Flyby3DCanvas, FlybyCameraMode } from './viewport/Flyby3DCanvas';
import { Flyby2DCanvas } from './viewport/Flyby2DCanvas';
import { GravityAssist2DSandbox } from './viewport/GravityAssist2DSandbox';
import { FlybyControlDeck } from './controls/FlybyControlDeck';
import { FlybySimulationToolbar, ViewFrameMode } from './controls/FlybySimulationToolbar';
import { ParameterSensitivityDeck } from './controls/ParameterSensitivityDeck';
import { FlybyTelemetryHUD } from './hud/FlybyTelemetryHUD';
import { FlybyCharts } from './charts/FlybyCharts';
import { FlybyExperiments } from './experiments/FlybyExperiments';
import { FlybyMissions } from './missions/FlybyMissions';
import { Sparkles, Compass, ShieldAlert, Cpu, Sliders, ChevronDown, ChevronUp, TrendingUp, Orbit, LineChart, Layers } from 'lucide-react';
import { GraphicsQuality } from './viewport/Flyby3DCanvas';

export interface FlybySandboxProps {
  initialView?: 'SIMULATION' | 'ANALYSIS';
  graphicsQuality?: GraphicsQuality;
  reducedMotion?: boolean;
  spacecraftModel?: 'PROBE' | 'ROCKET';
  onChangeSpacecraftModel?: (model: 'PROBE' | 'ROCKET') => void;
}

export const FlybySandbox: React.FC<FlybySandboxProps> = ({
  initialView = 'SIMULATION',
  graphicsQuality = 'HIGH',
  reducedMotion = false,
  spacecraftModel = 'PROBE',
  onChangeSpacecraftModel,
}) => {
  const [activeTab, setActiveTab] = useState<'SIMULATION' | 'ANALYSIS'>(initialView);

  useEffect(() => {
    if (initialView) {
      setActiveTab(initialView);
    }
  }, [initialView]);

  // Authoritative Scenario State
  const [scenario, setScenario] = useState<FlybyScenarioConfig>(DEFAULT_FLYBY_SCENARIO);
  const [draftScenario, setDraftScenario] = useState<FlybyScenarioConfig>(DEFAULT_FLYBY_SCENARIO);
  const [lastRunScenario, setLastRunScenario] = useState<FlybyScenarioConfig>(DEFAULT_FLYBY_SCENARIO);
  const [undoStack, setUndoStack] = useState<FlybyScenarioConfig[]>([]);
  const [redoStack, setRedoStack] = useState<FlybyScenarioConfig[]>([]);
  const lastValidScenarioRef = useRef<FlybyScenarioConfig>(DEFAULT_FLYBY_SCENARIO);
  const [autoApply, setAutoApply] = useState<boolean>(true);
  const [savedScenarios, setSavedScenarios] = useState<FlybyScenarioConfig[]>(() => loadSavedScenarios());

  // View & Playback State
  const [viewportMode, setViewportMode] = useState<'2D' | '3D'>('2D');
  const [viewFrameMode, setViewFrameMode] = useState<ViewFrameMode>('PLANET_CENTRIC');
  const [cameraMode, setCameraMode] = useState<FlybyCameraMode>('OVERVIEW');
  const [showVectors, setShowVectors] = useState<boolean>(true);
  const [showTrajectoryTrail, setShowTrajectoryTrail] = useState<boolean>(true);
  const [isParamsCollapsed, setIsParamsCollapsed] = useState<boolean>(false);
  const [showSensitivityDeck, setShowSensitivityDeck] = useState<boolean>(false);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2.0);
  const [currentPlaybackIndex, setCurrentPlaybackIndex] = useState<number>(0);

  // Derive active reference frame for single viewport components
  const activeReferenceFrame: ReferenceFrame = viewFrameMode === 'HELIOCENTRIC' ? 'HELIOCENTRIC' : 'PLANET_CENTRIC';

  // Check if draft has unsaved / unapplied modifications
  const isDraftStale = useMemo(() => {
    return JSON.stringify(scenario) !== JSON.stringify(draftScenario);
  }, [scenario, draftScenario]);

  // Parameters changed since the last authoritative run
  const changedParams = useMemo(() => {
    return detectScenarioChanges(lastRunScenario, draftScenario);
  }, [lastRunScenario, draftScenario]);

  // Deterministically compute authoritative simulation result from active scenario
  const simResult: FlybySimulationResult = useMemo(() => {
    const { config, options } = scenarioToInitialConditions(scenario);
    return FlybyEngine.runSimulation(config, options);
  }, [scenario]);

  // Reset playback to start whenever authoritative physical configuration changes
  useEffect(() => {
    setCurrentPlaybackIndex(0);
  }, [simResult]);

  // Animation frame playback loop - synchronized with 3D canvas
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Playback control callbacks
  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentPlaybackIndex(0);
  }, []);

  const handleStep = useCallback(() => {
    setIsPlaying(false);
    setCurrentPlaybackIndex((prev) => {
      if (!simResult || simResult.trajectory.length === 0) return 0;
      return Math.min(prev + 1, simResult.trajectory.length - 1);
    });
  }, [simResult]);

  const handleSeek = useCallback((index: number) => {
    setCurrentPlaybackIndex(index);
  }, []);

  // Update draft and smoothly debounced auto-apply
  const handleUpdateDraft = useCallback(
    (updater: (prev: FlybyScenarioConfig) => FlybyScenarioConfig) => {
      setDraftScenario((prev) => {
        const next = updater(prev);
        if (JSON.stringify(prev) !== JSON.stringify(next)) {
          setUndoStack((u) => [...u.slice(-30), prev]);
          setRedoStack([]);
        }
        const validation = validateScenario(next);
        if (validation.isValid) {
          lastValidScenarioRef.current = next;
          if (autoApply) {
            if (debounceTimerRef.current !== null) {
              window.clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = window.setTimeout(() => {
              setScenario(next);
              setLastRunScenario(next);
            }, 100);
          }
        }
        return next;
      });
    },
    [autoApply]
  );

  const handleApplySettings = useCallback(() => {
    const validation = validateScenario(draftScenario);
    if (validation.isValid) {
      setScenario(draftScenario);
      setLastRunScenario(draftScenario);
      lastValidScenarioRef.current = draftScenario;
      setCurrentPlaybackIndex(0);
    } else {
      alert(`Invalid configuration: ${validation.errors.join('; ')}`);
    }
  }, [draftScenario]);

  const handleUndo = useCallback(() => {
    setUndoStack((currentUndo) => {
      if (currentUndo.length === 0) return currentUndo;
      const previous = currentUndo[currentUndo.length - 1];
      const newUndo = currentUndo.slice(0, currentUndo.length - 1);
      setRedoStack((r) => [...r, draftScenario]);
      setDraftScenario(previous);
      if (autoApply) {
        setScenario(previous);
        setLastRunScenario(previous);
      }
      return newUndo;
    });
  }, [draftScenario, autoApply]);

  const handleRedo = useCallback(() => {
    setRedoStack((currentRedo) => {
      if (currentRedo.length === 0) return currentRedo;
      const next = currentRedo[currentRedo.length - 1];
      const newRedo = currentRedo.slice(0, currentRedo.length - 1);
      setUndoStack((u) => [...u, draftScenario]);
      setDraftScenario(next);
      if (autoApply) {
        setScenario(next);
        setLastRunScenario(next);
      }
      return newRedo;
    });
  }, [draftScenario, autoApply]);

  // Global Keyboard Shortcuts for Undo (Ctrl+Z) and Redo (Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;
      if (isModifier && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        isModifier &&
        (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleResetToPreset = useCallback(() => {
    const presetKey = (draftScenario.planet.presetId as any) || 'JUPITER';
    const newScenario = createScenarioFromPreset(
      ['JUPITER', 'SATURN', 'EARTH', 'VENUS'].includes(presetKey) ? presetKey : 'JUPITER'
    );
    setDraftScenario(newScenario);
    setScenario(newScenario);
    lastValidScenarioRef.current = newScenario;
    setCurrentPlaybackIndex(0);
  }, [draftScenario.planet.presetId]);

  const handleResetToDefaults = useCallback(() => {
    setDraftScenario(DEFAULT_FLYBY_SCENARIO);
    setScenario(DEFAULT_FLYBY_SCENARIO);
    lastValidScenarioRef.current = DEFAULT_FLYBY_SCENARIO;
    setCurrentPlaybackIndex(0);
  }, []);

  const handleSaveScenario = useCallback(
    (customName?: string) => {
      const nameToSave = customName || draftScenario.name;
      const scenarioToSave = { ...draftScenario, name: nameToSave };
      try {
        saveScenario(scenarioToSave);
        setSavedScenarios(loadSavedScenarios());
      } catch (err) {
        alert(String(err));
      }
    },
    [draftScenario]
  );

  const handleLoadScenario = useCallback((loaded: FlybyScenarioConfig) => {
    setDraftScenario(loaded);
    setScenario(loaded);
    lastValidScenarioRef.current = loaded;
    setCurrentPlaybackIndex(0);
  }, []);

  const handleDuplicateScenario = useCallback(() => {
    const cloned = duplicateScenario(draftScenario);
    saveScenario(cloned);
    setSavedScenarios(loadSavedScenarios());
    setDraftScenario(cloned);
    setScenario(cloned);
  }, [draftScenario]);

  const handleDeleteScenario = useCallback((id: string) => {
    const remaining = deleteScenario(id);
    setSavedScenarios(remaining);
  }, []);

  const handleExportJSON = useCallback(() => {
    const jsonStr = exportScenarioToJSON(scenario);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `astra-flyby-scenario-${scenario.planet.name.toLowerCase()}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [scenario]);

  const handleImportJSON = useCallback((jsonStr: string) => {
    const res = importScenarioFromJSON(jsonStr);
    if (res.success && res.scenario) {
      setDraftScenario(res.scenario);
      setScenario(res.scenario);
      lastValidScenarioRef.current = res.scenario;
      setCurrentPlaybackIndex(0);
    } else {
      alert(`Import Failed: ${res.error}`);
    }
  }, []);

  const handleRestoreLastValid = useCallback(() => {
    const valid = lastValidScenarioRef.current;
    setDraftScenario(valid);
    setScenario(valid);
    setCurrentPlaybackIndex(0);
  }, []);

  // Preset loader callback for experiments and historical missions
  const handleLoadPreset = useCallback((preset: Partial<FlybyInitialConditions>) => {
    setDraftScenario((prev) => {
      const p = preset.planet || prev.planet;
      const vInf = preset.vInfSpeedMPerS ?? prev.encounter.vInfSpeedMPerS;
      const pass = preset.passType || prev.encounter.passType;
      const mass = preset.spacecraftMassKg ?? prev.encounter.spacecraftMassKg;
      let altKm = prev.encounter.periapsisAltitudeKm;

      if (preset.targetPeriapsisM !== undefined) {
        altKm = (preset.targetPeriapsisM - p.radiusM) / 1000.0;
      }

      const rpM = p.radiusM + altKm * 1000.0;
      const bM = rpM > 0 ? FlybyEngine.periapsisToImpactParameter(rpM, vInf, p.mu) : 0;

      const updated: FlybyScenarioConfig = {
        ...prev,
        planet: {
          ...prev.planet,
          presetId: 'id' in p ? p.id : (p as any).presetId || 'CUSTOM',
          name: p.name,
          radiusM: p.radiusM,
          massKg: p.massKg,
          mu: p.mu,
          semiMajorAxisM: p.semiMajorAxisM,
          orbitalSpeedMPerS: p.orbitalSpeedMPerS,
          color: p.color,
          isTheoretical: false,
        },
        encounter: {
          ...prev.encounter,
          vInfSpeedMPerS: vInf,
          passType: pass,
          spacecraftMassKg: mass,
          periapsisAltitudeKm: altKm,
          impactParameterKm: bM / 1000.0,
        },
      };

      setScenario(updated);
      lastValidScenarioRef.current = updated;
      return updated;
    });

    setIsPlaying(true);
    setCurrentPlaybackIndex(0);
  }, []);

  return (
    <section
      id="gravity-assist-sandbox"
      className="w-full bg-[#F5F7FB] text-[#263247] py-12 px-4 sm:px-8 border-b border-[#DCE3EE]"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        {/* Section Header */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFD2B8] border border-[#B86230] animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#9C4217] font-bold">
              [ 05 // DEDICATED MULTI-PLANET GRAVITY ASSIST ENGINE ]
            </span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-sans font-black tracking-tight uppercase text-[#263247]">
            Multi-Planet Gravity Assist Simulator
          </h2>
          <p className="text-sm text-[#68758A] max-w-3xl leading-relaxed">
            A planetary gravity assist is an unperturbed hyperbolic encounter in the planet's rest frame where speed is strictly
            conserved (<span className="text-[#9C4217] font-mono font-bold">||v_∞(+) || = ||v_∞(-)||</span>). When transformed to the
            Sun's heliocentric frame, orbital momentum is exchanged with the moving planet, delivering monumental velocity
            boosts (<span className="text-[#1D6C50] font-mono font-bold">Δv_assist</span>) or high-efficiency gravitational braking.
          </p>
        </div>

        {/* Workspace Mode Tabs */}
        <div className="flex items-center gap-2 border-b border-[#DCE3EE] pb-2 text-xs font-mono">
          <button
            onClick={() => setActiveTab('SIMULATION')}
            className={`px-4 py-2 rounded-lg border font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs ${
              activeTab === 'SIMULATION'
                ? 'bg-white text-[#1D4F7A] border-[#A9D4F5]'
                : 'bg-[#EEF2F8] text-[#68758A] border-[#DCE3EE] hover:text-[#263247] hover:bg-white'
            }`}
          >
            <Orbit size={14} className="text-[#3882B6]" />
            <span>3D TRAJECTORY VIEWPORT & CONTROLS</span>
          </button>
          <button
            onClick={() => setActiveTab('ANALYSIS')}
            className={`px-4 py-2 rounded-lg border font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs ${
              activeTab === 'ANALYSIS'
                ? 'bg-white text-[#1D6C50] border-[#AEE5D0]'
                : 'bg-[#EEF2F8] text-[#68758A] border-[#DCE3EE] hover:text-[#263247] hover:bg-white'
            }`}
          >
            <LineChart size={14} className="text-[#2D8A68]" />
            <span>ANALYSIS LAB & FLIGHT DYNAMICS</span>
          </button>
        </div>

        {activeTab === 'SIMULATION' ? (
          <>
            {viewportMode === '2D' ? (
              /* PRIMARY DEFAULT: 2D GRAVITY ASSIST SANDBOX (DUAL-FRAME SIDE-BY-SIDE) */
              <GravityAssist2DSandbox
                scenario={draftScenario}
                simResult={simResult}
                onUpdateScenario={handleUpdateDraft}
                isPlaying={isPlaying}
                onTogglePlay={handleTogglePlay}
                onReset={handleReset}
                playbackSpeed={playbackSpeed}
                onChangePlaybackSpeed={setPlaybackSpeed}
                currentPlaybackIndex={currentPlaybackIndex}
                onPlaybackIndexChange={handleSeek}
                viewportMode={viewportMode}
                onChangeViewportMode={setViewportMode}
              />
            ) : (
              /* OPTIONAL 3D VIEWPORT */
              <div className="w-full flex flex-col gap-4">
                {/* 3D Header with Centered Title & View Switcher */}
                <div className="w-full flex flex-col items-center justify-center gap-3 py-2">
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#263247] uppercase text-center">
                    Gravity Assist Sandbox
                  </h2>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#DCE3EE] shadow-xs">
                    <button
                      onClick={() => setViewportMode('2D')}
                      className="px-4 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer text-[#68758A] hover:text-[#263247] hover:bg-[#F0F4FA]"
                    >
                      <Compass size={14} />
                      2D Simulation
                    </button>
                    <button
                      onClick={() => setViewportMode('3D')}
                      className="px-4 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer bg-[#10B981] text-white shadow-xs"
                    >
                      <Layers size={14} />
                      3D Simulation
                    </button>
                  </div>
                </div>

                {/* 3D Simulation Toolbar */}
                <FlybySimulationToolbar
                  viewportMode={viewportMode}
                  onChangeViewportMode={setViewportMode}
                  isPlaying={isPlaying}
                  onTogglePlay={handleTogglePlay}
                  onReset={handleReset}
                  onStep={handleStep}
                  playbackSpeed={playbackSpeed}
                  onChangePlaybackSpeed={setPlaybackSpeed}
                  currentStepIndex={currentPlaybackIndex}
                  totalSteps={simResult.trajectory.length}
                  currentTimeS={simResult.trajectory[currentPlaybackIndex]?.timeS ?? 0}
                  totalDurationS={simResult.totalDurationS}
                  onSeek={handleSeek}
                  periapsisTimeS={simResult.closestApproach.timeS}
                  collisionTimeS={simResult.collisionTimeS}
                  collisionDetected={simResult.collisionDetected}
                  viewFrameMode={viewFrameMode}
                  onChangeViewFrameMode={setViewFrameMode}
                  cameraMode={cameraMode}
                  onChangeCameraMode={setCameraMode}
                  onResetCamera={() => setCameraMode('OVERVIEW')}
                  showVectors={showVectors}
                  onToggleVectors={() => setShowVectors((prev) => !prev)}
                  showTrajectoryTrail={showTrajectoryTrail}
                  onToggleTrajectoryTrail={() => setShowTrajectoryTrail((prev) => !prev)}
                  isParamsCollapsed={isParamsCollapsed}
                  onToggleParamsCollapse={() => setIsParamsCollapsed((prev) => !prev)}
                />

                {/* 3D Canvas Viewport */}
                {viewFrameMode === 'SIDE_BY_SIDE' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 w-full">
                    <Flyby3DCanvas
                      simResult={simResult}
                      currentPlaybackIndex={currentPlaybackIndex}
                      referenceFrame="PLANET_CENTRIC"
                      cameraMode={cameraMode}
                      showVectors={showVectors}
                      showTrajectoryTrail={showTrajectoryTrail}
                      isPlaying={isPlaying}
                      playbackSpeed={playbackSpeed}
                      onCameraChange={setCameraMode}
                      onPlaybackIndexChange={handleSeek}
                      isClockMaster={true}
                      graphicsQuality={graphicsQuality}
                      reducedMotion={reducedMotion}
                      spacecraftModel={spacecraftModel}
                      onChangeSpacecraftModel={onChangeSpacecraftModel}
                      viewportMode={viewportMode}
                      onChangeViewportMode={setViewportMode}
                      title="PLANET-RELATIVE FRAME (||v_∞|| CONSERVED)"
                      heightClass="h-[520px]"
                    />

                    <Flyby3DCanvas
                      simResult={simResult}
                      currentPlaybackIndex={currentPlaybackIndex}
                      referenceFrame="HELIOCENTRIC"
                      cameraMode={cameraMode}
                      showVectors={showVectors}
                      showTrajectoryTrail={showTrajectoryTrail}
                      isPlaying={isPlaying}
                      playbackSpeed={playbackSpeed}
                      onCameraChange={setCameraMode}
                      onPlaybackIndexChange={handleSeek}
                      isClockMaster={false}
                      graphicsQuality={graphicsQuality}
                      reducedMotion={reducedMotion}
                      spacecraftModel={spacecraftModel}
                      onChangeSpacecraftModel={onChangeSpacecraftModel}
                      viewportMode={viewportMode}
                      onChangeViewportMode={setViewportMode}
                      title="SUN-RELATIVE HELIOCENTRIC FRAME (MOMENTUM TRANSFER)"
                      heightClass="h-[520px]"
                    />
                  </div>
                ) : (
                  <Flyby3DCanvas
                    simResult={simResult}
                    currentPlaybackIndex={currentPlaybackIndex}
                    referenceFrame={activeReferenceFrame}
                    cameraMode={cameraMode}
                    showVectors={showVectors}
                    showTrajectoryTrail={showTrajectoryTrail}
                    isPlaying={isPlaying}
                    playbackSpeed={playbackSpeed}
                    onCameraChange={setCameraMode}
                    onReferenceFrameChange={(f) => setViewFrameMode(f)}
                    onPlaybackIndexChange={handleSeek}
                    graphicsQuality={graphicsQuality}
                    reducedMotion={reducedMotion}
                    spacecraftModel={spacecraftModel}
                    onChangeSpacecraftModel={onChangeSpacecraftModel}
                    viewportMode={viewportMode}
                    onChangeViewportMode={setViewportMode}
                    title={viewFrameMode === 'PLANET_CENTRIC' ? 'PLANET-CENTRIC REST FRAME' : 'HELIOCENTRIC SUN FRAME'}
                    heightClass="h-[580px]"
                  />
                )}
              </div>
            )}

            {/* 3. Live Telemetry Panel */}
            <FlybyTelemetryHUD
              simResult={simResult}
              currentPlaybackIndex={currentPlaybackIndex}
              referenceFrame={activeReferenceFrame}
            />

        {/* 4. Collapsible Parameter Panel */}
        <div id="flyby-parameters" className="w-full">
          {isParamsCollapsed ? (
            <div className="w-full bg-white border border-[#DCE3EE] p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-[#263247] shadow-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-[#B45309]" />
                <span>ACTIVE TARGET: <strong className="text-[#263247]">{scenario.planet.name.toUpperCase()}</strong></span>
                <span>v_∞: <strong className="text-[#B45309]">{(scenario.encounter.vInfSpeedMPerS / 1000).toFixed(1)} km/s</strong></span>
                <span>PERIAPSIS: <strong className="text-[#059669]">{scenario.encounter.periapsisAltitudeKm.toLocaleString()} km</strong></span>
                <span>PASS: <strong className="text-[#0284C7]">{scenario.encounter.passType}</strong></span>
              </div>
              <button
                onClick={() => setIsParamsCollapsed(false)}
                className="px-3 py-1 bg-[#EEF2F8] hover:bg-[#E2E8F0] text-[#14426B] rounded-lg border border-[#DCE3EE] flex items-center gap-1 font-bold text-[11px] transition-colors cursor-pointer shadow-2xs"
              >
                <Sliders size={12} /> EXPAND PARAMETERS
              </button>
            </div>
          ) : (
            <FlybyControlDeck
              selectedPlanet={scenario.planet as any}
              onSelectPlanet={(p) => {
                handleUpdateDraft((prev) => ({
                  ...prev,
                  planet: {
                    ...prev.planet,
                    presetId: 'id' in p ? p.id : (p as any).presetId || 'CUSTOM',
                    name: p.name,
                    isTheoretical: false,
                    massKg: p.massKg,
                    radiusM: p.radiusM,
                    mu: p.mu,
                    semiMajorAxisM: p.semiMajorAxisM,
                    orbitalSpeedMPerS: p.orbitalSpeedMPerS,
                    color: p.color,
                  },
                }));
              }}
              vInfSpeedMPerS={scenario.encounter.vInfSpeedMPerS}
              onChangeVInf={(v) => {
                handleUpdateDraft((prev) => ({
                  ...prev,
                  encounter: { ...prev.encounter, vInfSpeedMPerS: v },
                }));
              }}
              periapsisAltitudeKm={scenario.encounter.periapsisAltitudeKm}
              onChangePeriapsisAltitude={(alt) => {
                handleUpdateDraft((prev) => ({
                  ...prev,
                  encounter: { ...prev.encounter, periapsisAltitudeKm: alt },
                }));
              }}
              passType={scenario.encounter.passType}
              onChangePassType={(pass) => {
                handleUpdateDraft((prev) => ({
                  ...prev,
                  encounter: { ...prev.encounter, passType: pass },
                }));
              }}
              spacecraftMassKg={scenario.encounter.spacecraftMassKg}
              onChangeSpacecraftMass={(m) => {
                handleUpdateDraft((prev) => ({
                  ...prev,
                  encounter: { ...prev.encounter, spacecraftMassKg: m },
                }));
              }}
              referenceFrame={activeReferenceFrame}
              onChangeReferenceFrame={(f) => setViewFrameMode(f)}
              cameraMode={cameraMode}
              onChangeCameraMode={setCameraMode}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onReset={handleReset}
              onStep={handleStep}
              playbackSpeed={playbackSpeed}
              onChangePlaybackSpeed={setPlaybackSpeed}
              currentStepIndex={currentPlaybackIndex}
              totalSteps={simResult.trajectory.length}
              onSeek={handleSeek}
              showVectors={showVectors}
              onToggleVectors={() => setShowVectors((prev) => !prev)}
              showTrajectoryTrail={showTrajectoryTrail}
              onToggleTrajectoryTrail={() => setShowTrajectoryTrail((prev) => !prev)}
              // Scenario Props
              scenario={scenario}
              draftScenario={draftScenario}
              onUpdateDraft={handleUpdateDraft}
              onApplySettings={handleApplySettings}
              onResetToPreset={handleResetToPreset}
              onResetToDefaults={handleResetToDefaults}
              onSaveScenario={handleSaveScenario}
              onLoadScenario={handleLoadScenario}
              onDuplicateScenario={handleDuplicateScenario}
              onDeleteScenario={handleDeleteScenario}
              onExportJSON={handleExportJSON}
              onImportJSON={handleImportJSON}
              onRestoreLastValid={handleRestoreLastValid}
              isDraftStale={isDraftStale}
              autoApply={autoApply}
              onToggleAutoApply={() => setAutoApply((prev) => !prev)}
              savedScenarios={savedScenarios}
              // Undo / Redo & Sensitivity
              onUndo={handleUndo}
              canUndo={undoStack.length > 0}
              onRedo={handleRedo}
              canRedo={redoStack.length > 0}
              changedParams={changedParams}
              onOpenSensitivity={() => setShowSensitivityDeck(true)}
            />
          )}
        </div>

        {/* Quick Link to Full Analysis Lab */}
        <div className="w-full bg-white border border-[#DCE3EE] p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-xs">
          <div className="flex items-center gap-2">
            <LineChart size={16} className="text-[#059669]" />
            <span className="text-[#263247] font-medium">EXPLORE TRAJECTORY PLOTS, PARAMETER SWEEPS & HISTORICAL MISSIONS:</span>
          </div>
          <button
            onClick={() => setActiveTab('ANALYSIS')}
            className="px-3.5 py-1.5 bg-[#AEE5D0]/35 hover:bg-[#AEE5D0]/60 text-[#1D6C50] rounded-lg border border-[#AEE5D0] font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <span>OPEN FLIGHT DYNAMICS ANALYSIS LAB</span>
            <TrendingUp size={13} />
          </button>
        </div>
      </>
    ) : (
      /* 5. Analysis Area: Graphs, Comparisons & Experiments */
      <div id="flyby-analysis-lab" className="flex flex-col gap-6 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#DCE3EE] p-4 rounded-xl shadow-xs">
          <div>
            <h3 className="text-lg font-mono font-bold uppercase text-[#263247] flex items-center gap-2">
              <LineChart size={18} className="text-[#059669]" />
              <span>FLIGHT DYNAMICS ANALYSIS LAB & VERIFICATION</span>
            </h3>
            <p className="text-xs text-[#68758A] font-mono">
              Real-time kinematic graphs, parameter sweeps, and archival mission comparisons.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('SIMULATION')}
              className="px-3 py-1.5 rounded-lg border font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer bg-[#EEF2F8] text-[#263247] border-[#DCE3EE] hover:bg-[#E2E8F0] shadow-2xs"
            >
              <Orbit size={13} className="text-[#0284C7]" />
              <span>RETURN TO 3D VIEWPORT</span>
            </button>
            <button
              onClick={() => setShowSensitivityDeck((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg border font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs ${
                showSensitivityDeck
                  ? 'bg-[#FFD2B8] text-[#7A3E1D] font-bold border-[#FFD2B8]'
                  : 'bg-white text-[#263247] border-[#DCE3EE] hover:bg-[#EEF2F8]'
              }`}
            >
              <TrendingUp size={13} />
              <span>{showSensitivityDeck ? 'HIDE SENSITIVITY SWEEPS' : 'PARAMETER SENSITIVITY SWEEP'}</span>
            </button>
          </div>
        </div>

        {showSensitivityDeck && (
          <ParameterSensitivityDeck
            scenario={scenario}
            onClose={() => setShowSensitivityDeck(false)}
          />
        )}

        {/* Real-Time Telemetry & Physics Charts */}
        <FlybyCharts
          simResult={simResult}
          currentPlaybackIndex={currentPlaybackIndex}
          referenceFrame={activeReferenceFrame}
        />

        {/* Controlled Astrodynamics Experiments (A — F) */}
        <FlybyExperiments onLoadPreset={handleLoadPreset} />

        {/* Historical Missions Dossier (Voyager 2, Cassini, Mariner 10) */}
        <FlybyMissions onLoadPreset={handleLoadPreset} />
      </div>
    )}
      </div>
    </section>
  );
};

export default FlybySandbox;
