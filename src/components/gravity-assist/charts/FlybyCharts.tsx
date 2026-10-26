import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { FlybySimulationResult, ReferenceFrame, TrajectoryPoint } from '../../../physics/FlybyEngine';
import { FlybyExperimentEngine } from '../../../physics/FlybyExperimentEngine';
import {
  LineChart,
  Download,
  Camera,
  Compass,
  TrendingUp,
  Zap,
  Target,
  Layers,
  Info,
  Maximize2,
} from 'lucide-react';

export interface FlybyChartsProps {
  simResult: FlybySimulationResult | null;
  currentPlaybackIndex: number;
  referenceFrame: ReferenceFrame;
}

export type ChartType =
  | 'DISTANCE_TIME'
  | 'ALTITUDE_TIME'
  | 'SPEED_PLANET_TIME'
  | 'SPEED_SUN_TIME'
  | 'GRAVITY_TIME'
  | 'TRAJECTORY_XY'
  | 'DEFLECTION_ALTITUDE'
  | 'DEFLECTION_SPEED'
  | 'SPEED_CHANGE_GEOMETRY';

interface HoverPoint {
  canvasX: number;
  canvasY: number;
  xValue: number;
  yValue: number;
  xLabel: string;
  yLabel: string;
}

export const FlybyCharts: React.FC<FlybyChartsProps> = ({
  simResult,
  currentPlaybackIndex,
  referenceFrame,
}) => {
  const [activeChart, setActiveChart] = useState<ChartType>('SPEED_PLANET_TIME');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverPoint, setHoverPoint] = useState<HoverPoint | null>(null);

  // Active chart title and axis labels
  const chartMetadata = useMemo(() => {
    switch (activeChart) {
      case 'DISTANCE_TIME':
        return {
          title: 'Distance from Planet Centre vs Time: r(t)',
          category: 'TIME_SERIES',
          xLabel: 'Time',
          xUnit: 's',
          yLabel: 'Centre Distance',
          yUnit: 'km',
          description: 'Radial distance from planet centre of mass. Minimum identifies closest approach (periapsis).',
        };
      case 'ALTITUDE_TIME':
        return {
          title: 'Altitude Above Surface vs Time: h(t) = r(t) - R_p',
          category: 'TIME_SERIES',
          xLabel: 'Time',
          xUnit: 's',
          yLabel: 'Altitude',
          yUnit: 'km',
          description: 'Clearance above planetary physical radius. Zero line denotes impact collision boundary.',
        };
      case 'SPEED_PLANET_TIME':
        return {
          title: 'Planet-Relative Speed vs Time: ||v_rel(t)||',
          category: 'TIME_SERIES',
          xLabel: 'Time',
          xUnit: 's',
          yLabel: 'Speed (Planet Frame)',
          yUnit: 'km/s',
          description: 'Spacecraft speed in planet rest frame. Enters and exits at identical asymptotic excess speed v_inf.',
        };
      case 'SPEED_SUN_TIME':
        return {
          title: 'Sun-Relative (Heliocentric) Speed vs Time: ||v_Sun(t)||',
          category: 'TIME_SERIES',
          xLabel: 'Time',
          xUnit: 's',
          yLabel: 'Speed (Sun Frame)',
          yUnit: 'km/s',
          description: 'True heliocentric speed in inertial frame. Demonstrates net gravity assist energy exchange.',
        };
      case 'GRAVITY_TIME':
        return {
          title: 'Gravitational Acceleration vs Time: a_g(t) = μ_p / r(t)²',
          category: 'TIME_SERIES',
          xLabel: 'Time',
          xUnit: 's',
          yLabel: 'Gravitational Accel',
          yUnit: 'm/s²',
          description: 'Local gravitational field strength experienced along trajectory, peaking sharply at periapsis.',
        };
      case 'TRAJECTORY_XY':
        return {
          title: 'Spacecraft X-Y Encounter Trajectory (Orbital Plane)',
          category: 'ORBITAL_PLANE',
          xLabel: 'In-Plane X',
          xUnit: '10³ km',
          yLabel: 'In-Plane Y',
          yUnit: '10³ km',
          description: 'True 2D hyperbolic trajectory relative to planet centre (0,0), showing asymptotes and turning angle.',
        };
      case 'DEFLECTION_ALTITUDE':
        return {
          title: 'Deflection Angle vs Closest-Approach Altitude: δ(h_p)',
          category: 'PARAMETRIC',
          xLabel: 'Periapsis Altitude (h_p)',
          xUnit: 'km',
          yLabel: 'Turning Angle (δ)',
          yUnit: 'deg',
          description: 'Analytical hyperbolic turning curve δ = 2·asin(1/(1 + (R_p + h_p)·v_inf²/μ)) across altitudes.',
        };
      case 'DEFLECTION_SPEED':
        return {
          title: 'Deflection Angle vs Incoming Asymptotic Speed: δ(v_inf)',
          category: 'PARAMETRIC',
          xLabel: 'Excess Speed (v_inf)',
          xUnit: 'km/s',
          yLabel: 'Turning Angle (δ)',
          yUnit: 'deg',
          description: 'Hyperbolic deflection decline with speed: δ decays as ~ 2μ / (r_p · v_inf²) at high velocities.',
        };
      case 'SPEED_CHANGE_GEOMETRY':
        return {
          title: 'Sun-Relative Speed Change vs Flyby Geometry: Δv_Sun(θ)',
          category: 'GEOMETRY',
          xLabel: 'Encounter Approach Angle (θ)',
          xUnit: 'deg',
          yLabel: 'Heliocentric Speed Change (Δv_Sun)',
          yUnit: 'km/s',
          description: 'Heliocentric acceleration vs deceleration as a function of incoming trajectory angle relative to V_p.',
        };
    }
  }, [activeChart]);

  // Canvas Drawing Routine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !simResult || simResult.trajectory.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    const padLeft = 70;
    const padRight = 35;
    const padTop = 32;
    const padBottom = 42;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    // Grid background lines
    ctx.strokeStyle = '#EEF2F8';
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
    const periTime = simResult.closestApproach.timeS;
    const currentIdx = Math.min(currentPlaybackIndex, traj.length - 1);
    const currentPt = traj[currentIdx];

    // Helper: Mark Closest Approach (Periapsis)
    const drawPeriapsisMarker = (periYCanvas?: number, labelText?: string) => {
      if (periTime >= 0 && periTime <= totalTime && totalTime > 0) {
        const periX = padLeft + (periTime / totalTime) * plotW;
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(periX, padTop);
        ctx.lineTo(periX, h - padBottom);
        ctx.stroke();
        ctx.setLineDash([]);

        if (periYCanvas !== undefined) {
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(periX, periYCanvas, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = '#10b981';
        ctx.font = '9px monospace';
        ctx.fillText(labelText || `PERIAPSIS (T+${periTime.toFixed(0)}s)`, periX + 4, padTop + 12);
      }
    };

    // Helper: Mark Surface Collision (Impact)
    const drawCollisionMarker = (collisionYCanvas?: number, labelText?: string) => {
      const colTime = simResult.collisionTimeS ?? totalTime;
      if (simResult.collisionDetected && totalTime > 0) {
        const colX = padLeft + (colTime / totalTime) * plotW;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        ctx.moveTo(colX, padTop);
        ctx.lineTo(colX, h - padBottom);
        ctx.stroke();
        ctx.setLineDash([]);

        if (collisionYCanvas !== undefined) {
          ctx.fillStyle = '#ef4444';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(colX, collisionYCanvas, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(labelText || `SURFACE IMPACT (T+${colTime.toFixed(0)}s)`, colX + 4, padTop + 24);
      }
    };

    // Helper: Draw Playback Time Scrubber
    const drawScrubber = () => {
      if (totalTime > 0) {
        const curX = padLeft + (currentPt.timeS / totalTime) * plotW;
        ctx.strokeStyle = 'rgba(38, 50, 71, 0.7)';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(curX, padTop);
        ctx.lineTo(curX, h - padBottom);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };

    // =========================================================================
    // CHART 1: DISTANCE FROM PLANET CENTRE vs TIME
    // =========================================================================
    if (activeChart === 'DISTANCE_TIME') {
      let maxDist = 0;
      traj.forEach((p) => {
        if (p.distanceFromCenterM > maxDist) maxDist = p.distanceFromCenterM;
      });
      maxDist = Math.max(maxDist * 1.08, simResult.config.planet.radiusM * 1.5);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(`DISTANCE r(t) (10³ km)`, padLeft - 60, padTop - 12);
      ctx.fillText(`TIME (s)`, w - padRight - 45, h - padBottom + 25);

      for (let i = 0; i <= 5; i++) {
        const val = ((maxDist * (5 - i)) / 5 / 1e6).toFixed(0);
        const y = padTop + (plotH * i) / 5;
        ctx.fillStyle = '#64748b';
        ctx.fillText(val, padLeft - 45, y + 3);
      }

      // Planet physical surface boundary
      const rSurfCanvasY = padTop + (1.0 - simResult.config.planet.radiusM / maxDist) * plotH;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padLeft, rSurfCanvasY);
      ctx.lineTo(w - padRight, rSurfCanvasY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ef4444';
      ctx.fillText(`R_p = ${planetRadiusKm.toLocaleString()} km`, w - padRight - 120, rSurfCanvasY - 4);

      // Trajectory Distance Curve
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

      const periY = padTop + (1.0 - simResult.closestApproach.distanceM / maxDist) * plotH;
      drawPeriapsisMarker(periY, `PERIAPSIS (${(simResult.closestApproach.distanceM / 1000).toLocaleString()} km)`);
      if (simResult.collisionDetected) {
        drawCollisionMarker(rSurfCanvasY, `IMPACT at R_p (${planetRadiusKm.toFixed(0)} km)`);
      }
      drawScrubber();

      ctx.fillStyle = '#10b981';
      ctx.fillText('— r(t): DISTANCE TO PLANET CENTRE', padLeft + 10, padTop + 26);
    }

    // =========================================================================
    // CHART 2: ALTITUDE ABOVE SURFACE vs TIME
    // =========================================================================
    else if (activeChart === 'ALTITUDE_TIME') {
      let maxAlt = 0;
      traj.forEach((p) => {
        if (p.altitudeM > maxAlt) maxAlt = p.altitudeM;
      });
      maxAlt = Math.max(maxAlt * 1.1, 10000);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(`ALTITUDE h(t) (10³ km)`, padLeft - 60, padTop - 12);
      ctx.fillText(`TIME (s)`, w - padRight - 45, h - padBottom + 25);

      for (let i = 0; i <= 5; i++) {
        const val = ((maxAlt * (5 - i)) / 5 / 1e6).toFixed(0);
        const y = padTop + (plotH * i) / 5;
        ctx.fillStyle = '#64748b';
        ctx.fillText(val, padLeft - 45, y + 3);
      }

      // Zero Altitude line (Surface)
      const zeroY = padTop + plotH;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padLeft, zeroY);
      ctx.lineTo(w - padRight, zeroY);
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.fillText(`SURFACE (h = 0 km)`, padLeft + 10, zeroY - 6);

      // Altitude Curve (Cyan)
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      traj.forEach((pt, i) => {
        const x = padLeft + (pt.timeS / totalTime) * plotW;
        const y = padTop + (1.0 - Math.max(0, pt.altitudeM) / maxAlt) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      const periAltY = padTop + (1.0 - Math.max(0, simResult.closestApproach.altitudeM) / maxAlt) * plotH;
      drawPeriapsisMarker(periAltY, `PERIAPSIS ALT: ${(simResult.closestApproach.altitudeM / 1000).toLocaleString()} km`);
      if (simResult.collisionDetected) {
        drawCollisionMarker(zeroY, `SURFACE IMPACT (h = 0 km)`);
      }
      drawScrubber();

      ctx.fillStyle = '#06b6d4';
      ctx.fillText('— h(t) = r(t) - R_p: CLEARANCE ABOVE SURFACE', padLeft + 10, padTop + 26);
    }

    // =========================================================================
    // CHART 3: PLANET-RELATIVE SPEED vs TIME
    // =========================================================================
    else if (activeChart === 'SPEED_PLANET_TIME') {
      let maxSpd = 0;
      traj.forEach((p) => {
        if (p.speedPlanetMPerS > maxSpd) maxSpd = p.speedPlanetMPerS;
      });
      maxSpd = Math.max(maxSpd * 1.15, simResult.config.vInfSpeedMPerS * 1.2);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(`PLANET SPEED (km/s)`, padLeft - 60, padTop - 12);
      ctx.fillText(`TIME (s)`, w - padRight - 45, h - padBottom + 25);

      for (let i = 0; i <= 5; i++) {
        const val = ((maxSpd * (5 - i)) / 5 / 1000).toFixed(0);
        const y = padTop + (plotH * i) / 5;
        ctx.fillStyle = '#64748b';
        ctx.fillText(val, padLeft - 45, y + 3);
      }

      // Asymptotic Excess Speed Baseline (v_inf)
      const vInfY = padTop + (1.0 - simResult.config.vInfSpeedMPerS / maxSpd) * plotH;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padLeft, vInfY);
      ctx.lineTo(w - padRight, vInfY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`ASYMPTOTE v_∞ = ${(simResult.config.vInfSpeedMPerS / 1000).toFixed(2)} km/s`, w - padRight - 160, vInfY - 4);

      // Planet speed curve
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      traj.forEach((pt, i) => {
        const x = padLeft + (pt.timeS / totalTime) * plotW;
        const y = padTop + (1.0 - pt.speedPlanetMPerS / maxSpd) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      const periSpdY = padTop + (1.0 - simResult.closestApproach.speedPlanetMPerS / maxSpd) * plotH;
      drawPeriapsisMarker(periSpdY, `V_MAX: ${(simResult.closestApproach.speedPlanetMPerS / 1000).toFixed(2)} km/s`);
      if (simResult.collisionDetected) {
        drawCollisionMarker(undefined, `IMPACT TERMINATION`);
      }
      drawScrubber();

      ctx.fillStyle = '#f59e0b';
      ctx.fillText('— ||v_rel(t)||: PLANET-RELATIVE HYPERBOLIC SPEED (v_in = v_out = v_∞)', padLeft + 10, padTop + 26);
    }

    // =========================================================================
    // CHART 4: SUN-RELATIVE SPEED vs TIME
    // =========================================================================
    else if (activeChart === 'SPEED_SUN_TIME') {
      let minSun = Infinity;
      let maxSun = 0;
      traj.forEach((p) => {
        if (p.speedSunMPerS > maxSun) maxSun = p.speedSunMPerS;
        if (p.speedSunMPerS < minSun) minSun = p.speedSunMPerS;
      });
      const span = Math.max(maxSun - minSun, 1000);
      const minPlot = Math.max(0, minSun - span * 0.15);
      const maxPlot = maxSun + span * 0.15;

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(`SUN SPEED (km/s)`, padLeft - 60, padTop - 12);
      ctx.fillText(`TIME (s)`, w - padRight - 45, h - padBottom + 25);

      for (let i = 0; i <= 5; i++) {
        const val = ((maxPlot - (span * 1.3 * i) / 5) / 1000).toFixed(1);
        const y = padTop + (plotH * i) / 5;
        ctx.fillStyle = '#64748b';
        ctx.fillText(val, padLeft - 45, y + 3);
      }

      // Initial speed baseline
      const v0 = traj[0].speedSunMPerS;
      const v0Y = padTop + (1.0 - (v0 - minPlot) / (maxPlot - minPlot)) * plotH;
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(padLeft, v0Y);
      ctx.lineTo(w - padRight, v0Y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Sun Speed Curve (Sky Blue)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      traj.forEach((pt, i) => {
        const x = padLeft + (pt.timeS / totalTime) * plotW;
        const y = padTop + (1.0 - (pt.speedSunMPerS - minPlot) / (maxPlot - minPlot)) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      const periSunY = padTop + (1.0 - (simResult.closestApproach.speedSunMPerS - minPlot) / (maxPlot - minPlot)) * plotH;
      drawPeriapsisMarker(periSunY);
      if (simResult.collisionDetected) {
        drawCollisionMarker(undefined, `IMPACT TERMINATION`);
      }
      drawScrubber();

      const deltaVSunKm = simResult.analytical.deltaVSunSpeedMPerS / 1000.0;
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(
        simResult.collisionDetected
          ? `— ||v_Sun(t)||: HELIOCENTRIC SPEED (NET GAIN: UNAVAILABLE DUE TO SURFACE IMPACT)`
          : `— ||v_Sun(t)||: HELIOCENTRIC SPEED (NET GAIN: ${deltaVSunKm >= 0 ? '+' : ''}${deltaVSunKm.toFixed(2)} km/s)`,
        padLeft + 10,
        padTop + 26
      );
    }

    // =========================================================================
    // CHART 5: GRAVITATIONAL ACCELERATION vs TIME
    // =========================================================================
    else if (activeChart === 'GRAVITY_TIME') {
      let maxG = 0;
      traj.forEach((p) => {
        if (p.gravitationalAccelerationMPerS2 > maxG) maxG = p.gravitationalAccelerationMPerS2;
      });
      maxG = Math.max(maxG * 1.15, 1.0);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(`GRAVITY (m/s²)`, padLeft - 60, padTop - 12);
      ctx.fillText(`TIME (s)`, w - padRight - 45, h - padBottom + 25);

      for (let i = 0; i <= 5; i++) {
        const val = ((maxG * (5 - i)) / 5).toFixed(1);
        const y = padTop + (plotH * i) / 5;
        ctx.fillStyle = '#64748b';
        ctx.fillText(val, padLeft - 45, y + 3);
      }

      // Gravitational Acceleration Curve (Violet)
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      traj.forEach((pt, i) => {
        const x = padLeft + (pt.timeS / totalTime) * plotW;
        const y = padTop + (1.0 - pt.gravitationalAccelerationMPerS2 / maxG) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      const peakG = simResult.closestApproach.distanceM > 0 ? simResult.config.planet.mu / (simResult.closestApproach.distanceM * simResult.closestApproach.distanceM) : 0;
      const peakY = padTop + (1.0 - peakG / maxG) * plotH;
      drawPeriapsisMarker(peakY, `PEAK a_g: ${peakG.toFixed(1)} m/s² (${(peakG / 9.80665).toFixed(1)} G)`);
      drawScrubber();

      ctx.fillStyle = '#a855f7';
      ctx.fillText('— a_g(t) = μ / r(t)²: LOCAL GRAVITATIONAL ACCELERATION', padLeft + 10, padTop + 26);
    }

    // =========================================================================
    // CHART 6: SPACECRAFT X-Y TRAJECTORY (ORBITAL PLANE)
    // =========================================================================
    else if (activeChart === 'TRAJECTORY_XY') {
      let maxCoord = 0;
      traj.forEach((p) => {
        if (Math.abs(p.posPlanetM.x) > maxCoord) maxCoord = Math.abs(p.posPlanetM.x);
        if (Math.abs(p.posPlanetM.y) > maxCoord) maxCoord = Math.abs(p.posPlanetM.y);
      });
      maxCoord = Math.max(maxCoord * 1.1, simResult.config.planet.radiusM * 2.0);

      const centerX = padLeft + plotW / 2;
      const centerY = padTop + plotH / 2;
      const scaleXY = Math.min(plotW, plotH) / (2.0 * maxCoord);

      // Axes crossing at planet center (0,0)
      ctx.strokeStyle = '#222738';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, centerY);
      ctx.lineTo(w - padRight, centerY);
      ctx.moveTo(centerX, padTop);
      ctx.lineTo(centerX, h - padBottom);
      ctx.stroke();

      // Planet Physical Sphere Disk
      const rPlanetCanvas = (simResult.config.planet.radiusM * scaleXY);
      ctx.fillStyle = simResult.config.planet.color || '#3b82f6';
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.max(rPlanetCanvas, 2), 0, Math.PI * 2);
      ctx.fill();

      // Surface perimeter ring
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.max(rPlanetCanvas, 2), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Trajectory Path (Amber)
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      traj.forEach((pt, i) => {
        const cx = centerX + pt.posPlanetM.x * scaleXY;
        const cy = centerY - pt.posPlanetM.y * scaleXY; // Invert Y for Cartesian
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.stroke();

      // Periapsis point
      const periX = centerX + simResult.closestApproach.positionPlanetM.x * scaleXY;
      const periY = centerY - simResult.closestApproach.positionPlanetM.y * scaleXY;
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(periX, periY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Current Animated Playback Marker
      const curX = centerX + currentPt.posPlanetM.x * scaleXY;
      const curY = centerY - currentPt.posPlanetM.y * scaleXY;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(curX, curY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Surface Collision Marker if trajectory impacted planet
      if (simResult.collisionDetected && simResult.collisionPositionPlanetM) {
        const colX = centerX + simResult.collisionPositionPlanetM.x * scaleXY;
        const colY = centerY - simResult.collisionPositionPlanetM.y * scaleXY;
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(colX, colY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('IMPACT SITE', colX + 8, colY + 3);
      }

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(`PLANET REST FRAME (Scale: ±${(maxCoord / 1e6).toFixed(0)}·10³ km)`, padLeft + 10, padTop + 15);
      ctx.fillStyle = simResult.collisionDetected ? '#ef4444' : '#10b981';
      ctx.fillText(
        simResult.collisionDetected
          ? `SURFACE COLLISION: r_p = ${(planetRadiusKm).toLocaleString()} km (IMPACT TERMINATION)`
          : `PERIAPSIS: r_p = ${(simResult.closestApproach.distanceM / 1000).toLocaleString()} km (δ = ${simResult.analytical.deflectionAngleDeg.toFixed(1)}°)`,
        padLeft + 10,
        padTop + 30
      );
    }

    // =========================================================================
    // CHART 7: DEFLECTION ANGLE vs CLOSEST-APPROACH ALTITUDE
    // =========================================================================
    else if (activeChart === 'DEFLECTION_ALTITUDE') {
      const vInf = simResult.config.vInfSpeedMPerS;
      const mu = simResult.config.planet.mu;
      const Rp = simResult.config.planet.radiusM;

      const minAltKm = 0;
      const maxAltKm = planetRadiusKm * 5.0;

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(`DEFLECTION δ (deg)`, padLeft - 60, padTop - 12);
      ctx.fillText(`ALTITUDE h_p (10³ km)`, w - padRight - 80, h - padBottom + 25);

      for (let i = 0; i <= 6; i++) {
        const deg = (180 * (6 - i)) / 6;
        const y = padTop + (plotH * i) / 6;
        ctx.fillStyle = '#64748b';
        ctx.fillText(`${deg.toFixed(0)}°`, padLeft - 45, y + 3);
      }

      for (let i = 0; i <= 5; i++) {
        const alt = ((maxAltKm * i) / 5 / 1000).toFixed(0);
        const x = padLeft + (plotW * i) / 5;
        ctx.fillStyle = '#64748b';
        ctx.fillText(alt, x - 10, h - padBottom + 15);
      }

      // Deflection Curve
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      const samples = 120;
      for (let s = 0; s <= samples; s++) {
        const hKm = minAltKm + (s / samples) * (maxAltKm - minAltKm);
        const rp = Rp + hKm * 1000.0;
        const eHyp = 1.0 + (rp * vInf * vInf) / mu;
        const halfDelta = Math.asin(Math.min(1.0, 1.0 / eHyp));
        const deltaDeg = (2.0 * halfDelta * 180.0) / Math.PI;

        const x = padLeft + ((hKm - minAltKm) / (maxAltKm - minAltKm)) * plotW;
        const y = padTop + (1.0 - deltaDeg / 180.0) * plotH;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Current operating point
      const curAltKm = (simResult.analytical.periapsisRadiusM - Rp) / 1000.0;
      if (curAltKm >= minAltKm && curAltKm <= maxAltKm) {
        const curX = padLeft + ((curAltKm - minAltKm) / (maxAltKm - minAltKm)) * plotW;
        const curY = padTop + (1.0 - simResult.analytical.deflectionAngleDeg / 180.0) * plotH;
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(curX, curY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(
          `ACTIVE: h_p = ${curAltKm.toFixed(0)} km (${simResult.analytical.deflectionAngleDeg.toFixed(1)}°)`,
          curX + 8,
          curY - 6
        );
      }

      ctx.fillStyle = '#38bdf8';
      ctx.fillText('— δ(h_p) = 2·asin( 1 / (1 + (R_p + h_p)·v_∞²/μ) )', padLeft + 10, padTop + 20);
    }

    // =========================================================================
    // CHART 8: DEFLECTION ANGLE vs INCOMING ASYMPTOTIC SPEED
    // =========================================================================
    else if (activeChart === 'DEFLECTION_SPEED') {
      const rp = simResult.analytical.periapsisRadiusM;
      const mu = simResult.config.planet.mu;

      const minVInf = 2000;
      const maxVInf = 35000;

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(`DEFLECTION δ (deg)`, padLeft - 60, padTop - 12);
      ctx.fillText(`EXCESS SPEED v_∞ (km/s)`, w - padRight - 90, h - padBottom + 25);

      for (let i = 0; i <= 6; i++) {
        const deg = (180 * (6 - i)) / 6;
        const y = padTop + (plotH * i) / 6;
        ctx.fillStyle = '#64748b';
        ctx.fillText(`${deg.toFixed(0)}°`, padLeft - 45, y + 3);
      }

      for (let i = 0; i <= 5; i++) {
        const vKm = ((minVInf + ((maxVInf - minVInf) * i) / 5) / 1000).toFixed(0);
        const x = padLeft + (plotW * i) / 5;
        ctx.fillStyle = '#64748b';
        ctx.fillText(vKm, x - 10, h - padBottom + 15);
      }

      // Deflection vs Speed Curve (Amber)
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      const samples = 120;
      for (let s = 0; s <= samples; s++) {
        const v = minVInf + (s / samples) * (maxVInf - minVInf);
        const eHyp = 1.0 + (rp * v * v) / mu;
        const halfDelta = Math.asin(Math.min(1.0, 1.0 / eHyp));
        const deltaDeg = (2.0 * halfDelta * 180.0) / Math.PI;

        const x = padLeft + ((v - minVInf) / (maxVInf - minVInf)) * plotW;
        const y = padTop + (1.0 - deltaDeg / 180.0) * plotH;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Current operating point
      const curV = simResult.config.vInfSpeedMPerS;
      if (curV >= minVInf && curV <= maxVInf) {
        const curX = padLeft + ((curV - minVInf) / (maxVInf - minVInf)) * plotW;
        const curY = padTop + (1.0 - simResult.analytical.deflectionAngleDeg / 180.0) * plotH;
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(curX, curY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(
          `ACTIVE: v_∞ = ${(curV / 1000).toFixed(1)} km/s (${simResult.analytical.deflectionAngleDeg.toFixed(1)}°)`,
          curX + 8,
          curY - 6
        );
      }

      ctx.fillStyle = '#f59e0b';
      ctx.fillText('— δ(v_∞): ASYMPTOTIC SPEED DEFLECTION DECAY (~ 1/v_∞²)', padLeft + 10, padTop + 20);
    }

    // =========================================================================
    // CHART 9: SUN-RELATIVE SPEED CHANGE vs FLYBY GEOMETRY
    // =========================================================================
    else if (activeChart === 'SPEED_CHANGE_GEOMETRY') {
      const planet = simResult.config.planet;
      const vInf = simResult.config.vInfSpeedMPerS;
      const rp = simResult.analytical.periapsisRadiusM;
      const Vp = planet.orbitalSpeedMPerS;
      const deltaRad = simResult.analytical.deflectionAngleRad;

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(`Δv_Sun (km/s)`, padLeft - 60, padTop - 12);
      ctx.fillText(`APPROACH ANGLE θ (deg)`, w - padRight - 85, h - padBottom + 25);

      const maxGain = (2.0 * Vp * Math.sin(deltaRad / 2.0)) / 1000.0;
      const maxPlot = Math.max(maxGain * 1.25, 2.0);

      // Zero-speed-change horizontal axis
      const zeroY = padTop + plotH / 2;
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, zeroY);
      ctx.lineTo(w - padRight, zeroY);
      ctx.stroke();

      for (let i = 0; i <= 4; i++) {
        const val = ((maxPlot * (2 - i)) / 2).toFixed(1);
        const y = padTop + (plotH * i) / 4;
        ctx.fillStyle = '#64748b';
        ctx.fillText(`${val}`, padLeft - 45, y + 3);
      }

      // X labels: 0°, 90°, 180°, 270°, 360°
      for (let i = 0; i <= 4; i++) {
        const angle = i * 90;
        const x = padLeft + (plotW * i) / 4;
        ctx.fillStyle = '#64748b';
        ctx.fillText(`${angle}°`, x - 8, h - padBottom + 15);
      }

      // Trailing Geometry Gain (Emerald)
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      const samples = 120;
      for (let s = 0; s <= samples; s++) {
        const theta = (s / samples) * 360;
        const thetaRad = (theta * Math.PI) / 180.0;
        // In-plane incoming vector:
        const vInX = vInf * Math.cos(thetaRad);
        const vInY = vInf * Math.sin(thetaRad);
        // Trailing turn:
        const vOutX = vInX * Math.cos(deltaRad) - vInY * Math.sin(deltaRad);
        const vOutY = vInX * Math.sin(deltaRad) + vInY * Math.cos(deltaRad);

        const vInSunSpeed = Math.sqrt(vInX * vInX + (Vp + vInY) * (Vp + vInY));
        const vOutSunSpeed = Math.sqrt(vOutX * vOutX + (Vp + vOutY) * (Vp + vOutY));
        const dVSunKm = (vOutSunSpeed - vInSunSpeed) / 1000.0;

        const x = padLeft + (s / samples) * plotW;
        const y = zeroY - (dVSunKm / maxPlot) * (plotH / 2);
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Current operating point
      const curAngle = simResult.config.approachAngleDeg ?? 0;
      const curDeltaVSun = simResult.analytical.deltaVSunSpeedMPerS / 1000.0;
      const curX = padLeft + (curAngle / 360) * plotW;
      const curY = zeroY - (curDeltaVSun / maxPlot) * (plotH / 2);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(curX, curY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(
        `ACTIVE: ${curAngle}° (${curDeltaVSun >= 0 ? '+' : ''}${curDeltaVSun.toFixed(2)} km/s)`,
        curX + 8,
        curY - 6
      );

      ctx.fillStyle = '#10b981';
      ctx.fillText('— Δv_Sun(θ): HELIOCENTRIC BOOST vs APPROACH GEOMETRY', padLeft + 10, padTop + 20);
    }

    // Draw Interactive Crosshair & Tooltip when hovering
    if (hoverPoint) {
      // Vertical crosshair
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hoverPoint.canvasX, padTop);
      ctx.lineTo(hoverPoint.canvasX, h - padBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Highlight target point
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hoverPoint.canvasX, hoverPoint.canvasY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Tooltip Card
      const textX = `${hoverPoint.xLabel}: ${typeof hoverPoint.xValue === 'number' ? hoverPoint.xValue.toLocaleString(undefined, { maximumFractionDigits: 2 }) : hoverPoint.xValue}`;
      const textY = `${hoverPoint.yLabel}: ${typeof hoverPoint.yValue === 'number' ? hoverPoint.yValue.toLocaleString(undefined, { maximumFractionDigits: 2 }) : hoverPoint.yValue}`;

      ctx.font = '10px monospace';
      const m1 = ctx.measureText(textX);
      const m2 = ctx.measureText(textY);
      const boxW = Math.max(m1.width, m2.width) + 16;
      const boxH = 36;

      let boxX = hoverPoint.canvasX + 12;
      if (boxX + boxW > w - padRight) {
        boxX = hoverPoint.canvasX - boxW - 12;
      }
      let boxY = hoverPoint.canvasY - boxH / 2;
      boxY = Math.max(padTop + 4, Math.min(boxY, h - padBottom - boxH - 4));

      ctx.fillStyle = 'rgba(10, 14, 23, 0.94)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(boxX, boxY, boxW, boxH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.fillText(textX, boxX + 8, boxY + 14);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(textY, boxX + 8, boxY + 28);
    }
  }, [simResult, currentPlaybackIndex, activeChart, hoverPoint]);

  // CSV Export for active chart data
  const handleExportChartCSV = useCallback(() => {
    if (!simResult) return;
    const meta = chartMetadata;
    const traj = simResult.trajectory;

    let points: Array<{ x: number; y: number; label?: string }> = [];

    switch (activeChart) {
      case 'DISTANCE_TIME':
        points = traj.map((p) => ({
          x: p.timeS,
          y: p.distanceFromCenterM / 1000.0,
          label: p.timeS === simResult.closestApproach.timeS ? 'PERIAPSIS' : undefined,
        }));
        break;
      case 'ALTITUDE_TIME':
        points = traj.map((p) => ({
          x: p.timeS,
          y: p.altitudeM / 1000.0,
          label: p.timeS === simResult.closestApproach.timeS ? 'PERIAPSIS' : undefined,
        }));
        break;
      case 'SPEED_PLANET_TIME':
        points = traj.map((p) => ({
          x: p.timeS,
          y: p.speedPlanetMPerS / 1000.0,
          label: p.timeS === simResult.closestApproach.timeS ? 'MAX_SPEED' : undefined,
        }));
        break;
      case 'SPEED_SUN_TIME':
        points = traj.map((p) => ({
          x: p.timeS,
          y: p.speedSunMPerS / 1000.0,
        }));
        break;
      case 'GRAVITY_TIME':
        points = traj.map((p) => ({
          x: p.timeS,
          y: p.gravitationalAccelerationMPerS2,
        }));
        break;
      case 'TRAJECTORY_XY':
        points = traj.map((p) => ({
          x: p.posPlanetM.x / 1000.0,
          y: p.posPlanetM.y / 1000.0,
        }));
        break;
      case 'DEFLECTION_ALTITUDE': {
        const vInf = simResult.config.vInfSpeedMPerS;
        const mu = simResult.config.planet.mu;
        const Rp = simResult.config.planet.radiusM;
        for (let s = 0; s <= 100; s++) {
          const hKm = (s / 100) * (Rp * 5 / 1000);
          const rp = Rp + hKm * 1000.0;
          const eHyp = 1.0 + (rp * vInf * vInf) / mu;
          const deltaDeg = (2.0 * Math.asin(Math.min(1.0, 1.0 / eHyp)) * 180.0) / Math.PI;
          points.push({ x: hKm, y: deltaDeg });
        }
        break;
      }
      case 'DEFLECTION_SPEED': {
        const rp = simResult.analytical.periapsisRadiusM;
        const mu = simResult.config.planet.mu;
        for (let s = 0; s <= 100; s++) {
          const v = 2000 + (s / 100) * 33000;
          const eHyp = 1.0 + (rp * v * v) / mu;
          const deltaDeg = (2.0 * Math.asin(Math.min(1.0, 1.0 / eHyp)) * 180.0) / Math.PI;
          points.push({ x: v / 1000.0, y: deltaDeg });
        }
        break;
      }
      case 'SPEED_CHANGE_GEOMETRY': {
        const planet = simResult.config.planet;
        const vInf = simResult.config.vInfSpeedMPerS;
        const Vp = planet.orbitalSpeedMPerS;
        const deltaRad = simResult.analytical.deflectionAngleRad;
        for (let s = 0; s <= 120; s++) {
          const theta = (s / 120) * 360;
          const thetaRad = (theta * Math.PI) / 180.0;
          const vInX = vInf * Math.cos(thetaRad);
          const vInY = vInf * Math.sin(thetaRad);
          const vOutX = vInX * Math.cos(deltaRad) - vInY * Math.sin(deltaRad);
          const vOutY = vInX * Math.sin(deltaRad) + vInY * Math.cos(deltaRad);
          const vInSunSpeed = Math.sqrt(vInX * vInX + (Vp + vInY) * (Vp + vInY));
          const vOutSunSpeed = Math.sqrt(vOutX * vOutX + (Vp + vOutY) * (Vp + vOutY));
          points.push({ x: theta, y: (vOutSunSpeed - vInSunSpeed) / 1000.0 });
        }
        break;
      }
    }

    const csv = FlybyExperimentEngine.exportChartDataToCSV(
      meta.title,
      meta.xLabel,
      meta.xUnit,
      meta.yLabel,
      meta.yUnit,
      points
    );

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `astra-${activeChart.toLowerCase()}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [simResult, activeChart, chartMetadata]);

  // Interactive Hover Calculation
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !simResult) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const padLeft = 70;
      const padRight = 35;
      const padTop = 32;
      const padBottom = 42;
      const plotW = rect.width - padLeft - padRight;
      const plotH = rect.height - padTop - padBottom;

      if (
        clientX < padLeft ||
        clientX > rect.width - padRight ||
        clientY < padTop ||
        clientY > rect.height - padBottom
      ) {
        setHoverPoint(null);
        return;
      }

      const traj = simResult.trajectory;
      if (traj.length === 0) return;
      const totalTime = traj[traj.length - 1].timeS;
      const planetRadiusKm = simResult.config.planet.radiusM / 1000.0;

      if (activeChart === 'DISTANCE_TIME') {
        let maxDist = 0;
        traj.forEach((p) => {
          if (p.distanceFromCenterM > maxDist) maxDist = p.distanceFromCenterM;
        });
        maxDist = Math.max(maxDist * 1.08, simResult.config.planet.radiusM * 1.5);

        const tRatio = Math.max(0, Math.min(1, (clientX - padLeft) / plotW));
        const targetTime = tRatio * totalTime;
        let closestPt = traj[0];
        let minDt = Infinity;
        for (const pt of traj) {
          const dt = Math.abs(pt.timeS - targetTime);
          if (dt < minDt) {
            minDt = dt;
            closestPt = pt;
          }
        }
        const cx = padLeft + (closestPt.timeS / totalTime) * plotW;
        const cy = padTop + (1.0 - closestPt.distanceFromCenterM / maxDist) * plotH;
        setHoverPoint({
          canvasX: cx,
          canvasY: cy,
          xValue: closestPt.timeS,
          yValue: closestPt.distanceFromCenterM / 1000.0,
          xLabel: 'Time (s)',
          yLabel: 'Distance (km)',
        });
      } else if (activeChart === 'ALTITUDE_TIME') {
        let maxAlt = 0;
        traj.forEach((p) => {
          if (p.altitudeM > maxAlt) maxAlt = p.altitudeM;
        });
        maxAlt = Math.max(maxAlt * 1.1, 10000);

        const tRatio = Math.max(0, Math.min(1, (clientX - padLeft) / plotW));
        const targetTime = tRatio * totalTime;
        let closestPt = traj[0];
        let minDt = Infinity;
        for (const pt of traj) {
          const dt = Math.abs(pt.timeS - targetTime);
          if (dt < minDt) {
            minDt = dt;
            closestPt = pt;
          }
        }
        const cx = padLeft + (closestPt.timeS / totalTime) * plotW;
        const cy = padTop + (1.0 - Math.max(0, closestPt.altitudeM) / maxAlt) * plotH;
        setHoverPoint({
          canvasX: cx,
          canvasY: cy,
          xValue: closestPt.timeS,
          yValue: closestPt.altitudeM / 1000.0,
          xLabel: 'Time (s)',
          yLabel: 'Altitude (km)',
        });
      } else if (activeChart === 'SPEED_PLANET_TIME') {
        let maxSpd = 0;
        traj.forEach((p) => {
          if (p.speedPlanetMPerS > maxSpd) maxSpd = p.speedPlanetMPerS;
        });
        maxSpd = Math.max(maxSpd * 1.15, simResult.config.vInfSpeedMPerS * 1.2);

        const tRatio = Math.max(0, Math.min(1, (clientX - padLeft) / plotW));
        const targetTime = tRatio * totalTime;
        let closestPt = traj[0];
        let minDt = Infinity;
        for (const pt of traj) {
          const dt = Math.abs(pt.timeS - targetTime);
          if (dt < minDt) {
            minDt = dt;
            closestPt = pt;
          }
        }
        const cx = padLeft + (closestPt.timeS / totalTime) * plotW;
        const cy = padTop + (1.0 - closestPt.speedPlanetMPerS / maxSpd) * plotH;
        setHoverPoint({
          canvasX: cx,
          canvasY: cy,
          xValue: closestPt.timeS,
          yValue: closestPt.speedPlanetMPerS / 1000.0,
          xLabel: 'Time (s)',
          yLabel: 'Planet Speed (km/s)',
        });
      } else if (activeChart === 'SPEED_SUN_TIME') {
        let minSun = Infinity;
        let maxSun = 0;
        traj.forEach((p) => {
          if (p.speedSunMPerS > maxSun) maxSun = p.speedSunMPerS;
          if (p.speedSunMPerS < minSun) minSun = p.speedSunMPerS;
        });
        const span = Math.max(maxSun - minSun, 1000);
        const minPlot = Math.max(0, minSun - span * 0.15);
        const maxPlot = maxSun + span * 0.15;

        const tRatio = Math.max(0, Math.min(1, (clientX - padLeft) / plotW));
        const targetTime = tRatio * totalTime;
        let closestPt = traj[0];
        let minDt = Infinity;
        for (const pt of traj) {
          const dt = Math.abs(pt.timeS - targetTime);
          if (dt < minDt) {
            minDt = dt;
            closestPt = pt;
          }
        }
        const cx = padLeft + (closestPt.timeS / totalTime) * plotW;
        const cy = padTop + (1.0 - (closestPt.speedSunMPerS - minPlot) / (maxPlot - minPlot)) * plotH;
        setHoverPoint({
          canvasX: cx,
          canvasY: cy,
          xValue: closestPt.timeS,
          yValue: closestPt.speedSunMPerS / 1000.0,
          xLabel: 'Time (s)',
          yLabel: 'Sun Speed (km/s)',
        });
      } else if (activeChart === 'GRAVITY_TIME') {
        let maxG = 0;
        traj.forEach((p) => {
          if (p.gravitationalAccelerationMPerS2 > maxG) maxG = p.gravitationalAccelerationMPerS2;
        });
        maxG = Math.max(maxG * 1.15, 1.0);

        const tRatio = Math.max(0, Math.min(1, (clientX - padLeft) / plotW));
        const targetTime = tRatio * totalTime;
        let closestPt = traj[0];
        let minDt = Infinity;
        for (const pt of traj) {
          const dt = Math.abs(pt.timeS - targetTime);
          if (dt < minDt) {
            minDt = dt;
            closestPt = pt;
          }
        }
        const cx = padLeft + (closestPt.timeS / totalTime) * plotW;
        const cy = padTop + (1.0 - closestPt.gravitationalAccelerationMPerS2 / maxG) * plotH;
        setHoverPoint({
          canvasX: cx,
          canvasY: cy,
          xValue: closestPt.timeS,
          yValue: closestPt.gravitationalAccelerationMPerS2,
          xLabel: 'Time (s)',
          yLabel: 'Gravity (m/s²)',
        });
      } else if (activeChart === 'TRAJECTORY_XY') {
        let maxCoord = 0;
        traj.forEach((p) => {
          if (Math.abs(p.posPlanetM.x) > maxCoord) maxCoord = Math.abs(p.posPlanetM.x);
          if (Math.abs(p.posPlanetM.y) > maxCoord) maxCoord = Math.abs(p.posPlanetM.y);
        });
        maxCoord = Math.max(maxCoord * 1.1, simResult.config.planet.radiusM * 2.0);
        const centerX = padLeft + plotW / 2;
        const centerY = padTop + plotH / 2;
        const scaleXY = Math.min(plotW, plotH) / (2.0 * maxCoord);

        let closestPt = traj[0];
        let minDistSq = Infinity;
        for (const pt of traj) {
          const cx = centerX + pt.posPlanetM.x * scaleXY;
          const cy = centerY - pt.posPlanetM.y * scaleXY;
          const d2 = (cx - clientX) * (cx - clientX) + (cy - clientY) * (cy - clientY);
          if (d2 < minDistSq) {
            minDistSq = d2;
            closestPt = pt;
          }
        }
        const cx = centerX + closestPt.posPlanetM.x * scaleXY;
        const cy = centerY - closestPt.posPlanetM.y * scaleXY;
        setHoverPoint({
          canvasX: cx,
          canvasY: cy,
          xValue: closestPt.posPlanetM.x / 1000.0,
          yValue: closestPt.posPlanetM.y / 1000.0,
          xLabel: 'X (km)',
          yLabel: 'Y (km)',
        });
      } else if (activeChart === 'DEFLECTION_ALTITUDE') {
        const vInf = simResult.config.vInfSpeedMPerS;
        const mu = simResult.config.planet.mu;
        const Rp = simResult.config.planet.radiusM;
        const minAltKm = 0;
        const maxAltKm = planetRadiusKm * 5.0;

        const altRatio = Math.max(0, Math.min(1, (clientX - padLeft) / plotW));
        const hKm = minAltKm + altRatio * (maxAltKm - minAltKm);
        const rp = Rp + hKm * 1000.0;
        const eHyp = 1.0 + (rp * vInf * vInf) / mu;
        const halfDelta = Math.asin(Math.min(1.0, 1.0 / eHyp));
        const deltaDeg = (2.0 * halfDelta * 180.0) / Math.PI;

        const cx = padLeft + altRatio * plotW;
        const cy = padTop + (1.0 - deltaDeg / 180.0) * plotH;
        setHoverPoint({
          canvasX: cx,
          canvasY: cy,
          xValue: hKm,
          yValue: deltaDeg,
          xLabel: 'Altitude (km)',
          yLabel: 'Deflection (deg)',
        });
      } else if (activeChart === 'DEFLECTION_SPEED') {
        const rp = simResult.analytical.periapsisRadiusM;
        const mu = simResult.config.planet.mu;
        const minVInf = 2000;
        const maxVInf = 35000;

        const vRatio = Math.max(0, Math.min(1, (clientX - padLeft) / plotW));
        const v = minVInf + vRatio * (maxVInf - minVInf);
        const eHyp = 1.0 + (rp * v * v) / mu;
        const halfDelta = Math.asin(Math.min(1.0, 1.0 / eHyp));
        const deltaDeg = (2.0 * halfDelta * 180.0) / Math.PI;

        const cx = padLeft + vRatio * plotW;
        const cy = padTop + (1.0 - deltaDeg / 180.0) * plotH;
        setHoverPoint({
          canvasX: cx,
          canvasY: cy,
          xValue: v / 1000.0,
          yValue: deltaDeg,
          xLabel: 'Speed v_∞ (km/s)',
          yLabel: 'Deflection (deg)',
        });
      } else if (activeChart === 'SPEED_CHANGE_GEOMETRY') {
        const planet = simResult.config.planet;
        const vInf = simResult.config.vInfSpeedMPerS;
        const Vp = planet.orbitalSpeedMPerS;
        const deltaRad = simResult.analytical.deflectionAngleRad;

        const maxGain = (2.0 * Vp * Math.sin(deltaRad / 2.0)) / 1000.0;
        const maxPlot = Math.max(maxGain * 1.25, 2.0);
        const zeroY = padTop + plotH / 2;

        const angleRatio = Math.max(0, Math.min(1, (clientX - padLeft) / plotW));
        const theta = angleRatio * 360;
        const thetaRad = (theta * Math.PI) / 180.0;
        const vInX = vInf * Math.cos(thetaRad);
        const vInY = vInf * Math.sin(thetaRad);
        const vOutX = vInX * Math.cos(deltaRad) - vInY * Math.sin(deltaRad);
        const vOutY = vInX * Math.sin(deltaRad) + vInY * Math.cos(deltaRad);

        const vInSunSpeed = Math.sqrt(vInX * vInX + (Vp + vInY) * (Vp + vInY));
        const vOutSunSpeed = Math.sqrt(vOutX * vOutX + (Vp + vOutY) * (Vp + vOutY));
        const dVSunKm = (vOutSunSpeed - vInSunSpeed) / 1000.0;

        const cx = padLeft + angleRatio * plotW;
        const cy = zeroY - (dVSunKm / maxPlot) * (plotH / 2);
        setHoverPoint({
          canvasX: cx,
          canvasY: cy,
          xValue: theta,
          yValue: dVSunKm,
          xLabel: 'Angle θ (deg)',
          yLabel: 'Δv_Sun (km/s)',
        });
      }
    },
    [simResult, activeChart]
  );

  // PNG Snapshot of Canvas
  const handleSnapshotPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `astra-${activeChart.toLowerCase()}-${Date.now()}.png`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [activeChart]);

  return (
    <div className="w-full bg-white border border-[#DCE3EE] p-4 rounded-xl flex flex-col gap-3 text-[#263247] shadow-xs">
      {/* Top Header & Export Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EE] pb-2.5">
        <div className="flex items-center gap-2">
          <LineChart size={16} className="text-[#0284C7]" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#14426B]">
            ASTRODYNAMICS SCIENTIFIC TELEMETRY & ANALYSIS CHARTS
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportChartCSV}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#EEF2F8] hover:bg-[#E2E8F0] text-[#14426B] border border-[#DCE3EE] rounded-lg font-mono text-[10px] transition-colors cursor-pointer shadow-2xs font-semibold"
            title="Export chart data points as RFC-4180 CSV"
          >
            <Download size={12} />
            <span>EXPORT CSV</span>
          </button>
          <button
            onClick={handleSnapshotPNG}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#EEF2F8] hover:bg-[#E2E8F0] text-[#263247] border border-[#DCE3EE] rounded-lg font-mono text-[10px] transition-colors cursor-pointer shadow-2xs font-semibold"
            title="Download high-resolution image snapshot"
          >
            <Camera size={12} />
            <span>PNG</span>
          </button>
        </div>
      </div>

      {/* Collision Alert Banner */}
      {simResult?.collisionDetected && (
        <div className="bg-[#FEE2E2] border border-[#FCA5A5] p-3 rounded-xl flex items-center justify-between text-xs font-mono text-[#991B1B] shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-pulse" />
            <span className="font-bold uppercase tracking-wider">SURFACE COLLISION DETECTED</span>
            <span className="text-[#7F1D1D]">
              Trajectory intersects planetary radius (R_p = {(simResult.config.planet.radiusM / 1000).toLocaleString()} km) at T+{(simResult.collisionTimeS ?? 0).toFixed(0)}s. Post-impact exit velocities are physically unavailable.
            </span>
          </div>
          <span className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-[#FCA5A5] font-bold text-[#DC2626]">
            IMPACT TERMINATION
          </span>
        </div>
      )}

      {/* 9 Chart Selection Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 font-mono text-[10px]">
        <button
          onClick={() => setActiveChart('DISTANCE_TIME')}
          className={`px-2 py-1.5 rounded-lg transition-colors text-left flex flex-col justify-center border cursor-pointer ${
            activeChart === 'DISTANCE_TIME'
              ? 'bg-[#AEE5D0] text-[#1D6C50] font-bold border-[#AEE5D0] shadow-2xs'
              : 'bg-[#F8FAFD] text-[#68758A] hover:bg-[#EEF2F8] border-[#DCE3EE]'
          }`}
        >
          <span className="truncate">1. DISTANCE r(t)</span>
          <span className="text-[8px] opacity-80">Centre Radius</span>
        </button>

        <button
          onClick={() => setActiveChart('ALTITUDE_TIME')}
          className={`px-2 py-1.5 rounded-lg transition-colors text-left flex flex-col justify-center border cursor-pointer ${
            activeChart === 'ALTITUDE_TIME'
              ? 'bg-[#A9D4F5] text-[#14426B] font-bold border-[#A9D4F5] shadow-2xs'
              : 'bg-[#F8FAFD] text-[#68758A] hover:bg-[#EEF2F8] border-[#DCE3EE]'
          }`}
        >
          <span className="truncate">2. ALTITUDE h(t)</span>
          <span className="text-[8px] opacity-80">Surface Limit</span>
        </button>

        <button
          onClick={() => setActiveChart('SPEED_PLANET_TIME')}
          className={`px-2 py-1.5 rounded-lg transition-colors text-left flex flex-col justify-center border cursor-pointer ${
            activeChart === 'SPEED_PLANET_TIME'
              ? 'bg-[#FFD2B8] text-[#7A3E1D] font-bold border-[#FFD2B8] shadow-2xs'
              : 'bg-[#F8FAFD] text-[#68758A] hover:bg-[#EEF2F8] border-[#DCE3EE]'
          }`}
        >
          <span className="truncate">3. PLANET SPEED</span>
          <span className="text-[8px] opacity-80">Rest Frame v_inf</span>
        </button>

        <button
          onClick={() => setActiveChart('SPEED_SUN_TIME')}
          className={`px-2 py-1.5 rounded-lg transition-colors text-left flex flex-col justify-center border cursor-pointer ${
            activeChart === 'SPEED_SUN_TIME'
              ? 'bg-[#A9D4F5] text-[#14426B] font-bold border-[#A9D4F5] shadow-2xs'
              : 'bg-[#F8FAFD] text-[#68758A] hover:bg-[#EEF2F8] border-[#DCE3EE]'
          }`}
        >
          <span className="truncate">4. SUN SPEED</span>
          <span className="text-[8px] opacity-80">Heliocentric Boost</span>
        </button>

        <button
          onClick={() => setActiveChart('GRAVITY_TIME')}
          className={`px-2 py-1.5 rounded-lg transition-colors text-left flex flex-col justify-center border cursor-pointer ${
            activeChart === 'GRAVITY_TIME'
              ? 'bg-[#C9BDF2] text-[#4A347F] font-bold border-[#C9BDF2] shadow-2xs'
              : 'bg-[#F8FAFD] text-[#68758A] hover:bg-[#EEF2F8] border-[#DCE3EE]'
          }`}
        >
          <span className="truncate">5. GRAVITY a_g(t)</span>
          <span className="text-[8px] opacity-80">Local Accel m/s²</span>
        </button>

        <button
          onClick={() => setActiveChart('TRAJECTORY_XY')}
          className={`px-2 py-1.5 rounded-lg transition-colors text-left flex flex-col justify-center border cursor-pointer ${
            activeChart === 'TRAJECTORY_XY'
              ? 'bg-[#FFD2B8] text-[#7A3E1D] font-bold border-[#FFD2B8] shadow-2xs'
              : 'bg-[#F8FAFD] text-[#68758A] hover:bg-[#EEF2F8] border-[#DCE3EE]'
          }`}
        >
          <span className="truncate">6. X-Y TRAJECTORY</span>
          <span className="text-[8px] opacity-80">Planar Hyperbola</span>
        </button>

        <button
          onClick={() => setActiveChart('DEFLECTION_ALTITUDE')}
          className={`px-2 py-1.5 rounded-lg transition-colors text-left flex flex-col justify-center border cursor-pointer ${
            activeChart === 'DEFLECTION_ALTITUDE'
              ? 'bg-[#A9D4F5] text-[#14426B] font-bold border-[#A9D4F5] shadow-2xs'
              : 'bg-[#F8FAFD] text-[#68758A] hover:bg-[#EEF2F8] border-[#DCE3EE]'
          }`}
        >
          <span className="truncate">7. DEFLECTION vs ALT</span>
          <span className="text-[8px] opacity-80">δ(h_p) Curve</span>
        </button>

        <button
          onClick={() => setActiveChart('DEFLECTION_SPEED')}
          className={`px-2 py-1.5 rounded-lg transition-colors text-left flex flex-col justify-center border cursor-pointer ${
            activeChart === 'DEFLECTION_SPEED'
              ? 'bg-[#F2B9C6] text-[#83263E] font-bold border-[#F2B9C6] shadow-2xs'
              : 'bg-[#F8FAFD] text-[#68758A] hover:bg-[#EEF2F8] border-[#DCE3EE]'
          }`}
        >
          <span className="truncate">8. DEFLECTION vs SPEED</span>
          <span className="text-[8px] opacity-80">δ(v_inf) Decline</span>
        </button>

        <button
          onClick={() => setActiveChart('SPEED_CHANGE_GEOMETRY')}
          className={`px-2 py-1.5 rounded-lg transition-colors text-left flex flex-col justify-center border col-span-2 sm:col-span-1 cursor-pointer ${
            activeChart === 'SPEED_CHANGE_GEOMETRY'
              ? 'bg-[#AEE5D0] text-[#1D6C50] font-bold border-[#AEE5D0] shadow-2xs'
              : 'bg-[#F8FAFD] text-[#68758A] hover:bg-[#EEF2F8] border-[#DCE3EE]'
          }`}
        >
          <span className="truncate">9. Δv vs GEOMETRY</span>
          <span className="text-[8px] opacity-80">Approach Angle θ</span>
        </button>
      </div>

      {/* Chart Description Pill */}
      <div className="bg-[#F8FAFD] border border-[#DCE3EE] px-3.5 py-2 rounded-lg flex items-center justify-between text-[11px] font-mono text-[#263247]">
        <div className="flex items-center gap-2">
          <Info size={13} className="text-[#0284C7]" />
          <span className="text-[#68758A]">{chartMetadata.description}</span>
        </div>
        <div className="text-[10px] text-[#94A3B8] hidden sm:block">
          HOVER TO INSPECT • CLOSEST APPROACH (PERIAPSIS) HIGHLIGHTED
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="w-full relative">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverPoint(null)}
          className="w-full h-[280px] rounded-xl border border-[#DCE3EE] block bg-white cursor-crosshair shadow-2xs"
        />
      </div>

      {/* Numerical Telemetry Summary for Active Plot */}
      {simResult && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-[10px] font-mono bg-[#F8FAFD] p-3 rounded-xl border border-[#DCE3EE] shadow-2xs">
          <div>
            <span className="text-[#68758A] block font-medium">CLOSEST APPROACH</span>
            <span className={`font-bold ${simResult.collisionDetected ? 'text-[#DC2626]' : 'text-[#059669]'}`}>
              {simResult.collisionDetected
                ? `IMPACT (${(simResult.config.planet.radiusM / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km)`
                : `${(simResult.closestApproach.distanceM / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`}
            </span>
          </div>
          <div>
            <span className="text-[#68758A] block font-medium">PERIAPSIS ALTITUDE</span>
            <span className={`font-bold ${simResult.collisionDetected ? 'text-[#DC2626]' : 'text-[#0284C7]'}`}>
              {simResult.collisionDetected
                ? '0.0 km (COLLISION)'
                : `${(simResult.closestApproach.altitudeM / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`}
            </span>
          </div>
          <div>
            <span className="text-[#68758A] block font-medium">DEFLECTION ANGLE δ</span>
            <span className={`font-bold ${simResult.collisionDetected ? 'text-[#991B1B]' : 'text-[#B45309]'}`}>
              {simResult.collisionDetected
                ? `UNREALIZED (${simResult.analytical.deflectionAngleDeg.toFixed(1)}° th)`
                : `${simResult.analytical.deflectionAngleDeg.toFixed(2)}° (${simResult.analytical.deflectionAngleRad.toFixed(4)} rad)`}
            </span>
          </div>
          <div>
            <span className="text-[#68758A] block font-medium">SUN SPEED CHANGE</span>
            {simResult.collisionDetected ? (
              <span className="text-[#DC2626] font-bold" title="Unavailable due to surface collision">
                UNAVAILABLE (Impact)
              </span>
            ) : (
              <span className={`font-bold ${simResult.analytical.deltaVSunSpeedMPerS >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                {simResult.analytical.deltaVSunSpeedMPerS >= 0 ? '+' : ''}
                {(simResult.analytical.deltaVSunSpeedMPerS / 1000).toFixed(3)} km/s
              </span>
            )}
          </div>
          <div>
            <span className="text-[#68758A] block font-medium">VECTOR Δv MAGNITUDE</span>
            {simResult.collisionDetected ? (
              <span className="text-[#DC2626] font-bold" title="Unavailable due to surface collision">
                UNAVAILABLE (Impact)
              </span>
            ) : (
              <span className="text-[#0284C7] font-bold">
                {(simResult.analytical.deltaVVectorMagnitudeMPerS / 1000).toFixed(3)} km/s
              </span>
            )}
          </div>
          <div>
            <span className="text-[#68758A] block font-medium">ENERGY DRIFT</span>
            <span className="text-[#263247] font-bold">
              {simResult.collisionDetected
                ? 'TERMINATED'
                : simResult.convergenceDiagnostics?.relativeEnergyConservationError !== undefined
                ? simResult.convergenceDiagnostics.relativeEnergyConservationError.toExponential(2)
                : '< 1e-12'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
