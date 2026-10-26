import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Play, Pause, RotateCcw, ZoomIn, ZoomOut, Maximize2, Compass, Layers, Check } from 'lucide-react';
import { FlybyScenarioConfig } from '../../../physics/FlybyScenario';
import { FlybyEngine, FlybySimulationResult } from '../../../physics/FlybyEngine';
import { TrajectoryInterpolator, InterpolatedState } from './TrajectoryInterpolator';

export interface GravityAssist2DSandboxProps {
  scenario: FlybyScenarioConfig;
  simResult: FlybySimulationResult;
  onUpdateScenario: (updater: (prev: FlybyScenarioConfig) => FlybyScenarioConfig) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  playbackSpeed: number;
  onChangePlaybackSpeed: (speed: number) => void;
  currentPlaybackIndex: number;
  onPlaybackIndexChange: (index: number) => void;
  viewportMode: '2D' | '3D';
  onChangeViewportMode: (mode: '2D' | '3D') => void;
}

export const GravityAssist2DSandbox: React.FC<GravityAssist2DSandboxProps> = ({
  scenario,
  simResult,
  onUpdateScenario,
  isPlaying,
  onTogglePlay,
  onReset,
  playbackSpeed,
  onChangePlaybackSpeed,
  currentPlaybackIndex,
  onPlaybackIndexChange,
  viewportMode,
  onChangeViewportMode,
}) => {
  // Canvases
  const planetCanvasRef = useRef<HTMLCanvasElement>(null);
  const sunCanvasRef = useRef<HTMLCanvasElement>(null);

  // High-precision Hermite Trajectory Interpolator
  const interpolatorRef = useRef<TrajectoryInterpolator | null>(null);
  useEffect(() => {
    if (simResult && simResult.trajectory.length > 0) {
      interpolatorRef.current = new TrajectoryInterpolator(simResult);
    } else {
      interpolatorRef.current = null;
    }
  }, [simResult]);

  // Shared Zoom Multiplier
  const [zoomMultiplier, setZoomMultiplier] = useState<number>(1.0);

  // Independent Pan offsets for user exploration
  const [planetPan, setPlanetPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [sunPan, setSunPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Drag tracking
  const isDraggingPlanetRef = useRef<boolean>(false);
  const isDraggingSunRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Playback Clock (smooth continuous seconds)
  const currentTimeSRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);
  const animFrameIdRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;

  const playbackSpeedRef = useRef<number>(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;

  const lastEmittedIndexRef = useRef<number>(-1);

  // Synchronize internal continuous time on external scrub/step/pause
  useEffect(() => {
    if (simResult && simResult.trajectory.length > 0) {
      if (isPlayingRef.current && currentPlaybackIndex === lastEmittedIndexRef.current) {
        return;
      }
      const idx = Math.min(Math.max(0, currentPlaybackIndex), simResult.trajectory.length - 1);
      const targetTimeS = simResult.trajectory[idx].timeS;
      if (!isPlayingRef.current || Math.abs(currentTimeSRef.current - targetTimeS) > 3.0) {
        currentTimeSRef.current = targetTimeS;
      }
    }
  }, [currentPlaybackIndex, simResult]);

  // Derived Trajectory Parameter values
  const v0KmS = (scenario.planet.orbitalSpeedMPerS / 1000.0);
  const vInfKmS = (scenario.encounter.vInfSpeedMPerS / 1000.0);
  const thetaDeg = scenario.encounter.approachAngleDeg ?? 0;
  const bKm = scenario.encounter.impactParameterKm || (simResult.analytical.impactParameterM / 1000.0);

  // Parameter Change Handlers
  const handleV0Change = (newV0KmS: number) => {
    onUpdateScenario((prev) => ({
      ...prev,
      planet: {
        ...prev.planet,
        orbitalSpeedMPerS: newV0KmS * 1000.0,
      },
    }));
  };

  const handleVInfChange = (newVInfKmS: number) => {
    const vInfM = newVInfKmS * 1000.0;
    const mu = scenario.planet.mu;
    const curRpM = scenario.planet.radiusM + scenario.encounter.periapsisAltitudeKm * 1000.0;
    const newBM = curRpM > 0 ? FlybyEngine.periapsisToImpactParameter(curRpM, vInfM, mu) : 0;

    onUpdateScenario((prev) => ({
      ...prev,
      encounter: {
        ...prev.encounter,
        vInfSpeedMPerS: vInfM,
        impactParameterKm: newBM / 1000.0,
      },
    }));
  };

  const handleThetaChange = (newThetaDeg: number) => {
    onUpdateScenario((prev) => ({
      ...prev,
      encounter: {
        ...prev.encounter,
        approachAngleDeg: newThetaDeg,
      },
    }));
  };

  const handleBChange = (newBKm: number) => {
    const bM = newBKm * 1000.0;
    const vInfM = scenario.encounter.vInfSpeedMPerS;
    const mu = scenario.planet.mu;
    const newRpM = FlybyEngine.impactParameterToPeriapsis(bM, vInfM, mu);
    const newAltKm = Math.max(0, (newRpM - scenario.planet.radiusM) / 1000.0);

    onUpdateScenario((prev) => ({
      ...prev,
      encounter: {
        ...prev.encounter,
        impactParameterKm: newBKm,
        periapsisAltitudeKm: newAltKm,
      },
    }));
  };

  // Reset View Pan
  const handleResetPlanetView = () => setPlanetPan({ x: 0, y: 0 });
  const handleResetSunView = () => setSunPan({ x: 0, y: 0 });

  // Main 60 FPS Dual-Canvas Animation & Rendering Loop
  useEffect(() => {
    const pCanvas = planetCanvasRef.current;
    const sCanvas = sunCanvasRef.current;
    if (!pCanvas || !sCanvas) return;

    const pCtx = pCanvas.getContext('2d', { alpha: false });
    const sCtx = sCanvas.getContext('2d', { alpha: false });
    if (!pCtx || !sCtx) return;

    let lastTime = performance.now();

    const render = () => {
      animFrameIdRef.current = requestAnimationFrame(render);

      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000.0);
      lastTime = now;

      const interpolator = interpolatorRef.current;
      if (!interpolator || !simResult || simResult.trajectory.length === 0) return;

      const totalDuration = interpolator.getTotalDurationS();

      // 1. Advance Master Continuous Clock
      if (isPlayingRef.current) {
        const timeAdvance = (totalDuration / 22.0) * playbackSpeedRef.current * dt;
        currentTimeSRef.current += timeAdvance;

        if (currentTimeSRef.current >= totalDuration) {
          if (simResult.collisionDetected) {
            currentTimeSRef.current = simResult.collisionTimeS ?? totalDuration;
          } else {
            currentTimeSRef.current = 0;
          }
        }

        // Throttled parent sync (~25 Hz)
        if (now - lastSyncTimeRef.current > 40 && onPlaybackIndexChange) {
          lastSyncTimeRef.current = now;
          const progress = Math.max(0, Math.min(1, currentTimeSRef.current / Math.max(1, totalDuration)));
          const targetIndex = Math.min(
            simResult.trajectory.length - 1,
            Math.floor(progress * (simResult.trajectory.length - 1))
          );
          lastEmittedIndexRef.current = targetIndex;
          onPlaybackIndexChange(targetIndex);
        }
      }

      // 2. Evaluate Exact Continuous Physical State
      const state: InterpolatedState = interpolator.evaluateAtTime(currentTimeSRef.current);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const traj = simResult.trajectory;
      const planetRadiusM = simResult.config.planet.radiusM;
      const originPlanetSun = traj[0].planetPosSunM;

      // =========================================================================
      // PLOT 1: PLANET FRAME (LEFT)
      // =========================================================================
      const pw = pCanvas.clientWidth;
      const ph = pCanvas.clientHeight;
      if (pCanvas.width !== pw * dpr || pCanvas.height !== ph * dpr) {
        pCanvas.width = pw * dpr;
        pCanvas.height = ph * dpr;
      }

      pCtx.save();
      pCtx.scale(dpr, dpr);

      // Background
      pCtx.fillStyle = '#FFFFFF';
      pCtx.fillRect(0, 0, pw, ph);

      // Base Scale in Planet Frame: span ~ 16 planet radii across height
      const pBaseSpanM = Math.max(planetRadiusM * 14.0, (simResult.analytical.impactParameterM || planetRadiusM * 3) * 2.6);
      const pScale = (Math.min(pw, ph) / pBaseSpanM) * zoomMultiplier;
      const pcx = pw / 2 + planetPan.x;
      const pcy = ph / 2 + planetPan.y;

      const pToScreenX = (wx: number) => pcx + wx * pScale;
      const pToScreenY = (wy: number) => pcy - wy * pScale;

      // Coordinate Grid & Distance Axis Lines
      pCtx.strokeStyle = '#F0F4FA';
      pCtx.lineWidth = 1;
      const gridSizePx = 45;
      const pStartX = pcx % gridSizePx;
      const pStartY = pcy % gridSizePx;

      pCtx.beginPath();
      for (let x = pStartX; x < pw; x += gridSizePx) {
        pCtx.moveTo(x, 0);
        pCtx.lineTo(x, ph);
      }
      for (let y = pStartY; y < ph; y += gridSizePx) {
        pCtx.moveTo(0, y);
        pCtx.lineTo(pw, y);
      }
      pCtx.stroke();

      // Main Cartesian Coordinate Crosshair
      pCtx.strokeStyle = '#DCE3EE';
      pCtx.lineWidth = 1.5;
      pCtx.beginPath();
      pCtx.moveTo(0, pcy);
      pCtx.lineTo(pw, pcy);
      pCtx.moveTo(pcx, 0);
      pCtx.lineTo(pcx, ph);
      pCtx.stroke();

      // Distance Axis Ticks & Numerical Labels
      pCtx.font = '9px monospace';
      pCtx.fillStyle = '#94A3B8';
      const tickStepM = planetRadiusM * 2.0;
      const maxTicks = 6;
      for (let i = -maxTicks; i <= maxTicks; i++) {
        if (i === 0) continue;
        const tx = pToScreenX(i * tickStepM);
        const ty = pToScreenY(i * tickStepM);
        const valKm = ((i * tickStepM) / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 });

        if (tx >= 20 && tx <= pw - 20) {
          pCtx.beginPath();
          pCtx.moveTo(tx, pcy - 3);
          pCtx.lineTo(tx, pcy + 3);
          pCtx.stroke();
          pCtx.fillText(`${valKm}k`, tx - 12, pcy + 14);
        }
        if (ty >= 20 && ty <= ph - 20) {
          pCtx.beginPath();
          pCtx.moveTo(pcx - 3, ty);
          pCtx.lineTo(pcx + 3, ty);
          pCtx.stroke();
          pCtx.fillText(`${valKm}k`, pcx + 6, ty + 3);
        }
      }

      // Gravitational Influence Rings
      const planetRadiusPx = Math.max(4, planetRadiusM * pScale);
      pCtx.save();
      pCtx.setLineDash([3, 4]);
      pCtx.strokeStyle = 'rgba(141, 191, 240, 0.4)';
      pCtx.fillStyle = 'rgba(141, 191, 240, 0.02)';
      [1.5, 3.0, 5.0].forEach((mul) => {
        const rPx = planetRadiusPx * mul;
        if (rPx < pw * 1.5) {
          pCtx.beginPath();
          pCtx.arc(pcx, pcy, rPx, 0, Math.PI * 2);
          pCtx.fill();
          pCtx.stroke();
          pCtx.fillStyle = '#94A3B8';
          pCtx.fillText(`${mul}R_p`, pcx + rPx + 4, pcy - 2);
        }
      });
      pCtx.restore();

      // Periapsis & Closest Approach Indicator
      const ca = simResult.closestApproach;
      const periScreenX = pToScreenX(ca.positionPlanetM.x);
      const periScreenY = pToScreenY(ca.positionPlanetM.y);

      // Radial periapsis distance line
      pCtx.save();
      pCtx.setLineDash([3, 3]);
      pCtx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
      pCtx.lineWidth = 1.2;
      pCtx.beginPath();
      pCtx.moveTo(pcx, pcy);
      pCtx.lineTo(periScreenX, periScreenY);
      pCtx.stroke();
      pCtx.restore();

      // Periapsis Diamond Marker
      pCtx.save();
      pCtx.fillStyle = '#F59E0B';
      pCtx.strokeStyle = '#FFFFFF';
      pCtx.lineWidth = 1.5;
      const dia = 5.5;
      pCtx.beginPath();
      pCtx.moveTo(periScreenX, periScreenY - dia);
      pCtx.lineTo(periScreenX + dia, periScreenY);
      pCtx.lineTo(periScreenX, periScreenY + dia);
      pCtx.lineTo(periScreenX - dia, periScreenY);
      pCtx.closePath();
      pCtx.fill();
      pCtx.stroke();
      pCtx.font = 'bold 9px monospace';
      pCtx.fillStyle = '#B45309';
      const rpValKm = (ca.distanceM / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 });
      pCtx.fillText(`r_p = ${rpValKm} km`, periScreenX + 8, periScreenY + 3);
      pCtx.restore();

      // Impact Parameter (b) Dashed Reference Line
      const bM = simResult.analytical.impactParameterM;
      if (bM > 0) {
        const bSign = simResult.config.passType === 'TRAILING' ? 1 : -1;
        const appRad = ((simResult.config.approachAngleDeg || 0) * Math.PI) / 180.0;
        const bTargetX = -bM * Math.sin(appRad) * bSign;
        const bTargetY = bM * Math.cos(appRad) * bSign;
        const bScreenX = pToScreenX(bTargetX);
        const bScreenY = pToScreenY(bTargetY);

        pCtx.save();
        pCtx.setLineDash([4, 4]);
        pCtx.strokeStyle = '#F97316';
        pCtx.lineWidth = 1.5;
        pCtx.beginPath();
        pCtx.moveTo(pcx, pcy);
        pCtx.lineTo(bScreenX, bScreenY);
        pCtx.stroke();

        // Label for Impact Parameter
        pCtx.fillStyle = '#C2410C';
        pCtx.font = 'bold 9px monospace';
        const bDisplayKm = (bM / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 });
        pCtx.fillText(`b = ${bDisplayKm} km`, (pcx + bScreenX) / 2 + 6, (pcy + bScreenY) / 2 - 4);
        pCtx.restore();
      }

      // Deflection Angle (delta) Annotation
      const deltaDeg = simResult.analytical.deflectionAngleDeg;
      if (deltaDeg > 0.5) {
        pCtx.save();
        pCtx.font = 'bold 10px monospace';
        pCtx.fillStyle = '#7C3AED';
        pCtx.fillText(`DEFLECTION: δ = ${deltaDeg.toFixed(1)}°`, 16, ph - 20);
        pCtx.restore();
      }

      // Hyperbolic Trajectory Paths (Incoming: Pastel Sky Blue, Outgoing: Pastel Lavender)
      const periIndex = traj.findIndex((p) => p.timeS >= ca.timeS) || Math.floor(traj.length / 2);

      // Incoming segment
      pCtx.save();
      pCtx.strokeStyle = '#4A90E2';
      pCtx.lineWidth = 2.5;
      pCtx.beginPath();
      for (let i = 0; i <= periIndex; i++) {
        const sx = pToScreenX(traj[i].posPlanetM.x);
        const sy = pToScreenY(traj[i].posPlanetM.y);
        if (i === 0) pCtx.moveTo(sx, sy);
        else pCtx.lineTo(sx, sy);
      }
      pCtx.stroke();

      // Outgoing segment
      pCtx.strokeStyle = '#8B5CF6';
      pCtx.beginPath();
      for (let i = periIndex; i < traj.length; i++) {
        const sx = pToScreenX(traj[i].posPlanetM.x);
        const sy = pToScreenY(traj[i].posPlanetM.y);
        if (i === periIndex) pCtx.moveTo(sx, sy);
        else pCtx.lineTo(sx, sy);
      }
      pCtx.stroke();
      pCtx.restore();

      // Planet Central Body (Pastel Sphere)
      pCtx.save();
      pCtx.shadowColor = 'rgba(38, 50, 71, 0.15)';
      pCtx.shadowBlur = 10;
      pCtx.shadowOffsetX = 2;
      pCtx.shadowOffsetY = 4;

      const pGrad = pCtx.createRadialGradient(
        pcx - planetRadiusPx * 0.3,
        pcy - planetRadiusPx * 0.3,
        planetRadiusPx * 0.1,
        pcx,
        pcy,
        planetRadiusPx
      );
      pGrad.addColorStop(0, '#FFFFFF');
      pGrad.addColorStop(0.35, '#BAE6FD');
      pGrad.addColorStop(1, '#60A5FA');

      pCtx.fillStyle = pGrad;
      pCtx.beginPath();
      pCtx.arc(pcx, pcy, planetRadiusPx, 0, Math.PI * 2);
      pCtx.fill();

      pCtx.shadowColor = 'transparent';
      pCtx.strokeStyle = '#3B82F6';
      pCtx.lineWidth = 1.5;
      pCtx.stroke();

      // Planet Name
      pCtx.font = 'bold 10px sans-serif';
      pCtx.fillStyle = '#1E3A8A';
      pCtx.fillText(simResult.config.planet.name.toUpperCase(), pcx + planetRadiusPx + 6, pcy + 4);
      pCtx.restore();

      // Spacecraft Probe (Planet Frame)
      const scPlanetX = pToScreenX(state.posPlanetM.x);
      const scPlanetY = pToScreenY(state.posPlanetM.y);
      const headingPlanet = Math.atan2(-state.velPlanetM.y, state.velPlanetM.x);

      pCtx.save();
      pCtx.translate(scPlanetX, scPlanetY);
      pCtx.rotate(headingPlanet);

      // Solar Wings
      pCtx.fillStyle = '#93C5FD';
      pCtx.fillRect(-2, -8, 4, 16);

      // Probe Hull
      pCtx.fillStyle = '#F4B58C';
      pCtx.strokeStyle = '#C2410C';
      pCtx.lineWidth = 1.2;
      pCtx.beginPath();
      pCtx.moveTo(7, 0);
      pCtx.lineTo(-5, -4);
      pCtx.lineTo(-3, 0);
      pCtx.lineTo(-5, 4);
      pCtx.closePath();
      pCtx.fill();
      pCtx.stroke();
      pCtx.restore();

      // Velocity Vector Arrow in Planet Frame (Strictly ||v_inf|| Conserved)
      if (state.speedPlanetMPerS > 10) {
        pCtx.save();
        const vLenPx = Math.min(65, Math.max(22, (state.speedPlanetMPerS / 1000) * 2.0));
        const vEndX = scPlanetX + Math.cos(headingPlanet) * vLenPx;
        const vEndY = scPlanetY + Math.sin(headingPlanet) * vLenPx;

        pCtx.strokeStyle = '#10B981';
        pCtx.fillStyle = '#10B981';
        pCtx.lineWidth = 2;
        pCtx.beginPath();
        pCtx.moveTo(scPlanetX, scPlanetY);
        pCtx.lineTo(vEndX, vEndY);
        pCtx.stroke();

        // Arrow tip
        const arrowSz = 6;
        pCtx.beginPath();
        pCtx.moveTo(vEndX, vEndY);
        pCtx.lineTo(vEndX - arrowSz * Math.cos(headingPlanet - Math.PI / 6), vEndY - arrowSz * Math.sin(headingPlanet - Math.PI / 6));
        pCtx.lineTo(vEndX - arrowSz * Math.cos(headingPlanet + Math.PI / 6), vEndY - arrowSz * Math.sin(headingPlanet + Math.PI / 6));
        pCtx.closePath();
        pCtx.fill();

        pCtx.font = 'bold 9px monospace';
        pCtx.fillStyle = '#065F46';
        pCtx.fillText(`v = ${(state.speedPlanetMPerS / 1000).toFixed(1)} km/s`, vEndX + 5, vEndY - 2);
        pCtx.restore();
      }

      pCtx.restore();

      // =========================================================================
      // PLOT 2: SUN FRAME (RIGHT)
      // =========================================================================
      const sw = sCanvas.clientWidth;
      const sh = sCanvas.clientHeight;
      if (sCanvas.width !== sw * dpr || sCanvas.height !== sh * dpr) {
        sCanvas.width = sw * dpr;
        sCanvas.height = sh * dpr;
      }

      sCtx.save();
      sCtx.scale(dpr, dpr);

      // Background
      sCtx.fillStyle = '#FFFFFF';
      sCtx.fillRect(0, 0, sw, sh);

      // Base Scale in Sun Frame: spans the entire heliocentric flyby arc
      const sBaseSpanM = Math.max(planetRadiusM * 20.0, (simResult.analytical.impactParameterM || planetRadiusM * 3) * 3.5);
      const sScale = (Math.min(sw, sh) / sBaseSpanM) * zoomMultiplier;
      const scx = sw / 2 + sunPan.x;
      const scy = sh / 2 + sunPan.y;

      const sToScreenX = (wx: number) => scx + wx * sScale;
      const sToScreenY = (wy: number) => scy - wy * sScale;

      // Coordinate Grid
      sCtx.strokeStyle = '#F0F4FA';
      sCtx.lineWidth = 1;
      const sStartX = scx % gridSizePx;
      const sStartY = scy % gridSizePx;

      sCtx.beginPath();
      for (let x = sStartX; x < sw; x += gridSizePx) {
        sCtx.moveTo(x, 0);
        sCtx.lineTo(x, sh);
      }
      for (let y = sStartY; y < sh; y += gridSizePx) {
        sCtx.moveTo(0, y);
        sCtx.lineTo(sw, y);
      }
      sCtx.stroke();

      // Main Coordinate Axes
      sCtx.strokeStyle = '#DCE3EE';
      sCtx.lineWidth = 1.5;
      sCtx.beginPath();
      sCtx.moveTo(0, scy);
      sCtx.lineTo(sw, scy);
      sCtx.moveTo(scx, 0);
      sCtx.lineTo(scx, sh);
      sCtx.stroke();

      // Axis Ticks
      sCtx.font = '9px monospace';
      sCtx.fillStyle = '#94A3B8';
      for (let i = -maxTicks; i <= maxTicks; i++) {
        if (i === 0) continue;
        const tx = sToScreenX(i * tickStepM);
        const ty = sToScreenY(i * tickStepM);
        const valKm = ((i * tickStepM) / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 });

        if (tx >= 20 && tx <= sw - 20) {
          sCtx.beginPath();
          sCtx.moveTo(tx, scy - 3);
          sCtx.lineTo(tx, scy + 3);
          sCtx.stroke();
          sCtx.fillText(`${valKm}k`, tx - 12, scy + 14);
        }
        if (ty >= 20 && ty <= sh - 20) {
          sCtx.beginPath();
          sCtx.moveTo(scx - 3, ty);
          sCtx.lineTo(scx + 3, ty);
          sCtx.stroke();
          sCtx.fillText(`${valKm}k`, scx + 6, ty + 3);
        }
      }

      // Planet Orbit Path & Moving Position in Sun Frame
      const planetRelSunX = state.planetPosSunM.x - originPlanetSun.x;
      const planetRelSunY = state.planetPosSunM.y - originPlanetSun.y;
      const pSunScreenX = sToScreenX(planetRelSunX);
      const pSunScreenY = sToScreenY(planetRelSunY);

      // Trajectory in Sun Frame
      sCtx.save();
      sCtx.strokeStyle = '#0284C7';
      sCtx.lineWidth = 2.5;
      sCtx.beginPath();
      for (let i = 0; i < traj.length; i++) {
        const sx = sToScreenX(traj[i].posSunM.x - originPlanetSun.x);
        const sy = sToScreenY(traj[i].posSunM.y - originPlanetSun.y);
        if (i === 0) sCtx.moveTo(sx, sy);
        else sCtx.lineTo(sx, sy);
      }
      sCtx.stroke();
      sCtx.restore();

      // Moving Planet Body in Sun Frame
      sCtx.save();
      sCtx.shadowColor = 'rgba(38, 50, 71, 0.15)';
      sCtx.shadowBlur = 8;
      sCtx.shadowOffsetX = 1;
      sCtx.shadowOffsetY = 3;

      const sPlanetGrad = sCtx.createRadialGradient(
        pSunScreenX - planetRadiusPx * 0.3,
        pSunScreenY - planetRadiusPx * 0.3,
        planetRadiusPx * 0.1,
        pSunScreenX,
        pSunScreenY,
        planetRadiusPx
      );
      sPlanetGrad.addColorStop(0, '#FFFFFF');
      sPlanetGrad.addColorStop(0.35, '#BAE6FD');
      sPlanetGrad.addColorStop(1, '#60A5FA');

      sCtx.fillStyle = sPlanetGrad;
      sCtx.beginPath();
      sCtx.arc(pSunScreenX, pSunScreenY, planetRadiusPx, 0, Math.PI * 2);
      sCtx.fill();

      sCtx.shadowColor = 'transparent';
      sCtx.strokeStyle = '#2563EB';
      sCtx.lineWidth = 1.5;
      sCtx.stroke();

      // Planet velocity vector (v0) in Sun Frame
      const pSpeed = state.planetVelSunM.length();
      if (pSpeed > 10.0) {
        const pHeading = Math.atan2(-state.planetVelSunM.y, state.planetVelSunM.x);
        const pvLenPx = 50;
        const pEndX = pSunScreenX + Math.cos(pHeading) * pvLenPx;
        const pEndY = pSunScreenY + Math.sin(pHeading) * pvLenPx;

        sCtx.strokeStyle = '#059669';
        sCtx.fillStyle = '#059669';
        sCtx.lineWidth = 2;
        sCtx.beginPath();
        sCtx.moveTo(pSunScreenX, pSunScreenY);
        sCtx.lineTo(pEndX, pEndY);
        sCtx.stroke();

        sCtx.beginPath();
        sCtx.moveTo(pEndX, pEndY);
        sCtx.lineTo(pEndX - 5 * Math.cos(pHeading - Math.PI / 6), pEndY - 5 * Math.sin(pHeading - Math.PI / 6));
        sCtx.lineTo(pEndX - 5 * Math.cos(pHeading + Math.PI / 6), pEndY - 5 * Math.sin(pHeading + Math.PI / 6));
        sCtx.closePath();
        sCtx.fill();

        sCtx.font = 'bold 9px monospace';
        sCtx.fillStyle = '#065F46';
        sCtx.fillText(`v_0 = ${(pSpeed / 1000).toFixed(1)} km/s`, pEndX + 5, pEndY - 2);
      }
      sCtx.restore();

      // Spacecraft Probe (Sun Frame)
      const scSunX = sToScreenX(state.posSunM.x - originPlanetSun.x);
      const scSunY = sToScreenY(state.posSunM.y - originPlanetSun.y);
      const headingSun = Math.atan2(-state.velSunM.y, state.velSunM.x);

      sCtx.save();
      sCtx.translate(scSunX, scSunY);
      sCtx.rotate(headingSun);

      // Solar Wings
      sCtx.fillStyle = '#93C5FD';
      sCtx.fillRect(-2, -8, 4, 16);

      // Probe Hull
      sCtx.fillStyle = '#F4B58C';
      sCtx.strokeStyle = '#C2410C';
      sCtx.lineWidth = 1.2;
      sCtx.beginPath();
      sCtx.moveTo(7, 0);
      sCtx.lineTo(-5, -4);
      sCtx.lineTo(-3, 0);
      sCtx.lineTo(-5, 4);
      sCtx.closePath();
      sCtx.fill();
      sCtx.stroke();
      sCtx.restore();

      // Heliocentric Velocity Vector Arrow
      if (state.speedSunMPerS > 10) {
        sCtx.save();
        const vLenPx = Math.min(65, Math.max(22, (state.speedSunMPerS / 1000) * 1.8));
        const vEndX = scSunX + Math.cos(headingSun) * vLenPx;
        const vEndY = scSunY + Math.sin(headingSun) * vLenPx;

        sCtx.strokeStyle = '#10B981';
        sCtx.fillStyle = '#10B981';
        sCtx.lineWidth = 2;
        sCtx.beginPath();
        sCtx.moveTo(scSunX, scSunY);
        sCtx.lineTo(vEndX, vEndY);
        sCtx.stroke();

        const arrowSz = 6;
        sCtx.beginPath();
        sCtx.moveTo(vEndX, vEndY);
        sCtx.lineTo(vEndX - arrowSz * Math.cos(headingSun - Math.PI / 6), vEndY - arrowSz * Math.sin(headingSun - Math.PI / 6));
        sCtx.lineTo(vEndX - arrowSz * Math.cos(headingSun + Math.PI / 6), vEndY - arrowSz * Math.sin(headingSun + Math.PI / 6));
        sCtx.closePath();
        sCtx.fill();

        sCtx.font = 'bold 9px monospace';
        sCtx.fillStyle = '#065F46';
        sCtx.fillText(`v_sun = ${(state.speedSunMPerS / 1000).toFixed(1)} km/s`, vEndX + 5, vEndY - 2);
        sCtx.restore();
      }

      // Resulting Delta-V Momentum Exchange Banner
      const isGain = simResult.analytical.deltaVSunSpeedMPerS >= 0;
      const deltaVKmS = Math.abs(simResult.analytical.deltaVSunSpeedMPerS / 1000.0);
      sCtx.save();
      sCtx.font = 'bold 10px monospace';
      sCtx.fillStyle = isGain ? '#059669' : '#DC2626';
      sCtx.fillText(
        `MOMENTUM TRANSFER: Δv = ${isGain ? '+' : '-'}${deltaVKmS.toFixed(2)} km/s (${isGain ? 'ORBITAL SPEED BOOST' : 'GRAVITATIONAL BRAKE'})`,
        16,
        sh - 20
      );
      sCtx.restore();

      // Upper-Right Compact Telemetry HUD Overlay
      const hudW = 160;
      const hudH = 100;
      const hudX = sw - hudW - 12;
      const hudY = 12;

      sCtx.save();
      sCtx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      sCtx.strokeStyle = '#DCE3EE';
      sCtx.lineWidth = 1;
      sCtx.beginPath();
      sCtx.roundRect(hudX, hudY, hudW, hudH, 8);
      sCtx.fill();
      sCtx.stroke();

      sCtx.font = 'bold 9px monospace';
      sCtx.fillStyle = '#64748B';
      sCtx.fillText('LIVE TELEMETRY', hudX + 10, hudY + 16);

      sCtx.font = '9px monospace';
      sCtx.fillStyle = '#1E293B';
      const timeHrs = (state.timeS / 3600).toFixed(1);
      sCtx.fillText(`TIME: ${timeHrs} hrs`, hudX + 10, hudY + 32);

      const distKm = (state.distanceFromCenterM / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 });
      sCtx.fillText(`DIST: ${distKm} km`, hudX + 10, hudY + 46);

      const altKm = (Math.max(0, state.altitudeM) / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 });
      sCtx.fillText(`ALT:  ${altKm} km`, hudX + 10, hudY + 60);

      sCtx.fillText(`v_rel: ${(state.speedPlanetMPerS / 1000).toFixed(1)} km/s`, hudX + 10, hudY + 74);

      sCtx.fillStyle = '#059669';
      sCtx.fillText(`v_sun: ${(state.speedSunMPerS / 1000).toFixed(1)} km/s`, hudX + 10, hudY + 88);
      sCtx.restore();

      sCtx.restore();
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [
    simResult,
    zoomMultiplier,
    planetPan,
    sunPan,
    onPlaybackIndexChange,
  ]);

  // Planet Canvas Drag Handlers
  const handlePlanetMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingPlanetRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePlanetMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingPlanetRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    setPlanetPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handlePlanetMouseUp = () => {
    isDraggingPlanetRef.current = false;
  };

  // Sun Canvas Drag Handlers
  const handleSunMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingSunRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleSunMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingSunRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    setSunPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handleSunMouseUp = () => {
    isDraggingSunRef.current = false;
  };

  return (
    <div className="w-full flex flex-col gap-6 select-none font-sans">
      {/* 1. Header with Centered Title & View Selector */}
      <div className="w-full flex flex-col items-center justify-center gap-3 py-2">
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#263247] uppercase text-center">
          Gravity Assist Sandbox
        </h2>
        
        {/* View Mode Selector (2D Default vs 3D Optional) */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#DCE3EE] shadow-xs">
          <button
            onClick={() => onChangeViewportMode('2D')}
            className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewportMode === '2D'
                ? 'bg-[#10B981] text-white shadow-xs'
                : 'text-[#68758A] hover:text-[#263247] hover:bg-[#F0F4FA]'
            }`}
          >
            <Compass size={14} />
            2D Simulation
          </button>
          <button
            onClick={() => onChangeViewportMode('3D')}
            className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewportMode === '3D'
                ? 'bg-[#10B981] text-white shadow-xs'
                : 'text-[#68758A] hover:text-[#263247] hover:bg-[#F0F4FA]'
            }`}
          >
            <Layers size={14} />
            3D Simulation
          </button>
        </div>
      </div>

      {/* 2. Top Control Panel: Two Columns on Desktop */}
      <div className="w-full bg-white border border-[#DCE3EE] rounded-xl p-5 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Trajectory Parameters */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#EEF2F8] pb-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#263247]">
              Trajectory Parameters
            </span>
            <span className="text-[11px] font-mono text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-md font-bold">
              TARGET: {scenario.planet.name.toUpperCase()}
            </span>
          </div>

          <div className="flex flex-col gap-3.5">
            {/* v0: Planet Velocity */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-[#68758A]">
                  <strong className="text-[#263247]">v₀</strong> (planet velocity)
                </span>
                <span className="font-bold text-[#10B981]">{v0KmS.toFixed(1)} km/s</span>
              </div>
              <input
                type="range"
                min="5.0"
                max="60.0"
                step="0.2"
                value={v0KmS}
                onChange={(e) => handleV0Change(parseFloat(e.target.value))}
                className="w-full accent-[#10B981] cursor-pointer h-1.5 bg-[#EEF2F8] rounded-lg"
              />
            </div>

            {/* v_inf: Incoming Spacecraft Velocity */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-[#68758A]">
                  <strong className="text-[#263247]">v_∞</strong> (incoming probe velocity)
                </span>
                <span className="font-bold text-[#0284C7]">{vInfKmS.toFixed(1)} km/s</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="40.0"
                step="0.2"
                value={vInfKmS}
                onChange={(e) => handleVInfChange(parseFloat(e.target.value))}
                className="w-full accent-[#0284C7] cursor-pointer h-1.5 bg-[#EEF2F8] rounded-lg"
              />
            </div>

            {/* theta: Approach Direction / Angle */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-[#68758A]">
                  <strong className="text-[#263247]">θ</strong> (approach direction)
                </span>
                <span className="font-bold text-[#7C3AED]">{thetaDeg.toFixed(1)}°</span>
              </div>
              <input
                type="range"
                min="-90.0"
                max="90.0"
                step="1.0"
                value={thetaDeg}
                onChange={(e) => handleThetaChange(parseFloat(e.target.value))}
                className="w-full accent-[#7C3AED] cursor-pointer h-1.5 bg-[#EEF2F8] rounded-lg"
              />
            </div>

            {/* b: Impact Parameter */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-[#68758A]">
                  <strong className="text-[#263247]">b</strong> (impact parameter)
                </span>
                <span className="font-bold text-[#F59E0B]">
                  {bKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
                </span>
              </div>
              <input
                type="range"
                min={(scenario.planet.radiusM * 1.1) / 1000.0}
                max={(scenario.planet.radiusM * 16.0) / 1000.0}
                step="500"
                value={bKm}
                onChange={(e) => handleBChange(parseFloat(e.target.value))}
                className="w-full accent-[#F59E0B] cursor-pointer h-1.5 bg-[#EEF2F8] rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Right Column: View & Animation */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#EEF2F8] pb-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#263247]">
              View & Animation
            </span>
            <span className="text-[11px] font-mono text-[#68758A]">
              STATUS: {isPlaying ? 'RUNNING' : 'PAUSED'}
            </span>
          </div>

          <div className="flex flex-col gap-3.5">
            {/* Zoom Slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-[#68758A]">Zoom level</span>
                <span className="font-bold text-[#263247]">{zoomMultiplier.toFixed(2)}x</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoomMultiplier((z) => Math.max(0.3, z - 0.2))}
                  className="p-1 rounded bg-[#EEF2F8] hover:bg-[#E2E8F0] text-[#263247] cursor-pointer transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                </button>
                <input
                  type="range"
                  min="0.3"
                  max="4.0"
                  step="0.05"
                  value={zoomMultiplier}
                  onChange={(e) => setZoomMultiplier(parseFloat(e.target.value))}
                  className="flex-1 accent-[#263247] cursor-pointer h-1.5 bg-[#EEF2F8] rounded-lg"
                />
                <button
                  onClick={() => setZoomMultiplier((z) => Math.min(4.0, z + 0.2))}
                  className="p-1 rounded bg-[#EEF2F8] hover:bg-[#E2E8F0] text-[#263247] cursor-pointer transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                </button>
              </div>
            </div>

            {/* Animation Speed Slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-[#68758A]">Animation speed</span>
                <span className="font-bold text-[#263247]">{playbackSpeed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.25"
                max="5.0"
                step="0.25"
                value={playbackSpeed}
                onChange={(e) => onChangePlaybackSpeed(parseFloat(e.target.value))}
                className="w-full accent-[#263247] cursor-pointer h-1.5 bg-[#EEF2F8] rounded-lg"
              />
            </div>

            {/* Checkbox: Enable Animation */}
            <label className="flex items-center gap-2.5 pt-1 cursor-pointer text-xs font-mono select-none">
              <input
                type="checkbox"
                checked={isPlaying}
                onChange={onTogglePlay}
                className="w-4 h-4 rounded text-[#10B981] accent-[#10B981] cursor-pointer"
              />
              <span className="text-[#263247] font-bold">Enable Animation</span>
            </label>

            {/* Clear Playback Controls */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={onTogglePlay}
                className={`px-4 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors ${
                  isPlaying
                    ? 'bg-[#EEF2F8] hover:bg-[#E2E8F0] text-[#263247]'
                    : 'bg-[#10B981] hover:bg-[#059669] text-white'
                }`}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>

              <button
                onClick={onReset}
                className="px-4 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 bg-[#EEF2F8] hover:bg-[#E2E8F0] text-[#263247] cursor-pointer shadow-xs transition-colors"
              >
                <RotateCcw size={14} />
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Simulation Area: Dual Side-by-Side Plotting Panels */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Panel: Planet Frame */}
        <div className="w-full flex flex-col bg-white border border-[#DCE3EE] rounded-xl shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#EEF2F8] bg-[#F8FAFC]">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
              <span className="font-bold text-[#263247]">Planet Frame</span>
              <span className="text-[10px] bg-[#EFF6FF] text-[#1E40AF] px-1.5 py-0.5 rounded font-bold">
                ||v_∞|| CONSERVED
              </span>
            </div>

            <button
              onClick={handleResetPlanetView}
              className="text-[11px] font-mono text-[#68758A] hover:text-[#263247] flex items-center gap-1 bg-white px-2 py-1 rounded border border-[#DCE3EE] shadow-2xs transition-colors cursor-pointer"
              title="Reset Planet Center View"
            >
              <Maximize2 size={11} />
              Center
            </button>
          </div>

          <div className="relative w-full h-[500px]">
            <canvas
              ref={planetCanvasRef}
              onMouseDown={handlePlanetMouseDown}
              onMouseMove={handlePlanetMouseMove}
              onMouseUp={handlePlanetMouseUp}
              onMouseLeave={handlePlanetMouseUp}
              className="w-full h-full cursor-grab active:cursor-grabbing block"
            />
          </div>
        </div>

        {/* Right Panel: Sun Frame */}
        <div className="w-full flex flex-col bg-white border border-[#DCE3EE] rounded-xl shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#EEF2F8] bg-[#F8FAFC]">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
              <span className="font-bold text-[#263247]">Sun Frame</span>
              <span className="text-[10px] bg-[#ECFDF5] text-[#065F46] px-1.5 py-0.5 rounded font-bold">
                MOMENTUM TRANSFER
              </span>
            </div>

            <button
              onClick={handleResetSunView}
              className="text-[11px] font-mono text-[#68758A] hover:text-[#263247] flex items-center gap-1 bg-white px-2 py-1 rounded border border-[#DCE3EE] shadow-2xs transition-colors cursor-pointer"
              title="Reset Sun Frame View"
            >
              <Maximize2 size={11} />
              Center
            </button>
          </div>

          <div className="relative w-full h-[500px]">
            <canvas
              ref={sunCanvasRef}
              onMouseDown={handleSunMouseDown}
              onMouseMove={handleSunMouseMove}
              onMouseUp={handleSunMouseUp}
              onMouseLeave={handleSunMouseUp}
              className="w-full h-full cursor-grab active:cursor-grabbing block"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
