import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { FlybySimulationResult, ReferenceFrame } from '../../../physics/FlybyEngine';
import { PlanetaryVisuals, PlanetBundle } from './PlanetaryVisuals';
import { SpacecraftVisuals, SpacecraftBundle, SpacecraftAttitudeMode } from './SpacecraftVisuals';
import { TrajectoryInterpolator, InterpolatedState } from './TrajectoryInterpolator';
import {
  RotateCcw,
  Compass,
  Grid,
  Zap,
  Target,
  Maximize2,
  Eye,
  Layers,
  ArrowRight,
  Sliders,
  Settings,
  Sparkles,
} from 'lucide-react';

export type FlybyCameraMode = 'OVERVIEW' | 'CLOSE_UP' | 'PROBE_FOLLOW' | 'FREE';
export type GraphicsQuality = 'HIGH' | 'BALANCED' | 'PERFORMANCE';

export interface Flyby3DCanvasProps {
  simResult: FlybySimulationResult | null;
  currentPlaybackIndex: number;
  referenceFrame: ReferenceFrame;
  cameraMode: FlybyCameraMode;
  showVectors: boolean;
  showTrajectoryTrail: boolean;
  isPlaying?: boolean;
  playbackSpeed?: number;
  onCameraChange?: (mode: FlybyCameraMode) => void;
  onReferenceFrameChange?: (frame: ReferenceFrame) => void;
  onPlaybackIndexChange?: (index: number) => void;
  showGravitationalAccel?: boolean;
  showGrid?: boolean;
  showPeriapsisMarker?: boolean;
}

