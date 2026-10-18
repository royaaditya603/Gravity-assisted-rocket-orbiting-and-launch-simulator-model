import React, { useState } from 'react';
import { SimulationManager, DEFAULT_SIM_PARAMS } from '../../../simulation/SimulationManager';
import { Play, Pause, RotateCcw, FastForward, Camera, Sliders, ChevronDown, ChevronUp } from 'lucide-react';

interface ControlDeckProps {
  sim: SimulationManager;
  cameraMode: 'CHASE' | 'ORBIT' | 'PAD';
  setCameraMode: (mode: 'CHASE' | 'ORBIT' | 'PAD') => void;
  onStateChange: () => void;
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  sim,
  cameraMode,
  setCameraMode,
  onStateChange,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [throttle, setThrottle] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(sim.params.pitchAngleDeg);
  const [burnDuration, setBurnDuration] = useState<number>(sim.params.burnDurationS);
  const [cutoffSpeed, setCutoffSpeed] = useState<number>(sim.params.targetCutoffSpeedMPerS);
  const [thrustKN, setThrustKN] = useState<number>(sim.params.thrustVacuumN / 1000.0);
  const [fuelTonnes, setFuelTonnes] = useState<number>(sim.params.propellantMassKg / 1000.0);

  const handlePlayToggle = () => {
    if (sim.isRunning) {
      sim.pause();
    } else {
      sim.startLaunch();
    }
    onStateChange();
  };

  const handleReset = () => {
    sim.reset();
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

  return (
    <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none flex flex-col items-center">
      <div className="w-full max-w-4xl bg-[#0e1017]/90 backdrop-blur-md border border-[#232733] p-3 rounded-sm pointer-events-auto shadow-2xl flex flex-col gap-3">
        {/* Top Control Bar: Playback, Presets, Warp, Camera */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#232733] pb-2 text-xs">
          {/* Main Launch / Pause Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs font-mono font-bold uppercase tracking-wider transition-colors ${
                sim.isRunning
                  ? 'bg-amber-500 hover:bg-amber-600 text-black'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-black'
              }`}
            >
              {sim.isRunning ? <Pause size={14} /> : <Play size={14} />}
              <span>{sim.flightPhase === 'ON_PAD' ? 'LAUNCH' : sim.isRunning ? 'PAUSE' : 'RESUME'}</span>
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xs font-mono text-neutral-300 bg-neutral-800 hover:bg-neutral-700 transition-colors"
              title="Reset Simulation"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">RESET</span>
            </button>

            {sim.flightPhase === 'POWERED_ASCENT' && (
              <button
                onClick={() => {
                  sim.manualCutoff();
                  onStateChange();
                }}
                className="px-2.5 py-1.5 rounded-xs font-mono text-rose-300 bg-rose-950/60 border border-rose-800/80 hover:bg-rose-900 transition-colors text-[11px]"
              >
                MECO CUTOFF
              </button>
            )}
          </div>

          {/* Mission Presets (Renamed Suborbital Ballistic Trajectory per review!) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest hidden md:inline">
              PRESET:
            </span>
            <button
              onClick={() => handlePreset('LEO_400KM')}
              className="px-2 py-1 text-[11px] font-mono rounded-xs bg-[#191d28] hover:bg-[#252b3d] text-sky-400 border border-sky-800/40 transition-colors"
            >
              400KM LEO
            </button>
            <button
              onClick={() => handlePreset('SUBORBITAL_BALLISTIC')}
              className="px-2 py-1 text-[11px] font-mono rounded-xs bg-[#191d28] hover:bg-[#252b3d] text-amber-400 border border-amber-800/40 transition-colors"
            >
              SUBORBITAL
            </button>
            <button
              onClick={() => handlePreset('EARTH_ESCAPE')}
              className="px-2 py-1 text-[11px] font-mono rounded-xs bg-[#191d28] hover:bg-[#252b3d] text-purple-400 border border-purple-800/40 transition-colors"
            >
              ESCAPE
            </button>
          </div>

          {/* Time Warp Selector */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-neutral-500 uppercase hidden sm:inline mr-1">
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

          {/* Camera View Mode */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-neutral-500 uppercase hidden sm:inline mr-1">
              CAM:
            </span>
            {(['CHASE', 'ORBIT', 'PAD'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setCameraMode(mode)}
                className={`px-2 py-1 text-[11px] font-mono rounded-xs transition-colors ${
                  cameraMode === mode
                    ? 'bg-neutral-200 text-black font-bold'
                    : 'bg-neutral-800/60 text-neutral-400 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Expand/Collapse Parameter Sliders */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-[11px] font-mono text-neutral-400 hover:text-white transition-colors"
          >
            <Sliders size={13} />
            <span>PARAMS</span>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>

        {/* Collapsible Parameter Deck */}
        {isExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1 pb-1 text-xs">
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
