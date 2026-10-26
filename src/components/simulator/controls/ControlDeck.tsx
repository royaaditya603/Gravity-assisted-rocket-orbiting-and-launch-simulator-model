import React, { useState } from 'react';
import { SimulationManager } from '../../../simulation/SimulationManager';
import { CameraMode } from '../viewport/SimulationCanvas';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Rewind,
  Sliders,
  ChevronDown,
  ChevronUp,
  Film,
  SkipBack,
  SkipForward,
  ArrowRight,
  Eye,
  Flag,
  Compass,
} from 'lucide-react';

interface ControlDeckProps {
  sim: SimulationManager;
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  showVectors: boolean;
  onToggleVectors: () => void;
  onProceedToInterplanetary?: () => void;
  onStateChange: () => void;
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  sim,
  cameraMode,
  setCameraMode,
  showVectors,
  onToggleVectors,
  onProceedToInterplanetary,
  onStateChange,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [throttle, setThrottle] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(sim.params.pitchAngleDeg);
  const [burnDuration, setBurnDuration] = useState<number>(sim.params.burnDurationS);
  const [cutoffSpeed, setCutoffSpeed] = useState<number>(sim.params.targetCutoffSpeedMPerS);
  const [thrustKN, setThrustKN] = useState<number>(sim.params.thrustVacuumN / 1000.0);
  const [fuelTonnes, setFuelTonnes] = useState<number>(sim.params.propellantMassKg / 1000.0);

  // Replay rates
  const REPLAY_RATES = [0.1, 0.25, 0.5, 1.0, 2.0, 5.0];

  const handlePlayToggle = () => {
    if (sim.isReplayMode) {
      sim.toggleReplayPlay();
    } else {
      if (sim.isRunning) {
        sim.pause();
      } else {
        sim.startLaunch();
      }
    }
    onStateChange();
  };

  const handleReset = () => {
    if (sim.isReplayMode) {
      sim.restartReplay();
    } else {
      sim.reset();
    }
    onStateChange();
  };

  const handleToggleReplayMode = () => {
    sim.setReplayMode(!sim.isReplayMode);
    onStateChange();
  };

  const handleSeek = (timeS: number) => {
    sim.seekReplay(timeS);
    onStateChange();
  };

  const handleStep = (dtS: number) => {
    sim.stepReplay(dtS);
    onStateChange();
  };

  const handleMilestoneJump = (milestoneId: string) => {
    sim.jumpToMilestone(milestoneId);
    onStateChange();
  };

  const handleTimeWarp = (warp: number) => {
    sim.setTimeWarp(warp);
    onStateChange();
  };

  const handlePreset = (preset: 'LEO_400KM' | 'SUBORBITAL_BALLISTIC' | 'EARTH_ESCAPE') => {
    sim.applyPreset(preset);
    setPitch(sim.params.pitchAngleDeg);
    setBurnDuration(sim.params.burnDurationS);
    setCutoffSpeed(sim.params.targetCutoffSpeedMPerS);
    setThrustKN(sim.params.thrustVacuumN / 1000.0);
    setFuelTonnes(sim.params.propellantMassKg / 1000.0);
    onStateChange();
  };

  const handleThrottleChange = (val: number) => {
    setThrottle(val);
    sim.setThrottle(val);
    onStateChange();
  };

  const handleParamCommit = () => {
    sim.reset({
      pitchAngleDeg: pitch,
      burnDurationS: burnDuration,
      targetCutoffSpeedMPerS: cutoffSpeed,
      thrustVacuumN: thrustKN * 1000.0,
      thrustSeaLevelN: thrustKN * 900.0,
      propellantMassKg: fuelTonnes * 1000.0,
    });
    onStateChange();
  };

  const cameraOptions: { id: CameraMode; label: string }[] = [
    { id: 'OVERVIEW', label: 'OVERVIEW' },
    { id: 'ROCKET_FOLLOW', label: 'FOLLOW' },
    { id: 'CHASE', label: 'CHASE' },
    { id: 'PAD', label: 'PAD' },
    { id: 'ORBIT', label: 'ORBIT' },
    { id: 'FREE', label: 'FREE' },
    { id: 'CINEMATIC', label: 'CINEMA' },
  ];

  const currentTime = sim.isReplayMode ? sim.replayTimeS : sim.timeS;
  const maxDuration = Math.max(10.0, sim.totalFlightDurationS);
  const activeMilestone = sim.milestones.find(
    (m) => Math.abs(m.timeS - currentTime) <= 2.5
  );

