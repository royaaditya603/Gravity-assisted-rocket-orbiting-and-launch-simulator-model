import React, { useState, useMemo } from 'react';
import { PlanetaryBodyData, PLANETARY_BODIES, G_NEWTON, AU } from '../../../physics/constants';
import { FlybyEngine, FlybyPassType, ReferenceFrame } from '../../../physics/FlybyEngine';
import { FlybyCameraMode } from '../viewport/Flyby3DCanvas';
import {
  FlybyScenarioConfig,
  ConfigurationMode,
  ParameterAuthority,
  PlanetVelocityMode,
  EncounterDistanceMode,
  syncMassAndMu,
  syncAltitudeAndImpactParameter,
  computeCircularOrbitalSpeed,
  checkMassMuConsistency,
  checkClosestApproachHazards,
  ParameterDiff,
  getEducationalPresets,
} from '../../../physics/FlybyScenario';
import { PlanetPresetSelector } from './PlanetPresetSelector';
import { CustomPlanetEditor } from './CustomPlanetEditor';
import { FlybyGeometryControls } from './FlybyGeometryControls';
import { NumericalStateControls } from './NumericalStateControls';
import { AdvancedSimulationSettings } from './AdvancedSimulationSettings';
import { ScenarioStorageControls } from './ScenarioStorageControls';
import { ParameterTooltip, UnitBadge } from './ParameterTooltip';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  FolderOpen,
  Save,
  Copy,
  Download,
  Upload,
  Undo2,
  Redo2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Globe,
  Settings2,
  Compass,
  Check,
  ShieldAlert,
  AlertTriangle,
  Sliders,
  TrendingUp,
  Info,
  Sparkles,
} from 'lucide-react';

export interface FlybyControlDeckProps {
  selectedPlanet: PlanetaryBodyData;
  onSelectPlanet: (planet: PlanetaryBodyData) => void;
  vInfSpeedMPerS: number;
  onChangeVInf: (speed: number) => void;
  periapsisAltitudeKm: number;
  onChangePeriapsisAltitude: (altKm: number) => void;
  passType: FlybyPassType;
  onChangePassType: (pass: FlybyPassType) => void;
  spacecraftMassKg: number;
  onChangeSpacecraftMass: (mass: number) => void;
  referenceFrame: ReferenceFrame;
  onChangeReferenceFrame: (frame: ReferenceFrame) => void;
  cameraMode: FlybyCameraMode;
  onChangeCameraMode: (mode: FlybyCameraMode) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  onStep: () => void;
  playbackSpeed: number;
  onChangePlaybackSpeed: (speed: number) => void;
  currentStepIndex: number;
  totalSteps: number;
  onSeek: (index: number) => void;
  showVectors: boolean;
  onToggleVectors: () => void;
  showTrajectoryTrail: boolean;
  onToggleTrajectoryTrail: () => void;

  // Extended Scenario & Configuration Props
  scenario?: FlybyScenarioConfig;
  draftScenario?: FlybyScenarioConfig;
  onUpdateDraft?: (updater: (prev: FlybyScenarioConfig) => FlybyScenarioConfig) => void;
  onApplySettings?: () => void;
  onResetToPreset?: () => void;
  onResetToDefaults?: () => void;
  onSaveScenario?: (name?: string) => void;
  onLoadScenario?: (scenario: FlybyScenarioConfig) => void;
  onDuplicateScenario?: () => void;
  onExportJSON?: () => void;
  onImportJSON?: (jsonStr: string) => void;
  onRestoreLastValid?: () => void;
  isDraftStale?: boolean;
  autoApply?: boolean;
  onToggleAutoApply?: () => void;
  savedScenarios?: FlybyScenarioConfig[];
  onDeleteScenario?: (id: string) => void;

  // Undo / Redo & Sensitivity
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  changedParams?: ParameterDiff[];
  onOpenSensitivity?: () => void;
}

export type ControlTab = 'PRESETS' | 'FLYBY' | 'CUSTOM_PLANET' | 'ADVANCED';

