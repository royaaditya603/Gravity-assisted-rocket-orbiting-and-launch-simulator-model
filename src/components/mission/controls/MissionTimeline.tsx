import React, { useEffect, useRef } from 'react';
import {
  MissionAnalysisResult,
  MissionTrajectorySample,
} from '../../../physics/MissionEngine';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Clock,
  Calendar,
  Zap,
} from 'lucide-react';

interface MissionTimelineProps {
  mission: MissionAnalysisResult;
  currentTimeDays: number;
  onTimeChange: (action: number | ((prev: number) => number)) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackWarp: number;
  onChangePlaybackWarp: (warp: number) => void;
  onReset: () => void;
}

export const MissionTimeline: React.FC<MissionTimelineProps> = ({
  mission,
  currentTimeDays,
  onTimeChange,
  isPlaying,
  onTogglePlay,
  playbackWarp,
  onChangePlaybackWarp,
  onReset,
}) => {
  const maxDays =
    mission.fullTrajectory.length > 0
      ? mission.fullTrajectory[mission.fullTrajectory.length - 1].timeDays
      : 1500;

  // Animation frame loop for smooth playback
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let animId: number;

    const step = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }
      const deltaSec = (timestamp - lastTimeRef.current) / 1000.0;
      lastTimeRef.current = timestamp;

      if (isPlaying) {
        onTimeChange((prev: number) => {
          const next = prev + deltaSec * playbackWarp;
          if (next >= maxDays) {
            return maxDays;
          }
          return next;
        });
      }

      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animId);
      lastTimeRef.current = null;
    };
  }, [isPlaying, playbackWarp, maxDays, onTimeChange]);

  // Current calendar date and active leg
  const currentSample = mission.fullTrajectory.find(
    (s) => Math.abs(s.timeDays - currentTimeDays) < 5
  ) || mission.fullTrajectory[0];

  const currentUTC = currentSample ? currentSample.epochUTC.slice(0, 10) : mission.departureEpochUTC.slice(0, 10);
  const currentJD = currentSample ? currentSample.julianDate.toFixed(1) : '2443376.1';

  // Step controls
  const handleStepForward = () => {
    onTimeChange(Math.min(maxDays, currentTimeDays + 15));
  };

  const handleStepBack = () => {
    onTimeChange(Math.max(0, currentTimeDays - 15));
  };

  return (
    <div className="w-full bg-[#0d0f17] border border-[#222538] p-4 rounded-xs text-white font-mono flex flex-col gap-3">
      {/* Top Row: Mission Clocks & Epoch Telemetry */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2436] pb-3 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-neutral-300">
            <Clock size={15} className="text-cyan-400" />
            <span className="text-neutral-500">MET:</span>
            <span className="text-white font-bold text-sm">
              T+{currentTimeDays.toFixed(1)} <span className="text-neutral-400 text-xs">DAYS</span>
            </span>
            <span className="text-neutral-500">({(currentTimeDays / 365.25).toFixed(2)} YRS)</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-neutral-300">
            <Calendar size={14} className="text-amber-400" />
            <span className="text-neutral-500">EPOCH:</span>
            <span className="text-amber-300 font-bold">{currentUTC}</span>
            <span className="text-neutral-500">(JD {currentJD})</span>
          </div>
        </div>

        {/* Playback Controls & Time Warp Multipliers */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#151926] border border-[#2b334d] rounded-xs p-0.5">
            {[1, 10, 50, 200].map((warp) => (
              <button
                key={warp}
                onClick={() => onChangePlaybackWarp(warp)}
                className={`px-2 py-0.5 text-[10px] rounded-xs transition-colors ${
                  playbackWarp === warp
                    ? 'bg-cyan-500 text-black font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {warp}x
              </button>
            ))}
          </div>

          <button
            onClick={handleStepBack}
            className="p-1.5 rounded-xs bg-[#161a29] text-neutral-400 hover:text-white border border-[#273047]"
            title="Step Back -15 Days"
          >
            <SkipBack size={13} />
          </button>

          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-1 px-3 py-1 rounded-xs border text-xs font-bold transition-colors ${
              isPlaying
                ? 'bg-amber-500 border-amber-400 text-black'
                : 'bg-cyan-500 border-cyan-400 text-black'
            }`}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span>{isPlaying ? 'PAUSE' : 'PROPAGATE'}</span>
          </button>

          <button
            onClick={handleStepForward}
            className="p-1.5 rounded-xs bg-[#161a29] text-neutral-400 hover:text-white border border-[#273047]"
            title="Step Forward +15 Days"
          >
            <SkipForward size={13} />
          </button>

          <button
            onClick={onReset}
            className="p-1.5 rounded-xs bg-[#161a29] text-neutral-400 hover:text-white border border-[#273047]"
            title="Reset to T=0"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* Main Timeline Scrubber Bar with Encounter Pins */}
      <div className="relative w-full pt-4 pb-1">
        {/* Milestone Pin Indicators */}
        <div className="relative w-full h-4 mb-1">
          {/* Departure Pin */}
          <button
            onClick={() => onTimeChange(0)}
            className="absolute top-0 text-[10px] text-sky-400 hover:underline -translate-x-1/2"
            style={{ left: '0%' }}
          >
            ▲ LAUNCH
          </button>

          {/* Encounter Pins */}
          {mission.encounters.map((enc) => {
            const sample = mission.fullTrajectory.find(
              (s) => s.epochUTC.slice(0, 10) === enc.targetEpochUTC.slice(0, 10)
            );
            const encDays = sample ? sample.timeDays : (enc.encounterIndex === 1 ? 688 : 1466);
            const pct = Math.max(0, Math.min(100, (encDays / maxDays) * 100));

            return (
              <button
                key={enc.encounterId}
                onClick={() => onTimeChange(encDays)}
                className="absolute top-0 text-[10px] text-amber-400 hover:text-amber-200 transition-colors -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${pct}%` }}
                title={`Seek to ${enc.planetName} Encounter`}
              >
                <span>▲ {enc.planetName.toUpperCase()}</span>
              </button>
            );
          })}
        </div>

        {/* Range Slider */}
        <input
          type="range"
          min={0}
          max={maxDays}
          step={1}
          value={currentTimeDays}
          onChange={(e) => onTimeChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-[#181d2c] rounded-xs appearance-none cursor-pointer accent-cyan-400"
        />

        {/* Progress Labels */}
        <div className="flex justify-between items-center text-[10px] text-neutral-500 mt-1">
          <span>T+0.0 D</span>
          <span>{((currentTimeDays / maxDays) * 100).toFixed(0)}% MISSION PROGRESS</span>
          <span>T+{maxDays.toFixed(0)} D</span>
        </div>
      </div>
    </div>
  );
};