  return (
    <div className="absolute bottom-3 left-3 right-3 z-20 pointer-events-none flex flex-col items-center">
      <div className="w-full max-w-5xl bg-[#0b0e17]/95 backdrop-blur-md border border-[#232a3d] p-3 rounded-xs pointer-events-auto shadow-2xl flex flex-col gap-2.5">
        
        {/* ROW 1: Mode Switcher, Primary Controls, Camera Selection, Vectors */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#1c2235] pb-2 text-xs font-mono">
          
          {/* Live vs Replay Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-[#121624] p-0.5 rounded-xs border border-[#262f48]">
            <button
              onClick={() => {
                if (sim.isReplayMode) sim.setReplayMode(false);
                onStateChange();
              }}
              className={`px-2.5 py-1 rounded-xs font-bold transition-colors ${
                !sim.isReplayMode
                  ? 'bg-emerald-500 text-black shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              LIVE ASCENT
            </button>
            <button
              onClick={() => {
                if (!sim.isReplayMode) sim.setReplayMode(true);
                onStateChange();
              }}
              className={`px-2.5 py-1 rounded-xs font-bold flex items-center gap-1 transition-colors ${
                sim.isReplayMode
                  ? 'bg-amber-500 text-black shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Film size={12} />
              <span>3D REPLAY</span>
            </button>
          </div>

          {/* Primary Action Button */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePlayToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs font-bold uppercase tracking-wider transition-colors shadow-xs ${
                sim.isReplayMode
                  ? sim.isReplayPlaying
                    ? 'bg-amber-500 hover:bg-amber-600 text-black'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-black'
                  : sim.isRunning
                  ? 'bg-amber-500 hover:bg-amber-600 text-black'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-black'
              }`}
            >
              {sim.isReplayMode ? (
                sim.isReplayPlaying ? <Pause size={13} /> : <Play size={13} />
              ) : sim.isRunning ? (
                <Pause size={13} />
              ) : (
                <Play size={13} />
              )}
              <span>
                {sim.isReplayMode
                  ? sim.isReplayPlaying
                    ? 'PAUSE'
                    : 'REPLAY'
                  : sim.flightPhase === 'ON_PAD'
                  ? 'LIFTOFF'
                  : sim.isRunning
                  ? 'PAUSE'
                  : 'RESUME'}
              </span>
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xs text-neutral-300 bg-[#161a29] hover:bg-[#20273d] border border-[#28324f] transition-colors"
              title={sim.isReplayMode ? 'Rewind to T=0' : 'Reset Simulation'}
            >
              <RotateCcw size={12} />
              <span className="hidden sm:inline">{sim.isReplayMode ? 'REWIND' : 'RESET'}</span>
            </button>

            {sim.isReplayMode && (
              <>
                <button
                  onClick={() => handleStep(-0.5)}
                  className="px-2 py-1.5 rounded-xs text-neutral-300 bg-[#161a29] hover:bg-[#20273d] border border-[#28324f]"
                  title="Step Backward 0.5s"
                >
                  <SkipBack size={12} />
                </button>
                <button
                  onClick={() => handleStep(0.5)}
                  className="px-2 py-1.5 rounded-xs text-neutral-300 bg-[#161a29] hover:bg-[#20273d] border border-[#28324f]"
                  title="Step Forward 0.5s"
                >
                  <SkipForward size={12} />
                </button>
              </>
            )}
          </div>

          {/* Camera View Mode */}
          <div className="flex items-center gap-1 bg-[#121624] p-0.5 rounded-xs border border-[#262f48]">
            <span className="text-[10px] text-neutral-500 uppercase px-1.5 font-bold hidden md:inline">
              CAM:
            </span>
            {cameraOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setCameraMode(opt.id)}
                className={`px-2 py-1 text-[10px] font-bold rounded-xs transition-colors ${
                  cameraMode === opt.id
                    ? 'bg-neutral-200 text-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Vectors Toggle */}
          <button
            onClick={onToggleVectors}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-xs border transition-colors ${
              showVectors
                ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300'
                : 'bg-[#121624] border-[#262f48] text-neutral-400 hover:text-white'
            }`}
            title="Toggle 3D Force Vectors (Velocity, Thrust, Gravity, Drag)"
          >
            <Eye size={12} />
            <span>VECTORS</span>
          </button>

          {/* Proceed to Interplanetary Cruise */}
          {onProceedToInterplanetary && (
            <button
              onClick={onProceedToInterplanetary}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xs font-bold text-black bg-cyan-400 hover:bg-cyan-300 shadow-md transition-colors"
            >
              <span>INTERPLANETARY CRUISE</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>

        {/* ROW 2: Replay Timeline Scrubber & Speed / Rate Controls */}
        {sim.isReplayMode ? (
          <div className="flex flex-col gap-2 bg-[#121624]/60 p-2 rounded-xs border border-[#1e2538]">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-bold">REPLAY SCRUBBER</span>
                <span className="text-white font-mono font-bold bg-[#1e2538] px-2 py-0.5 rounded-xs text-[11px]">
                  T+{currentTime.toFixed(1)}s / {maxDuration.toFixed(1)}s
                </span>
                {activeMilestone && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-950/80 border border-amber-500/50 px-2 py-0.5 rounded-xs animate-pulse">
                    <Flag size={10} />
                    <span>{activeMilestone.name}</span>
                  </span>
                )}
              </div>

              {/* Slow-Motion Replay Rates */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-neutral-500 uppercase mr-1">RATE:</span>
                {REPLAY_RATES.map((rate) => (
                  <button
                    key={rate}
                    onClick={() => {
                      sim.setReplaySpeed(rate);
                      onStateChange();
                    }}
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded-xs transition-colors ${
                      sim.replaySpeed === rate
                        ? 'bg-amber-400 text-black font-bold'
                        : 'bg-[#181d2e] text-neutral-400 hover:text-white'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            {/* Continuous Scrubber Range Slider */}
            <input
              type="range"
              min="0"
              max={maxDuration}
              step="0.05"
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full accent-amber-400 bg-neutral-800 h-2 rounded-xs cursor-pointer"
            />

            {/* Milestone Jump Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono">
              <span className="text-neutral-500 uppercase mr-1">MILESTONES:</span>
              <button
                onClick={() => handleMilestoneJump('IGNITION')}
                className="px-2 py-0.5 rounded-xs bg-[#181d2e] hover:bg-[#252c42] text-neutral-300 border border-[#2b3552]"
              >
                LIFTOFF (T+0s)
              </button>
              <button
                onClick={() => handleMilestoneJump('PITCHOVER')}
                className="px-2 py-0.5 rounded-xs bg-[#181d2e] hover:bg-[#252c42] text-neutral-300 border border-[#2b3552]"
              >
                PITCHOVER
              </button>
              <button
                onClick={() => handleMilestoneJump('MAX_Q')}
                className="px-2 py-0.5 rounded-xs bg-[#181d2e] hover:bg-[#252c42] text-amber-300 border border-amber-800/40"
              >
                MAX-Q
              </button>
              <button
                onClick={() => handleMilestoneJump('MECO_STAGING')}
                className="px-2 py-0.5 rounded-xs bg-[#181d2e] hover:bg-[#252c42] text-rose-300 border border-rose-800/40"
              >
                MECO / STAGING
              </button>
              <button
                onClick={() => handleMilestoneJump('FAIRING_JETTISON')}
                className="px-2 py-0.5 rounded-xs bg-[#181d2e] hover:bg-[#252c42] text-sky-300 border border-sky-800/40"
              >
                FAIRING SEP
              </button>
              <button
                onClick={() => handleMilestoneJump('ORBITAL_INSERTION')}
                className="px-2 py-0.5 rounded-xs bg-[#181d2e] hover:bg-[#252c42] text-emerald-300 border border-emerald-800/40"
              >
                ORBIT INSERTION
              </button>
            </div>
          </div>
        ) : (
          /* Live Flight Sub-Bar: Presets, Warp, Param Expand */
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            {/* Mission Presets */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-neutral-500 uppercase tracking-widest hidden md:inline">
                PRESET:
              </span>
              <button
                onClick={() => handlePreset('LEO_400KM')}
                className="px-2 py-1 text-[11px] font-mono rounded-xs bg-[#161a29] hover:bg-[#252c42] text-sky-400 border border-sky-800/40 transition-colors"
              >
                400KM LEO
              </button>
              <button
                onClick={() => handlePreset('SUBORBITAL_BALLISTIC')}
                className="px-2 py-1 text-[11px] font-mono rounded-xs bg-[#161a29] hover:bg-[#252c42] text-amber-400 border border-amber-800/40 transition-colors"
              >
                SUBORBITAL
              </button>
              <button
                onClick={() => handlePreset('EARTH_ESCAPE')}
                className="px-2 py-1 text-[11px] font-mono rounded-xs bg-[#161a29] hover:bg-[#252c42] text-purple-400 border border-purple-800/40 transition-colors"
              >
                ESCAPE
              </button>
            </div>

            {/* Time Warp Selector */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-neutral-500 uppercase hidden sm:inline mr-1">
                WARP:
              </span>
              {[1, 5, 20, 100].map((warp) => (
                <button
                  key={warp}
                  onClick={() => handleTimeWarp(warp)}
                  className={`px-2 py-1 text-[11px] font-mono rounded-xs transition-colors ${
                    sim.timeWarp === warp
                      ? 'bg-neutral-200 text-black font-bold'
                      : 'bg-neutral-800/60 text-neutral-400 hover:text-white'
                  }`}
                >
                  {warp}x
                </button>
              ))}
            </div>

            {/* Expand/Collapse Parameter Sliders */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-[11px] font-mono text-neutral-400 hover:text-white transition-colors"
            >
              <Sliders size={13} />
              <span>VEHICLE PARAMS</span>
              {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        )}

        {/* Collapsible Parameter Deck */}
        {isExpanded && !sim.isReplayMode && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-[#1e2538] text-xs">
            {/* Throttle */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-neutral-400 font-mono text-[11px]">
                <span>THROTTLE</span>
                <span className="text-white font-bold">{(throttle * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={throttle}
                onChange={(e) => handleThrottleChange(parseFloat(e.target.value))}
                className="w-full accent-amber-500 bg-neutral-800 h-1.5 rounded-sm cursor-pointer"
              />
            </div>

            {/* Gravity Turn Pitch */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-neutral-400 font-mono text-[11px]">
                <span>PITCH PROGRAM START</span>
                <span className="text-white font-bold">{pitch.toFixed(0)}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="45"
                step="1"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="w-full accent-amber-500 bg-neutral-800 h-1.5 rounded-sm cursor-pointer"
              />
            </div>

            {/* Burn Duration */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-neutral-400 font-mono text-[11px]">
                <span>BURN DURATION</span>
                <span className="text-white font-bold">{burnDuration.toFixed(0)} s</span>
              </div>
              <input
                type="range"
                min="30"
                max="300"
                step="5"
                value={burnDuration}
                onChange={(e) => setBurnDuration(parseFloat(e.target.value))}
                className="w-full accent-amber-500 bg-neutral-800 h-1.5 rounded-sm cursor-pointer"
              />
            </div>

            {/* Cutoff Velocity Target */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-neutral-400 font-mono text-[11px]">
                <span>TARGET CUTOFF SPEED</span>
                <span className="text-white font-bold">
                  {cutoffSpeed > 0 ? `${cutoffSpeed.toFixed(0)} m/s` : 'MAX DURATION'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="11500"
                step="100"
                value={cutoffSpeed}
                onChange={(e) => setCutoffSpeed(parseFloat(e.target.value))}
                className="w-full accent-sky-500 bg-neutral-800 h-1.5 rounded-sm cursor-pointer"
              />
            </div>

            {/* Engine Thrust */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-neutral-400 font-mono text-[11px]">
                <span>VACUUM THRUST</span>
                <span className="text-white font-bold">{thrustKN.toFixed(0)} kN</span>
              </div>
              <input
                type="range"
                min="3000"
                max="12000"
                step="200"
                value={thrustKN}
                onChange={(e) => setThrustKN(parseFloat(e.target.value))}
                className="w-full accent-amber-500 bg-neutral-800 h-1.5 rounded-sm cursor-pointer"
              />
            </div>

            {/* Propellant Load */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-neutral-400 font-mono text-[11px]">
                <span>PROPELLANT LOAD</span>
                <span className="text-white font-bold">{fuelTonnes.toFixed(0)} tonnes</span>
              </div>
              <input
                type="range"
                min="100"
                max="500"
                step="10"
                value={fuelTonnes}
                onChange={(e) => setFuelTonnes(parseFloat(e.target.value))}
                className="w-full accent-sky-500 bg-neutral-800 h-1.5 rounded-sm cursor-pointer"
              />
            </div>

            <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex justify-end pt-1">
              <button
                onClick={handleParamCommit}
                className="px-3 py-1 bg-neutral-200 hover:bg-white text-black font-mono font-bold text-xs rounded-xs transition-colors"
              >
                APPLY & RE-INITIALIZE PAD
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
