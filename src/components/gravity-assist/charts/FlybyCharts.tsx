import React, { useRef, useEffect, useState } from 'react';
import { FlybySimulationResult, ReferenceFrame, TrajectoryPoint } from '../../../physics/FlybyEngine';
import { LineChart, BarChart2, TrendingUp, Compass } from 'lucide-react';

interface FlybyChartsProps {
  simResult: FlybySimulationResult | null;
  currentPlaybackIndex: number;
  referenceFrame: ReferenceFrame;
}

type ChartTab = 'SPEED_TIME' | 'DISTANCE_TIME' | 'DEFLECTION_CURVE' | 'ENERGY_TIME';

export const FlybyCharts: React.FC<FlybyChartsProps> = ({
  simResult,
  currentPlaybackIndex,
  referenceFrame,
}) => {
  const [activeTab, setActiveTab] = useState<ChartTab>('SPEED_TIME');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !simResult || simResult.trajectory.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Dark technical background
    ctx.fillStyle = '#08090d';
    ctx.fillRect(0, 0, w, h);

    const padLeft = 60;
    const padRight = 30;
    const padTop = 30;
    const padBottom = 40;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    // Grid lines
    ctx.strokeStyle = '#151822';
    ctx.lineWidth = 1;
    for (let x = padLeft; x <= w - padRight; x += plotW / 6) {
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, h - padBottom);
      ctx.stroke();
    }
    for (let y = padTop; y <= h - padBottom; y += plotH / 5) {
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();
    }

    const traj = simResult.trajectory;
    const totalTime = traj[traj.length - 1].timeS;
    const planetRadiusKm = simResult.config.planet.radiusM / 1000.0;
    const currentIdx = Math.min(currentPlaybackIndex, traj.length - 1);
    const currentPt = traj[currentIdx];

    if (activeTab === 'SPEED_TIME') {
      // 1. Spacecraft Speed vs Time in both frames
      let maxSpeed = 0;
      for (const pt of traj) {
        if (pt.speedPlanetMPerS > maxSpeed) maxSpeed = pt.speedPlanetMPerS;
        if (pt.speedSunMPerS > maxSpeed) maxSpeed = pt.speedSunMPerS;
      }
      maxSpeed = Math.ceil(maxSpeed * 1.15); // Add 15% headroom

      // Axes labels
      ctx.fillStyle = '#8e96aa';
      ctx.font = '10px monospace';
      ctx.fillText(`SPEED (km/s)`, padLeft - 50, padTop - 12);
      ctx.fillText(`TIME (s)`, w - padRight - 40, h - padBottom + 25);

      for (let i = 0; i <= 5; i++) {
        const val = (maxSpeed * (5 - i)) / 5 / 1000.0;
        const y = padTop + (plotH * i) / 5;
        ctx.fillStyle = '#656d82';
        ctx.fillText(val.toFixed(0), padLeft - 35, y + 3);
      }

      // Draw Planet-frame speed curve (Amber)
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      traj.forEach((pt, i) => {
        const x = padLeft + (pt.timeS / totalTime) * plotW;
        const y = padTop + (1.0 - pt.speedPlanetMPerS / maxSpeed) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Draw Sun-frame speed curve (Sky)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      traj.forEach((pt, i) => {
        const x = padLeft + (pt.timeS / totalTime) * plotW;
        const y = padTop + (1.0 - pt.speedSunMPerS / maxSpeed) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Playback Current Time marker
      const curX = padLeft + (currentPt.timeS / totalTime) * plotW;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(curX, padTop);
      ctx.lineTo(curX, h - padBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Legend
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('— PLANET REST-FRAME SPEED (v_∞ asymptotic)', padLeft + 10, padTop + 15);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('— SUN HELIOCENTRIC SPEED (genuine boost)', padLeft + 10, padTop + 30);
    } else if (activeTab === 'DISTANCE_TIME') {
      // 2. Distance from Center vs Time (with physical surface collision limit)
      let maxDist = 0;
      for (const pt of traj) {
        if (pt.distanceFromCenterM > maxDist) maxDist = pt.distanceFromCenterM;
      }
      maxDist = Math.max(maxDist * 1.1, simResult.config.planet.radiusM * 1.5);

      ctx.fillStyle = '#8e96aa';
      ctx.font = '10px monospace';
      ctx.fillText(`DISTANCE (10³ km)`, padLeft - 50, padTop - 12);
      ctx.fillText(`TIME (s)`, w - padRight - 40, h - padBottom + 25);

      for (let i = 0; i <= 5; i++) {
        const val = ((maxDist * (5 - i)) / 5 / 1e6).toFixed(0);
        const y = padTop + (plotH * i) / 5;
        ctx.fillStyle = '#656d82';
        ctx.fillText(val, padLeft - 35, y + 3);
      }

      // Draw Physical Surface Radius Line (Red boundary)
      const rSurfaceY = padTop + (1.0 - simResult.config.planet.radiusM / maxDist) * plotH;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padLeft, rSurfaceY);
      ctx.lineTo(w - padRight, rSurfaceY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ef4444';
      ctx.fillText(
        `PHYSICAL PLANET SURFACE (R_p = ${planetRadiusKm.toLocaleString()} km)`,
        padLeft + 10,
        rSurfaceY - 6
      );

      // Draw Distance Curve (Emerald)
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      traj.forEach((pt, i) => {
        const x = padLeft + (pt.timeS / totalTime) * plotW;
        const y = padTop + (1.0 - pt.distanceFromCenterM / maxDist) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Current time marker
      const curX = padLeft + (currentPt.timeS / totalTime) * plotW;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(curX, padTop);
      ctx.lineTo(curX, h - padBottom);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (activeTab === 'DEFLECTION_CURVE') {
      // 3. Analytical Deflection Angle vs Periapsis Distance Curve
      const vInf = simResult.config.vInfSpeedMPerS;
      const mu = simResult.config.planet.mu;
      const Rp = simResult.config.planet.radiusM;

      ctx.fillStyle = '#8e96aa';
      ctx.font = '10px monospace';
      ctx.fillText(`DEFLECTION δ (DEG)`, padLeft - 50, padTop - 12);
      ctx.fillText(`PERIAPSIS DISTANCE (R_p multiples)`, w - padRight - 80, h - padBottom + 25);

      // Max deflection 180 degrees
      for (let i = 0; i <= 6; i++) {
        const deg = (180 * (6 - i)) / 6;
        const y = padTop + (plotH * i) / 6;
        ctx.fillStyle = '#656d82';
        ctx.fillText(deg.toFixed(0) + '°', padLeft - 35, y + 3);
      }

      // Draw curve for r_p from 0.8 Rp to 8 Rp
      const minMult = 0.8;
      const maxMult = 8.0;

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      const samples = 100;
      for (let s = 0; s <= samples; s++) {
        const mult = minMult + (s / samples) * (maxMult - minMult);
        const rp = Rp * mult;
        const eHyp = 1.0 + (rp * vInf * vInf) / mu;
        const halfDelta = Math.asin(Math.min(1.0, 1.0 / eHyp));
        const deltaDeg = (2.0 * halfDelta * 180.0) / Math.PI;

        const x = padLeft + ((mult - minMult) / (maxMult - minMult)) * plotW;
        const y = padTop + (1.0 - deltaDeg / 180.0) * plotH;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Current operating point marker
      const currentRpMult = simResult.analytical.periapsisRadiusM / Rp;
      if (currentRpMult >= minMult && currentRpMult <= maxMult) {
        const curX = padLeft + ((currentRpMult - minMult) / (maxMult - minMult)) * plotW;
        const curY = padTop + (1.0 - simResult.analytical.deflectionAngleDeg / 180.0) * plotH;
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(curX, curY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(
          `CURRENT: ${currentRpMult.toFixed(2)} Rp (${simResult.analytical.deflectionAngleDeg.toFixed(1)}°)`,
          curX + 8,
          curY - 6
        );
      }
    }
  }, [simResult, currentPlaybackIndex, activeTab]);

  return (
    <div className="w-full bg-[#0d0e14] border border-[#202434] p-4 rounded-xs flex flex-col gap-3 text-white">
      {/* Chart Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#202434] pb-2">
        <div className="flex items-center gap-2">
          <LineChart size={15} className="text-sky-400" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-200">
            DYNAMIC ORBITAL MECHANICS CHARTS
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <button
            onClick={() => setActiveTab('SPEED_TIME')}
            className={`px-2.5 py-1 rounded-xs transition-colors ${
              activeTab === 'SPEED_TIME'
                ? 'bg-amber-500 text-black font-bold'
                : 'bg-[#141620] text-neutral-400 hover:text-white border border-[#232738]'
            }`}
          >
            SPEED v(t) [BOTH FRAMES]
          </button>
          <button
            onClick={() => setActiveTab('DISTANCE_TIME')}
            className={`px-2.5 py-1 rounded-xs transition-colors ${
              activeTab === 'DISTANCE_TIME'
                ? 'bg-emerald-500 text-black font-bold'
                : 'bg-[#141620] text-neutral-400 hover:text-white border border-[#232738]'
            }`}
          >
            DISTANCE r(t) & SURFACE LIMIT
          </button>
          <button
            onClick={() => setActiveTab('DEFLECTION_CURVE')}
            className={`px-2.5 py-1 rounded-xs transition-colors ${
              activeTab === 'DEFLECTION_CURVE'
                ? 'bg-sky-500 text-black font-bold'
                : 'bg-[#141620] text-neutral-400 hover:text-white border border-[#232738]'
            }`}
          >
            TURNING ANGLE δ(rp)
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="w-full">
        <canvas
          ref={canvasRef}
          width={760}
          height={260}
          className="w-full h-auto rounded-xs border border-[#1b1f2d]"
        />
      </div>
    </div>
  );
};