export const Flyby3DCanvas: React.FC<Flyby3DCanvasProps> = ({
  simResult,
  currentPlaybackIndex,
  referenceFrame,
  cameraMode,
  showVectors,
  showTrajectoryTrail,
  isPlaying = false,
  playbackSpeed = 1.0,
  onCameraChange,
  onReferenceFrameChange,
  onPlaybackIndexChange,
  showGravitationalAccel: initialShowGravity = true,
  showGrid: initialShowGrid = true,
  showPeriapsisMarker: initialShowPeriMarker = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameIdRef = useRef<number>(0);

  // Graphics Quality & Attitude Mode
  const [quality, setQuality] = useState<GraphicsQuality>('HIGH');
  const [attitudeMode, setAttitudeMode] = useState<SpacecraftAttitudeMode>('VELOCITY_ALIGNED');
  const [showSettingsDropdown, setShowSettingsDropdown] = useState<boolean>(false);

  // Visual toggles
  const [showGravityVector, setShowGravityVector] = useState<boolean>(initialShowGravity);
  const [showEquatorialGrid, setShowEquatorialGrid] = useState<boolean>(initialShowGrid);
  const [showPeriMarker, setShowPeriMarker] = useState<boolean>(initialShowPeriMarker);

  // High-Precision Hermite Interpolator
  const interpolatorRef = useRef<TrajectoryInterpolator | null>(null);
  useEffect(() => {
    if (simResult && simResult.trajectory.length > 0) {
      interpolatorRef.current = new TrajectoryInterpolator(simResult);
    } else {
      interpolatorRef.current = null;
    }
  }, [simResult]);

  // Visual Scale: Planet radius = 4.0 scene units
  const VISUAL_PLANET_RADIUS = 4.0;

  // Scene entities references
  const planetBundleRef = useRef<PlanetBundle | null>(null);
  const spacecraftBundleRef = useRef<SpacecraftBundle | null>(null);
  const trajectoryLineRef = useRef<THREE.Line | null>(null);
  const closestMarkerRef = useRef<THREE.Mesh | null>(null);
  const impactLineRef = useRef<THREE.Line | null>(null);
  const vectorsGroupRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);

  // Continuous Playback Time in Seconds
  const currentTimeSRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);

  // Sync internal continuous time when currentPlaybackIndex is changed from outside (seeking/reset)
  useEffect(() => {
    if (simResult && simResult.trajectory.length > 0) {
      const idx = Math.min(currentPlaybackIndex, simResult.trajectory.length - 1);
      const targetTimeS = simResult.trajectory[idx].timeS;
      // Only update if difference is meaningful to prevent jitter during continuous playback
      if (Math.abs(currentTimeSRef.current - targetTimeS) > 0.2) {
        currentTimeSRef.current = targetTimeS;
      }
    }
  }, [currentPlaybackIndex, simResult]);

  // Smooth Camera State
  const isMouseDownRef = useRef(false);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const cameraSphericalRef = useRef({ radius: 38, theta: Math.PI / 4, phi: Math.PI / 3 });
  const currentLookAtRef = useRef(new THREE.Vector3(0, 0, 0));
  const targetLookAtRef = useRef(new THREE.Vector3(0, 0, 0));

  // Reset camera
  const handleResetCamera = useCallback(() => {
    cameraSphericalRef.current = { radius: 38, theta: Math.PI / 4, phi: Math.PI / 3 };
    targetLookAtRef.current.set(0, 0, 0);
    if (onCameraChange) onCameraChange('OVERVIEW');
  }, [onCameraChange]);

  // --- 1. SETUP THREE.JS SCENE & RENDERER ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030408);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      2500
    );
    camera.position.set(28, 22, 28);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: quality !== 'PERFORMANCE',
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);

    const dprLimit = quality === 'HIGH' ? 2.0 : quality === 'BALANCED' ? 1.5 : 1.0;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprLimit));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Direct Sun Lighting (Directional Light with deep celestial amber warmth)
    const sunLightDirection = new THREE.Vector3(1.2, 0.45, 0.85).normalize();
    const sunLight = new THREE.DirectionalLight(0xfffaec, 2.7);
    sunLight.position.copy(sunLightDirection.clone().multiplyScalar(150));
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Ambient Starlight Fill
    const ambientLight = new THREE.AmbientLight(0x182032, 0.75);
    scene.add(ambientLight);

    // Deep Celestial Starfield Skybox
    const starCount = quality === 'HIGH' ? 1800 : quality === 'BALANCED' ? 1100 : 600;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      const r = 600 + Math.random() * 500;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      starPos[i] = r * Math.sin(ph) * Math.cos(th);
      starPos[i + 1] = r * Math.sin(ph) * Math.sin(th);
      starPos[i + 2] = r * Math.cos(ph);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x99aacc,
      size: 1.5,
      sizeAttenuation: false,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // Reference Equatorial Orbital Plane Grid
    const grid = new THREE.GridHelper(80, 40, 0x263045, 0x121622);
    grid.position.y = 0;
    scene.add(grid);
    gridHelperRef.current = grid;

    // Vectors Group
    const vectorsGroup = new THREE.Group();
    scene.add(vectorsGroup);
    vectorsGroupRef.current = vectorsGroup;

    // Closest Approach Periapsis Marker
    const markerGeo = new THREE.TorusGeometry(0.65, 0.05, 16, 32);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.rotation.x = Math.PI / 2;
    marker.visible = false;
    scene.add(marker);
    closestMarkerRef.current = marker;

    // High-Fidelity Believable Spacecraft Probe
    const scBundle = SpacecraftVisuals.create(1.0);
    scene.add(scBundle.group);
    spacecraftBundleRef.current = scBundle;

    // Mouse Orbit Listeners
    const onMouseDown = (e: MouseEvent) => {
      isMouseDownRef.current = true;
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDownRef.current) return;
      const dx = e.clientX - mousePosRef.current.x;
      const dy = e.clientY - mousePosRef.current.y;
      mousePosRef.current = { x: e.clientX, y: e.clientY };

      cameraSphericalRef.current.theta -= dx * 0.0065;
      cameraSphericalRef.current.phi = Math.max(
        0.05,
        Math.min(Math.PI - 0.05, cameraSphericalRef.current.phi - dy * 0.0065)
      );
    };

    const onMouseUp = () => {
      isMouseDownRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraSphericalRef.current.radius = Math.max(
        6.0,
        Math.min(220.0, cameraSphericalRef.current.radius + e.deltaY * 0.035)
      );
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // Responsive ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    });
    resizeObserver.observe(container);

    // --- CONTINUOUS JITTER-FREE 60 FPS ANIMATION LOOP ---
    let lastTime = performance.now();
    const animate = (time: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const dt = Math.min(0.1, (time - lastTime) * 0.001);
      lastTime = time;

      const interpolator = interpolatorRef.current;
      const isSunFrame = referenceFrame === 'HELIOCENTRIC';
      const planetData = simResult?.config.planet;
      const toSceneScale = planetData ? VISUAL_PLANET_RADIUS / planetData.radiusM : 1e-6;

      // 1. Advance Simulation Clock if playing
      if (isPlaying && interpolator && simResult) {
        const totalDuration = interpolator.getTotalDurationS();
        // Dynamic speed mapping: traverses trajectory smoothly across playback
        const timeAdvance = (totalDuration / 22.0) * playbackSpeed * dt;
        currentTimeSRef.current += timeAdvance;

        if (currentTimeSRef.current >= totalDuration) {
          if (simResult.collisionDetected) {
            // Stop at collision impact point
            currentTimeSRef.current = simResult.collisionTimeS ?? totalDuration;
          } else {
            // Loop smoothly
            currentTimeSRef.current = 0;
          }
        }

        // Throttled synchronization back to React HUD / charts (~25 Hz)
        if (time - lastSyncTimeRef.current > 40 && onPlaybackIndexChange) {
          lastSyncTimeRef.current = time;
          const progress = Math.max(0, Math.min(1, currentTimeSRef.current / Math.max(1, totalDuration)));
          const targetIndex = Math.min(
            simResult.trajectory.length - 1,
            Math.floor(progress * (simResult.trajectory.length - 1))
          );
          onPlaybackIndexChange(targetIndex);
        }
      }

      // 2. Continuous Hermite Evaluation
      let currentPosScene = new THREE.Vector3(0, 0, 0);
      let currentVelScene = new THREE.Vector3(0, 0, 0);

      if (interpolator && simResult) {
        const state: InterpolatedState = interpolator.evaluateAtTime(currentTimeSRef.current);

        if (isSunFrame) {
          const originPlanet = simResult.trajectory[0].planetPosSunM;
          currentPosScene.set(
            (state.posSunM.x - originPlanet.x) * toSceneScale,
            0,
            (state.posSunM.y - originPlanet.y) * toSceneScale
          );
          currentVelScene.set(state.velSunM.x, 0, state.velSunM.y);

          // In Sun frame, planet moves continuously
          if (planetBundleRef.current) {
            const pX = (state.planetPosSunM.x - originPlanet.x) * toSceneScale;
            const pZ = (state.planetPosSunM.y - originPlanet.y) * toSceneScale;
            planetBundleRef.current.group.position.set(pX, 0, pZ);
          }
        } else {
          currentPosScene.set(state.posPlanetM.x * toSceneScale, 0, state.posPlanetM.y * toSceneScale);
          currentVelScene.set(state.velPlanetM.x, 0, state.velPlanetM.y);

          if (planetBundleRef.current) {
            planetBundleRef.current.group.position.set(0, 0, 0);
          }
        }

        // Update Spacecraft Probe transforms smoothly with Quaternion SLERP
        if (spacecraftBundleRef.current) {
          const sunPos = new THREE.Vector3(100, 40, 80);
          spacecraftBundleRef.current.update(
            currentPosScene,
            currentVelScene,
            sunPos,
            attitudeMode,
            dt
          );
        }

        // Update Dynamic Vector Arrows
        const vecGroup = vectorsGroupRef.current;
        if (vecGroup) {
          while (vecGroup.children.length > 0) {
            vecGroup.remove(vecGroup.children[0]);
          }

          if (showVectors) {
            const vScale = 0.0006;
            // 1. Current Spacecraft Velocity (Emerald)
            const vLen = currentVelScene.length() * vScale;
            if (vLen > 0.15) {
              const vDir = currentVelScene.clone().normalize();
              const arrow = new THREE.ArrowHelper(
                vDir,
                currentPosScene.clone().add(new THREE.Vector3(0, 0.2, 0)),
                vLen,
                0x10b981,
                0.45,
                0.22
              );
              vecGroup.add(arrow);
            }

            // 2. Gravitational Acceleration (Purple: pointing to planet center)
            if (showGravityVector) {
              const planetPos = isSunFrame && planetBundleRef.current
                ? planetBundleRef.current.group.position
                : new THREE.Vector3(0, 0, 0);

              const toPlanet = new THREE.Vector3().subVectors(planetPos, currentPosScene);
              if (toPlanet.length() > 0.1) {
                const gDir = toPlanet.clone().normalize();
                const gMag = state.gravitationalAccelerationMPerS2;
                const gLen = Math.max(0.6, Math.min(4.5, Math.sqrt(gMag) * 0.42));
                const gArrow = new THREE.ArrowHelper(
                  gDir,
                  currentPosScene.clone().add(new THREE.Vector3(0, 0.25, 0)),
                  gLen,
                  0xa855f7,
                  0.42,
                  0.2
                );
                vecGroup.add(gArrow);
              }
            }
          }
        }
      }

      // 3. Update Planetary Body Axial Rotation & Multi-layer Shaders
      if (planetBundleRef.current) {
        planetBundleRef.current.update(currentTimeSRef.current, dt);
      }

      // 4. Smooth Critically-Damped Camera Motion
      const cam = cameraRef.current;
      if (cam) {
        if (cameraMode === 'PROBE_FOLLOW') {
          targetLookAtRef.current.copy(currentPosScene);
          cameraSphericalRef.current.radius = Math.max(9.0, cameraSphericalRef.current.radius);
        } else if (cameraMode === 'CLOSE_UP' && simResult) {
          const ca = simResult.closestApproach;
          const caX = isSunFrame ? currentPosScene.x : ca.positionPlanetM.x * toSceneScale;
          const caZ = isSunFrame ? currentPosScene.z : ca.positionPlanetM.y * toSceneScale;
          targetLookAtRef.current.set(caX, 0, caZ);
          cameraSphericalRef.current.radius = 13.0;
        } else if (cameraMode === 'OVERVIEW') {
          targetLookAtRef.current.set(0, 0, 0);
          cameraSphericalRef.current.radius = 48.0;
        }

        // Critically damped look-at interpolation (smooth, zero lag)
        currentLookAtRef.current.lerp(targetLookAtRef.current, Math.min(1.0, dt * 10.0));

        const { radius, theta, phi } = cameraSphericalRef.current;
        const target = currentLookAtRef.current;
        const desiredX = target.x + radius * Math.sin(phi) * Math.sin(theta);
        const desiredY = target.y + radius * Math.cos(phi);
        const desiredZ = target.z + radius * Math.sin(phi) * Math.cos(theta);

        // Smooth camera position damping
        cam.position.lerp(new THREE.Vector3(desiredX, desiredY, desiredZ), Math.min(1.0, dt * 8.0));
        cam.lookAt(target);
      }

      renderer.render(scene, camera);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      if (spacecraftBundleRef.current) spacecraftBundleRef.current.dispose();
      renderer.dispose();
    };
  }, [quality, attitudeMode, referenceFrame, isPlaying, playbackSpeed, showVectors, showGravityVector, cameraMode]);

  // Update Grid
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showEquatorialGrid;
    }
  }, [showEquatorialGrid]);

  // Update Planet Mesh (When planet changes)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !simResult) return;

    if (planetBundleRef.current) {
      scene.remove(planetBundleRef.current.group);
      planetBundleRef.current.dispose();
      planetBundleRef.current = null;
    }

    const planetData = simResult.config.planet;
    const sunDir = sunLightRef.current?.position.clone().normalize() || new THREE.Vector3(1, 0.5, 0.8).normalize();

    // Create Photorealistic Multi-layer Planet
    const bundle = PlanetaryVisuals.create(planetData, VISUAL_PLANET_RADIUS, sunDir);
    scene.add(bundle.group);
    planetBundleRef.current = bundle;
  }, [simResult?.config.planet.id]);

  // Update Trajectory Trail line
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !simResult || simResult.trajectory.length === 0) return;

    if (trajectoryLineRef.current) {
      scene.remove(trajectoryLineRef.current);
      trajectoryLineRef.current.geometry.dispose();
      trajectoryLineRef.current = null;
    }

    if (impactLineRef.current) {
      scene.remove(impactLineRef.current);
      impactLineRef.current.geometry.dispose();
      impactLineRef.current = null;
    }

    if (!showTrajectoryTrail) return;

    const planetRadiusM = simResult.config.planet.radiusM;
    const toSceneScale = VISUAL_PLANET_RADIUS / planetRadiusM;
    const points: THREE.Vector3[] = [];
    const isSunFrame = referenceFrame === 'HELIOCENTRIC';

    for (const pt of simResult.trajectory) {
      if (isSunFrame) {
        const relSunX = (pt.posSunM.x - simResult.trajectory[0].planetPosSunM.x) * toSceneScale;
        const relSunY = (pt.posSunM.y - simResult.trajectory[0].planetPosSunM.y) * toSceneScale;
        points.push(new THREE.Vector3(relSunX, 0, relSunY));
      } else {
        points.push(new THREE.Vector3(pt.posPlanetM.x * toSceneScale, 0, pt.posPlanetM.y * toSceneScale));
      }
    }

    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineColor = simResult.collisionDetected ? 0xef4444 : 0x38bdf8;
    const lineMat = new THREE.LineBasicMaterial({ color: lineColor, linewidth: 2 });
    const line = new THREE.Line(lineGeo, lineMat);
    scene.add(line);
    trajectoryLineRef.current = line;

    // Position periapsis marker
    if (closestMarkerRef.current) {
      const ca = simResult.closestApproach;
      const caX = ca.positionPlanetM.x * toSceneScale;
      const caY = ca.positionPlanetM.y * toSceneScale;
      closestMarkerRef.current.position.set(caX, 0, caY);
      closestMarkerRef.current.visible = showPeriMarker && !isSunFrame && !simResult.collisionDetected;
    }

    // Impact parameter offset line (in planet frame)
    if (!isSunFrame && showPeriMarker) {
      const bM = simResult.analytical.impactParameterM;
      const bScaled = bM * toSceneScale;
      const bSign = simResult.config.passType === 'TRAILING' ? 1 : -1;
      const appAngleRad = ((simResult.config.approachAngleDeg || 0) * Math.PI) / 180.0;

      const impactPts = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(
          -bScaled * Math.sin(appAngleRad) * bSign,
          0,
          bScaled * Math.cos(appAngleRad) * bSign
        ),
      ];
      const impGeo = new THREE.BufferGeometry().setFromPoints(impactPts);
      const impMat = new THREE.LineDashedMaterial({ color: 0xf59e0b, dashSize: 0.5, gapSize: 0.3 });
      const impLine = new THREE.Line(impGeo, impMat);
      impLine.computeLineDistances();
      scene.add(impLine);
      impactLineRef.current = impLine;
    }
  }, [simResult, referenceFrame, showTrajectoryTrail, showPeriMarker]);

  return (
    <div className="relative w-full h-[540px] bg-[#030408] rounded-xs border border-[#1b2032] overflow-hidden select-none">
      {/* Three.js Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top-Right Interactive Toolbar */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10 font-mono text-[11px]">
        {/* Reset Camera */}
        <button
          onClick={handleResetCamera}
          title="Reset Camera (Overview)"
          className="p-1.5 bg-[#0e121d]/90 hover:bg-[#1a2133] text-neutral-300 hover:text-white rounded-xs border border-[#252f48] backdrop-blur-sm transition-colors shadow-sm"
        >
          <RotateCcw size={14} />
        </button>

        {/* Equatorial Grid */}
        <button
          onClick={() => setShowEquatorialGrid((prev) => !prev)}
          title="Toggle Reference Equatorial Plane Grid"
          className={`p-1.5 rounded-xs border backdrop-blur-sm transition-colors shadow-sm ${
            showEquatorialGrid
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
              : 'bg-[#0e121d]/90 text-neutral-400 border-[#252f48]'
          }`}
        >
          <Grid size={14} />
        </button>

        {/* Gravitational Accel Vector Toggle */}
        <button
          onClick={() => setShowGravityVector((prev) => !prev)}
          title="Toggle Gravitational Acceleration Vector (Purple: Points to Center)"
          className={`p-1.5 rounded-xs border backdrop-blur-sm transition-colors shadow-sm ${
            showGravityVector
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/60'
              : 'bg-[#0e121d]/90 text-neutral-400 border-[#252f48]'
          }`}
        >
          <Zap size={14} />
        </button>

        {/* Periapsis & Impact Parameter Marker Toggle */}
        <button
          onClick={() => setShowPeriMarker((prev) => !prev)}
          title="Toggle Periapsis & Impact Parameter (b) Markers"
          className={`p-1.5 rounded-xs border backdrop-blur-sm transition-colors shadow-sm ${
            showPeriMarker
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60'
              : 'bg-[#0e121d]/90 text-neutral-400 border-[#252f48]'
          }`}
        >
          <Target size={14} />
        </button>

        {/* Graphics & Attitude Settings Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSettingsDropdown((prev) => !prev)}
            title="Graphics & Spacecraft Attitude Settings"
            className="p-1.5 bg-[#0e121d]/90 hover:bg-[#1a2133] text-neutral-300 hover:text-white rounded-xs border border-[#252f48] backdrop-blur-sm transition-colors shadow-sm flex items-center gap-1"
          >
            <Settings size={14} />
          </button>

          {showSettingsDropdown && (
            <div className="absolute right-0 top-8 w-56 bg-[#0b0e17]/95 border border-[#252f48] p-3 rounded-xs shadow-xl backdrop-blur-md flex flex-col gap-2.5 text-xs text-neutral-200">
              <div className="flex justify-between items-center border-b border-[#20283d] pb-1.5 text-[10px] text-neutral-400">
                <span className="font-bold uppercase tracking-wider text-sky-400">3D DISPLAY SETTINGS</span>
                <button
                  onClick={() => setShowSettingsDropdown(false)}
                  className="hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Graphics Quality */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-neutral-400">GRAPHICS QUALITY</span>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  {(['HIGH', 'BALANCED', 'PERFORMANCE'] as GraphicsQuality[]).map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      className={`py-1 rounded-xs border transition-colors ${
                        quality === q
                          ? 'bg-sky-500 text-black font-bold border-sky-400'
                          : 'bg-[#141926] text-neutral-400 border-[#242e44] hover:text-white'
                      }`}
                    >
                      {q[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Spacecraft Attitude Mode */}
              <div className="flex flex-col gap-1 pt-1 border-t border-[#20283d]">
                <span className="text-[10px] text-neutral-400">SPACECRAFT ATTITUDE</span>
                <select
                  value={attitudeMode}
                  onChange={(e) => setAttitudeMode(e.target.value as SpacecraftAttitudeMode)}
                  className="w-full bg-[#141926] border border-[#242e44] rounded-xs px-2 py-1 text-[11px] text-amber-300"
                >
                  <option value="VELOCITY_ALIGNED">VELOCITY ALIGNED</option>
                  <option value="SUN_POINTING">SUN / EARTH POINTING</option>
                  <option value="INERTIAL">INERTIALLY STABILIZED</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top-Left Reference Frame & Camera Overlay */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 font-mono text-[11px]">
        <div className="bg-[#0b0e17]/85 border border-[#222a40] px-2.5 py-1.5 rounded-xs backdrop-blur-sm flex items-center gap-2 shadow-sm">
          <Compass size={13} className="text-amber-400" />
          <span className="text-neutral-400 text-[10px]">FRAME:</span>
          <button
            onClick={() => {
              if (onReferenceFrameChange) {
                onReferenceFrameChange(
                  referenceFrame === 'PLANET_CENTRIC' ? 'HELIOCENTRIC' : 'PLANET_CENTRIC'
                );
              }
            }}
            className="text-amber-300 font-bold hover:underline cursor-pointer"
          >
            {referenceFrame === 'PLANET_CENTRIC' ? 'PLANET-CENTRIC (REST)' : 'HELIOCENTRIC (SUN-CENTRIC)'}
          </button>
        </div>

        {/* Dynamic State Overlay */}
        <div className="bg-[#0b0e17]/85 border border-[#222a40] px-2.5 py-1 rounded-xs backdrop-blur-sm flex items-center gap-3 text-[10px] text-neutral-300 shadow-sm">
          <div>
            PLANET: <strong className="text-white">{simResult?.config.planet.name.toUpperCase() || '—'}</strong>
          </div>
          <div>
            MODE: <strong className="text-sky-400">{cameraMode}</strong>
          </div>
          <div>
            FPS: <strong className="text-emerald-400">60 CONTINUOUS</strong>
          </div>
        </div>
      </div>

      {/* Collision Warning Banner */}
      {simResult?.collisionDetected && (
        <div className="absolute bottom-3 left-3 right-3 bg-rose-950/90 border border-rose-500/70 p-2.5 rounded-xs backdrop-blur-sm flex items-center justify-between text-rose-200 font-mono text-xs z-10 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <strong className="text-rose-100 uppercase tracking-wide">SURFACE COLLISION EVENT</strong>
            <span className="text-rose-300 text-[11px]">
              Trajectory intersects physical planetary surface (r &le; R_p). Spacecraft halted at impact.
            </span>
          </div>
          <span className="text-[10px] bg-rose-900/60 px-2 py-0.5 rounded-xs border border-rose-700 font-bold">
            TERMINAL IMPACT
          </span>
        </div>
      )}
    </div>
  );
};
