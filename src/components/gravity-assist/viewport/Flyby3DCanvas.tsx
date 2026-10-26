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
  Settings,
  ZoomIn,
  ZoomOut,
  Crosshair,
  ShieldAlert,
} from 'lucide-react';
import { WebGLFallbackDisplay } from './WebGLFallbackDisplay';

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
  title?: string;
  heightClass?: string;
  graphicsQuality?: GraphicsQuality;
  reducedMotion?: boolean;
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
  title,
  heightClass = 'h-[540px]',
  graphicsQuality: propQuality,
  reducedMotion = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameIdRef = useRef<number>(0);
  const [webGlError, setWebGlError] = useState<string | null>(null);

  // Graphics Quality & Attitude Mode
  const [internalQuality, setInternalQuality] = useState<GraphicsQuality>('HIGH');
  const quality = propQuality || internalQuality;
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
  const pastLineRef = useRef<THREE.Line | null>(null);
  const futureLineRef = useRef<THREE.Line | null>(null);
  const closestMarkerRef = useRef<THREE.Mesh | null>(null);
  const impactMarkerRef = useRef<THREE.Group | null>(null);
  const impactLineRef = useRef<THREE.Line | null>(null);
  const vectorsGroupRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const surfaceRingRef = useRef<THREE.Mesh | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);

  // Precomputed all points in scene coordinates
  const allScenePointsRef = useRef<THREE.Vector3[]>([]);
  const lastDrawnIdxRef = useRef<number>(-1);

  // Continuous Playback Time in Seconds
  const currentTimeSRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);

  // Sync internal continuous time when currentPlaybackIndex is changed from outside (seeking/reset)
  useEffect(() => {
    if (simResult && simResult.trajectory.length > 0) {
      const idx = Math.min(currentPlaybackIndex, simResult.trajectory.length - 1);
      const targetTimeS = simResult.trajectory[idx].timeS;
      if (Math.abs(currentTimeSRef.current - targetTimeS) > 0.2) {
        currentTimeSRef.current = targetTimeS;
      }
    }
  }, [currentPlaybackIndex, simResult]);

  // Smooth Camera State
  const isMouseDownRef = useRef(false);
  const isPanningRef = useRef(false);
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

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    cameraSphericalRef.current.radius = Math.max(6.0, cameraSphericalRef.current.radius - 5.0);
  }, []);

  const handleZoomOut = useCallback(() => {
    cameraSphericalRef.current.radius = Math.min(220.0, cameraSphericalRef.current.radius + 5.0);
  }, []);

  // --- 1. SETUP THREE.JS SCENE & RENDERER ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040508);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      3000
    );
    camera.position.set(28, 22, 28);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: quality !== 'PERFORMANCE',
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      console.warn('WebGL initialization failed, falling back to 2D telemetry schematic:', err);
      setWebGlError(String(err));
      return;
    }
    renderer.setSize(container.clientWidth, container.clientHeight);

    const dprLimit = quality === 'HIGH' ? 2.0 : quality === 'BALANCED' ? 1.5 : 1.0;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprLimit));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebGlError('WebGL graphics context was lost by the GPU.');
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Direct Sun Lighting
    const sunLightDirection = new THREE.Vector3(1.2, 0.45, 0.85).normalize();
    const sunLight = new THREE.DirectionalLight(0xfffaec, 2.7);
    sunLight.position.copy(sunLightDirection.clone().multiplyScalar(150));
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Ambient Fill
    const ambientLight = new THREE.AmbientLight(0x182032, 0.75);
    scene.add(ambientLight);

    // Starfield Skybox
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

    // Visible Physical Surface Radius Boundary Ring (R_planet = 4.0 scene units)
    const surfaceRingGeo = new THREE.RingGeometry(3.96, 4.04, 64);
    const surfaceRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const surfaceRing = new THREE.Mesh(surfaceRingGeo, surfaceRingMat);
    surfaceRing.rotation.x = Math.PI / 2;
    scene.add(surfaceRing);
    surfaceRingRef.current = surfaceRing;

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

    // Terminal Collision Impact Beacon Group
    const impactGroup = new THREE.Group();
    const impactCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    const impactRing = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.75, 32),
      new THREE.MeshBasicMaterial({ color: 0xff0033, side: THREE.DoubleSide })
    );
    impactRing.rotation.x = Math.PI / 2;
    impactGroup.add(impactCore);
    impactGroup.add(impactRing);
    impactGroup.visible = false;
    scene.add(impactGroup);
    impactMarkerRef.current = impactGroup;

    // High-Fidelity Spacecraft Probe
    const scBundle = SpacecraftVisuals.create(1.0);
    // Add distinct high-visibility beacon marker so spacecraft is recognizable at all zoom levels
    const beaconGeo = new THREE.OctahedronGeometry(0.4);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    scBundle.group.add(beaconMesh);

    scene.add(scBundle.group);
    spacecraftBundleRef.current = scBundle;

    // Mouse Listeners: Orbit & Pan
    const onMouseDown = (e: MouseEvent) => {
      isMouseDownRef.current = true;
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      isPanningRef.current = e.button === 2 || e.button === 1 || e.shiftKey;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDownRef.current) return;
      const dx = e.clientX - mousePosRef.current.x;
      const dy = e.clientY - mousePosRef.current.y;
      mousePosRef.current = { x: e.clientX, y: e.clientY };

      if (isPanningRef.current) {
        // Pan camera lookAt target along screen plane
        const { radius, theta, phi } = cameraSphericalRef.current;
        const panSpeed = 0.0012 * radius;
        const right = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta));
        const forward = new THREE.Vector3(
          -Math.sin(phi) * Math.sin(theta),
          -Math.cos(phi),
          -Math.sin(phi) * Math.cos(theta)
        ).normalize();
        const up = new THREE.Vector3().crossVectors(right, forward).normalize();

        const panDelta = right.clone().multiplyScalar(-dx * panSpeed).add(up.clone().multiplyScalar(dy * panSpeed));
        targetLookAtRef.current.add(panDelta);
        if (onCameraChange) onCameraChange('FREE');
      } else {
        cameraSphericalRef.current.theta -= dx * 0.0065;
        cameraSphericalRef.current.phi = Math.max(
          0.05,
          Math.min(Math.PI - 0.05, cameraSphericalRef.current.phi - dy * 0.0065)
        );
      }
    };

    const onMouseUp = () => {
      isMouseDownRef.current = false;
      isPanningRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraSphericalRef.current.radius = Math.max(
        6.0,
        Math.min(220.0, cameraSphericalRef.current.radius + e.deltaY * 0.035)
      );
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('contextmenu', onContextMenu);

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
        const timeAdvance = (totalDuration / 22.0) * playbackSpeed * dt;
        currentTimeSRef.current += timeAdvance;

        if (currentTimeSRef.current >= totalDuration) {
          if (simResult.collisionDetected) {
            currentTimeSRef.current = simResult.collisionTimeS ?? totalDuration;
          } else {
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

          // In Sun frame, planet moves along its heliocentric orbit
          if (planetBundleRef.current) {
            const pX = (state.planetPosSunM.x - originPlanet.x) * toSceneScale;
            const pZ = (state.planetPosSunM.y - originPlanet.y) * toSceneScale;
            planetBundleRef.current.group.position.set(pX, 0, pZ);

            // Position equatorial grid and surface ring centered on moving planet
            if (gridHelperRef.current) {
              gridHelperRef.current.position.set(pX, 0, pZ);
            }
            if (surfaceRingRef.current) {
              surfaceRingRef.current.position.set(pX, 0, pZ);
            }
          }
        } else {
          currentPosScene.set(state.posPlanetM.x * toSceneScale, 0, state.posPlanetM.y * toSceneScale);
          currentVelScene.set(state.velPlanetM.x, 0, state.velPlanetM.y);

          if (planetBundleRef.current) {
            planetBundleRef.current.group.position.set(0, 0, 0);
          }
          if (gridHelperRef.current) {
            gridHelperRef.current.position.set(0, 0, 0);
          }
          if (surfaceRingRef.current) {
            surfaceRingRef.current.position.set(0, 0, 0);
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

        // Dynamic Split Trajectory Trail Update (Past vs Predicted Future)
        if (showTrajectoryTrail && allScenePointsRef.current.length > 0) {
          const allPts = allScenePointsRef.current;
          const totalDuration = interpolator.getTotalDurationS();
          const progress = Math.max(0, Math.min(1, currentTimeSRef.current / Math.max(1, totalDuration)));
          const curIdx = Math.min(allPts.length - 1, Math.floor(progress * (allPts.length - 1)));

          if (curIdx !== lastDrawnIdxRef.current) {
            lastDrawnIdxRef.current = curIdx;

            if (pastLineRef.current) {
              const pastPts = [...allPts.slice(0, curIdx + 1), currentPosScene];
              pastLineRef.current.geometry.setFromPoints(pastPts);
            }

            if (futureLineRef.current) {
              const futurePts = [currentPosScene, ...allPts.slice(curIdx + 1)];
              futureLineRef.current.geometry.setFromPoints(futurePts);
              futureLineRef.current.computeLineDistances();
            }
          }
        }

        // Update Dynamic Vector Arrows
        const vecGroup = vectorsGroupRef.current;
        if (vecGroup) {
          while (vecGroup.children.length > 0) {
            vecGroup.remove(vecGroup.children[0]);
          }

          if (showVectors) {
            const vScale = 0.0006;
            // 1. Current Spacecraft Velocity (Emerald: v_rel or v_sun)
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

            // 2. In Sun Frame: Planet's orbital velocity vector V_p (Amber/Gold)
            if (isSunFrame && planetBundleRef.current) {
              const pPos = planetBundleRef.current.group.position.clone();
              const pVel = new THREE.Vector3(state.planetVelSunM.x, 0, state.planetVelSunM.y);
              const pVelLen = pVel.length() * vScale;
              if (pVelLen > 0.15) {
                const pDir = pVel.clone().normalize();
                const pArrow = new THREE.ArrowHelper(
                  pDir,
                  pPos.clone().add(new THREE.Vector3(0, 0.35, 0)),
                  pVelLen,
                  0xf59e0b,
                  0.55,
                  0.28
                );
                vecGroup.add(pArrow);
              }
            }

            // 3. Gravitational Acceleration (Purple: pointing to planet center)
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

      // 3. Update Planetary Body Axial Rotation
      if (planetBundleRef.current) {
        planetBundleRef.current.update(currentTimeSRef.current, dt);
      }

      // 4. Smooth Camera Motion
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
          cameraSphericalRef.current.radius = 14.0;
        } else if (cameraMode === 'OVERVIEW') {
          targetLookAtRef.current.set(0, 0, 0);
          cameraSphericalRef.current.radius = 48.0;
        }

        const lookAtRate = reducedMotion ? 1.0 : Math.min(1.0, dt * 10.0);
        currentLookAtRef.current.lerp(targetLookAtRef.current, lookAtRate);

        const { radius, theta, phi } = cameraSphericalRef.current;
        const target = currentLookAtRef.current;
        const desiredX = target.x + radius * Math.sin(phi) * Math.sin(theta);
        const desiredY = target.y + radius * Math.cos(phi);
        const desiredZ = target.z + radius * Math.sin(phi) * Math.cos(theta);

        if (reducedMotion) {
          cam.position.set(desiredX, desiredY, desiredZ);
        } else {
          cam.position.lerp(new THREE.Vector3(desiredX, desiredY, desiredZ), Math.min(1.0, dt * 8.0));
        }
        cam.lookAt(target);
      }

      renderer.render(scene, camera);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('contextmenu', onContextMenu);
      if (spacecraftBundleRef.current) spacecraftBundleRef.current.dispose();
      renderer.dispose();
    };
  }, [quality, attitudeMode, referenceFrame, isPlaying, playbackSpeed, showVectors, showGravityVector, cameraMode]);

  // Update Grid Visibility
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showEquatorialGrid;
    }
  }, [showEquatorialGrid]);

  // Planet identity for stable visual bundle updates
  const planetKey = useMemo(() => {
    if (!simResult?.config.planet) return undefined;
    if (webGlError) {
    return (
      <WebGLFallbackDisplay
        simResult={simResult}
        currentPlaybackIndex={currentPlaybackIndex}
        referenceFrame={referenceFrame}
        errorMessage={webGlError}
        onRetry={() => setWebGlError(null)}
        heightClass={heightClass}
      />
    );
  }

  return ('id' in simResult.config.planet && (simResult.config.planet as any).id) || simResult.config.planet.name;
  }, [simResult?.config.planet]);

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

    const bundle = PlanetaryVisuals.create(planetData, VISUAL_PLANET_RADIUS, sunDir);
    scene.add(bundle.group);
    planetBundleRef.current = bundle;
  }, [planetKey]);

  // Update Trajectory Geometry (Precomputation of allScenePoints & Line Materials)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !simResult || simResult.trajectory.length === 0) return;

    // Clean up existing lines
    if (pastLineRef.current) {
      scene.remove(pastLineRef.current);
      pastLineRef.current.geometry.dispose();
      pastLineRef.current = null;
    }
    if (futureLineRef.current) {
      scene.remove(futureLineRef.current);
      futureLineRef.current.geometry.dispose();
      futureLineRef.current = null;
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

    allScenePointsRef.current = points;
    lastDrawnIdxRef.current = -1;

    // 1. Past Trajectory (Solid Line, High Contrast)
    const pastGeo = new THREE.BufferGeometry().setFromPoints(points.slice(0, 2));
    const pastMat = new THREE.LineBasicMaterial({
      color: simResult.collisionDetected ? 0xef4444 : 0x38bdf8,
      linewidth: 2,
    });
    const pastLine = new THREE.Line(pastGeo, pastMat);
    scene.add(pastLine);
    pastLineRef.current = pastLine;

    // 2. Predicted Future Trajectory (Dashed Muted Line)
    const futureGeo = new THREE.BufferGeometry().setFromPoints(points);
    const futureMat = new THREE.LineDashedMaterial({
      color: simResult.collisionDetected ? 0xf87171 : 0x7dd3fc,
      dashSize: 0.8,
      gapSize: 0.4,
      transparent: true,
      opacity: 0.65,
    });
    const futureLine = new THREE.Line(futureGeo, futureMat);
    futureLine.computeLineDistances();
    scene.add(futureLine);
    futureLineRef.current = futureLine;

    // 3. Closest Approach Periapsis Marker
    if (closestMarkerRef.current) {
      const ca = simResult.closestApproach;
      if (isSunFrame) {
        const originPlanet = simResult.trajectory[0].planetPosSunM;
        const caX = (ca.positionSunM.x - originPlanet.x) * toSceneScale;
        const caZ = (ca.positionSunM.y - originPlanet.y) * toSceneScale;
        closestMarkerRef.current.position.set(caX, 0, caZ);
      } else {
        const caX = ca.positionPlanetM.x * toSceneScale;
        const caZ = ca.positionPlanetM.y * toSceneScale;
        closestMarkerRef.current.position.set(caX, 0, caZ);
      }
      closestMarkerRef.current.visible = showPeriMarker && !simResult.collisionDetected;
    }

    // Update physical surface ring styling on collision
    if (surfaceRingRef.current) {
      const mat = surfaceRingRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.color.setHex(simResult.collisionDetected ? 0xef4444 : 0x38bdf8);
      }
    }

    // 4. Collision Impact Beacon
    if (impactMarkerRef.current) {
      if (simResult.collisionDetected && points.length > 0) {
        const impactPoint = points[points.length - 1];
        impactMarkerRef.current.position.copy(impactPoint);
        impactMarkerRef.current.visible = true;
      } else {
        impactMarkerRef.current.visible = false;
      }
    }

    // 5. Impact parameter offset line (in planet frame)
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

  if (webGlError) {
    return (
      <WebGLFallbackDisplay
        simResult={simResult}
        currentPlaybackIndex={currentPlaybackIndex}
        referenceFrame={referenceFrame}
        errorMessage={webGlError}
        onRetry={() => setWebGlError(null)}
        heightClass={heightClass}
      />
    );
  }

  return (
    <div className={`relative w-full ${heightClass} bg-[#040508] rounded-xs border border-[#1b2032] overflow-hidden select-none`}>
      {/* Three.js Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Frame / Viewport Title Banner (if provided) */}
      {title && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#090b12]/90 border border-[#252f48] px-3 py-1 rounded-xs backdrop-blur-sm z-10 text-[11px] font-mono font-bold tracking-wider text-neutral-200">
          {title}
        </div>
      )}

      {/* Top-Right Viewport Controls */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10 font-mono text-[11px]">
        {/* Reset Camera */}
        <button
          onClick={handleResetCamera}
          title="Reset Camera (Overview)"
          className="p-1.5 bg-[#0e121d]/90 hover:bg-[#1a2133] text-neutral-300 hover:text-white rounded-xs border border-[#252f48] backdrop-blur-sm transition-colors shadow-sm"
        >
          <RotateCcw size={14} />
        </button>

        {/* Zoom In */}
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="p-1.5 bg-[#0e121d]/90 hover:bg-[#1a2133] text-neutral-300 hover:text-white rounded-xs border border-[#252f48] backdrop-blur-sm transition-colors shadow-sm"
        >
          <ZoomIn size={14} />
        </button>

        {/* Zoom Out */}
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="p-1.5 bg-[#0e121d]/90 hover:bg-[#1a2133] text-neutral-300 hover:text-white rounded-xs border border-[#252f48] backdrop-blur-sm transition-colors shadow-sm"
        >
          <ZoomOut size={14} />
        </button>

        {/* Follow Spacecraft Toggle */}
        <button
          onClick={() => {
            if (onCameraChange) {
              onCameraChange(cameraMode === 'PROBE_FOLLOW' ? 'OVERVIEW' : 'PROBE_FOLLOW');
            }
          }}
          title="Follow Spacecraft Camera"
          className={`p-1.5 rounded-xs border backdrop-blur-sm transition-colors shadow-sm ${
            cameraMode === 'PROBE_FOLLOW'
              ? 'bg-sky-500/20 text-sky-300 border-sky-500/60'
              : 'bg-[#0e121d]/90 text-neutral-400 border-[#252f48]'
          }`}
        >
          <Crosshair size={14} />
        </button>

        {/* Equatorial Grid Toggle */}
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
          title="Toggle Gravitational Acceleration Vector (Purple: Points to Planet Center)"
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

        {/* Settings Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSettingsDropdown((prev) => !prev)}
            title="Graphics & Spacecraft Attitude Settings"
            className="p-1.5 bg-[#0e121d]/90 hover:bg-[#1a2133] text-neutral-300 hover:text-white rounded-xs border border-[#252f48] backdrop-blur-sm transition-colors shadow-sm flex items-center gap-1"
          >
            <Settings size={14} />
          </button>

          {showSettingsDropdown && (
            <div className="absolute right-0 top-8 w-56 bg-[#0b0e17]/95 border border-[#252f48] p-3 rounded-xs shadow-xl backdrop-blur-md flex flex-col gap-2.5 text-xs text-neutral-200 z-50">
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
                      onClick={() => setInternalQuality(q)}
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
          <span className="text-amber-300 font-bold">
            {referenceFrame === 'PLANET_CENTRIC' ? 'PLANET-CENTRIC (REST FRAME)' : 'SUN-CENTRIC (HELIOCENTRIC FRAME)'}
          </span>
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
            FPS: <strong className="text-emerald-400">60 FPS</strong>
          </div>
        </div>

        {/* Physical Scale & Radius Representation */}
        {simResult && (
          <div className="bg-[#0b0e17]/85 border border-[#222a40] px-2.5 py-1 rounded-xs backdrop-blur-sm flex flex-wrap items-center gap-2.5 text-[10px] text-neutral-300 shadow-sm">
            <div>
              PHYSICAL RADIUS (R_p):{' '}
              <strong className="text-amber-300">
                {(simResult.config.planet.radiusM / 1000).toLocaleString()} km
              </strong>
            </div>
            <span className="text-neutral-600">|</span>
            <div>
              GRID CELL:{' '}
              <strong className="text-sky-300">
                {(simResult.config.planet.radiusM / 2000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* Loading / Numerical Computation Overlay */}
      {(!simResult || simResult.status === 'RUNNING' || simResult.status === 'INITIALIZED') && (
        <div className="absolute inset-0 bg-[#040508]/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-3 font-mono text-center">
          <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <div className="text-sky-300 text-sm font-bold tracking-wider uppercase">
            {simResult?.status === 'RUNNING'
              ? 'Integrating Trajectory (RK4 Adaptive Sub-Stepping)...'
              : 'Awaiting Simulation State...'}
          </div>
          <div className="text-neutral-400 text-xs max-w-sm">
            Evaluating 2-body gravitational equations of motion and computing dual-frame orbital telemetry.
          </div>
        </div>
      )}

      {/* Bottom Scale & Vectors Legend */}
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2.5 z-10 font-mono text-[10px] text-neutral-300 pointer-events-none bg-[#090b12]/85 backdrop-blur-sm border border-[#20273c] px-3 py-1 rounded-xs shadow-sm">
        {simResult && (
          <>
            <span className="flex items-center gap-1.5 text-neutral-300">
              <span className="inline-block w-6 border-b-2 border-amber-400" />
              <span>
                SCALE: 4 UNITS = {(simResult.config.planet.radiusM / 1000).toLocaleString()} km (R_p)
              </span>
            </span>
            <span className="text-neutral-600">|</span>
          </>
        )}
        {showVectors && (
          <>
            <span className="text-neutral-400">VELOCITY: 1 UNIT = 1.67 km/s</span>
            <span className="text-neutral-600">|</span>
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Spacecraft Velocity
            </span>
            {referenceFrame === 'HELIOCENTRIC' && (
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Planet Orbital Motion (V_p)
              </span>
            )}
            {showGravityVector && (
              <span className="flex items-center gap-1 text-purple-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Gravity Accel g(r)
              </span>
            )}
          </>
        )}
      </div>

      {/* Collision Warning Banner */}
      {simResult?.collisionDetected && (
        <div className="absolute bottom-3 right-3 bg-rose-950/90 border border-rose-500/70 px-3 py-1.5 rounded-xs backdrop-blur-sm flex items-center gap-2 text-rose-200 font-mono text-xs z-10 shadow-lg">
          <ShieldAlert size={14} className="text-rose-400 animate-pulse" />
          <strong className="text-rose-100 uppercase tracking-wide">SURFACE IMPACT EVENT</strong>
          <span className="text-rose-300 text-[10px]">
            T_impact = {simResult.collisionTimeS?.toFixed(1)}s (Altitude 0 km)
          </span>
        </div>
      )}
    </div>
  );
};

export default Flyby3DCanvas;