export const FlybyControlDeck: React.FC<FlybyControlDeckProps> = ({
  selectedPlanet,
  onSelectPlanet,
  vInfSpeedMPerS,
  onChangeVInf,
  periapsisAltitudeKm,
  onChangePeriapsisAltitude,
  passType,
  onChangePassType,
  spacecraftMassKg,
  onChangeSpacecraftMass,
  referenceFrame,
  onChangeReferenceFrame,
  cameraMode,
  onChangeCameraMode,
  isPlaying,
  onTogglePlay,
  onReset,
  onStep,
  playbackSpeed,
  onChangePlaybackSpeed,
  currentStepIndex,
  totalSteps,
  onSeek,
  showVectors,
  onToggleVectors,
  showTrajectoryTrail,
  onToggleTrajectoryTrail,

  // Scenario Props
  scenario,
  draftScenario,
  onUpdateDraft,
  onApplySettings,
  onResetToPreset,
  onResetToDefaults,
  onSaveScenario,
  onLoadScenario,
  onDuplicateScenario,
  onDeleteScenario,
  onExportJSON,
  onImportJSON,
  onRestoreLastValid,
  isDraftStale = false,
  autoApply = true,
  onToggleAutoApply,
  savedScenarios = [],

  // Undo / Redo & Sensitivity
  onUndo,
  canUndo = false,
  onRedo,
  canRedo = false,
  changedParams = [],
  onOpenSensitivity,
}) => {
  // Navigation & Drawer states
  const [activeTab, setActiveTab] = useState<ControlTab>('PRESETS');
  const [showScenarioDrawer, setShowScenarioDrawer] = useState<boolean>(false);
  const [showExplanations, setShowExplanations] = useState<boolean>(false);

  // Derive current effective values
  const effectivePlanet = draftScenario
    ? draftScenario.planet
    : {
        presetId: selectedPlanet.id.toUpperCase(),
        name: selectedPlanet.name,
        isTheoretical: selectedPlanet.isTheoretical ?? false,
        massKg: selectedPlanet.massKg,
        radiusM: selectedPlanet.radiusM,
        mu: selectedPlanet.mu,
        authority: 'MU_AUTHORITATIVE' as ParameterAuthority,
        velocityMode: 'CIRCULAR_ORBIT' as PlanetVelocityMode,
        semiMajorAxisM: selectedPlanet.semiMajorAxisM,
        orbitalSpeedMPerS: selectedPlanet.orbitalSpeedMPerS,
        customVelocityVectorMPerS: { x: 0, y: selectedPlanet.orbitalSpeedMPerS, z: 0 },
        initialPhaseDeg: 0,
        color: selectedPlanet.color,
        sourceOrReference: selectedPlanet.sourceOrReference,
        modelSimplificationNote: selectedPlanet.modelSimplificationNote,
      };

  const effectiveEncounter = draftScenario
    ? draftScenario.encounter
    : {
        vInfSpeedMPerS,
        approachAngleDeg: 0,
        passType,
        distanceMode: 'PERIAPSIS_ALTITUDE' as EncounterDistanceMode,
        periapsisAltitudeKm,
        impactParameterKm: 0,
        spacecraftMassKg,
        customInitialState: undefined,
      };

  const effectiveAdvanced = draftScenario
    ? draftScenario.advanced
    : {
        timeStepCoeff: 0.015,
        entryDistanceMultiple: 20.0,
        trajectoryMode: 'NUMERICAL_RK4' as const,
        simulationWindowStartS: 0,
      };

  const isCustomPlanet =
    effectivePlanet.presetId === 'CUSTOM' || effectivePlanet.isTheoretical;

  // Preset selection handler
  const handleSelectPreset = (presetKey: string) => {
    const isCustom = presetKey === 'CUSTOM';
    const presetBody = PLANETARY_BODIES[presetKey] || PLANETARY_BODIES.JUPITER;

    onSelectPlanet(presetBody);

    if (onUpdateDraft) {
      onUpdateDraft((prev) => {
        let vInf = 10000;
        let altKm = 45000;

        switch (presetKey) {
          case 'JUPITER':
            vInf = 10000;
            altKm = 45000;
            break;
          case 'SATURN':
            vInf = 9000;
            altKm = 35000;
            break;
          case 'EARTH':
            vInf = 8000;
            altKm = 2500;
            break;
          case 'MARS':
            vInf = 5000;
            altKm = 1200;
            break;
          case 'VENUS':
            vInf = 7500;
            altKm = 1500;
            break;
          case 'CUSTOM':
            vInf = 10000;
            altKm = 15000;
            break;
          default:
            vInf = 8000;
            altKm = 5000;
            break;
        }

        const rpM = presetBody.radiusM + altKm * 1000.0;
        const bM = FlybyEngine.periapsisToImpactParameter(rpM, vInf, presetBody.mu);

        return {
          ...prev,
          mode: isCustom ? 'CUSTOM_PLANET' : 'PLANET_PRESET',
          planet: {
            ...prev.planet,
            presetId: presetKey,
            name: isCustom ? 'Custom Theoretical Planet' : presetBody.name,
            isTheoretical: isCustom,
            massKg: presetBody.massKg,
            radiusM: presetBody.radiusM,
            mu: presetBody.mu,
            semiMajorAxisM: presetBody.semiMajorAxisM,
            orbitalSpeedMPerS: presetBody.orbitalSpeedMPerS,
            color: presetBody.color,
            sourceOrReference: presetBody.sourceOrReference,
            modelSimplificationNote: presetBody.modelSimplificationNote,
            muOverride: undefined,
          },
          encounter: {
            ...prev.encounter,
            vInfSpeedMPerS: vInf,
            periapsisAltitudeKm: altKm,
            impactParameterKm: bM / 1000.0,
          },
        };
      });
    }

    if (isCustom) {
      setActiveTab('CUSTOM_PLANET');
    }
  };

  return (
    <div className="w-full bg-[#0d0f18] border border-[#202638] p-4 sm:p-5 rounded-xs flex flex-col gap-4 text-white font-mono shadow-xl">
      {/* 1. Master Top Bar: Navigation Tabs + Undo/Redo + Simulation Execution */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2538] pb-3">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#080a12] p-1 rounded-xs border border-[#1b2132]">
          <button
            type="button"
            onClick={() => setActiveTab('PRESETS')}
            className={`px-3 py-1 text-[11px] font-bold rounded-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'PRESETS'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Globe size={13} /> 1. PLANET PRESETS
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('FLYBY')}
            className={`px-3 py-1 text-[11px] font-bold rounded-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'FLYBY'
                ? 'bg-sky-500 text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Compass size={13} /> 2. FLYBY CONTROLS
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CUSTOM_PLANET')}
            className={`px-3 py-1 text-[11px] font-bold rounded-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'CUSTOM_PLANET'
                ? 'bg-purple-500 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sliders size={13} /> 3. CUSTOM PLANET
            {isCustomPlanet && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ADVANCED')}
            className={`px-3 py-1 text-[11px] font-bold rounded-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ADVANCED'
                ? 'bg-emerald-500 text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Settings2 size={13} /> 4. ADVANCED SETTINGS
          </button>
        </div>

        {/* Action Controls: Undo/Redo, Auto-Apply, Run Button, Scenario Drawer */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Undo / Redo */}
          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-1.5 rounded-xs border text-xs transition-colors flex items-center gap-1 ${
                canUndo
                  ? 'bg-[#161a29] hover:bg-[#22283e] text-neutral-200 border-[#28324a] cursor-pointer'
                  : 'bg-[#10121a] text-neutral-600 border-[#1a1e2a] cursor-not-allowed'
              }`}
              title="Undo parameter change (Ctrl+Z)"
            >
              <Undo2 size={13} />
            </button>
          )}
          {onRedo && (
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-1.5 rounded-xs border text-xs transition-colors flex items-center gap-1 ${
                canRedo
                  ? 'bg-[#161a29] hover:bg-[#22283e] text-neutral-200 border-[#28324a] cursor-pointer'
                  : 'bg-[#10121a] text-neutral-600 border-[#1a1e2a] cursor-not-allowed'
              }`}
              title="Redo parameter change (Ctrl+Y)"
            >
              <Redo2 size={13} />
            </button>
          )}

          {/* Auto-Apply Toggle */}
          {onToggleAutoApply && (
            <label className="flex items-center gap-1.5 text-[10px] text-neutral-400 cursor-pointer select-none bg-[#121522] px-2 py-1 rounded-xs border border-[#22293c]">
              <input
                type="checkbox"
                checked={autoApply}
                onChange={onToggleAutoApply}
                className="accent-amber-500"
              />
              <span>AUTO-APPLY</span>
            </label>
          )}

          {/* Apply / Run Simulation Button */}
          {onApplySettings && (
            <button
              type="button"
              onClick={onApplySettings}
              disabled={!isDraftStale}
              className={`px-3 py-1 text-[11px] font-bold rounded-xs transition-all flex items-center gap-1 cursor-pointer ${
                isDraftStale
                  ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-md animate-pulse ring-1 ring-amber-300'
                  : 'bg-[#161a29] text-neutral-500 border border-[#252d42] cursor-default'
              }`}
            >
              <Check size={13} /> {isDraftStale ? 'RUN SIMULATION' : 'SIMULATION RUN'}
            </button>
          )}

          {/* Scenario Persistence Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowScenarioDrawer((prev) => !prev)}
            className={`px-2.5 py-1 text-[11px] rounded-xs border transition-colors flex items-center gap-1.5 cursor-pointer ${
              showScenarioDrawer
                ? 'bg-neutral-200 text-black font-bold border-white'
                : 'bg-[#161a29] text-neutral-300 hover:text-white border-[#273046]'
            }`}
          >
            <FolderOpen size={13} /> SCENARIOS ({savedScenarios.length})
          </button>

          {/* Parameter Sensitivity Tool */}
          {onOpenSensitivity && (
            <button
              type="button"
              onClick={onOpenSensitivity}
              className="px-2.5 py-1 text-[11px] rounded-xs border bg-[#161a29] text-amber-300 hover:text-white border-[#273046] flex items-center gap-1 cursor-pointer"
              title="Open Parameter Sensitivity Sweep Tool"
            >
              <TrendingUp size={13} /> SENSITIVITY
            </button>
          )}

          {/* Astrodynamic Physics Tooltips Drawer Button */}
          <button
            type="button"
            onClick={() => setShowExplanations((prev) => !prev)}
            className={`p-1.5 rounded-xs border transition-colors cursor-pointer ${
              showExplanations
                ? 'bg-[#22293d] text-white border-white'
                : 'bg-[#161a29] text-neutral-400 hover:text-white border-[#273046]'
            }`}
            title="Astrodynamic Parameters Physical Meaning & Units"
          >
            <HelpCircle size={14} />
          </button>
        </div>
      </div>

      {/* Changed Parameters Indicator Banner */}
      {changedParams.length > 0 && (
        <div className="bg-[#101322] border border-[#26304d] px-3 py-2 rounded-xs flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="text-amber-300 font-bold">CHANGED SINCE LAST RUN:</span>
            <span className="text-neutral-300 text-[11px]">
              {changedParams.map((d, i) => (
                <span key={d.paramKey} className="mr-2">
                  <strong>{d.label}</strong> ({d.formattedOld} →{' '}
                  <span className="text-amber-400 font-bold">{d.formattedNew}</span>)
                  {i < changedParams.length - 1 ? ',' : ''}
                </span>
              ))}
            </span>
          </div>
          {isDraftStale && !autoApply && (
            <span className="text-[10px] text-amber-400 font-bold bg-amber-950/60 px-2 py-0.5 rounded-xs border border-amber-600">
              RESULTS STALE — RUN TO UPDATE
            </span>
          )}
        </div>
      )}

      {/* Scenario Persistence Drawer */}
      {showScenarioDrawer && (
        <ScenarioStorageControls
          currentScenario={draftScenario || scenario}
          savedScenarios={savedScenarios}
          onSaveScenario={onSaveScenario}
          onLoadScenario={onLoadScenario}
          onDuplicateScenario={onDuplicateScenario}
          onDeleteScenario={onDeleteScenario}
          onExportJSON={onExportJSON}
          onImportJSON={onImportJSON}
          onResetToDefaults={onResetToDefaults}
          onRestoreLastValid={onRestoreLastValid}
        />
      )}

      {/* Physics Tooltips & Concept Reference Drawer */}
      {showExplanations && (
        <div className="bg-[#080a12] border border-[#1f2538] p-4 rounded-xs grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-neutral-300">
          <div className="bg-[#121522] p-2.5 rounded-xs border border-[#1e2538] flex flex-col gap-1">
            <span className="text-amber-400 font-bold">INCOMING ASYMPTOTIC SPEED (v_∞)</span>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Excess hyperbolic velocity relative to the planet at the boundary of its Sphere of
              Influence (SOI). Specific orbital energy in the planet-centric frame is{' '}
              <span className="text-white font-bold">ε = +v_∞² / 2 &gt; 0</span>.
            </p>
          </div>

          <div className="bg-[#121522] p-2.5 rounded-xs border border-[#1e2538] flex flex-col gap-1">
            <span className="text-sky-400 font-bold">IMPACT PARAMETER (b) vs. PERIAPSIS (r_p)</span>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              The impact parameter <span className="text-white font-bold">b</span> is the asymptotic miss distance.
              Due to gravitational bending, the actual periapsis distance <span className="text-white font-bold">r_p</span> is
              closer: <span className="text-amber-300 font-bold">b = r_p · √(1 + 2μ / (r_p · v_∞²))</span>.
            </p>
          </div>

          <div className="bg-[#121522] p-2.5 rounded-xs border border-[#1e2538] flex flex-col gap-1">
            <span className="text-emerald-400 font-bold">PLANET REST FRAME vs. SUN FRAME</span>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              In the planet rest frame, speed is strictly conserved (<span className="text-white font-bold">||v_out|| = ||v_in|| = v_∞</span>).
              In the heliocentric Sun frame, momentum transfer delivers a net velocity change{' '}
              <span className="text-white font-bold">Δv_assist</span>.
            </p>
          </div>

          <div className="bg-[#121522] p-2.5 rounded-xs border border-[#1e2538] flex flex-col gap-1">
            <span className="text-rose-400 font-bold">TRAILING (+) vs. LEADING (-) PASS</span>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Passing behind the moving planet (<span className="text-white font-bold">Trailing</span>) adds orbital energy (+ΔV).
              Passing ahead (<span className="text-white font-bold">Leading</span>) causes gravitational braking (-ΔV).
            </p>
          </div>

          <div className="bg-[#121522] p-2.5 rounded-xs border border-[#1e2538] flex flex-col gap-1">
            <span className="text-purple-400 font-bold">MASS (M) vs. GRAV. PARAMETER (μ = GM)</span>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Spacecraft tracking directly measures <span className="text-white font-bold">μ = GM</span> with extreme precision.
              Mass M is derived via Newton's G. In ASTRA, users can set either value as authoritative.
            </p>
          </div>

          <div className="bg-[#121522] p-2.5 rounded-xs border border-[#1e2538] flex flex-col gap-1">
            <span className="text-amber-400 font-bold">CIRCULAR ORBIT APPROXIMATION</span>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Planets are modeled in unperturbed circular heliocentric orbits at mean distance. This is an engineering
              simplification; real planetary missions utilize numerical JPL ephemerides (DE440).
            </p>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 1: PLANET PRESETS
         ========================================================================= */}
      {activeTab === 'PRESETS' && (
        <div className="flex flex-col gap-4">
          <PlanetPresetSelector
            selectedPresetId={effectivePlanet.presetId}
            isCustomPlanet={isCustomPlanet}
            onSelectPreset={handleSelectPreset}
            onSelectEducationalPreset={onLoadScenario}
            planetData={effectivePlanet}
          />

          {isCustomPlanet && (
            <div className="mt-2 border-t border-[#1f2538] pt-4">
              <CustomPlanetEditor
                planet={effectivePlanet}
                onChangePlanet={(updater) => {
                  if (onUpdateDraft) {
                    onUpdateDraft((prev) => ({
                      ...prev,
                      planet: updater(prev.planet),
                    }));
                  }
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: SPACECRAFT & FLYBY CONTROLS
         ========================================================================= */}
      {activeTab === 'FLYBY' && (
        <div className="flex flex-col gap-4">
          <FlybyGeometryControls
            planetRadiusM={effectivePlanet.radiusM}
            planetMu={effectivePlanet.mu}
            vInfSpeedMPerS={effectiveEncounter.vInfSpeedMPerS}
            onChangeVInf={(spd) => {
              onChangeVInf(spd);
              if (onUpdateDraft) {
                onUpdateDraft((prev) => ({
                  ...prev,
                  encounter: { ...prev.encounter, vInfSpeedMPerS: spd },
                }));
              }
            }}
            approachAngleDeg={effectiveEncounter.approachAngleDeg}
            onChangeApproachAngle={(angle) => {
              if (onUpdateDraft) {
                onUpdateDraft((prev) => ({
                  ...prev,
                  encounter: { ...prev.encounter, approachAngleDeg: angle },
                }));
              }
            }}
            passType={effectiveEncounter.passType}
            onChangePassType={(pass) => {
              onChangePassType(pass);
              if (onUpdateDraft) {
                onUpdateDraft((prev) => ({
                  ...prev,
                  encounter: { ...prev.encounter, passType: pass },
                }));
              }
            }}
            distanceMode={effectiveEncounter.distanceMode}
            onChangeDistanceMode={(mode) => {
              if (onUpdateDraft) {
                onUpdateDraft((prev) => ({
                  ...prev,
                  encounter: { ...prev.encounter, distanceMode: mode },
                }));
              }
            }}
            periapsisAltitudeKm={effectiveEncounter.periapsisAltitudeKm}
            onChangePeriapsisAltitude={(alt) => {
              onChangePeriapsisAltitude(alt);
              if (onUpdateDraft) {
                onUpdateDraft((prev) => ({
                  ...prev,
                  encounter: { ...prev.encounter, periapsisAltitudeKm: alt },
                }));
              }
            }}
            impactParameterKm={effectiveEncounter.impactParameterKm}
            onChangeImpactParameter={(bKm) => {
              if (onUpdateDraft) {
                onUpdateDraft((prev) => ({
                  ...prev,
                  encounter: { ...prev.encounter, impactParameterKm: bKm },
                }));
              }
            }}
            spacecraftMassKg={effectiveEncounter.spacecraftMassKg}
            onChangeSpacecraftMass={(m) => {
              onChangeSpacecraftMass(m);
              if (onUpdateDraft) {
                onUpdateDraft((prev) => ({
                  ...prev,
                  encounter: { ...prev.encounter, spacecraftMassKg: m },
                }));
              }
            }}
          />

          {/* Numerical State Vector Override */}
          <NumericalStateControls
            customInitialState={effectiveEncounter.customInitialState}
            planetRadiusM={effectivePlanet.radiusM}
            planetMu={effectivePlanet.mu}
            periapsisAltitudeKm={effectiveEncounter.periapsisAltitudeKm}
            impactParameterKm={effectiveEncounter.impactParameterKm}
            vInfSpeedMPerS={effectiveEncounter.vInfSpeedMPerS}
            onChangeCustomInitialState={(updater) => {
              if (onUpdateDraft) {
                onUpdateDraft((prev) => {
                  const currentCustom = prev.encounter.customInitialState || {
                    enabled: false,
                    positionKm: { x: -prev.planet.radiusM * 0.02, y: prev.encounter.impactParameterKm, z: 0 },
                    velocityKmPerS: { x: prev.encounter.vInfSpeedMPerS / 1000.0, y: 0, z: 0 },
                  };
                  return {
                    ...prev,
                    encounter: {
                      ...prev.encounter,
                      customInitialState: updater(currentCustom),
                    },
                  };
                });
              }
            }}
          />
        </div>
      )}

      {/* =========================================================================
          TAB 3: CUSTOM PLANET DESIGNER
         ========================================================================= */}
      {activeTab === 'CUSTOM_PLANET' && (
        <div className="flex flex-col gap-4">
          <CustomPlanetEditor
            planet={effectivePlanet}
            onChangePlanet={(updater) => {
              if (onUpdateDraft) {
                onUpdateDraft((prev) => ({
                  ...prev,
                  mode: 'CUSTOM_PLANET',
                  planet: updater(prev.planet),
                }));
              }
            }}
          />
        </div>
      )}

      {/* =========================================================================
          TAB 4: ADVANCED SETTINGS & ORBITAL KINEMATICS
         ========================================================================= */}
      {activeTab === 'ADVANCED' && (
        <div className="flex flex-col gap-4">
          <AdvancedSimulationSettings
            advanced={effectiveAdvanced}
            onChangeAdvanced={(updater) => {
              if (onUpdateDraft) {
                onUpdateDraft((prev) => ({
                  ...prev,
                  advanced: updater(prev.advanced),
                }));
              }
            }}
            planetVelocityMode={effectivePlanet.velocityMode}
            onChangePlanetVelocityMode={(mode) => {
              if (onUpdateDraft) {
                onUpdateDraft((prev) => ({
                  ...prev,
                  planet: { ...prev.planet, velocityMode: mode },
                }));
              }
            }}
            semiMajorAxisM={effectivePlanet.semiMajorAxisM}
            orbitalSpeedMPerS={effectivePlanet.orbitalSpeedMPerS}
            customVelocityVectorMPerS={effectivePlanet.customVelocityVectorMPerS}
            onChangeOrbitalParams={(updater) => {
              if (onUpdateDraft) {
                onUpdateDraft((prev) => ({
                  ...prev,
                  planet: updater(prev.planet),
                }));
              }
            }}
          />

          <NumericalStateControls
            customInitialState={effectiveEncounter.customInitialState}
            planetRadiusM={effectivePlanet.radiusM}
            planetMu={effectivePlanet.mu}
            periapsisAltitudeKm={effectiveEncounter.periapsisAltitudeKm}
            impactParameterKm={effectiveEncounter.impactParameterKm}
            vInfSpeedMPerS={effectiveEncounter.vInfSpeedMPerS}
            onChangeCustomInitialState={(updater) => {
              if (onUpdateDraft) {
                onUpdateDraft((prev) => {
                  const currentCustom = prev.encounter.customInitialState || {
                    enabled: false,
                    positionKm: { x: -prev.planet.radiusM * 0.02, y: prev.encounter.impactParameterKm, z: 0 },
                    velocityKmPerS: { x: prev.encounter.vInfSpeedMPerS / 1000.0, y: 0, z: 0 },
                  };
                  return {
                    ...prev,
                    encounter: {
                      ...prev.encounter,
                      customInitialState: updater(currentCustom),
                    },
                  };
                });
              }
            }}
          />
        </div>
      )}

      {/* 4. Coordinate Frame & Viewport Camera Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1f2538] text-xs">
        {/* Coordinate Frame Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-neutral-400 font-bold">FRAME:</span>
          <div className="flex rounded-xs border border-[#273046] overflow-hidden">
            <button
              type="button"
              onClick={() => onChangeReferenceFrame('PLANET_CENTRIC')}
              className={`px-3 py-1 text-[11px] transition-colors cursor-pointer ${
                referenceFrame === 'PLANET_CENTRIC'
                  ? 'bg-amber-500 text-black font-bold'
                  : 'bg-[#141826] text-neutral-400 hover:text-white'
              }`}
            >
              PLANET REST FRAME (v_∞ CONSTANT)
            </button>
            <button
              type="button"
              onClick={() => onChangeReferenceFrame('HELIOCENTRIC')}
              className={`px-3 py-1 text-[11px] transition-colors cursor-pointer ${
                referenceFrame === 'HELIOCENTRIC'
                  ? 'bg-sky-500 text-black font-bold'
                  : 'bg-[#141826] text-neutral-400 hover:text-white'
              }`}
            >
              HELIOCENTRIC FRAME (ΔV BOOST)
            </button>
          </div>
        </div>

        {/* Camera Views */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-neutral-400 font-bold">CAMERA:</span>
          {(['OVERVIEW', 'CLOSE_UP', 'PROBE_FOLLOW'] as FlybyCameraMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChangeCameraMode(mode)}
              className={`px-2.5 py-1 text-[10px] rounded-xs border transition-colors cursor-pointer ${
                cameraMode === mode
                  ? 'bg-neutral-200 text-black font-bold border-neutral-100'
                  : 'bg-[#141826] text-neutral-400 border-[#262f44] hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* 3D Visual Overlays */}
        <div className="flex items-center gap-3 text-[10px] text-neutral-300">
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showVectors}
              onChange={onToggleVectors}
              className="accent-amber-500"
            />
            <span>3D VELOCITY VECTORS</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showTrajectoryTrail}
              onChange={onToggleTrajectoryTrail}
              className="accent-sky-500"
            />
            <span>TRAIL</span>
          </label>
        </div>
      </div>

      {/* 5. Playback Controller & Scrubber */}
      <div className="bg-[#090b13] p-3 rounded-xs border border-[#1b2030] flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              className={`p-2 rounded-xs flex items-center justify-center transition-colors cursor-pointer ${
                isPlaying ? 'bg-amber-500 text-black' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
              title={isPlaying ? 'Pause simulation' : 'Play simulation'}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              type="button"
              onClick={onStep}
              className="p-2 bg-[#181d2c] hover:bg-[#22283e] text-neutral-300 rounded-xs transition-colors cursor-pointer"
              title="Single-step advance"
            >
              <SkipForward size={14} />
            </button>
            <button
              type="button"
              onClick={onReset}
              className="p-2 bg-[#181d2c] hover:bg-[#22283e] text-neutral-300 rounded-xs transition-colors cursor-pointer"
              title="Reset simulation to start"
            >
              <RotateCcw size={14} />
            </button>

            {/* Playback Speed */}
            <div className="flex items-center gap-1 ml-2">
              <span className="text-[10px] text-neutral-500">SPEED:</span>
              {[0.25, 0.5, 1, 2, 5, 10].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => onChangePlaybackSpeed(spd)}
                  className={`px-1.5 py-0.5 text-[10px] rounded-xs border cursor-pointer ${
                    playbackSpeed === spd
                      ? 'bg-neutral-300 text-black font-bold border-white'
                      : 'bg-[#121522] text-neutral-400 border-[#20273a]'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          <div className="text-neutral-400 text-[10px]">
            TIMESTEP: <span className="text-white font-bold">{currentStepIndex}</span> / {totalSteps}
          </div>
        </div>

        {/* Time Progress Scrubber */}
        <input
          type="range"
          min="0"
          max={Math.max(0, totalSteps - 1)}
          value={currentStepIndex}
          onChange={(e) => onSeek(parseInt(e.target.value, 10))}
          className="w-full accent-amber-500 bg-neutral-800 h-1.5 rounded-sm cursor-pointer"
        />
      </div>
    </div>
  );
};
