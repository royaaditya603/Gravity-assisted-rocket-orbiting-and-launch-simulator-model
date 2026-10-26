import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  FlybySimulationResult,
  ReferenceFrame,
  TrajectoryPoint,
} from '../../../physics/FlybyEngine';
import { ViewFrameMode } from '../controls/FlybySimulationToolbar';
import { TrajectoryInterpolator, InterpolatedState } from './TrajectoryInterpolator';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  Compass,
  Eye,
  Orbit,
  Box,
  Layers,
  Sparkles,
} from 'lucide-react';

export interface Flyby2DCanvasProps {
  simResult: FlybySimulationResult;
  currentPlaybackIndex: number;
  referenceFrame: ReferenceFrame;
  showVectors?: boolean;
  showTrajectoryTrail?: boolean;
  isPlaying?: boolean;
  playbackSpeed?: number;
  onPlaybackIndexChange?: (index: number) => void;
  onReferenceFrameChange?: (frame: ViewFrameMode) => void;
  viewportMode?: '2D' | '3D';
  onChangeViewportMode?: (mode: '2D' | '3D') => void;
  title?: string;
  heightClass?: string;
  isClockMaster?: boolean;
}

export const Flyby2DCanvas: React.FC<Flyby2DCanvasProps> = ({
  simResult,
  currentPlaybackIndex,
  referenceFrame,
  showVectors = true,
  showTrajectoryTrail = true,
  isPlaying = false,
  playbackSpeed = 1.0,
  onPlaybackIndexChange,
  onReferenceFrameChange,
  viewportMode = '2D',
  onChangeViewportMode,
  title,
  heightClass = 'h-[580px]',
  isClockMaster = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // High-precision Hermite Trajectory Interpolator
  const interpolatorRef = useRef<TrajectoryInterpolator | null>(null);
  useEffect(() => {
    if (simResult && simResult.trajectory.length > 0) {
      interpolatorRef.current = new TrajectoryInterpolator(simResult);
    } else {
      interpolatorRef.current = null;
    }
  }, [simResult]);

  // Synchronize state with refs to prevent teardown in 60 FPS animation loop
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const isClockMasterRef = useRef(isClockMaster);
  isClockMasterRef.current = isClockMaster;

  const lastEmittedIndexRef = useRef<number>(-1);

  // Viewport Pan & Zoom Transform (world meters to canvas pixels)
  // (panX, panY) is the canvas offset from center (0, 0)
  // scale is pixels per meter
  const [scale, setScale] = useState<number>(1e-6);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [trackingMode, setTrackingMode] = useState<'FREE' | 'CENTER_PLANET' | 'FOLLOW_SPACECRAFT'>('CENTER_PLANET');

  // Visual toggles
  const [showGravityRings, setShowGravityRings] = useState<boolean>(true);
  const [showPeriapsisBadge, setShowPeriapsisBadge] = useState<boolean>(true);
  const [localVectors, setLocalVectors] = useState<boolean>(showVectors);

  // Sync external prop changes
  useEffect(() => {
    setLocalVectors(showVectors);
  }, [showVectors]);

  // Mouse / Touch Drag State
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Playback Clock (smooth continuous seconds)
  const currentTimeSRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);
  const animFrameIdRef = useRef<number>(0);

  // Sync with currentPlaybackIndex when user seeks externally (prevents continuous clock snapping)
  useEffect(() => {
    if (simResult && simResult.trajectory.length > 0) {
      if (isPlayingRef.current && isClockMasterRef.current && currentPlaybackIndex === lastEmittedIndexRef.current) {
        return;
      }
      const idx = Math.min(Math.max(0, currentPlaybackIndex), simResult.trajectory.length - 1);
      const targetTimeS = simResult.trajectory[idx].timeS;
      if (!isPlayingRef.current || Math.abs(currentTimeSRef.current - targetTimeS) > 3.0) {
        currentTimeSRef.current = targetTimeS;
      }
    }
  }, [currentPlaybackIndex, simResult]);

  // Derive whether this view is Sun-relative heliocentric
  const isSunFrame = referenceFrame === 'HELIOCENTRIC';

  // Compute Auto-Fit Bounding Box
  const fitToTrajectory = useCallback(() => {
    const container = containerRef.current;
    if (!container || !simResult || simResult.trajectory.length === 0) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 580;

    const traj = simResult.trajectory;
    const originPlanet = traj[0].planetPosSunM;
    const planetRadius = simResult.config.planet.radiusM;

    let minX = -planetRadius * 1.5;
    let maxX = planetRadius * 1.5;
    let minY = -planetRadius * 1.5;
    let maxY = planetRadius * 1.5;

    for (let i = 0; i < traj.length; i += Math.max(1, Math.floor(traj.length / 100))) {
      const pt = traj[i];
      const wx = isSunFrame ? pt.posSunM.x - originPlanet.x : pt.posPlanetM.x;
      const wy = isSunFrame ? pt.posSunM.y - originPlanet.y : pt.posPlanetM.y;

      if (wx < minX) minX = wx;
      if (wx > maxX) maxX = wx;
      if (wy < minY) minY = wy;
      if (wy > maxY) maxY = wy;

      if (isSunFrame) {
        const px = pt.planetPosSunM.x - originPlanet.x;
        const py = pt.planetPosSunM.y - originPlanet.y;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }

    const spanX = Math.max(planetRadius * 4, maxX - minX);
    const spanY = Math.max(planetRadius * 4, maxY - minY);

    const fitScaleX = (width * 0.8) / spanX;
    const fitScaleY = (height * 0.8) / spanY;
    const newScale = Math.min(fitScaleX, fitScaleY);

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    setScale(newScale);
    setPan({
      x: -midX * newScale,
      y: midY * newScale,
    });
    setTrackingMode('FREE');
  }, [simResult, isSunFrame]);

  // Initial fit on scenario change
  useEffect(() => {
    fitToTrajectory();
  }, [simResult, fitToTrajectory]);

  // Zoom helpers
  const handleZoom = (factor: number) => {
    setScale((prev) => {
      const next = Math.max(1e-12, Math.min(1e-2, prev * factor));
      return next;
    });
  };

  // Center on Planet
  const handleCenterPlanet = () => {
    setTrackingMode('CENTER_PLANET');
    setPan({ x: 0, y: 0 });
  };

  // Follow Spacecraft
  const handleFollowSpacecraft = () => {
    setTrackingMode('FOLLOW_SPACECRAFT');
  };

  // Mouse / Touch Event Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    setTrackingMode('FREE');
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    setPan((prev) => ({
      x: prev.x + dx,
      y: prev.y + dy,
    }));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - canvas.clientWidth / 2;
    const mouseY = e.clientY - rect.top - canvas.clientHeight / 2;

    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;

    setScale((prevScale) => {
      const nextScale = Math.max(1e-12, Math.min(1e-2, prevScale * factor));
      const scaleRatio = nextScale / prevScale;

      setPan((prevPan) => ({
        x: mouseX - (mouseX - prevPan.x) * scaleRatio,
        y: mouseY - (mouseY - prevPan.y) * scaleRatio,
      }));

      return nextScale;
    });
    setTrackingMode('FREE');
  };

  // Main 2D Drawing & Continuous Interpolation Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let lastTime = performance.now();

    const render = () => {
      animFrameIdRef.current = requestAnimationFrame(render);

      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000.0);
      lastTime = now;

      const interpolator = interpolatorRef.current;
      if (!interpolator || !simResult || simResult.trajectory.length === 0) return;

      const totalDuration = interpolator.getTotalDurationS();

      // 1. Advance playback clock if playing
      if (isPlaying) {
        const timeAdvance = (totalDuration / 20.0) * playbackSpeed * dt;
        currentTimeSRef.current += timeAdvance;

        if (currentTimeSRef.current >= totalDuration) {
          if (simResult.collisionDetected) {
            currentTimeSRef.current = simResult.collisionTimeS ?? totalDuration;
          } else {
            currentTimeSRef.current = 0;
          }
        }

        // Throttled parent sync (~25 Hz)
        if (isClockMasterRef.current && now - lastSyncTimeRef.current > 40 && onPlaybackIndexChange) {
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

      // 2. Continuous Hermite State Evaluation
      const state: InterpolatedState = interpolator.evaluateAtTime(currentTimeSRef.current);

      // Handle HiDPI
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // World-to-Canvas Transform Helpers
      const cx = width / 2 + pan.x;
      const cy = height / 2 + pan.y;

      const originPlanet = simResult.trajectory[0].planetPosSunM;

      const toScreenX = (wx: number) => cx + wx * scale;
      const toScreenY = (wy: number) => cy - wy * scale; // Cartesian y-up

      // Update Follow Spacecraft if enabled
      if (trackingMode === 'FOLLOW_SPACECRAFT') {
        const scX = isSunFrame ? state.posSunM.x - originPlanet.x : state.posPlanetM.x;
        const scY = isSunFrame ? state.posSunM.y - originPlanet.y : state.posPlanetM.y;
        setPan({
          x: -scX * scale,
          y: scY * scale,
        });
      } else if (trackingMode === 'CENTER_PLANET') {
        const pX = isSunFrame ? state.planetPosSunM.x - originPlanet.x : 0;
        const pY = isSunFrame ? state.planetPosSunM.y - originPlanet.y : 0;
        setPan({
          x: -pX * scale,
          y: pY * scale,
        });
      }

      // 3. Clear Screen (Pastel Clean White/Light Theme)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // 4. Subtle Background Coordinate Grid
      ctx.strokeStyle = '#F0F4FA';
      ctx.lineWidth = 1;
      const gridSize = 50;
      const startX = cx % gridSize;
      const startY = cy % gridSize;

      ctx.beginPath();
      for (let x = startX; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = startY; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Axis crosshair at origin
      ctx.strokeStyle = '#DCE3EE';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy);
      ctx.lineTo(cx + 15, cy);
      ctx.moveTo(cx, cy - 15);
      ctx.lineTo(cx, cy + 15);
      ctx.stroke();

      // Active Planet Location
      const planetX = isSunFrame ? state.planetPosSunM.x - originPlanet.x : 0;
      const planetY = isSunFrame ? state.planetPosSunM.y - originPlanet.y : 0;
      const planetScreenX = toScreenX(planetX);
      const planetScreenY = toScreenY(planetY);
      const planetRadiusM = simResult.config.planet.radiusM;
      const planetRadiusPx = Math.max(3, planetRadiusM * scale);

      // 5. Gravitational Influence & Equipotential Circles
      if (showGravityRings && planetRadiusPx > 1.5) {
        const rings = [1.5, 3.0, 6.0, 10.0];
        ctx.save();
        ctx.setLineDash([4, 4]);

        rings.forEach((mul) => {
          const rPx = planetRadiusPx * mul;
          if (rPx < width * 2) {
            ctx.strokeStyle = 'rgba(141, 191, 240, 0.45)';
            ctx.fillStyle = 'rgba(141, 191, 240, 0.02)';
            ctx.beginPath();
            ctx.arc(planetScreenX, planetScreenY, rPx, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Distance label
            ctx.font = '9px monospace';
            ctx.fillStyle = '#68758A';
            ctx.fillText(`${mul}Rp`, planetScreenX + rPx + 4, planetScreenY - 3);
          }
        });
        ctx.restore();
      }

      // 6. Closest Approach (Periapsis) Line & Marker
      const periapsisM = simResult.closestApproach.positionPlanetM;
      const periapsisSunM = simResult.closestApproach.positionSunM;
      const periX = isSunFrame ? periapsisSunM.x - originPlanet.x : periapsisM.x;
      const periY = isSunFrame ? periapsisSunM.y - originPlanet.y : periapsisM.y;
      const periScreenX = toScreenX(periX);
      const periScreenY = toScreenY(periY);

      if (showPeriapsisBadge) {
        // Dashed connection to planet center
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(planetScreenX, planetScreenY);
        ctx.lineTo(periScreenX, periScreenY);
        ctx.stroke();
        ctx.restore();

        // Periapsis Diamond Marker
        ctx.save();
        ctx.fillStyle = '#F59E0B';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        const diamondSize = 6;
        ctx.beginPath();
        ctx.moveTo(periScreenX, periScreenY - diamondSize);
        ctx.lineTo(periScreenX + diamondSize, periScreenY);
        ctx.lineTo(periScreenX, periScreenY + diamondSize);
        ctx.lineTo(periScreenX - diamondSize, periScreenY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Periapsis Label
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#7A3E1D';
        const rpKm = (simResult.closestApproach.distanceM / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 });
        const altKm = (simResult.closestApproach.altitudeM / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 });
        ctx.fillText(`PERIAPSIS: r_p = ${rpKm} km (Alt: ${altKm} km)`, periScreenX + 10, periScreenY + 3);
        ctx.restore();
      }

      // 7. Trajectories (Incoming: Pastel Blue, Outgoing: Pastel Lavender)
      const traj = simResult.trajectory;
      const periIndex = traj.findIndex((p) => p.timeS >= simResult.closestApproach.timeS) || Math.floor(traj.length / 2);

      // Incoming Segment
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = '#4A90E2'; // High-contrast pastel blue
      ctx.lineWidth = 2.5;
      for (let i = 0; i <= periIndex; i++) {
        const pt = traj[i];
        const wx = isSunFrame ? pt.posSunM.x - originPlanet.x : pt.posPlanetM.x;
        const wy = isSunFrame ? pt.posSunM.y - originPlanet.y : pt.posPlanetM.y;
        const sx = toScreenX(wx);
        const sy = toScreenY(wy);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // Outgoing Segment
      ctx.beginPath();
      ctx.strokeStyle = '#7B61FF'; // High-contrast pastel lavender
      ctx.lineWidth = 2.5;
      for (let i = periIndex; i < traj.length; i++) {
        const pt = traj[i];
        const wx = isSunFrame ? pt.posSunM.x - originPlanet.x : pt.posPlanetM.x;
        const wy = isSunFrame ? pt.posSunM.y - originPlanet.y : pt.posPlanetM.y;
        const sx = toScreenX(wx);
        const sy = toScreenY(wy);
        if (i === periIndex) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.restore();

      // 8. Planet Body & Physical Surface Ring
      ctx.save();
      // Drop Shadow
      ctx.shadowColor = 'rgba(38, 50, 71, 0.15)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 4;

      // Radial gradient for clean pastel sphere
      const planetGrad = ctx.createRadialGradient(
        planetScreenX - planetRadiusPx * 0.3,
        planetScreenY - planetRadiusPx * 0.3,
        planetRadiusPx * 0.1,
        planetScreenX,
        planetScreenY,
        planetRadiusPx
      );
      planetGrad.addColorStop(0, '#FFFFFF');
      planetGrad.addColorStop(0.3, '#A9D4F5');
      planetGrad.addColorStop(1, '#8DBFF0');

      ctx.fillStyle = planetGrad;
      ctx.beginPath();
      ctx.arc(planetScreenX, planetScreenY, planetRadiusPx, 0, Math.PI * 2);
      ctx.fill();

      // Atmosphere / Surface Rim
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#60A5FA';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Physical surface radius indicator
      ctx.strokeStyle = 'rgba(30, 64, 175, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(planetScreenX, planetScreenY, planetRadiusPx, 0, Math.PI * 2);
      ctx.stroke();

      // Planet Label
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#263247';
      const pName = simResult.config.planet.name.toUpperCase();
      ctx.fillText(pName, planetScreenX + planetRadiusPx + 8, planetScreenY + 4);
      ctx.restore();

      // 9. Spacecraft Probe & Heading
      const scX = isSunFrame ? state.posSunM.x - originPlanet.x : state.posPlanetM.x;
      const scY = isSunFrame ? state.posSunM.y - originPlanet.y : state.posPlanetM.y;
      const scScreenX = toScreenX(scX);
      const scScreenY = toScreenY(scY);

      const vel = isSunFrame ? state.velSunM : state.velPlanetM;
      const speed = isSunFrame ? state.speedSunMPerS : state.speedPlanetMPerS;
      const headingAngle = Math.atan2(-vel.y, vel.x); // Canvas inverted Y

      ctx.save();
      ctx.translate(scScreenX, scScreenY);

      // Spacecraft Direction Indicator
      ctx.rotate(headingAngle);

      // Solar Wings
      ctx.fillStyle = '#8DBFF0';
      ctx.fillRect(-2, -9, 4, 18);

      // Central Body (Pastel Peach)
      ctx.fillStyle = '#F4B58C';
      ctx.strokeStyle = '#D97736';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-6, -5);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-6, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      // 10. Velocity & Acceleration Vectors
      if (localVectors && speed > 10.0) {
        ctx.save();
        // Velocity Vector Arrow (Mint/Emerald)
        const velLenPx = Math.min(75, Math.max(25, (speed / 1000) * 2.2));
        const vEndX = scScreenX + Math.cos(headingAngle) * velLenPx;
        const vEndY = scScreenY + Math.sin(headingAngle) * velLenPx;

        ctx.strokeStyle = '#10B981';
        ctx.fillStyle = '#10B981';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(scScreenX, scScreenY);
        ctx.lineTo(vEndX, vEndY);
        ctx.stroke();

        // Arrow head
        const arrowHead = 7;
        ctx.beginPath();
        ctx.moveTo(vEndX, vEndY);
        ctx.lineTo(
          vEndX - arrowHead * Math.cos(headingAngle - Math.PI / 6),
          vEndY - arrowHead * Math.sin(headingAngle - Math.PI / 6)
        );
        ctx.lineTo(
          vEndX - arrowHead * Math.cos(headingAngle + Math.PI / 6),
          vEndY - arrowHead * Math.sin(headingAngle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        // Vector label
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#065F46';
        ctx.fillText(`v = ${(speed / 1000).toFixed(1)} km/s`, vEndX + 6, vEndY - 2);

        // Gravitational Acceleration Vector (Purple pointing towards planet)
        const toPlanetAngle = Math.atan2(planetScreenY - scScreenY, planetScreenX - scScreenX);
        const gravLenPx = 30;
        const gEndX = scScreenX + Math.cos(toPlanetAngle) * gravLenPx;
        const gEndY = scScreenY + Math.sin(toPlanetAngle) * gravLenPx;

        ctx.strokeStyle = '#8B5CF6';
        ctx.fillStyle = '#8B5CF6';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(scScreenX, scScreenY);
        ctx.lineTo(gEndX, gEndY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(gEndX, gEndY);
        ctx.lineTo(
          gEndX - 5 * Math.cos(toPlanetAngle - Math.PI / 6),
          gEndY - 5 * Math.sin(toPlanetAngle - Math.PI / 6)
        );
        ctx.lineTo(
          gEndX - 5 * Math.cos(toPlanetAngle + Math.PI / 6),
          gEndY - 5 * Math.sin(toPlanetAngle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        // Planet Velocity Vector in Sun-Relative Frame (Pastel Mint)
        if (isSunFrame) {
          const pVel = state.planetVelSunM;
          const pSpeed = pVel.length();
          if (pSpeed > 10.0) {
            const pAngle = Math.atan2(-pVel.y, pVel.x);
            const pLenPx = 55;
            const pvEndX = planetScreenX + Math.cos(pAngle) * pLenPx;
            const pvEndY = planetScreenY + Math.sin(pAngle) * pLenPx;

            ctx.strokeStyle = '#059669';
            ctx.fillStyle = '#059669';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(planetScreenX, planetScreenY);
            ctx.lineTo(pvEndX, pvEndY);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(pvEndX, pvEndY);
            ctx.lineTo(
              pvEndX - 6 * Math.cos(pAngle - Math.PI / 6),
              pvEndY - 6 * Math.sin(pAngle - Math.PI / 6)
            );
            ctx.lineTo(
              pvEndX - 6 * Math.cos(pAngle + Math.PI / 6),
              pvEndY - 6 * Math.sin(pAngle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();

            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = '#065F46';
            ctx.fillText(`v_p = ${(pSpeed / 1000).toFixed(1)} km/s`, pvEndX + 6, pvEndY - 2);
          }
        }
        ctx.restore();
      }

      // 11. Collision Impact Indicator (if collided)
      if (simResult.collisionDetected && state.isTerminalImpact) {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.beginPath();
        ctx.arc(scScreenX, scScreenY, 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#EF4444';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(scScreenX, scScreenY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#991B1B';
        ctx.fillText('COLLISION DETECTED // SURFACE IMPACT', scScreenX + 12, scScreenY + 4);
        ctx.restore();
      }

      // 12. Dynamic Distance Scale Bar (Bottom Right)
      ctx.save();
      const targetBarPx = 100;
      const rawDistanceM = targetBarPx / scale;
      // Round to neat magnitude (10k, 50k, 100k, 500k km)
      const distKm = rawDistanceM / 1000;
      const magnitude = Math.pow(10, Math.floor(Math.log10(distKm)));
      const normalized = distKm / magnitude;
      let roundNormalized = 1;
      if (normalized >= 5) roundNormalized = 5;
      else if (normalized >= 2) roundNormalized = 2;

      const roundDistKm = roundNormalized * magnitude;
      const barPx = (roundDistKm * 1000) * scale;

      const barX = width - barPx - 24;
      const barY = height - 20;

      ctx.strokeStyle = '#68758A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(barX, barY - 4);
      ctx.lineTo(barX, barY);
      ctx.lineTo(barX + barPx, barY);
      ctx.lineTo(barX + barPx, barY - 4);
      ctx.stroke();

      ctx.font = '10px monospace';
      ctx.fillStyle = '#68758A';
      ctx.textAlign = 'center';
      ctx.fillText(`${roundDistKm.toLocaleString()} km`, barX + barPx / 2, barY - 6);
      ctx.restore();

      ctx.restore();
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [
    simResult,
    isPlaying,
    playbackSpeed,
    pan,
    scale,
    trackingMode,
    isSunFrame,
    showGravityRings,
    showPeriapsisBadge,
    localVectors,
    onPlaybackIndexChange,
  ]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${heightClass} bg-white rounded-xl border border-[#DCE3EE] shadow-xs overflow-hidden select-none`}
    >
      {/* Interactive HTML5 2D Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Top Bar: Viewport Mode Switcher (2D Default vs 3D Optional) & Frame Title */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Title & Reference Frame Pill */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#DCE3EE] shadow-xs text-xs font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
            <span className="font-bold text-[#263247]">
              {title || (isSunFrame ? 'SUN-RELATIVE HELIOCENTRIC FRAME' : 'PLANET-CENTRIC REST FRAME')}
            </span>
            <span className="text-[10px] text-[#68758A] bg-[#EEF2F8] px-1.5 py-0.5 rounded-md font-bold">
              2D ORBITAL PLANE
            </span>
          </div>

          {/* Reference Frame Switcher */}
          {onReferenceFrameChange && (
            <div className="flex items-center gap-0.5 bg-white/95 backdrop-blur-md p-0.5 rounded-lg border border-[#DCE3EE] shadow-xs text-xs font-mono">
              <button
                onClick={() => onReferenceFrameChange('PLANET_CENTRIC')}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  !isSunFrame
                    ? 'bg-[#FFD2B8] text-[#7A3E1D] shadow-2xs'
                    : 'text-[#68758A] hover:text-[#263247]'
                }`}
              >
                PLANET-CENTRIC
              </button>
              <button
                onClick={() => onReferenceFrameChange('HELIOCENTRIC')}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  isSunFrame
                    ? 'bg-[#A9D4F5] text-[#14426B] shadow-2xs'
                    : 'text-[#68758A] hover:text-[#263247]'
                }`}
              >
                HELIOCENTRIC
              </button>
            </div>
          )}
        </div>

        {/* Top-Right: 2D Default vs 3D Optional View Selector */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {onChangeViewportMode && (
            <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-lg border border-[#DCE3EE] shadow-xs font-mono text-xs">
              <button
                onClick={() => onChangeViewportMode('2D')}
                className={`px-3 py-1 rounded-md font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewportMode === '2D'
                    ? 'bg-[#AEE5D0] text-[#1D6C50] shadow-xs'
                    : 'text-[#68758A] hover:text-[#263247]'
                }`}
                title="Primary lightweight 2D orbital visualization"
              >
                <Orbit size={13} className="text-[#1D6C50]" />
                <span>2D — DEFAULT</span>
              </button>
              <button
                onClick={() => onChangeViewportMode('3D')}
                className={`px-3 py-1 rounded-md font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewportMode === '3D'
                    ? 'bg-[#C9BDF2] text-[#4A347F] shadow-xs'
                    : 'text-[#68758A] hover:text-[#263247]'
                }`}
                title="Switch to detailed Three.js 3D perspective"
              >
                <Box size={13} className="text-[#8B5CF6]" />
                <span>3D — OPTIONAL</span>
              </button>
            </div>
          )}

          {/* Quick Zoom / Fit Buttons */}
          <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-lg border border-[#DCE3EE] shadow-xs text-xs font-mono">
            <button
              onClick={() => handleZoom(1.25)}
              className="p-1 hover:bg-[#EEF2F8] rounded text-[#263247] cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={() => handleZoom(0.8)}
              className="p-1 hover:bg-[#EEF2F8] rounded text-[#263247] cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={fitToTrajectory}
              className="p-1 hover:bg-[#EEF2F8] rounded text-[#263247] cursor-pointer"
              title="Fit Entire Trajectory to Viewport"
            >
              <Maximize2 size={14} />
            </button>
            <button
              onClick={handleCenterPlanet}
              className={`p-1 rounded cursor-pointer ${
                trackingMode === 'CENTER_PLANET' ? 'bg-[#A9D4F5] text-[#14426B]' : 'hover:bg-[#EEF2F8] text-[#263247]'
              }`}
              title="Center View on Planet"
            >
              <Crosshair size={14} />
            </button>
            <button
              onClick={handleFollowSpacecraft}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                trackingMode === 'FOLLOW_SPACECRAFT'
                  ? 'bg-[#C9BDF2] text-[#4A347F]'
                  : 'hover:bg-[#EEF2F8] text-[#68758A]'
              }`}
              title="Follow Spacecraft Continuously"
            >
              FOLLOW
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Visual Toggles & Pastel Color Legend */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Pastel Color Legend */}
        <div className="flex flex-wrap items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#DCE3EE] shadow-xs text-[10px] font-mono text-[#263247] pointer-events-auto">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4A90E2]" />
            <span>INCOMING</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#7B61FF]" />
            <span>OUTGOING</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F4B58C] border border-[#D97736]" />
            <span>PROBE</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
            <span>PERIAPSIS</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
            <span>VELOCITY</span>
          </span>
        </div>

        {/* View Toggles */}
        <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-lg border border-[#DCE3EE] shadow-xs text-[10px] font-mono pointer-events-auto">
          <button
            onClick={() => setLocalVectors(!localVectors)}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
              localVectors ? 'bg-[#AEE5D0] text-[#1D6C50] font-bold' : 'text-[#68758A] hover:text-[#263247]'
            }`}
          >
            VECTORS
          </button>
          <button
            onClick={() => setShowGravityRings(!showGravityRings)}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
              showGravityRings ? 'bg-[#A9D4F5] text-[#14426B] font-bold' : 'text-[#68758A] hover:text-[#263247]'
            }`}
          >
            GRAVITY SOI
          </button>
          <button
            onClick={() => setShowPeriapsisBadge(!showPeriapsisBadge)}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
              showPeriapsisBadge ? 'bg-[#FFD2B8] text-[#7A3E1D] font-bold' : 'text-[#68758A] hover:text-[#263247]'
            }`}
          >
            PERIAPSIS
          </button>
        </div>
      </div>
    </div>
  );
};
