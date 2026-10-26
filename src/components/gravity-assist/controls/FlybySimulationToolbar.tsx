import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Compass,
  Sliders,
  Eye,
  Crosshair,
  Grid,
  Zap,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { FlybyCameraMode } from '../viewport/Flyby3DCanvas';
import { ReferenceFrame } from '../../../physics/FlybyEngine';

export type ViewFrameMode = 'PLANET_CENTRIC' | 'HELIOCENTRIC' | 'SIDE_BY_SIDE';

export interface FlybySimulationToolbarProps {
  // Playback state
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  onStep: () => void;
  onStepBack?: () => void;
  playbackSpeed: number;
  onChangePlaybackSpeed: (speed: number) => void;
  currentStepIndex: number;
  totalSteps: number;
  currentTimeS: number;
  totalDurationS: number;
  onSeek: (index: number) => void;
  periapsisTimeS?: number;
  collisionTimeS?: number;
  collisionDetected?: boolean;

  // Reference Frame
  viewFrameMode: ViewFrameMode;
  onChangeViewFrameMode: (mode: ViewFrameMode) => void;

  // Camera
  cameraMode: FlybyCameraMode;
  onChangeCameraMode: (mode: FlybyCameraMode) => void;
  onResetCamera: () => void;

  // Visual Toggles
  showVectors: boolean;
  onToggleVectors: () => void;
  showTrajectoryTrail: boolean;
  onToggleTrajectoryTrail: () => void;

  // Collapsible Parameter Panel State
  isParamsCollapsed: boolean;
  onToggleParamsCollapse: () => void;
}

const PLAYBACK_SPEEDS = [0.25, 0.5, 1.0, 2.0, 5.0, 10.0];

