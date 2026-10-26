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
    <div className="w-full bg-white border border-[#DCE3EE] p-4 rounded-xl text-[#263247] font-mono flex flex-col gap-3 shadow-xs">
      {/* Top Row: Mission Clocks & Epoch Telemetry */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EE] pb-3 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[#263247]">
            <Clock size={15} className="text-[#0284C7]" />
            <span className="text-[#68758A]">MET:</span>
            <span className="text-[#263247] font-bold text-sm">
              T+{currentTimeDays.toFixed(1)} <span className="text-[#68758A] text-xs">DAYS</span>
            </span>
            <span className="text-[#94A3B8]">({(currentTimeDays / 365.25).toFixed(2)} YRS)</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[#263247]">
            <Calendar size={14} className="text-[#B45309]" />
            <span className="text-[#68758A]">EPOCH:</span>
            <span className="text-[#B45309] font-bold">{currentUTC}</span>
            <span className="text-[#94A3B8]">(JD {currentJD})</span>
          </div>
        </div>

        {/* Playback Controls & Time Warp Multipliers */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#EEF2F8] border border-[#DCE3EE] rounded-lg p-0.5">
            {[1, 10, 50, 200].map((warp) => (
              <button
                key={warp}
                onClick={() => onChangePlaybackWarp(warp)}
                className={`px-2 py-0.5 text-[10px] rounded-md transition-colors cursor-pointer ${
                  playbackWarp === warp
                    ? 'bg-[#A9D4F5] text-[#14426B] font-bold shadow-2xs'
                    : 'text-[#68758A] hover:text-[#263247]'
                }`}
              >
                {warp}x
              </button>
            ))}
          </div>

          <button
            onClick={handleStepBack}
            className="p-1.5 rounded-lg bg-white text-[#263247] hover:bg-[#EEF2F8] border border-[#DCE3EE] shadow-2xs cursor-pointer"
            title="Step Back -15 Days"
          >
            <SkipBack size={13} />
          </button>

          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer shadow-2xs ${
              isPlaying
                ? 'bg-[#FFD2B8] hover:bg-[#ffc5a3] text-[#7A3E1D] border-[#FFD2B8]'
                : 'bg-[#AEE5D0] hover:bg-[#97dbc1] text-[#1D6C50] border-[#AEE5D0]'
            }`}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span>{isPlaying ? 'PAUSE' : 'PROPAGATE'}</span>
          </button>

          <button
            onClick={handleStepForward}
            className="p-1.5 rounded-lg bg-white text-[#263247] hover:bg-[#EEF2F8] border border-[#DCE3EE] shadow-2xs cursor-pointer"
            title="Step Forward +15 Days"
          >
            <SkipForward size={13} />
          </button>

          <button
            onClick={onReset}
            className="p-1.5 rounded-lg bg-white text-[#263247] hover:bg-[#EEF2F8] border border-[#DCE3EE] shadow-2xs cursor-pointer"
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
            className="absolute top-0 text-[10px] text-[#0284C7] hover:underline -translate-x-1/2 font-bold cursor-pointer"
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
                className="absolute top-0 text-[10px] text-[#B45309] hover:underline transition-colors -translate-x-1/2 flex flex-col items-center font-bold cursor-pointer"
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
          className="w-full h-2 bg-[#EEF2F8] rounded-md appearance-none cursor-pointer accent-[#0284C7]"
        />

        {/* Progress Labels */}
        <div className="flex justify-between items-center text-[10px] text-[#68758A] mt-1 font-medium">
          <span>T+0.0 D</span>
          <span>{((currentTimeDays / maxDays) * 100).toFixed(0)}% MISSION PROGRESS</span>
          <span>T+{maxDays.toFixed(0)} D</span>
        </div>
      </div>
    </div>
  );
};
