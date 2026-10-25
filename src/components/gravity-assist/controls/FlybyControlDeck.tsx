import React, { useState } from 'react';
import { PlanetaryBodyData, PLANETARY_BODIES, G_NEWTON, AU } from '../../../physics/constants';
import { FlybyPassType, ReferenceFrame } from '../../../physics/FlybyEngine';
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
} from '../../../physics/FlybyScenario';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Eye,
  Compass,
  ShieldAlert,
  Sparkles,
  Sliders,
  Settings2,
  FolderOpen,
  Save,
  Copy,
  Download,
  Upload,
  Undo2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Globe,
  Layers,
  ArrowRight,
  Info,
  Check,
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
}

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

  // Scenario props
  scenario,
  draftScenario,
  onUpdateDraft,
  onApplySettings,
  onResetToPreset,
  onResetToDefaults,
  onSaveScenario,
  onLoadScenario,
  onDuplicateScenario,
  onExportJSON,
  onImportJSON,
  onRestoreLastValid,
  isDraftStale = false,
  autoApply = true,
  onToggleAutoApply,
  savedScenarios = [],
  onDeleteScenario,
}) => {
  // Local UI expansion states
  const [activeMode, setActiveMode] = useState<ConfigurationMode>('PLANET_PRESET');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showScenarioDrawer, setShowScenarioDrawer] = useState<boolean>(false);
  const [showExplanations, setShowExplanations] = useState<boolean>(false);
  const [newScenarioName, setNewScenarioName] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);

  // Derive current effective values (preferring draftScenario if available)
  const effectivePlanet = draftScenario ? draftScenario.planet : selectedPlanet;
  const effectiveAltKm = draftScenario ? draftScenario.encounter.periapsisAltitudeKm : periapsisAltitudeKm;
  const effectiveVInf = draftScenario ? draftScenario.encounter.vInfSpeedMPerS : vInfSpeedMPerS;
  const effectivePassType = draftScenario ? draftScenario.encounter.passType : passType;
  const effectiveMass = draftScenario ? draftScenario.encounter.spacecraftMassKg : spacecraftMassKg;
  const effectiveAngleDeg = draftScenario ? draftScenario.encounter.approachAngleDeg : 0;
  const effectiveDistMode: EncounterDistanceMode = draftScenario ? draftScenario.encounter.distanceMode : 'PERIAPSIS_ALTITUDE';
  const effectiveImpactKm = draftScenario ? draftScenario.encounter.impactParameterKm : 0;

  const isCollisionWarning = effectiveAltKm <= 0;

  // File import handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string' && onImportJSON) {
        onImportJSON(content);
        setImportError(null);
      }
    };
    reader.readAsText(file);
    // Reset file input value
    e.target.value = '';
  };

  return (
    <div className="w-full bg-[#10121a] border border-[#222638] p-5 rounded-xs flex flex-col gap-5 text-white">
      {/* 1. Configuration Mode Selector & Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222638] pb-3">
        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1.5 bg-[#0a0b10] p-1 rounded-xs border border-[#1e2334]">
          <button
            onClick={() => {
              setActiveMode('PLANET_PRESET');
              if (onUpdateDraft) onUpdateDraft((prev) => ({ ...prev, mode: 'PLANET_PRESET' }));
            }}
            className={`px-3 py-1 text-[11px] font-mono font-bold rounded-xs transition-colors flex items-center gap-1.5 ${
              activeMode === 'PLANET_PRESET'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Globe size={13} /> MODE A: PRESETS
          </button>
          <button
            onClick={() => {
              setActiveMode('CUSTOM_PLANET');
              if (onUpdateDraft) onUpdateDraft((prev) => ({ ...prev, mode: 'CUSTOM_PLANET' }));
            }}
            className={`px-3 py-1 text-[11px] font-mono font-bold rounded-xs transition-colors flex items-center gap-1.5 ${
              activeMode === 'CUSTOM_PLANET'
                ? 'bg-sky-500 text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Settings2 size={13} /> MODE B: CUSTOM PLANET
          </button>
          <button
            onClick={() => {
              setActiveMode('CUSTOM_FLYBY');
              if (onUpdateDraft) onUpdateDraft((prev) => ({ ...prev, mode: 'CUSTOM_FLYBY' }));
            }}
            className={`px-3 py-1 text-[11px] font-mono font-bold rounded-xs transition-colors flex items-center gap-1.5 ${
              activeMode === 'CUSTOM_FLYBY'
                ? 'bg-emerald-500 text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Compass size={13} /> MODE C: CUSTOM FLYBY
          </button>
        </div>

        {/* Action Controls & Scenario Manager Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Auto-Apply Toggle */}
          {onToggleAutoApply && (
            <label className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-400 cursor-pointer select-none bg-[#141722] px-2 py-1 rounded-xs border border-[#252c3e]">
              <input
                type="checkbox"
                checked={autoApply}
                onChange={onToggleAutoApply}
                className="accent-amber-500"
              />
              <span>AUTO-APPLY</span>
            </label>
          )}

          {/* Apply Button */}
          {onApplySettings && (
            <button
              onClick={onApplySettings}
              disabled={!isDraftStale}
              className={`px-3 py-1 text-[11px] font-mono font-bold rounded-xs transition-all flex items-center gap-1 ${
                isDraftStale
                  ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-md animate-pulse'
                  : 'bg-[#181c28] text-neutral-500 border border-[#252c3f] cursor-default'
              }`}
            >
              <Check size={13} /> {isDraftStale ? 'APPLY SETTINGS' : 'SETTINGS APPLIED'}
            </button>
          )}

          {/* Scenarios Drawer Button */}
          <button
            onClick={() => setShowScenarioDrawer((prev) => !prev)}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-xs border transition-colors flex items-center gap-1.5 ${
              showScenarioDrawer
                ? 'bg-neutral-200 text-black font-bold border-white'
                : 'bg-[#181c28] text-neutral-300 hover:text-white border-[#272e42]'
            }`}
          >
            <FolderOpen size={13} /> SCENARIOS ({savedScenarios.length})
          </button>

          {/* Physics Help Drawer Button */}
          <button
            onClick={() => setShowExplanations((prev) => !prev)}
            className={`p-1.5 text-neutral-400 hover:text-white rounded-xs border border-[#272e42] ${
              showExplanations ? 'bg-[#252c3f] text-white' : 'bg-[#181c28]'
            }`}
            title="Physics Parameters Explanation"
          >
            <HelpCircle size={14} />
          </button>
        </div>
      </div>

      {/* 2. Scenario Management Drawer (Collapsible) */}
      {showScenarioDrawer && (
        <div className="bg-[#0b0c12] border border-[#23283c] p-4 rounded-xs flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1f2436] pb-2">
            <span className="text-xs font-mono font-bold text-amber-400 uppercase flex items-center gap-1.5">
              <FolderOpen size={14} /> SCENARIO LIBRARY & PERSISTENCE
            </span>
            <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400">
              {draftScenario && (
                <span>
                  ACTIVE: <strong className="text-white">{draftScenario.name}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Quick Actions Row */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
            {/* Save Form */}
            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="New scenario name..."
                value={newScenarioName}
                onChange={(e) => setNewScenarioName(e.target.value)}
                className="bg-[#151824] border border-[#2a3044] px-2.5 py-1 text-xs text-white rounded-xs focus:outline-none focus:border-amber-500 w-48"
              />
              <button
                onClick={() => {
                  if (onSaveScenario) onSaveScenario(newScenarioName.trim() || undefined);
                  setNewScenarioName('');
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xs flex items-center gap-1"
              >
                <Save size={13} /> SAVE
              </button>
            </div>

            {/* Duplicate */}
            {onDuplicateScenario && (
              <button
                onClick={onDuplicateScenario}
                className="px-2.5 py-1 bg-[#1a1e2d] hover:bg-[#252a3f] text-neutral-200 border border-[#2b334a] rounded-xs flex items-center gap-1"
              >
                <Copy size={13} /> DUPLICATE
              </button>
            )}

            {/* Export JSON */}
            {onExportJSON && (
              <button
                onClick={onExportJSON}
                className="px-2.5 py-1 bg-[#1a1e2d] hover:bg-[#252a3f] text-neutral-200 border border-[#2b334a] rounded-xs flex items-center gap-1"
              >
                <Download size={13} /> EXPORT JSON
              </button>
            )}

            {/* Import JSON */}
            <label className="px-2.5 py-1 bg-[#1a1e2d] hover:bg-[#252a3f] text-neutral-200 border border-[#2b334a] rounded-xs flex items-center gap-1 cursor-pointer">
              <Upload size={13} /> IMPORT JSON
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Restore Last Valid */}
            {onRestoreLastValid && (
              <button
                onClick={onRestoreLastValid}
                className="px-2.5 py-1 bg-[#1a1e2d] hover:bg-[#252a3f] text-amber-300 border border-[#2b334a] rounded-xs flex items-center gap-1"
                title="Undo changes to last verified valid state"
              >
                <Undo2 size={13} /> RESTORE LAST VALID
              </button>
            )}

            {/* Reset to Preset */}
            {onResetToPreset && (
              <button
                onClick={onResetToPreset}
                className="px-2.5 py-1 bg-[#1a1e2d] hover:bg-[#252a3f] text-neutral-400 hover:text-white border border-[#2b334a] rounded-xs"
              >
                RESET TO PRESET
              </button>
            )}

            {/* Reset to Defaults */}
            {onResetToDefaults && (
              <button
                onClick={onResetToDefaults}
                className="px-2.5 py-1 bg-[#1a1e2d] hover:bg-[#252a3f] text-neutral-400 hover:text-white border border-[#2b334a] rounded-xs"
              >
                RESET DEFAULTS
              </button>
            )}
          </div>

          {/* Import Error Message */}
          {importError && (
            <div className="text-xs font-mono text-rose-400 bg-rose-950/40 p-2 rounded-xs border border-rose-800">
              {importError}
            </div>
          )}

          {/* Saved Scenarios List */}
          {savedScenarios.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1a1f2e]">
              <span className="text-[10px] font-mono text-neutral-500 self-center">LOAD SAVED:</span>
              {savedScenarios.map((sc) => (
                <div
                  key={sc.id}
                  className="flex items-center gap-1 bg-[#151824] border border-[#282f44] px-2 py-0.5 rounded-xs text-[11px] font-mono"
                >
                  <button
                    onClick={() => onLoadScenario && onLoadScenario(sc)}
                    className="text-neutral-300 hover:text-amber-400 text-left"
                  >
                    {sc.name}
                  </button>
                  {onDeleteScenario && savedScenarios.length > 1 && (
                    <button
                      onClick={() => onDeleteScenario(sc.id)}
                      className="text-neutral-600 hover:text-rose-400 ml-1"
                      title="Delete saved scenario"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Physics Explanations & Tooltip Drawer (Collapsible) */}
      {showExplanations && (
        <div className="bg-[#0b0c12] border border-[#23283c] p-4 rounded-xs grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono text-neutral-300">
          <div className="bg-[#131622] p-2.5 rounded-xs border border-[#20273a] flex flex-col gap-1">
            <span className="text-amber-400 font-bold">PLANET MASS vs. GRAVITATIONAL PARAMETER (μ)</span>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Standard gravitational parameter <span className="text-white font-bold">μ = GM</span> is directly observed
              from orbital tracking with extreme precision. Planetary mass <span className="text-white font-bold">M</span> is
              derived via Newton’s constant G, which carries laboratory measurement uncertainty.
            </p>
          </div>
          <div className="bg-[#131622] p-2.5 rounded-xs border border-[#20273a] flex flex-col gap-1">
            <span className="text-sky-400 font-bold">IMPACT PARAMETER (b) vs. PERIAPSIS DISTANCE (rp)</span>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Impact parameter <span className="text-white font-bold">b</span> is the asymptotic distance of closest approach
              at infinity. Due to gravitational focusing, the actual physical periapsis is closer:
              <span className="text-amber-300 font-bold"> b² = rp² + 2μrp/v_∞²</span>.
            </p>
          </div>
          <div className="bg-[#131622] p-2.5 rounded-xs border border-[#20273a] flex flex-col gap-1">
            <span className="text-emerald-400 font-bold">PLANET REST FRAME vs. SUN FRAME</span>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              In the planet’s frame, energy is conserved (<span className="text-white font-bold">||v_∞(+) || = ||v_∞(-)||</span>).
              In the Sun’s frame, the moving planet exchanges momentum, yielding a net heliocentric velocity boost.
            </p>
          </div>
          <div className="bg-[#131622] p-2.5 rounded-xs border border-[#20273a] flex flex-col gap-1">
            <span className="text-rose-400 font-bold">VECTOR Δv vs. SCALAR SPEED CHANGE</span>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              <span className="text-white font-bold">||Δv_vector|| = 2v_∞ sin(δ/2)</span> is the magnitude of the velocity
              vector rotation, while <span className="text-white font-bold">Δv_speed = ||v_out|| - ||v_in||</span> is the scalar
              speed change along the flight path. They are fundamentally distinct.
            </p>
          </div>
          <div className="bg-[#131622] p-2.5 rounded-xs border border-[#20273a] flex flex-col gap-1">
            <span className="text-purple-400 font-bold">SIMULATED TIME vs. WALL-CLOCK TIME</span>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Simulated time <span className="text-white font-bold">T + t</span> reflects physical coordinate seconds in SI units
              integrated by RK4. Playback speed scales animation frame delivery independently.
            </p>
          </div>
          <div className="bg-[#131622] p-2.5 rounded-xs border border-[#20273a] flex flex-col gap-1">
            <span className="text-amber-400 font-bold">TRAILING vs. LEADING FLYBY</span>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Passing behind the planet’s orbital velocity vector (<span className="text-white font-bold">Trailing</span>) adds
              energy (+ΔV). Passing ahead (<span className="text-white font-bold">Leading</span>) gravitational brakes (-ΔV).
            </p>
          </div>
        </div>
      )}

      {/* 4. MODE A: PLANET PRESETS */}
      {activeMode === 'PLANET_PRESET' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-mono text-neutral-400 uppercase">
              SELECT CANONICAL SOLAR SYSTEM BODY:
            </span>
            <div className="flex items-center gap-1.5">
              {Object.values(PLANETARY_BODIES).map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelectPlanet(p);
                    if (onUpdateDraft) {
                      onUpdateDraft((prev) => ({
                        ...prev,
                        planet: {
                          ...prev.planet,
                          presetId: p.id,
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
                    }
                  }}
                  className={`px-3 py-1.5 text-xs font-mono uppercase font-bold rounded-xs transition-colors ${
                    effectivePlanet.name === p.name
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'bg-[#181c28] text-neutral-400 hover:text-white border border-[#252c3f]'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Preset Characteristics Summary */}
          <div className="bg-[#0b0c12] p-3 rounded-xs border border-[#1b1f2b] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <span className="text-neutral-500 text-[10px]">MEAN RADIUS:</span>
              <div className="text-white font-bold">{(effectivePlanet.radiusM / 1000).toLocaleString()} km</div>
            </div>
            <div>
              <span className="text-neutral-500 text-[10px]">GRAVITATIONAL PARAMETER (μ):</span>
              <div className="text-amber-400 font-bold">{effectivePlanet.mu.toExponential(4)} m³/s²</div>
            </div>
            <div>
              <span className="text-neutral-500 text-[10px]">ORBITAL SPEED (SUN):</span>
              <div className="text-sky-400 font-bold">{(effectivePlanet.orbitalSpeedMPerS / 1000).toFixed(2)} km/s</div>
            </div>
            <div>
              <span className="text-neutral-500 text-[10px]">STATUS:</span>
              <div className="text-emerald-400 font-bold">
                {effectivePlanet.isTheoretical ? 'THEORETICAL MODEL' : 'VERIFIED ASTRODYNAMICS CONSTANTS'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODE B: CUSTOM PLANET BUILDER */}
      {activeMode === 'CUSTOM_PLANET' && (
        <div className="bg-[#0c0d14] border border-[#23283c] p-4 rounded-xs flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1f2436] pb-2">
            <span className="text-xs font-mono font-bold text-sky-400 uppercase flex items-center gap-1.5">
              <Settings2 size={14} /> THEORETICAL PLANET BUILDER
            </span>
            <span className="px-2 py-0.5 bg-amber-950/60 border border-amber-600 text-amber-300 text-[10px] font-mono rounded-xs font-bold">
              THEORETICAL EXOPLANET MODEL
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            {/* Planet Name */}
            <div className="flex flex-col gap-1">
              <label className="text-neutral-400 text-[10px] uppercase">PLANET DESIGNATION</label>
              <input
                type="text"
                value={effectivePlanet.name}
                onChange={(e) => {
                  const val = e.target.value;
                  if (onUpdateDraft) {
                    onUpdateDraft((prev) => ({
                      ...prev,
                      planet: { ...prev.planet, name: val, isTheoretical: true },
                    }));
                  }
                }}
                className="bg-[#141724] border border-[#272e42] px-2.5 py-1.5 rounded-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Mass Authority Toggle & Input */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-[10px]">
                <label className="text-neutral-400 uppercase">MASS (kg)</label>
                <button
                  onClick={() => {
                    if (onUpdateDraft) {
                      onUpdateDraft((prev) => ({
                        ...prev,
                        planet: {
                          ...prev.planet,
                          authority: prev.planet.authority === 'MASS_AUTHORITATIVE' ? 'MU_AUTHORITATIVE' : 'MASS_AUTHORITATIVE',
                        },
                      }));
                    }
                  }}
                  className="text-[9px] text-amber-400 hover:underline"
                >
                  {draftScenario?.planet.authority === 'MASS_AUTHORITATIVE' ? '[MASS AUTH]' : '[μ AUTH]'}
                </button>
              </div>
              <input
                type="number"
                step="1e24"
                min="1e20"
                value={effectivePlanet.massKg}
                onChange={(e) => {
                  const m = parseFloat(e.target.value);
                  if (m > 0 && onUpdateDraft) {
                    onUpdateDraft((prev) => {
                      const synced = syncMassAndMu(m, prev.planet.mu, 'MASS_AUTHORITATIVE');
                      return {
                        ...prev,
                        planet: {
                          ...prev.planet,
                          massKg: synced.massKg,
                          mu: synced.mu,
                          authority: 'MASS_AUTHORITATIVE',
                          isTheoretical: true,
                        },
                      };
                    });
                  }
                }}
                className="bg-[#141724] border border-[#272e42] px-2.5 py-1.5 rounded-xs text-white focus:outline-none focus:border-sky-500"
              />
              <span className="text-[9px] text-neutral-500">
                μ derived: {(effectivePlanet.mu).toExponential(3)} m³/s²
              </span>
            </div>

            {/* Planetary Radius */}
            <div className="flex flex-col gap-1">
              <label className="text-neutral-400 text-[10px] uppercase">VOLUMETRIC RADIUS (km)</label>
              <input
                type="number"
                step="500"
                min="500"
                value={effectivePlanet.radiusM / 1000.0}
                onChange={(e) => {
                  const rKm = parseFloat(e.target.value);
                  if (rKm > 0 && onUpdateDraft) {
                    onUpdateDraft((prev) => ({
                      ...prev,
                      planet: { ...prev.planet, radiusM: rKm * 1000.0, isTheoretical: true },
                    }));
                  }
                }}
                className="bg-[#141724] border border-[#272e42] px-2.5 py-1.5 rounded-xs text-white focus:outline-none focus:border-sky-500"
              />
              <span className="text-[9px] text-neutral-500">
                Physical surface threshold for impact
              </span>
            </div>

            {/* Planet Orbital Speed / Semi-major Axis */}
            <div className="flex flex-col gap-1">
              <label className="text-neutral-400 text-[10px] uppercase">SEMI-MAJOR AXIS (AU)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="50"
                value={(effectivePlanet.semiMajorAxisM / AU).toFixed(2)}
                onChange={(e) => {
                  const aAU = parseFloat(e.target.value);
                  if (aAU > 0 && onUpdateDraft) {
                    const aM = aAU * AU;
                    const spd = computeCircularOrbitalSpeed(aM);
                    onUpdateDraft((prev) => ({
                      ...prev,
                      planet: {
                        ...prev.planet,
                        semiMajorAxisM: aM,
                        orbitalSpeedMPerS: spd,
                        customVelocityVectorMPerS: { x: 0, y: spd, z: 0 },
                        isTheoretical: true,
                      },
                    }));
                  }
                }}
                className="bg-[#141724] border border-[#272e42] px-2.5 py-1.5 rounded-xs text-white focus:outline-none focus:border-sky-500"
              />
              <span className="text-[9px] text-sky-400">
                V_planet: {(effectivePlanet.orbitalSpeedMPerS / 1000.0).toFixed(2)} km/s
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODE C: CUSTOM FLYBY & PRIMARY ENCOUNTER PARAMETERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pass Type (Encounter Geometry) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-mono text-neutral-400 uppercase">
            ENCOUNTER GEOMETRY
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                onChangePassType('TRAILING');
                if (onUpdateDraft) onUpdateDraft((prev) => ({ ...prev, encounter: { ...prev.encounter, passType: 'TRAILING' } }));
              }}
              className={`py-2 px-2 text-[11px] font-mono rounded-xs border transition-colors ${
                effectivePassType === 'TRAILING'
                  ? 'bg-amber-500 text-black font-bold border-amber-400'
                  : 'bg-[#161924] text-neutral-400 border-[#252c3f] hover:text-white'
              }`}
            >
              TRAILING (ACCEL +)
            </button>
            <button
              onClick={() => {
                onChangePassType('LEADING');
                if (onUpdateDraft) onUpdateDraft((prev) => ({ ...prev, encounter: { ...prev.encounter, passType: 'LEADING' } }));
              }}
              className={`py-2 px-2 text-[11px] font-mono rounded-xs border transition-colors ${
                effectivePassType === 'LEADING'
                  ? 'bg-rose-500 text-white font-bold border-rose-400'
                  : 'bg-[#161924] text-neutral-400 border-[#252c3f] hover:text-white'
              }`}
            >
              LEADING (BRAKE -)
            </button>
          </div>
          <span className="text-[9px] font-mono text-neutral-500">
            {effectivePassType === 'TRAILING'
              ? 'Behind planet: pulls towards V_p (+ΔV Sun)'
              : 'Ahead of planet: pulls against V_p (-ΔV Sun)'}
          </span>
        </div>

        {/* Hyperbolic Excess Speed v_inf */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-neutral-400">HYPERBOLIC EXCESS (v_∞)</span>
            <span className="text-amber-400 font-bold">{(effectiveVInf / 1000).toFixed(1)} km/s</span>
          </div>
          <input
            type="range"
            min="2000"
            max="30000"
            step="250"
            value={effectiveVInf}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onChangeVInf(val);
              if (onUpdateDraft) {
                onUpdateDraft((prev) => {
                  const synced = syncAltitudeAndImpactParameter(
                    prev.encounter.periapsisAltitudeKm,
                    prev.encounter.impactParameterKm,
                    prev.encounter.distanceMode,
                    prev.planet.radiusM,
                    val,
                    prev.planet.mu
                  );
                  return {
                    ...prev,
                    encounter: {
                      ...prev.encounter,
                      vInfSpeedMPerS: val,
                      periapsisAltitudeKm: synced.periapsisAltitudeKm,
                      impactParameterKm: synced.impactParameterKm,
                    },
                  };
                });
              }
            }}
            className="w-full accent-amber-500 bg-neutral-800 h-1.5 rounded-sm cursor-pointer"
          />
          <div className="flex justify-between text-[9px] font-mono text-neutral-500">
            <span>2.0 km/s</span>
            <span>30.0 km/s</span>
          </div>
        </div>

        {/* Closest Approach Control: Toggle between Periapsis Altitude hp and Impact Parameter b */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs font-mono">
            <div className="flex items-center gap-1">
              <span className="text-neutral-400">
                {effectiveDistMode === 'PERIAPSIS_ALTITUDE' ? 'ALTITUDE (hp)' : 'IMPACT PARAM (b)'}
              </span>
              <button
                onClick={() => {
                  const nextMode: EncounterDistanceMode =
                    effectiveDistMode === 'PERIAPSIS_ALTITUDE' ? 'IMPACT_PARAMETER' : 'PERIAPSIS_ALTITUDE';
                  if (onUpdateDraft) {
                    onUpdateDraft((prev) => ({
                      ...prev,
                      encounter: { ...prev.encounter, distanceMode: nextMode },
                    }));
                  }
                }}
                className="text-[9px] text-sky-400 hover:underline"
              >
                [SWITCH TO {effectiveDistMode === 'PERIAPSIS_ALTITUDE' ? 'b' : 'hp'}]
              </button>
            </div>
            <span className={`font-bold ${isCollisionWarning ? 'text-rose-400' : 'text-sky-400'}`}>
              {effectiveDistMode === 'PERIAPSIS_ALTITUDE'
                ? `${effectiveAltKm.toFixed(0)} km`
                : `${effectiveImpactKm.toFixed(0)} km`}
            </span>
          </div>

          {effectiveDistMode === 'PERIAPSIS_ALTITUDE' ? (
            <input
              type="range"
              min="-10000"
              max="200000"
              step="1000"
              value={effectiveAltKm}
              onChange={(e) => {
                const alt = parseFloat(e.target.value);
                onChangePeriapsisAltitude(alt);
                if (onUpdateDraft) {
                  onUpdateDraft((prev) => {
                    const synced = syncAltitudeAndImpactParameter(
                      alt,
                      prev.encounter.impactParameterKm,
                      'PERIAPSIS_ALTITUDE',
                      prev.planet.radiusM,
                      prev.encounter.vInfSpeedMPerS,
                      prev.planet.mu
                    );
                    return {
                      ...prev,
                      encounter: {
                        ...prev.encounter,
                        periapsisAltitudeKm: synced.periapsisAltitudeKm,
                        impactParameterKm: synced.impactParameterKm,
                      },
                    };
                  });
                }
              }}
              className={`w-full h-1.5 rounded-sm cursor-pointer ${
                isCollisionWarning ? 'accent-rose-500 bg-rose-950' : 'accent-sky-500 bg-neutral-800'
              }`}
            />
          ) : (
            <input
              type="range"
              min="0"
              max="300000"
              step="1000"
              value={effectiveImpactKm}
              onChange={(e) => {
                const bVal = parseFloat(e.target.value);
                if (onUpdateDraft) {
                  onUpdateDraft((prev) => {
                    const synced = syncAltitudeAndImpactParameter(
                      prev.encounter.periapsisAltitudeKm,
                      bVal,
                      'IMPACT_PARAMETER',
                      prev.planet.radiusM,
                      prev.encounter.vInfSpeedMPerS,
                      prev.planet.mu
                    );
                    onChangePeriapsisAltitude(synced.periapsisAltitudeKm);
                    return {
                      ...prev,
                      encounter: {
                        ...prev.encounter,
                        periapsisAltitudeKm: synced.periapsisAltitudeKm,
                        impactParameterKm: synced.impactParameterKm,
                      },
                    };
                  });
                }
              }}
              className="w-full accent-sky-500 bg-neutral-800 h-1.5 rounded-sm cursor-pointer"
            />
          )}

          <div className="flex justify-between text-[9px] font-mono text-neutral-500">
            <span>
              {effectiveDistMode === 'PERIAPSIS_ALTITUDE'
                ? `b: ${effectiveImpactKm.toFixed(0)} km`
                : `hp: ${effectiveAltKm.toFixed(0)} km`}
            </span>
            <span>{isCollisionWarning ? 'IMPACT ZONE' : 'SAFE FLYBY'}</span>
          </div>
        </div>

        {/* Spacecraft Mass */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-neutral-400">PROBE MASS (m)</span>
            <span className="text-white font-bold">{effectiveMass.toLocaleString()} kg</span>
          </div>
          <input
            type="range"
            min="100"
            max="25000"
            step="100"
            value={effectiveMass}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onChangeSpacecraftMass(val);
              if (onUpdateDraft) {
                onUpdateDraft((prev) => ({
                  ...prev,
                  encounter: { ...prev.encounter, spacecraftMassKg: val },
                }));
              }
            }}
            className="w-full accent-emerald-500 bg-neutral-800 h-1.5 rounded-sm cursor-pointer"
          />
          <span className="text-[9px] font-mono text-neutral-500">
            Kinematic trajectory invariant; scales ΔK & momentum
          </span>
        </div>
      </div>

      {/* Collision Warning Banner */}
      {isCollisionWarning && (
        <div className="p-2.5 bg-rose-950/60 border border-rose-600/50 rounded-xs flex items-center gap-2 text-rose-300 text-xs font-mono">
          <ShieldAlert size={16} className="text-rose-500 flex-shrink-0" />
          <span>
            <strong>COLLISION HAZARD:</strong> Periapsis altitude is below the physical planetary radius of{' '}
            {(effectivePlanet.radiusM / 1000).toLocaleString()} km. The spacecraft will impact the surface.
          </span>
        </div>
      )}

      {/* 7. Advanced Settings Toggle & Drawer */}
      <div className="border-t border-[#1e2334] pt-2">
        <button
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="text-xs font-mono text-neutral-400 hover:text-white flex items-center gap-1.5"
        >
          <Sliders size={13} /> ADVANCED ASTRODYNAMICS & NUMERICAL INTEGRATION
          {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {showAdvanced && (
          <div className="mt-3 p-3 bg-[#0a0b10] border border-[#1e2334] rounded-xs grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            {/* Approach Angle */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-neutral-400">APPROACH ANGLE (θ_app)</span>
                <span className="text-amber-400 font-bold">{effectiveAngleDeg}°</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={effectiveAngleDeg}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (onUpdateDraft) {
                    onUpdateDraft((prev) => ({
                      ...prev,
                      encounter: { ...prev.encounter, approachAngleDeg: val },
                    }));
                  }
                }}
                className="w-full accent-amber-500 bg-neutral-800 h-1 rounded-sm cursor-pointer"
              />
              <span className="text-[9px] text-neutral-500">In-plane asymptote approach heading</span>
            </div>

            {/* Time-step Coeff (Integrator Precision) */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-neutral-400">RK4 STEP COEFFICIENT (η)</span>
                <span className="text-sky-400 font-bold">
                  {draftScenario?.advanced.timeStepCoeff ?? 0.015}
                </span>
              </div>
              <input
                type="range"
                min="0.005"
                max="0.05"
                step="0.005"
                value={draftScenario?.advanced.timeStepCoeff ?? 0.015}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (onUpdateDraft) {
                    onUpdateDraft((prev) => ({
                      ...prev,
                      advanced: { ...prev.advanced, timeStepCoeff: val },
                    }));
                  }
                }}
                className="w-full accent-sky-500 bg-neutral-800 h-1 rounded-sm cursor-pointer"
              />
              <span className="text-[9px] text-neutral-500">Smaller η = higher numerical precision</span>
            </div>

            {/* Trajectory Mode */}
            <div className="flex flex-col gap-1">
              <span className="text-neutral-400 text-[10px]">TRAJECTORY MODEL</span>
              <div className="grid grid-cols-2 gap-1 mt-1">
                <button
                  onClick={() => {
                    if (onUpdateDraft) {
                      onUpdateDraft((prev) => ({
                        ...prev,
                        advanced: { ...prev.advanced, trajectoryMode: 'NUMERICAL_RK4' },
                      }));
                    }
                  }}
                  className={`py-1 text-[10px] rounded-xs border font-mono ${
                    draftScenario?.advanced.trajectoryMode !== 'ANALYTICAL_IDEAL'
                      ? 'bg-amber-500 text-black font-bold border-amber-400'
                      : 'bg-[#141724] text-neutral-400 border-[#252c3f]'
                  }`}
                >
                  NUMERICAL RK4
                </button>
                <button
                  onClick={() => {
                    if (onUpdateDraft) {
                      onUpdateDraft((prev) => ({
                        ...prev,
                        advanced: { ...prev.advanced, trajectoryMode: 'ANALYTICAL_IDEAL' },
                      }));
                    }
                  }}
                  className={`py-1 text-[10px] rounded-xs border font-mono ${
                    draftScenario?.advanced.trajectoryMode === 'ANALYTICAL_IDEAL'
                      ? 'bg-sky-500 text-black font-bold border-sky-400'
                      : 'bg-[#141724] text-neutral-400 border-[#252c3f]'
                  }`}
                >
                  IDEAL CONIC
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 8. Reference Frame & Camera Mode Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#222638]">
        {/* Dual-Frame Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-neutral-400">COORDINATE FRAME:</span>
          <div className="flex rounded-xs border border-[#2a3044] overflow-hidden">
            <button
              onClick={() => onChangeReferenceFrame('PLANET_CENTRIC')}
              className={`px-3 py-1 text-[11px] font-mono transition-colors ${
                referenceFrame === 'PLANET_CENTRIC'
                  ? 'bg-amber-500 text-black font-bold'
                  : 'bg-[#161924] text-neutral-400 hover:text-white'
              }`}
            >
              PLANET REST FRAME (v_∞ CONSTANT)
            </button>
            <button
              onClick={() => onChangeReferenceFrame('HELIOCENTRIC')}
              className={`px-3 py-1 text-[11px] font-mono transition-colors ${
                referenceFrame === 'HELIOCENTRIC'
                  ? 'bg-sky-500 text-black font-bold'
                  : 'bg-[#161924] text-neutral-400 hover:text-white'
              }`}
            >
              HELIOCENTRIC FRAME (GENUINE ΔV BOOST)
            </button>
          </div>
        </div>

        {/* Camera Views */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-neutral-400">CAMERA:</span>
          {(['OVERVIEW', 'CLOSE_UP', 'PROBE_FOLLOW'] as FlybyCameraMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onChangeCameraMode(mode)}
              className={`px-2.5 py-1 text-[10px] font-mono rounded-xs border transition-colors ${
                cameraMode === mode
                  ? 'bg-neutral-200 text-black font-bold border-neutral-100'
                  : 'bg-[#161924] text-neutral-400 border-[#272e42] hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Visual Toggles */}
        <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-300">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showVectors}
              onChange={onToggleVectors}
              className="accent-amber-500"
            />
            <span>3D VECTORS</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
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

      {/* 9. Playback Controller & Scrubber */}
      <div className="bg-[#0b0c12] p-3 rounded-xs border border-[#1b1f2b] flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePlay}
              className={`p-2 rounded-xs flex items-center justify-center transition-colors ${
                isPlaying ? 'bg-amber-500 text-black' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              onClick={onStep}
              className="p-2 bg-[#1c202e] hover:bg-[#252a3d] text-neutral-300 rounded-xs transition-colors"
              title="Single-step advance"
            >
              <SkipForward size={14} />
            </button>
            <button
              onClick={onReset}
              className="p-2 bg-[#1c202e] hover:bg-[#252a3d] text-neutral-300 rounded-xs transition-colors"
              title="Reset simulation"
            >
              <RotateCcw size={14} />
            </button>

            {/* Playback Speed Multiplier */}
            <div className="flex items-center gap-1 ml-2">
              <span className="text-[10px] text-neutral-500">SPEED:</span>
              {[0.5, 1, 2, 5, 10].map((spd) => (
                <button
                  key={spd}
                  onClick={() => onChangePlaybackSpeed(spd)}
                  className={`px-1.5 py-0.5 text-[10px] font-mono rounded-xs border ${
                    playbackSpeed === spd
                      ? 'bg-neutral-300 text-black font-bold border-white'
                      : 'bg-[#141722] text-neutral-400 border-[#222838]'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          <div className="text-neutral-400 font-mono text-[10px]">
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
          className="w-full accent-amber-500 bg-neutral-800 h-1 rounded-sm cursor-pointer"
        />
      </div>
    </div>
  );
};
