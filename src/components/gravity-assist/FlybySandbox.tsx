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
} from '../../physics/FlybyScenario';
import { Flyby3DCanvas, FlybyCameraMode } from './viewport/Flyby3DCanvas';
import { FlybyControlDeck } from './controls/FlybyControlDeck';
import { FlybyTelemetryHUD } from './hud/FlybyTelemetryHUD';
import { FlybyCharts } from './charts/FlybyCharts';
import { FlybyExperiments } from './experiments/FlybyExperiments';
import { FlybyMissions } from './missions/FlybyMissions';
import { Sparkles, Compass, ShieldAlert, Cpu } from 'lucide-react';

export const FlybySandbox: React.FC = () => {
  // Authoritative Scenario State
  const [scenario, setScenario] = useState<FlybyScenarioConfig>(DEFAULT_FLYBY_SCENARIO);
  const [draftScenario, setDraftScenario] = useState<FlybyScenarioConfig>(DEFAULT_FLYBY_SCENARIO);
  const lastValidScenarioRef = useRef<FlybyScenarioConfig>(DEFAULT_FLYBY_SCENARIO);
  const [autoApply, setAutoApply] = useState<boolean>(true);
  const [savedScenarios, setSavedScenarios] = useState<FlybyScenarioConfig[]>(() => loadSavedScenarios());

  // View & Playback State
  const [referenceFrame, setReferenceFrame] = useState<ReferenceFrame>('PLANET_CENTRIC');
  const [cameraMode, setCameraMode] = useState<FlybyCameraMode>('OVERVIEW');
  const [showVectors, setShowVectors] = useState<boolean>(true);
  const [showTrajectoryTrail, setShowTrajectoryTrail] = useState<boolean>(true);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2.0);
  const [currentPlaybackIndex, setCurrentPlaybackIndex] = useState<number>(0);

  // Check if draft has unsaved / unapplied modifications
  const isDraftStale = useMemo(() => {
    return JSON.stringify(scenario) !== JSON.stringify(draftScenario);
  }, [scenario, draftScenario]);

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
      if (!simResult) return 0;
      return Math.min(prev + 5, simResult.trajectory.length - 1);
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
        const validation = validateScenario(next);
        if (validation.isValid) {
          lastValidScenarioRef.current = next;
          if (autoApply) {
            if (debounceTimerRef.current !== null) {
              window.clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = window.setTimeout(() => {
              setScenario(next);
            }, 60);
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
      lastValidScenarioRef.current = draftScenario;
      setCurrentPlaybackIndex(0);
    } else {
      alert(`Invalid configuration: ${validation.errors.join('; ')}`);
    }
  }, [draftScenario]);

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
      className="w-full bg-[#08090d] text-white py-16 px-4 sm:px-8 border-t border-b border-[#202535]"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        {/* Section Header */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
              [ 05 // DEDICATED MULTI-PLANET GRAVITY ASSIST ENGINE ]
            </span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-sans font-black tracking-tight uppercase">
            Multi-Planet Gravity Assist Simulator
          </h2>
          <p className="text-sm text-neutral-400 max-w-3xl leading-relaxed">
            A planetary gravity assist is an unperturbed hyperbolic encounter in the planet's rest frame where speed is strictly
            conserved (<span className="text-amber-400 font-mono">||v_∞(+) || = ||v_∞(-)||</span>). When transformed to the
            Sun's heliocentric frame, orbital momentum is exchanged with the moving planet, delivering monumental velocity
            boosts (<span className="text-emerald-400 font-mono">Δv_assist</span>) or high-efficiency gravitational braking.
          </p>
        </div>

        {/* 1. Main 3D Viewport & HUD */}
        <div className="flex flex-col gap-3">
          <Flyby3DCanvas
            simResult={simResult}
            currentPlaybackIndex={currentPlaybackIndex}
            referenceFrame={referenceFrame}
            cameraMode={cameraMode}
            showVectors={showVectors}
            showTrajectoryTrail={showTrajectoryTrail}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            onCameraChange={setCameraMode}
            onReferenceFrameChange={setReferenceFrame}
            onPlaybackIndexChange={handleSeek}
          />

          <FlybyTelemetryHUD
            simResult={simResult}
            currentPlaybackIndex={currentPlaybackIndex}
            referenceFrame={referenceFrame}
          />
        </div>

        {/* 2. Interactive Control Deck & Scenario Management */}
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
          referenceFrame={referenceFrame}
          onChangeReferenceFrame={setReferenceFrame}
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
        />

        {/* 3. Real-Time Telemetry & Physics Charts */}
        <FlybyCharts
          simResult={simResult}
          currentPlaybackIndex={currentPlaybackIndex}
          referenceFrame={referenceFrame}
        />

        {/* 4. Controlled Astrodynamics Experiments (A — F) */}
        <FlybyExperiments onLoadPreset={handleLoadPreset} />

        {/* 5. Historical Missions Dossier (Voyager 2, Cassini, Mariner 10) */}
        <FlybyMissions onLoadPreset={handleLoadPreset} />
      </div>
    </section>
  );
};

export default FlybySandbox;
