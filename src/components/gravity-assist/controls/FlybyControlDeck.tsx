import React from 'react';
import { PlanetaryBodyData, PLANETARY_BODIES } from '../../../physics/constants';
import { FlybyPassType, ReferenceFrame } from '../../../physics/FlybyEngine';
import { FlybyCameraMode } from '../viewport/Flyby3DCanvas';
import { Play, Pause, RotateCcw, SkipForward, Eye, Compass, ShieldAlert, Sparkles, Sliders } from 'lucide-react';

interface FlybyControlDeckProps {
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
}) => {
  const isCollisionWarning = periapsisAltitudeKm <= 0;

  return (
    <div className="w-full bg-[#10121a] border border-[#222638] p-5 rounded-xs flex flex-col gap-5 text-white">
      {/* 1. Header & Quick Presets */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222638] pb-3">
        <div className="flex items-center gap-2">
          <Sliders size={16} className="text-amber-400" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-200">
            FLIGHT MECHANICS & ENCOUNTER CONTROLS
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-neutral-400">PLANET:</span>
          {Object.values(PLANETARY_BODIES).map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectPlanet(p)}
              className={`px-2.5 py-1 text-[11px] font-mono uppercase font-bold rounded-xs transition-colors ${
                selectedPlanet.id === p.id
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'bg-[#181c28] text-neutral-400 hover:text-white border border-[#252c3f]'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Primary Encounter Parameters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pass Type (Encounter Geometry) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-mono text-neutral-400 uppercase">
            ENCOUNTER GEOMETRY
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onChangePassType('TRAILING')}
              className={`py-2 px-2 text-[11px] font-mono rounded-xs border transition-colors ${
                passType === 'TRAILING'
                  ? 'bg-amber-500 text-black font-bold border-amber-400'
                  : 'bg-[#161924] text-neutral-400 border-[#252c3f] hover:text-white'
              }`}
            >
              TRAILING (ACCEL +)
            </button>
            <button
              onClick={() => onChangePassType('LEADING')}
              className={`py-2 px-2 text-[11px] font-mono rounded-xs border transition-colors ${
                passType === 'LEADING'
                  ? 'bg-rose-500 text-white font-bold border-rose-400'
                  : 'bg-[#161924] text-neutral-400 border-[#252c3f] hover:text-white'
              }`}
            >
              LEADING (BRAKE -)
            </button>
          </div>
          <span className="text-[9px] font-mono text-neutral-500">
            {passType === 'TRAILING'
              ? 'Passes behind planet: pulls towards V_p (+ΔV Sun)'
              : 'Passes ahead of planet: pulls against V_p (-ΔV Sun)'}
          </span>
        </div>

        {/* Hyperbolic Excess Speed v_inf */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-neutral-400">HYPERBOLIC EXCESS (v_∞)</span>
            <span className="text-amber-400 font-bold">{(vInfSpeedMPerS / 1000).toFixed(1)} km/s</span>
          </div>
          <input
            type="range"
            min="2000"
            max="25000"
            step="250"
            value={vInfSpeedMPerS}
            onChange={(e) => onChangeVInf(parseFloat(e.target.value))}
            className="w-full accent-amber-500 bg-neutral-800 h-1.5 rounded-sm cursor-pointer"
          />
          <div className="flex justify-between text-[9px] font-mono text-neutral-500">
            <span>2.0 km/s</span>
            <span>25.0 km/s</span>
          </div>
        </div>

        {/* Periapsis Altitude hp */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-neutral-400">PERIAPSIS ALTITUDE (hp)</span>
            <span className={`font-bold ${isCollisionWarning ? 'text-rose-400' : 'text-sky-400'}`}>
              {periapsisAltitudeKm.toFixed(0)} km
            </span>
          </div>
          <input
            type="range"
            min="-10000"
            max="200000"
            step="1000"
            value={periapsisAltitudeKm}
            onChange={(e) => onChangePeriapsisAltitude(parseFloat(e.target.value))}
            className={`w-full h-1.5 rounded-sm cursor-pointer ${
              isCollisionWarning ? 'accent-rose-500 bg-rose-950' : 'accent-sky-500 bg-neutral-800'
            }`}
          />
          <div className="flex justify-between text-[9px] font-mono text-neutral-500">
            <span>-10k km (Impact)</span>
            <span>200k km</span>
          </div>
        </div>

        {/* Spacecraft Mass */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-neutral-400">PROBE MASS (m)</span>
            <span className="text-white font-bold">{spacecraftMassKg.toLocaleString()} kg</span>
          </div>
          <input
            type="range"
            min="100"
            max="20000"
            step="100"
            value={spacecraftMassKg}
            onChange={(e) => onChangeSpacecraftMass(parseFloat(e.target.value))}
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
            {(selectedPlanet.radiusM / 1000).toLocaleString()} km. The spacecraft will impact the surface.
          </span>
        </div>
      )}

      {/* 3. Reference Frame & Camera Mode Bar */}
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

      {/* 4. Playback Controller & Scrubber */}
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
