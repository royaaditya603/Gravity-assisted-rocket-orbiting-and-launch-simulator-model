import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Compass,
  Sliders,
  ChevronDown,
  ChevronUp,
  Orbit,
  Box,
} from 'lucide-react';
import { FlybyCameraMode } from '../viewport/Flyby3DCanvas';

export type ViewFrameMode = 'PLANET_CENTRIC' | 'HELIOCENTRIC' | 'SIDE_BY_SIDE';

export interface FlybySimulationToolbarProps {
  // Viewport 2D Default vs 3D Optional Mode
  viewportMode?: '2D' | '3D';
  onChangeViewportMode?: (mode: '2D' | '3D') => void;

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
  viewportMode = '2D',
  onChangeViewportMode,
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
  showVectors,
  onToggleVectors,
  showTrajectoryTrail,
  onToggleTrajectoryTrail,
  isParamsCollapsed,
  onToggleParamsCollapse,
}) => {
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
    <div className="w-full bg-white border border-[#DCE3EE] p-3.5 rounded-xl flex flex-col gap-3 text-[#263247] font-mono shadow-xs select-none">
      {/* Top Bar: Playback Controls + Speed + Reference Frame Mode + Camera + Param Panel Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EE] pb-2.5">
        {/* Left: Playback & Step Controls */}
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause Simulation' : 'Resume Simulation'}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isPlaying
                ? 'bg-[#FFD2B8] hover:bg-[#ffc5a3] text-[#7A3E1D] border border-[#FFD2B8]'
                : 'bg-[#AEE5D0] hover:bg-[#97dbc1] text-[#1D6C50] border border-[#AEE5D0]'
            }`}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
          </button>

          {/* Step Backward */}
          <button
            onClick={handleStepBack}
            title="Step Backward One Numerical Step"
            className="p-1.5 bg-[#EEF2F8] hover:bg-[#E2E8F0] text-[#263247] rounded-lg border border-[#DCE3EE] transition-colors cursor-pointer"
          >
            <SkipBack size={14} />
          </button>

          {/* Step Forward */}
          <button
            onClick={onStep}
            title="Step Forward One Numerical Step"
            className="p-1.5 bg-[#EEF2F8] hover:bg-[#E2E8F0] text-[#263247] rounded-lg border border-[#DCE3EE] transition-colors cursor-pointer"
          >
            <SkipForward size={14} />
          </button>

          {/* Reset */}
          <button
            onClick={onReset}
            title="Reset Simulation to T=0"
            className="p-1.5 bg-[#EEF2F8] hover:bg-[#E2E8F0] text-[#263247] rounded-lg border border-[#DCE3EE] transition-colors cursor-pointer"
          >
            <RotateCcw size={14} />
          </button>

          {/* Playback Speed Selector */}
          <div className="flex items-center gap-0.5 bg-[#EEF2F8] p-0.5 rounded-lg border border-[#DCE3EE] text-[10px]">
            {PLAYBACK_SPEEDS.map((spd) => (
              <button
                key={spd}
                onClick={() => onChangePlaybackSpeed(spd)}
                className={`px-1.5 py-0.5 rounded-md transition-colors cursor-pointer ${
                  playbackSpeed === spd
                    ? 'bg-[#A9D4F5] text-[#14426B] font-bold shadow-2xs'
                    : 'text-[#68758A] hover:text-[#263247]'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Center: Reference Frame Mode Selector */}
        <div className="flex items-center gap-1 bg-[#EEF2F8] p-1 rounded-lg border border-[#DCE3EE] text-[11px]">
          <span className="text-[10px] text-[#68758A] px-1.5 flex items-center gap-1">
            <Compass size={12} className="text-[#B45309]" /> FRAME:
          </span>
          <button
            onClick={() => onChangeViewFrameMode('PLANET_CENTRIC')}
            className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
              viewFrameMode === 'PLANET_CENTRIC'
                ? 'bg-[#FFD2B8] text-[#7A3E1D] shadow-2xs'
                : 'text-[#68758A] hover:text-[#263247]'
            }`}
          >
            PLANET-RELATIVE
          </button>
          <button
            onClick={() => onChangeViewFrameMode('HELIOCENTRIC')}
            className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
              viewFrameMode === 'HELIOCENTRIC'
                ? 'bg-[#A9D4F5] text-[#14426B] shadow-2xs'
                : 'text-[#68758A] hover:text-[#263247]'
            }`}
          >
            SUN-RELATIVE
          </button>
          <button
            onClick={() => onChangeViewFrameMode('SIDE_BY_SIDE')}
            className={`px-2.5 py-1 rounded-md font-bold transition-colors flex items-center gap-1 cursor-pointer ${
              viewFrameMode === 'SIDE_BY_SIDE'
                ? 'bg-[#AEE5D0] text-[#1D6C50] shadow-2xs'
                : 'text-[#68758A] hover:text-[#263247]'
            }`}
          >
            <span>◫</span> SIDE-BY-SIDE
          </button>
        </div>

        {/* 2D Default vs 3D Optional Mode Selector */}
        {onChangeViewportMode && (
          <div className="flex items-center gap-1 bg-[#EEF2F8] p-1 rounded-lg border border-[#DCE3EE] text-[11px]">
            <button
              onClick={() => onChangeViewportMode('2D')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewportMode === '2D'
                  ? 'bg-[#AEE5D0] text-[#1D6C50] shadow-2xs'
                  : 'text-[#68758A] hover:text-[#263247]'
              }`}
              title="Primary lightweight 2D orbital visualization"
            >
              <Orbit size={13} className="text-[#1D6C50]" />
              <span>2D — DEFAULT</span>
            </button>
            <button
              onClick={() => onChangeViewportMode('3D')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewportMode === '3D'
                  ? 'bg-[#C9BDF2] text-[#4A347F] shadow-2xs'
                  : 'text-[#68758A] hover:text-[#263247]'
              }`}
              title="Optional Three.js 3D perspective"
            >
              <Box size={13} className="text-[#8B5CF6]" />
              <span>3D — OPTIONAL</span>
            </button>
          </div>
        )}

        {/* Right: Camera Mode & Parameter Panel Toggle */}
        <div className="flex items-center gap-2">
          {/* Camera Preset Selector */}
          <div className="flex items-center gap-0.5 bg-[#EEF2F8] p-0.5 rounded-lg border border-[#DCE3EE] text-[10px]">
            <span className="text-[9px] text-[#68758A] px-1">CAM:</span>
            <button
              onClick={() => onChangeCameraMode('OVERVIEW')}
              className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                cameraMode === 'OVERVIEW'
                  ? 'bg-white text-[#263247] font-bold shadow-2xs'
                  : 'text-[#68758A] hover:text-[#263247]'
              }`}
            >
              OVERVIEW
            </button>
            <button
              onClick={() => onChangeCameraMode('CLOSE_UP')}
              className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                cameraMode === 'CLOSE_UP'
                  ? 'bg-white text-[#263247] font-bold shadow-2xs'
                  : 'text-[#68758A] hover:text-[#263247]'
              }`}
            >
              CLOSE-UP
            </button>
            <button
              onClick={() => onChangeCameraMode('PROBE_FOLLOW')}
              className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                cameraMode === 'PROBE_FOLLOW'
                  ? 'bg-[#C9BDF2] text-[#4A347F] font-bold shadow-2xs'
                  : 'text-[#68758A] hover:text-[#263247]'
              }`}
            >
              FOLLOW
            </button>
          </div>

          {/* Toggle Vectors */}
          <button
            onClick={onToggleVectors}
            title="Toggle Velocity & Acceleration Vectors"
            className={`px-2.5 py-1 text-[10px] rounded-lg border transition-colors cursor-pointer font-medium ${
              showVectors
                ? 'bg-[#AEE5D0]/35 border-[#AEE5D0] text-[#1D6C50]'
                : 'bg-[#EEF2F8] border-[#DCE3EE] text-[#68758A] hover:text-[#263247]'
            }`}
          >
            VECTORS
          </button>

          {/* Toggle Trajectory Trail */}
          <button
            onClick={onToggleTrajectoryTrail}
            title="Toggle Trajectory Trail Lines"
            className={`px-2.5 py-1 text-[10px] rounded-lg border transition-colors cursor-pointer font-medium ${
              showTrajectoryTrail
                ? 'bg-[#A9D4F5]/35 border-[#A9D4F5] text-[#14426B]'
                : 'bg-[#EEF2F8] border-[#DCE3EE] text-[#68758A] hover:text-[#263247]'
            }`}
          >
            TRAILS
          </button>

          {/* Collapsible Parameter Panel Toggle */}
          <button
            onClick={onToggleParamsCollapse}
            title="Toggle Parameter Panel"
            className="px-2.5 py-1 bg-[#EEF2F8] hover:bg-[#E2E8F0] text-[#263247] border border-[#DCE3EE] rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Sliders size={12} className="text-[#B45309]" />
            <span>PARAMETERS</span>
            {isParamsCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
        </div>
      </div>

      {/* Bottom Bar: Timeline Scrubber with Event Milestones */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] text-[#263247]">
          <div className="flex items-center gap-2">
            <span className="text-[#B45309] font-bold">
              T + {currentTimeS.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s
            </span>
            <span className="text-[#94A3B8]">/</span>
            <span className="text-[#68758A]">
              {totalDurationS.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s
            </span>
            {collisionDetected && (
              <span className="text-[#991B1B] font-bold bg-[#FEE2E2] px-2 py-0.5 rounded-md border border-[#FCA5A5] text-[10px]">
                IMPACT AT T + {collisionTimeS?.toFixed(1)}s
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[10px] text-[#68758A]">
            {periapsisTimeS !== undefined && (
              <span className="text-[#059669] font-semibold">
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
            className="w-full h-2 bg-[#EEF2F8] rounded-md appearance-none cursor-pointer accent-[#0284C7]"
          />

          {/* Periapsis Milestone Tick */}
          {periapsisPercent !== null && periapsisPercent >= 0 && periapsisPercent <= 100 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3 bg-[#059669] rounded-full pointer-events-none opacity-85"
              style={{ left: `${periapsisPercent}%` }}
              title={`Closest Approach (T + ${periapsisTimeS?.toFixed(1)}s)`}
            />
          )}

          {/* Collision Milestone Tick */}
          {collisionPercent !== null && collisionPercent >= 0 && collisionPercent <= 100 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-3.5 bg-[#EF4444] rounded-full pointer-events-none animate-pulse"
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