export const FlybySimulationToolbar: React.FC<FlybySimulationToolbarProps> = ({
  isPlaying,
  onTogglePlay,
  onReset,
  onStep,
  onStepBack,
  playbackSpeed,
  onChangePlaybackSpeed,
  currentStepIndex,
  totalSteps,
  currentTimeS,
  totalDurationS,
  onSeek,
  periapsisTimeS,
  collisionTimeS,
  collisionDetected,
  viewFrameMode,
  onChangeViewFrameMode,
  cameraMode,
  onChangeCameraMode,
  onResetCamera,
  showVectors,
  onToggleVectors,
  showTrajectoryTrail,
  onToggleTrajectoryTrail,
  isParamsCollapsed,
  onToggleParamsCollapse,
}) => {
  const progressPercent = totalDurationS > 0 ? (currentTimeS / totalDurationS) * 100 : 0;
  const periapsisPercent =
    totalDurationS > 0 && periapsisTimeS !== undefined ? (periapsisTimeS / totalDurationS) * 100 : null;
  const collisionPercent =
    totalDurationS > 0 && collisionTimeS !== undefined ? (collisionTimeS / totalDurationS) * 100 : null;

  const handleStepBack = () => {
    if (onStepBack) {
      onStepBack();
    } else {
      onSeek(Math.max(0, currentStepIndex - 1));
    }
  };

  return (
    <div className="w-full bg-[#0c0e16] border border-[#1f2538] p-3 rounded-xs flex flex-col gap-3 text-white font-mono shadow-md select-none">
      {/* Top Bar: Playback Controls + Speed + Reference Frame Mode + Camera + Param Panel Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1b2132] pb-2.5">
        {/* Left: Playback & Step Controls */}
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause Simulation' : 'Resume Simulation'}
            className={`px-3 py-1.5 rounded-xs flex items-center gap-1.5 text-xs font-bold transition-all shadow-sm ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-black'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
          </button>

          {/* Step Backward */}
          <button
            onClick={handleStepBack}
            title="Step Backward One Numerical Step"
            className="p-1.5 bg-[#141824] hover:bg-[#20273a] text-neutral-300 hover:text-white rounded-xs border border-[#27324d] transition-colors"
          >
            <SkipBack size={14} />
          </button>

          {/* Step Forward */}
          <button
            onClick={onStep}
            title="Step Forward One Numerical Step"
            className="p-1.5 bg-[#141824] hover:bg-[#20273a] text-neutral-300 hover:text-white rounded-xs border border-[#27324d] transition-colors"
          >
            <SkipForward size={14} />
          </button>

          {/* Reset */}
          <button
            onClick={onReset}
            title="Reset Simulation to T=0"
            className="p-1.5 bg-[#141824] hover:bg-[#20273a] text-neutral-300 hover:text-white rounded-xs border border-[#27324d] transition-colors"
          >
            <RotateCcw size={14} />
          </button>

          {/* Playback Speed Selector */}
          <div className="flex items-center gap-1 bg-[#090b12] p-0.5 rounded-xs border border-[#1e2538] text-[10px]">
            {PLAYBACK_SPEEDS.map((spd) => (
              <button
                key={spd}
                onClick={() => onChangePlaybackSpeed(spd)}
                className={`px-1.5 py-0.5 rounded-xs transition-colors ${
                  playbackSpeed === spd
                    ? 'bg-sky-500 text-black font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Center: Reference Frame Mode Selector */}
        <div className="flex items-center gap-1 bg-[#090b12] p-1 rounded-xs border border-[#1e2538] text-[11px]">
          <span className="text-[10px] text-neutral-400 px-1.5 flex items-center gap-1">
            <Compass size={12} className="text-amber-400" /> FRAME:
          </span>
          <button
            onClick={() => onChangeViewFrameMode('PLANET_CENTRIC')}
            className={`px-2.5 py-1 rounded-xs font-bold transition-colors ${
              viewFrameMode === 'PLANET_CENTRIC'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            PLANET-RELATIVE
          </button>
          <button
            onClick={() => onChangeViewFrameMode('HELIOCENTRIC')}
            className={`px-2.5 py-1 rounded-xs font-bold transition-colors ${
              viewFrameMode === 'HELIOCENTRIC'
                ? 'bg-sky-500 text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            SUN-RELATIVE
          </button>
          <button
            onClick={() => onChangeViewFrameMode('SIDE_BY_SIDE')}
            className={`px-2.5 py-1 rounded-xs font-bold transition-colors flex items-center gap-1 ${
              viewFrameMode === 'SIDE_BY_SIDE'
                ? 'bg-emerald-500 text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span>◫</span> SIDE-BY-SIDE
          </button>
        </div>

        {/* Right: Camera Mode & Parameter Panel Toggle */}
        <div className="flex items-center gap-2">
          {/* Camera Preset Selector */}
          <div className="flex items-center gap-1 bg-[#090b12] p-0.5 rounded-xs border border-[#1e2538] text-[10px]">
            <span className="text-[9px] text-neutral-400 px-1">CAM:</span>
            <button
              onClick={() => onChangeCameraMode('OVERVIEW')}
              className={`px-2 py-0.5 rounded-xs transition-colors ${
                cameraMode === 'OVERVIEW'
                  ? 'bg-neutral-200 text-black font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              OVERVIEW
            </button>
            <button
              onClick={() => onChangeCameraMode('CLOSE_UP')}
              className={`px-2 py-0.5 rounded-xs transition-colors ${
                cameraMode === 'CLOSE_UP'
                  ? 'bg-neutral-200 text-black font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              CLOSE-UP
            </button>
            <button
              onClick={() => onChangeCameraMode('PROBE_FOLLOW')}
              className={`px-2 py-0.5 rounded-xs transition-colors ${
                cameraMode === 'PROBE_FOLLOW'
                  ? 'bg-sky-500 text-black font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              FOLLOW
            </button>
          </div>

          {/* Toggle Vectors */}
          <button
            onClick={onToggleVectors}
            title="Toggle Velocity & Acceleration Vectors"
            className={`px-2 py-1 text-[10px] rounded-xs border transition-colors ${
              showVectors
                ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                : 'bg-[#141824] border-[#27324d] text-neutral-400 hover:text-white'
            }`}
          >
            VECTORS
          </button>

          {/* Toggle Trajectory Trail */}
          <button
            onClick={onToggleTrajectoryTrail}
            title="Toggle Trajectory Trail Lines"
            className={`px-2 py-1 text-[10px] rounded-xs border transition-colors ${
              showTrajectoryTrail
                ? 'bg-sky-950/80 border-sky-600 text-sky-300'
                : 'bg-[#141824] border-[#27324d] text-neutral-400 hover:text-white'
            }`}
          >
            TRAILS
          </button>

          {/* Collapsible Parameter Panel Toggle */}
          <button
            onClick={onToggleParamsCollapse}
            title="Toggle Parameter Panel"
            className="px-2.5 py-1 bg-[#161c2b] hover:bg-[#20273a] text-neutral-200 border border-[#27334f] rounded-xs text-[10px] font-bold flex items-center gap-1 transition-colors"
          >
            <Sliders size={12} className="text-amber-400" />
            <span>PARAMETERS</span>
            {isParamsCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
        </div>
      </div>

      {/* Bottom Bar: Timeline Scrubber with Event Milestones */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] text-neutral-300">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold">
              T + {currentTimeS.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s
            </span>
            <span className="text-neutral-500">/</span>
            <span className="text-neutral-400">
              {totalDurationS.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s
            </span>
            {collisionDetected && (
              <span className="text-rose-400 font-bold bg-rose-950/80 px-1.5 py-0.2 rounded-xs border border-rose-700 text-[10px]">
                IMPACT AT T + {collisionTimeS?.toFixed(1)}s
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[10px] text-neutral-400">
            {periapsisTimeS !== undefined && (
              <span className="text-emerald-400">
                PERIAPSIS: T + {periapsisTimeS.toFixed(1)}s
              </span>
            )}
            <span>STEP: {currentStepIndex + 1} / {totalSteps}</span>
          </div>
        </div>

        {/* Timeline Slider with Interactive Scrubbing & Event Markers */}
        <div className="relative w-full flex items-center">
          <input
            type="range"
            min={0}
            max={Math.max(1, totalSteps - 1)}
            value={currentStepIndex}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="w-full h-2 bg-[#171b28] rounded-xs appearance-none cursor-pointer accent-sky-400"
          />

          {/* Periapsis Milestone Tick */}
          {periapsisPercent !== null && periapsisPercent >= 0 && periapsisPercent <= 100 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3 bg-emerald-400 rounded-full pointer-events-none opacity-80"
              style={{ left: `${periapsisPercent}%` }}
              title={`Closest Approach (T + ${periapsisTimeS?.toFixed(1)}s)`}
            />
          )}

          {/* Collision Milestone Tick */}
          {collisionPercent !== null && collisionPercent >= 0 && collisionPercent <= 100 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-3.5 bg-rose-500 rounded-full pointer-events-none animate-pulse"
              style={{ left: `${collisionPercent}%` }}
              title={`Collision Impact (T + ${collisionTimeS?.toFixed(1)}s)`}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default FlybySimulationToolbar;