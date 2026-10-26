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
      <div className="w-full max-w-5xl bg-white/95 backdrop-blur-md border border-[#DCE3EE] p-3 rounded-xl pointer-events-auto shadow-lg flex flex-col gap-2.5 text-[#263247]">
        
        {/* ROW 1: Mode Switcher, Primary Controls, Camera Selection, Vectors */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#DCE3EE] pb-2 text-xs font-mono">
          
          {/* Live vs Replay Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-[#EEF2F8] p-0.5 rounded-lg border border-[#DCE3EE]">
            <button
              onClick={() => {
                if (sim.isReplayMode) sim.setReplayMode(false);
                onStateChange();
              }}
              className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                !sim.isReplayMode
                  ? 'bg-[#AEE5D0] text-[#1D6C50] shadow-xs'
                  : 'text-[#68758A] hover:text-[#263247]'
              }`}
            >
              LIVE ASCENT
            </button>
            <button
              onClick={() => {
                if (!sim.isReplayMode) sim.setReplayMode(true);
                onStateChange();
              }}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition-colors ${
                sim.isReplayMode
                  ? 'bg-[#FFD2B8] text-[#7A3E1D] shadow-xs'
                  : 'text-[#68758A] hover:text-[#263247]'
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider transition-colors shadow-xs ${
                sim.isReplayMode
                  ? sim.isReplayPlaying
                    ? 'bg-[#FFD2B8] hover:bg-[#F5BCA0] text-[#7A3E1D] border border-[#F5BCA0]'
                    : 'bg-[#AEE5D0] hover:bg-[#95D9BF] text-[#1D6C50] border border-[#95D9BF]'
                  : sim.isRunning
                  ? 'bg-[#FFD2B8] hover:bg-[#F5BCA0] text-[#7A3E1D] border border-[#F5BCA0]'
                  : 'bg-[#AEE5D0] hover:bg-[#95D9BF] text-[#1D6C50] border border-[#95D9BF]'
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
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[#263247] bg-[#EEF2F8] hover:bg-white border border-[#DCE3EE] transition-colors"
              title={sim.isReplayMode ? 'Rewind to T=0' : 'Reset Simulation'}
            >
              <RotateCcw size={12} />
              <span className="hidden sm:inline">{sim.isReplayMode ? 'REWIND' : 'RESET'}</span>
            </button>

            {sim.isReplayMode && (
              <>
                <button
                  onClick={() => handleStep(-0.5)}
                  className="px-2 py-1.5 rounded-lg text-[#263247] bg-[#EEF2F8] hover:bg-white border border-[#DCE3EE]"
                  title="Step Backward 0.5s"
                >
                  <SkipBack size={12} />
                </button>
                <button
                  onClick={() => handleStep(0.5)}
                  className="px-2 py-1.5 rounded-lg text-[#263247] bg-[#EEF2F8] hover:bg-white border border-[#DCE3EE]"
                  title="Step Forward 0.5s"
                >
                  <SkipForward size={12} />
                </button>
              </>
            )}
          </div>

          {/* Camera View Mode */}
          <div className="flex items-center gap-1 bg-[#EEF2F8] p-0.5 rounded-lg border border-[#DCE3EE]">
            <span className="text-[10px] text-[#68758A] uppercase px-1.5 font-bold hidden md:inline">
              CAM:
            </span>
            {cameraOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setCameraMode(opt.id)}
                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${
                  cameraMode === opt.id
                    ? 'bg-white text-[#14426B] shadow-xs border border-[#DCE3EE]'
                    : 'text-[#68758A] hover:text-[#263247]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Vectors Toggle */}
          <button
            onClick={onToggleVectors}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-lg border transition-colors ${
              showVectors
                ? 'bg-[#A9D4F5] border-[#89C2EE] text-[#14426B] font-bold'
                : 'bg-[#EEF2F8] border-[#DCE3EE] text-[#68758A] hover:text-[#263247]'
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[#14426B] bg-[#A9D4F5] hover:bg-[#89C2EE] border border-[#89C2EE] shadow-xs transition-colors"
            >
              <span>INTERPLANETARY CRUISE</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>

        {/* ROW 2: Replay Timeline Scrubber & Speed / Rate Controls */}
        {sim.isReplayMode ? (
          <div className="flex flex-col gap-2 bg-[#F8FAFD] p-2 rounded-lg border border-[#DCE3EE]">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-[#7A3E1D] font-bold">REPLAY SCRUBBER</span>
                <span className="text-[#263247] font-mono font-bold bg-white px-2 py-0.5 rounded-md border border-[#DCE3EE] text-[11px]">
                  T+{currentTime.toFixed(1)}s / {maxDuration.toFixed(1)}s
                </span>
                {activeMilestone && (
                  <span className="flex items-center gap-1 text-[10px] text-[#7A3E1D] bg-[#FFD2B8] border border-[#F5BCA0] px-2 py-0.5 rounded-md animate-pulse">
                    <Flag size={10} />
                    <span>{activeMilestone.name}</span>
                  </span>
                )}
              </div>

              {/* Slow-Motion Replay Rates */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[#68758A] uppercase mr-1">RATE:</span>
                {REPLAY_RATES.map((rate) => (
                  <button
                    key={rate}
                    onClick={() => {
                      sim.setReplaySpeed(rate);
                      onStateChange();
                    }}
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded-md transition-colors ${
                      sim.replaySpeed === rate
                        ? 'bg-[#FFD2B8] text-[#7A3E1D] font-bold border border-[#F5BCA0]'
                        : 'bg-white text-[#68758A] hover:text-[#263247] border border-[#DCE3EE]'
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
              className="w-full accent-[#14426B] bg-[#EEF2F8] h-2 rounded-lg cursor-pointer"
            />

            {/* Milestone Jump Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono">
              <span className="text-[#68758A] uppercase mr-1">MILESTONES:</span>
              <button
                onClick={() => handleMilestoneJump('IGNITION')}
                className="px-2 py-0.5 rounded-md bg-white hover:bg-[#EEF2F8] text-[#263247] border border-[#DCE3EE]"
              >
                LIFTOFF (T+0s)
              </button>
              <button
                onClick={() => handleMilestoneJump('PITCHOVER')}
                className="px-2 py-0.5 rounded-md bg-white hover:bg-[#EEF2F8] text-[#263247] border border-[#DCE3EE]"
              >
                PITCHOVER
              </button>
              <button
                onClick={() => handleMilestoneJump('MAX_Q')}
                className="px-2 py-0.5 rounded-md bg-white hover:bg-[#EEF2F8] text-[#7A3E1D] border border-[#DCE3EE]"
              >
                MAX-Q
              </button>
              <button
                onClick={() => handleMilestoneJump('MECO_STAGING')}
                className="px-2 py-0.5 rounded-md bg-white hover:bg-[#EEF2F8] text-[#83263E] border border-[#DCE3EE]"
              >
                MECO / STAGING
              </button>
              <button
                onClick={() => handleMilestoneJump('FAIRING_JETTISON')}
                className="px-2 py-0.5 rounded-md bg-white hover:bg-[#EEF2F8] text-[#14426B] border border-[#DCE3EE]"
              >
                FAIRING SEP
              </button>
              <button
                onClick={() => handleMilestoneJump('ORBITAL_INSERTION')}
                className="px-2 py-0.5 rounded-md bg-white hover:bg-[#EEF2F8] text-[#1D6C50] border border-[#DCE3EE]"
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
              <span className="text-[10px] text-[#68758A] uppercase tracking-widest hidden md:inline">
                PRESET:
              </span>
              <button
                onClick={() => handlePreset('LEO_400KM')}
                className="px-2 py-1 text-[11px] font-mono rounded-lg bg-[#A9D4F5]/30 hover:bg-[#A9D4F5]/60 text-[#14426B] border border-[#A9D4F5] transition-colors"
              >
                400KM LEO
              </button>
              <button
                onClick={() => handlePreset('SUBORBITAL_BALLISTIC')}
                className="px-2 py-1 text-[11px] font-mono rounded-lg bg-[#FFD2B8]/30 hover:bg-[#FFD2B8]/60 text-[#7A3E1D] border border-[#FFD2B8] transition-colors"
              >
                SUBORBITAL
              </button>
              <button
                onClick={() => handlePreset('EARTH_ESCAPE')}
                className="px-2 py-1 text-[11px] font-mono rounded-lg bg-[#C9BDF2]/30 hover:bg-[#C9BDF2]/60 text-[#4A347F] border border-[#C9BDF2] transition-colors"
              >
                ESCAPE
              </button>
            </div>

            {/* Time Warp Selector */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#68758A] uppercase hidden sm:inline mr-1">
                WARP:
              </span>
              {[1, 5, 20, 100].map((warp) => (
                <button
                  key={warp}
                  onClick={() => handleTimeWarp(warp)}
                  className={`px-2 py-1 text-[11px] font-mono rounded-md transition-colors ${
                    sim.timeWarp === warp
                      ? 'bg-white text-[#14426B] font-bold shadow-xs border border-[#DCE3EE]'
                      : 'bg-[#EEF2F8] text-[#68758A] hover:text-[#263247]'
                  }`}
                >
                  {warp}x
                </button>
              ))}
            </div>

            {/* Expand/Collapse Parameter Sliders */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-[11px] font-mono text-[#68758A] hover:text-[#263247] transition-colors"
            >
              <Sliders size={13} />
              <span>VEHICLE PARAMS</span>
              {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        )}

        {/* Collapsible Parameter Deck */}
        {isExpanded && !sim.isReplayMode && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-[#DCE3EE] text-xs">
            {/* Throttle */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[#68758A] font-mono text-[11px]">
                <span>THROTTLE</span>
                <span className="text-[#263247] font-bold">{(throttle * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={throttle}
                onChange={(e) => handleThrottleChange(parseFloat(e.target.value))}
                className="w-full accent-[#14426B] bg-[#EEF2F8] h-1.5 rounded-md cursor-pointer"
              />
            </div>

            {/* Gravity Turn Pitch */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[#68758A] font-mono text-[11px]">
                <span>PITCH PROGRAM START</span>
                <span className="text-[#263247] font-bold">{pitch.toFixed(0)}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="45"
                step="1"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="w-full accent-[#14426B] bg-[#EEF2F8] h-1.5 rounded-md cursor-pointer"
              />
            </div>

            {/* Burn Duration */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[#68758A] font-mono text-[11px]">
                <span>BURN DURATION</span>
                <span className="text-[#263247] font-bold">{burnDuration.toFixed(0)} s</span>
              </div>
              <input
                type="range"
                min="30"
                max="300"
                step="5"
                value={burnDuration}
                onChange={(e) => setBurnDuration(parseFloat(e.target.value))}
                className="w-full accent-[#14426B] bg-[#EEF2F8] h-1.5 rounded-md cursor-pointer"
              />
            </div>

            {/* Cutoff Velocity Target */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[#68758A] font-mono text-[11px]">
                <span>TARGET CUTOFF SPEED</span>
                <span className="text-[#263247] font-bold">
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
                className="w-full accent-[#14426B] bg-[#EEF2F8] h-1.5 rounded-md cursor-pointer"
              />
            </div>

            {/* Engine Thrust */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[#68758A] font-mono text-[11px]">
                <span>VACUUM THRUST</span>
                <span className="text-[#263247] font-bold">{thrustKN.toFixed(0)} kN</span>
              </div>
              <input
                type="range"
                min="3000"
                max="12000"
                step="200"
                value={thrustKN}
                onChange={(e) => setThrustKN(parseFloat(e.target.value))}
                className="w-full accent-[#14426B] bg-[#EEF2F8] h-1.5 rounded-md cursor-pointer"
              />
            </div>

            {/* Propellant Load */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[#68758A] font-mono text-[11px]">
                <span>PROPELLANT LOAD</span>
                <span className="text-[#263247] font-bold">{fuelTonnes.toFixed(0)} tonnes</span>
              </div>
              <input
                type="range"
                min="100"
                max="500"
                step="10"
                value={fuelTonnes}
                onChange={(e) => setFuelTonnes(parseFloat(e.target.value))}
                className="w-full accent-[#14426B] bg-[#EEF2F8] h-1.5 rounded-md cursor-pointer"
              />
            </div>

            <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex justify-end pt-1">
              <button
                onClick={handleParamCommit}
                className="px-3 py-1.5 bg-[#AEE5D0] hover:bg-[#95D9BF] text-[#1D6C50] font-mono font-bold text-xs rounded-lg border border-[#95D9BF] transition-colors"
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
