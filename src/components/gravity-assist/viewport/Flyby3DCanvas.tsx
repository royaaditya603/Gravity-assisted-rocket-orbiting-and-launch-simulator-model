import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { FlybySimulationResult, ReferenceFrame } from '../../../physics/FlybyEngine';
import { PlanetaryVisuals, PlanetBundle } from './PlanetaryVisuals';
import { SpacecraftVisuals, SpacecraftBundle, SpacecraftAttitudeMode, SpacecraftModelType } from './SpacecraftVisuals';
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
  spacecraftModel?: SpacecraftModelType;
  onChangeSpacecraftModel?: (model: SpacecraftModelType) => void;
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
  spacecraftModel = 'PROBE',
  onChangeSpacecraftModel,
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

  // Synchronize dynamic props with refs to prevent destroying the Three.js scene
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const playbackSpeedRef = useRef(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;

  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;

  const referenceFrameRef = useRef(referenceFrame);
  referenceFrameRef.current = referenceFrame;

  const showVectorsRef = useRef(showVectors);
  showVectorsRef.current = showVectors;

  const showGravityVectorRef = useRef(showGravityVector);
  showGravityVectorRef.current = showGravityVector;

  const showTrajectoryTrailRef = useRef(showTrajectoryTrail);
  showTrajectoryTrailRef.current = showTrajectoryTrail;

  const attitudeModeRef = useRef(attitudeMode);
  attitudeModeRef.current = attitudeMode;

  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const simResultRef = useRef(simResult);
  simResultRef.current = simResult;

  const onPlaybackIndexChangeRef = useRef(onPlaybackIndexChange);
  onPlaybackIndexChangeRef.current = onPlaybackIndexChange;

  // High-Precision Hermite Interpolator
  const interpolatorRef = useRef<TrajectoryInterpolator | null>(null);
  useEffect(() => {
    if (simResult && simResult.trajectory.length > 0) {
      interpolatorRef.current = new TrajectoryInterpolator(simResult);
    } else {
      interpolatorRef.current = null;
    }
  }, [simResult]);

  // Synchronize 3D Spacecraft Model preference
  useEffect(() => {
    if (spacecraftBundleRef.current && spacecraftModel) {
      spacecraftBundleRef.current.setModelType(spacecraftModel);
    }
  }, [spacecraftModel]);

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
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const surfaceRingRef = useRef<THREE.Mesh | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);

  // Persistent Arrow Helpers (zero GC allocations per frame)
  const velArrowRef = useRef<THREE.ArrowHelper | null>(null);
  const planetVelArrowRef = useRef<THREE.ArrowHelper | null>(null);
  const gravityArrowRef = useRef<THREE.ArrowHelper | null>(null);

  // Precomputed all points in scene coordinates
  const allScenePointsRef = useRef<THREE.Vector3[]>([]);
  const lastDrawnIdxRef = useRef<number>(-1);

  // Continuous Playback Time in Seconds
  const currentTimeSRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);
  const isSeekingExternalRef = useRef<boolean>(false);

  // Sync internal continuous time when currentPlaybackIndex is changed from outside (seeking/reset)
  useEffect(() => {
    if (simResult && simResult.trajectory.length > 0) {
      const idx = Math.min(currentPlaybackIndex, simResult.trajectory.length - 1);
      const targetTimeS = simResult.trajectory[idx].timeS;
      // Only snap if outside normal continuous playback range to avoid jitter
      if (Math.abs(currentTimeSRef.current - targetTimeS) > 1.2 || !isPlayingRef.current) {
        currentTimeSRef.current = targetTimeS;
        lastDrawnIdxRef.current = -1;
      }
    }
  }, [currentPlaybackIndex, simResult]);

  // Smooth Camera State
  const isMouseDownRef = useRef(false);
  const isPanningRef = useRef(false);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const cameraSphericalRef = useRef({ radius: 42, theta: Math.PI / 4, phi: Math.PI / 3 });
  const currentLookAtRef = useRef(new THREE.Vector3(0, 0, 0));
  const targetLookAtRef = useRef(new THREE.Vector3(0, 0, 0));

  // Reset camera
  const handleResetCamera = useCallback(() => {
    cameraSphericalRef.current = { radius: 42, theta: Math.PI / 4, phi: Math.PI / 3 };
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

  // --- 1. SETUP THREE.JS SCENE & RENDERER (MOUNT ONCE) ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    // Soft celestial deep slate background (pastel space palette)
    scene.background = new THREE.Color(0x141a29);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      3000
    );
    camera.position.set(30, 24, 30);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
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
    renderer.toneMappingExposure = 1.15;

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebGlError('WebGL graphics context was lost by the GPU.');
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Direct Sun Lighting (balanced key illumination)
    const sunLightDirection = new THREE.Vector3(1.2, 0.45, 0.85).normalize();
    const sunLight = new THREE.DirectionalLight(0xfff8ee, 2.6);
    sunLight.position.copy(sunLightDirection.clone().multiplyScalar(150));
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Softer ambient fill light to prevent harsh unlit blackness
    const ambientLight = new THREE.AmbientLight(0x28364f, 0.95);
    scene.add(ambientLight);

    // Starfield Skybox with subtle low-contrast stars
    const starCount = 1200;
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
      color: 0x94a9c9,
      size: 1.4,
      transparent: true,
      opacity: 0.45,
      sizeAttenuation: false,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // Reference Equatorial Orbital Plane Grid (Soft pastel slate styling)
    const grid = new THREE.GridHelper(80, 40, 0x2e3a52, 0x1a2233);
    grid.position.y = 0;
    scene.add(grid);
    gridHelperRef.current = grid;

    // Visible Physical Surface Radius Boundary Ring (R_planet = 4.0 scene units)
    const surfaceRingGeo = new THREE.RingGeometry(3.96, 4.04, 64);
    const surfaceRingMat = new THREE.MeshBasicMaterial({
      color: 0x7bb6e8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const surfaceRing = new THREE.Mesh(surfaceRingGeo, surfaceRingMat);
    surfaceRing.rotation.x = Math.PI / 2;
    scene.add(surfaceRing);
    surfaceRingRef.current = surfaceRing;

    // Persistent Vector Arrows Group
    const vectorsGroup = new THREE.Group();
    scene.add(vectorsGroup);

    // 1. Spacecraft Velocity Arrow (Pastel Mint)
    const velArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      1.0,
      0x5dd39e,
      0.45,
      0.22
    );
    velArrow.visible = false;
    vectorsGroup.add(velArrow);
    velArrowRef.current = velArrow;

    // 2. Planet Orbital Velocity Arrow (Pastel Peach)
    const planetVelArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      1.0,
      0xfbb073,
      0.5,
      0.25
    );
    planetVelArrow.visible = false;
    vectorsGroup.add(planetVelArrow);
    planetVelArrowRef.current = planetVelArrow;

    // 3. Gravitational Acceleration Arrow (Pastel Lavender)
    const gravityArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 0),
      1.0,
      0xb39ddb,
      0.42,
      0.2
    );
    gravityArrow.visible = false;
    vectorsGroup.add(gravityArrow);
    gravityArrowRef.current = gravityArrow;

    // Closest Approach Periapsis Marker (Pastel Mint Torus)
    const markerGeo = new THREE.TorusGeometry(0.65, 0.05, 16, 32);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x48cfad });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.rotation.x = Math.PI / 2;
    marker.visible = false;
    scene.add(marker);
    closestMarkerRef.current = marker;

    // Terminal Collision Impact Beacon Group
    const impactGroup = new THREE.Group();
    const impactCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xf28b82 })
    );
    const impactRing = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.75, 32),
      new THREE.MeshBasicMaterial({ color: 0xf87171, side: THREE.DoubleSide })
    );
    impactRing.rotation.x = Math.PI / 2;
    impactGroup.add(impactCore);
    impactGroup.add(impactRing);
    impactGroup.visible = false;
    scene.add(impactGroup);
    impactMarkerRef.current = impactGroup;

    // High-Fidelity Spacecraft (Probe or Launch Vehicle)
    const scBundle = SpacecraftVisuals.create(1.0, spacecraftModel);
    // Distinct high-visibility beacon wireframe marker
    const beaconGeo = new THREE.OctahedronGeometry(0.42);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x7bb6e8, wireframe: true });
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
      const dt = Math.min(0.066, (time - lastTime) * 0.001);
      lastTime = time;

      const interpolator = interpolatorRef.current;
      const activeSim = simResultRef.current;
      const isSunFrame = referenceFrameRef.current === 'HELIOCENTRIC';
      const planetData = activeSim?.config.planet;
      const toSceneScale = planetData ? VISUAL_PLANET_RADIUS / planetData.radiusM : 1e-6;

      // 1. Advance Simulation Clock if playing
      if (isPlayingRef.current && interpolator && activeSim) {
        const totalDuration = interpolator.getTotalDurationS();
        const timeAdvance = (totalDuration / 22.0) * playbackSpeedRef.current * dt;
        currentTimeSRef.current += timeAdvance;

        if (currentTimeSRef.current >= totalDuration) {
          if (activeSim.collisionDetected) {
            currentTimeSRef.current = activeSim.collisionTimeS ?? totalDuration;
          } else {
            currentTimeSRef.current = 0;
          }
        }

        // Throttled synchronization back to React HUD / charts (~25 Hz)
        if (time - lastSyncTimeRef.current > 40 && onPlaybackIndexChangeRef.current) {
          lastSyncTimeRef.current = time;
          const progress = Math.max(0, Math.min(1, currentTimeSRef.current / Math.max(1, totalDuration)));
          const targetIndex = Math.min(
            activeSim.trajectory.length - 1,
            Math.floor(progress * (activeSim.trajectory.length - 1))
          );
          onPlaybackIndexChangeRef.current(targetIndex);
        }
      }

      // 2. Continuous Hermite Evaluation
      let currentPosScene = new THREE.Vector3(0, 0, 0);
      let currentVelScene = new THREE.Vector3(0, 0, 0);

      if (interpolator && activeSim) {
        const state: InterpolatedState = interpolator.evaluateAtTime(currentTimeSRef.current);

        if (isSunFrame) {
          const originPlanet = activeSim.trajectory[0].planetPosSunM;
          currentPosScene.set(
            (state.posSunM.x - originPlanet.x) * toSceneScale,
            0,
            (state.posSunM.y - originPlanet.y) * toSceneScale
          );
          currentVelScene.set(state.velSunM.x, 0, state.velSunM.y);

          if (planetBundleRef.current) {
            const pX = (state.planetPosSunM.x - originPlanet.x) * toSceneScale;
            const pZ = (state.planetPosSunM.y - originPlanet.y) * toSceneScale;
            planetBundleRef.current.group.position.set(pX, 0, pZ);

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

        // Update Spacecraft transforms smoothly with Quaternion SLERP
        if (spacecraftBundleRef.current) {
          const sunPos = new THREE.Vector3(100, 40, 80);
          spacecraftBundleRef.current.update(
            currentPosScene,
            currentVelScene,
            sunPos,
            attitudeModeRef.current,
            dt
          );
        }

        // Smooth Trajectory Trail Update (Past vs Predicted Future)
        if (showTrajectoryTrailRef.current && allScenePointsRef.current.length > 0) {
          const allPts = allScenePointsRef.current;
          const totalDuration = interpolator.getTotalDurationS();
          const progress = Math.max(0, Math.min(1, currentTimeSRef.current / Math.max(1, totalDuration)));
          const curIdx = Math.min(allPts.length - 1, Math.floor(progress * (allPts.length - 1)));

          if (pastLineRef.current) {
            const pastPts = [...allPts.slice(0, curIdx + 1), currentPosScene];
            pastLineRef.current.geometry.setFromPoints(pastPts);
          }

          if (curIdx !== lastDrawnIdxRef.current) {
            lastDrawnIdxRef.current = curIdx;
            if (futureLineRef.current) {
              const futurePts = [currentPosScene, ...allPts.slice(curIdx + 1)];
              futureLineRef.current.geometry.setFromPoints(futurePts);
              futureLineRef.current.computeLineDistances();
            }
          }
        }

        // Update Dynamic Vector Arrows without re-allocation
        if (showVectorsRef.current) {
          const vScale = 0.0006;
          const vLen = currentVelScene.length() * vScale;
          if (velArrowRef.current) {
            if (vLen > 0.15) {
              velArrowRef.current.setDirection(currentVelScene.clone().normalize());
              velArrowRef.current.setLength(vLen, 0.45, 0.22);
              velArrowRef.current.position.copy(currentPosScene).add(new THREE.Vector3(0, 0.2, 0));
              velArrowRef.current.visible = true;
            } else {
              velArrowRef.current.visible = false;
            }
          }

          if (planetVelArrowRef.current) {
            if (isSunFrame && planetBundleRef.current) {
              const pPos = planetBundleRef.current.group.position.clone();
              const pVel = new THREE.Vector3(state.planetVelSunM.x, 0, state.planetVelSunM.y);
              const pVelLen = pVel.length() * vScale;
              if (pVelLen > 0.15) {
                planetVelArrowRef.current.setDirection(pVel.clone().normalize());
                planetVelArrowRef.current.setLength(pVelLen, 0.5, 0.25);
                planetVelArrowRef.current.position.copy(pPos).add(new THREE.Vector3(0, 0.35, 0));
                planetVelArrowRef.current.visible = true;
              } else {
                planetVelArrowRef.current.visible = false;
              }
            } else {
              planetVelArrowRef.current.visible = false;
            }
          }

          if (gravityArrowRef.current) {
            if (showGravityVectorRef.current) {
              const planetPos = isSunFrame && planetBundleRef.current
                ? planetBundleRef.current.group.position
                : new THREE.Vector3(0, 0, 0);

              const toPlanet = new THREE.Vector3().subVectors(planetPos, currentPosScene);
              if (toPlanet.length() > 0.1) {
                const gDir = toPlanet.clone().normalize();
                const gMag = state.gravitationalAccelerationMPerS2;
                const gLen = Math.max(0.6, Math.min(4.5, Math.sqrt(gMag) * 0.42));
                gravityArrowRef.current.setDirection(gDir);
                gravityArrowRef.current.setLength(gLen, 0.42, 0.2);
                gravityArrowRef.current.position.copy(currentPosScene).add(new THREE.Vector3(0, 0.25, 0));
                gravityArrowRef.current.visible = true;
              } else {
                gravityArrowRef.current.visible = false;
              }
            } else {
              gravityArrowRef.current.visible = false;
            }
          }
        } else {
          if (velArrowRef.current) velArrowRef.current.visible = false;
          if (planetVelArrowRef.current) planetVelArrowRef.current.visible = false;
          if (gravityArrowRef.current) gravityArrowRef.current.visible = false;
        }
      }

      // 3. Update Planetary Body Axial Rotation
      if (planetBundleRef.current) {
        planetBundleRef.current.update(currentTimeSRef.current, dt);
      }

      // 4. Stable Camera Motion (Zero Jitter / Zero Vibration)
      const cam = cameraRef.current;
      if (cam) {
        const mode = cameraModeRef.current;
        const { radius, theta, phi } = cameraSphericalRef.current;

        if (mode === 'PROBE_FOLLOW') {
          // Rigidly and critically-damped lock to spacecraft without dual-lag oscillation
          const desiredX = currentPosScene.x + radius * Math.sin(phi) * Math.sin(theta);
          const desiredY = currentPosScene.y + radius * Math.cos(phi);
          const desiredZ = currentPosScene.z + radius * Math.sin(phi) * Math.cos(theta);

          if (reducedMotionRef.current) {
            cam.position.set(desiredX, desiredY, desiredZ);
            currentLookAtRef.current.copy(currentPosScene);
          } else {
            const trackRate = Math.min(1.0, dt * 14.0);
            cam.position.lerp(new THREE.Vector3(desiredX, desiredY, desiredZ), trackRate);
            currentLookAtRef.current.lerp(currentPosScene, trackRate);
          }
          cam.lookAt(currentLookAtRef.current);
        } else if (mode === 'CLOSE_UP' && activeSim) {
          const ca = activeSim.closestApproach;
          const caX = isSunFrame ? currentPosScene.x : ca.positionPlanetM.x * toSceneScale;
          const caZ = isSunFrame ? currentPosScene.z : ca.positionPlanetM.y * toSceneScale;
          targetLookAtRef.current.set(caX, 0, caZ);

          const desiredX = caX + radius * Math.sin(phi) * Math.sin(theta);
          const desiredY = radius * Math.cos(phi);
          const desiredZ = caZ + radius * Math.sin(phi) * Math.cos(theta);

          if (reducedMotionRef.current) {
            cam.position.set(desiredX, desiredY, desiredZ);
            currentLookAtRef.current.copy(targetLookAtRef.current);
          } else {
            cam.position.lerp(new THREE.Vector3(desiredX, desiredY, desiredZ), Math.min(1.0, dt * 8.0));
            currentLookAtRef.current.lerp(targetLookAtRef.current, Math.min(1.0, dt * 8.0));
          }
          cam.lookAt(currentLookAtRef.current);
        } else if (mode === 'OVERVIEW') {
          targetLookAtRef.current.set(0, 0, 0);
          const desiredX = radius * Math.sin(phi) * Math.sin(theta);
          const desiredY = radius * Math.cos(phi);
          const desiredZ = radius * Math.sin(phi) * Math.cos(theta);

          if (reducedMotionRef.current) {
            cam.position.set(desiredX, desiredY, desiredZ);
            currentLookAtRef.current.set(0, 0, 0);
          } else {
            cam.position.lerp(new THREE.Vector3(desiredX, desiredY, desiredZ), Math.min(1.0, dt * 8.0));
            currentLookAtRef.current.lerp(targetLookAtRef.current, Math.min(1.0, dt * 8.0));
          }
          cam.lookAt(currentLookAtRef.current);
        } else {
          // FREE camera mode
          const target = currentLookAtRef.current;
          const desiredX = target.x + radius * Math.sin(phi) * Math.sin(theta);
          const desiredY = target.y + radius * Math.cos(phi);
          const desiredZ = target.z + radius * Math.sin(phi) * Math.cos(theta);
          cam.position.set(desiredX, desiredY, desiredZ);
          cam.lookAt(target);
        }
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
      if (planetBundleRef.current) planetBundleRef.current.dispose();
      if (spacecraftBundleRef.current) spacecraftBundleRef.current.dispose();
      renderer.dispose();
    };
  }, []); // Mounts once and runs continuously without teardown

  // Update Grid Visibility dynamically
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showEquatorialGrid;
    }
  }, [showEquatorialGrid]);

  // Planet identity for stable visual bundle updates
  const planetKey = useMemo(() => {
    if (!simResult?.config.planet) return undefined;
    return ('id' in simResult.config.planet && (simResult.config.planet as any).id) || simResult.config.planet.name;
  }, [simResult?.config.planet]);

  // Update Planet Mesh when selected planet configuration changes
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

    // 1. Past Trajectory (Pastel Sky Blue, Solid)
    const pastGeo = new THREE.BufferGeometry().setFromPoints(points.slice(0, 2));
    const pastMat = new THREE.LineBasicMaterial({
      color: simResult.collisionDetected ? 0xf87171 : 0x7bb6e8,
      linewidth: 2,
    });
    const pastLine = new THREE.Line(pastGeo, pastMat);
    scene.add(pastLine);
    pastLineRef.current = pastLine;

    // 2. Predicted Future Trajectory (Pastel Lavender, Dashed)
    const futureGeo = new THREE.BufferGeometry().setFromPoints(points);
    const futureMat = new THREE.LineDashedMaterial({
      color: simResult.collisionDetected ? 0xfca5a5 : 0xbba7eb,
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
        mat.color.setHex(simResult.collisionDetected ? 0xf87171 : 0x7bb6e8);
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
      const impMat = new THREE.LineDashedMaterial({ color: 0xfbb073, dashSize: 0.5, gapSize: 0.3 });
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
    <div className={`relative w-full ${heightClass} bg-[#141a29] rounded-xl border border-[#DCE3EE] shadow-sm overflow-hidden select-none`}>
      {/* Three.js Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Frame / Viewport Title Banner */}
      {title && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/90 border border-[#DCE3EE] px-3.5 py-1 rounded-full backdrop-blur-md z-10 text-[11px] font-mono font-bold tracking-wider text-[#263247] shadow-sm">
          {title}
        </div>
      )}

      {/* Top-Right Viewport Controls (Pastel UI buttons) */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10 font-mono text-[11px]">
        {/* Reset Camera */}
        <button
          onClick={handleResetCamera}
          title="Reset Camera (Overview)"
          className="p-2 bg-white/90 hover:bg-[#EEF2F8] text-[#263247] hover:text-[#1E293B] rounded-lg border border-[#DCE3EE] backdrop-blur-md transition-colors shadow-xs cursor-pointer"
        >
          <RotateCcw size={14} />
        </button>

        {/* Zoom In */}
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="p-2 bg-white/90 hover:bg-[#EEF2F8] text-[#263247] hover:text-[#1E293B] rounded-lg border border-[#DCE3EE] backdrop-blur-md transition-colors shadow-xs cursor-pointer"
        >
          <ZoomIn size={14} />
        </button>

        {/* Zoom Out */}
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="p-2 bg-white/90 hover:bg-[#EEF2F8] text-[#263247] hover:text-[#1E293B] rounded-lg border border-[#DCE3EE] backdrop-blur-md transition-colors shadow-xs cursor-pointer"
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
          className={`p-2 rounded-lg border backdrop-blur-md transition-colors shadow-xs cursor-pointer ${
            cameraMode === 'PROBE_FOLLOW'
              ? 'bg-[#A9D4F5]/30 text-[#1E5F8A] border-[#A9D4F5] font-bold'
              : 'bg-white/90 text-[#68758A] border-[#DCE3EE] hover:text-[#263247] hover:bg-[#EEF2F8]'
          }`}
        >
          <Crosshair size={14} />
        </button>

        {/* Equatorial Grid Toggle */}
        <button
          onClick={() => setShowEquatorialGrid((prev) => !prev)}
          title="Toggle Reference Equatorial Plane Grid"
          className={`p-2 rounded-lg border backdrop-blur-md transition-colors shadow-xs cursor-pointer ${
            showEquatorialGrid
              ? 'bg-[#FFD2B8]/40 text-[#9C4217] border-[#FFD2B8] font-bold'
              : 'bg-white/90 text-[#68758A] border-[#DCE3EE] hover:text-[#263247] hover:bg-[#EEF2F8]'
          }`}
        >
          <Grid size={14} />
        </button>

        {/* Gravitational Accel Vector Toggle */}
        <button
          onClick={() => setShowGravityVector((prev) => !prev)}
          title="Toggle Gravitational Acceleration Vector"
          className={`p-2 rounded-lg border backdrop-blur-md transition-colors shadow-xs cursor-pointer ${
            showGravityVector
              ? 'bg-[#C9BDF2]/40 text-[#5B478F] border-[#C9BDF2] font-bold'
              : 'bg-white/90 text-[#68758A] border-[#DCE3EE] hover:text-[#263247] hover:bg-[#EEF2F8]'
          }`}
        >
          <Zap size={14} />
        </button>

        {/* Periapsis & Impact Parameter Marker Toggle */}
        <button
          onClick={() => setShowPeriMarker((prev) => !prev)}
          title="Toggle Periapsis & Impact Parameter (b) Markers"
          className={`p-2 rounded-lg border backdrop-blur-md transition-colors shadow-xs cursor-pointer ${
            showPeriMarker
              ? 'bg-[#AEE5D0]/40 text-[#1D6C50] border-[#AEE5D0] font-bold'
              : 'bg-white/90 text-[#68758A] border-[#DCE3EE] hover:text-[#263247] hover:bg-[#EEF2F8]'
          }`}
        >
          <Target size={14} />
        </button>

        {/* Settings Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSettingsDropdown((prev) => !prev)}
            title="Graphics & Spacecraft Settings"
            className="p-2 bg-white/90 hover:bg-[#EEF2F8] text-[#263247] hover:text-[#1E293B] rounded-lg border border-[#DCE3EE] backdrop-blur-md transition-colors shadow-xs cursor-pointer flex items-center gap-1"
          >
            <Settings size={14} />
          </button>

          {showSettingsDropdown && (
            <div className="absolute right-0 top-10 w-60 bg-white/95 border border-[#DCE3EE] p-3.5 rounded-xl shadow-lg backdrop-blur-md flex flex-col gap-3 text-xs text-[#263247] z-50">
              <div className="flex justify-between items-center border-b border-[#EEF2F8] pb-2 text-[10px] text-[#68758A]">
                <span className="font-bold uppercase tracking-wider text-[#1E5F8A]">VIEWPORT DISPLAY</span>
                <button
                  onClick={() => setShowSettingsDropdown(false)}
                  className="hover:text-[#263247] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Graphics Quality */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-[#68758A] font-bold uppercase">GRAPHICS QUALITY</span>
                <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                  {(['HIGH', 'BALANCED', 'PERFORMANCE'] as GraphicsQuality[]).map((q) => (
                    <button
                      key={q}
                      onClick={() => setInternalQuality(q)}
                      className={`py-1.5 rounded-md border text-center transition-colors cursor-pointer ${
                        quality === q
                          ? 'bg-[#A9D4F5] text-[#1D4F7A] font-bold border-[#89C3EE]'
                          : 'bg-[#EEF2F8] text-[#68758A] border-[#DCE3EE] hover:text-[#263247]'
                      }`}
                    >
                      {q[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Spacecraft 3D Model Selection */}
              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-[#EEF2F8]">
                <span className="text-[10px] text-[#68758A] font-bold uppercase">SPACECRAFT MODEL</span>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <button
                    onClick={() => {
                      if (spacecraftBundleRef.current) spacecraftBundleRef.current.setModelType('PROBE');
                      onChangeSpacecraftModel?.('PROBE');
                    }}
                    className={`py-1.5 px-2 rounded-md border text-center transition-colors cursor-pointer ${
                      (spacecraftBundleRef.current?.modelType || spacecraftModel) === 'PROBE'
                        ? 'bg-[#FFD2B8] text-[#8C3A0F] font-bold border-[#F5B892]'
                        : 'bg-[#EEF2F8] text-[#68758A] border-[#DCE3EE] hover:text-[#263247]'
                    }`}
                  >
                    PROBE
                  </button>
                  <button
                    onClick={() => {
                      if (spacecraftBundleRef.current) spacecraftBundleRef.current.setModelType('ROCKET');
                      onChangeSpacecraftModel?.('ROCKET');
                    }}
                    className={`py-1.5 px-2 rounded-md border text-center transition-colors cursor-pointer ${
                      (spacecraftBundleRef.current?.modelType || spacecraftModel) === 'ROCKET'
                        ? 'bg-[#FFD2B8] text-[#8C3A0F] font-bold border-[#F5B892]'
                        : 'bg-[#EEF2F8] text-[#68758A] border-[#DCE3EE] hover:text-[#263247]'
                    }`}
                  >
                    ROCKET
                  </button>
                </div>
              </div>

              {/* Spacecraft Attitude Mode */}
              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-[#EEF2F8]">
                <span className="text-[10px] text-[#68758A] font-bold uppercase">SPACECRAFT ATTITUDE</span>
                <select
                  value={attitudeMode}
                  onChange={(e) => setAttitudeMode(e.target.value as SpacecraftAttitudeMode)}
                  className="w-full bg-[#EEF2F8] border border-[#DCE3EE] rounded-md px-2 py-1.5 text-[11px] text-[#263247] focus:outline-none focus:border-[#A9D4F5] cursor-pointer"
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
      <div className="absolute top-3 left-3 flex flex-col gap-2 z-10 font-mono text-[11px]">
        <div className="bg-white/90 border border-[#DCE3EE] px-3 py-1.5 rounded-lg backdrop-blur-md flex items-center gap-2 shadow-xs">
          <Compass size={14} className="text-[#B86230]" />
          <span className="text-[#68758A] text-[10px] font-bold">FRAME:</span>
          <span className="text-[#263247] font-bold">
            {referenceFrame === 'PLANET_CENTRIC' ? 'PLANET-CENTRIC (REST FRAME)' : 'SUN-CENTRIC (HELIOCENTRIC FRAME)'}
          </span>
        </div>

        {/* Dynamic State Overlay */}
        <div className="bg-white/90 border border-[#DCE3EE] px-3 py-1 rounded-lg backdrop-blur-md flex items-center gap-3 text-[10px] text-[#263247] shadow-xs">
          <div>
            PLANET: <strong className="text-[#1D4F7A]">{simResult?.config.planet.name.toUpperCase() || '—'}</strong>
          </div>
          <div>
            MODE: <strong className="text-[#6D5AA6]">{cameraMode}</strong>
          </div>
          <div>
            FPS: <strong className="text-[#2D8A68]">60 FPS</strong>
          </div>
        </div>
      </div>

      {/* Loading / Numerical Computation Overlay */}
      {(!simResult || simResult.status === 'RUNNING' || simResult.status === 'INITIALIZED') && (
        <div className="absolute inset-0 bg-[#F5F7FB]/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-3 font-mono text-center">
          <div className="w-8 h-8 border-3 border-[#A9D4F5] border-t-transparent rounded-full animate-spin" />
          <div className="text-[#1E5F8A] text-sm font-bold tracking-wider uppercase">
            {simResult?.status === 'RUNNING'
              ? 'Integrating Trajectory (RK4 Adaptive Sub-Stepping)...'
              : 'Awaiting Simulation State...'}
          </div>
          <div className="text-[#68758A] text-xs max-w-sm">
            Evaluating gravitational equations of motion and computing dual-frame orbital telemetry.
          </div>
        </div>
      )}

      {/* Bottom Scale & Vectors Legend (Pastel styling) */}
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2.5 z-10 font-mono text-[10px] text-[#263247] pointer-events-none bg-white/90 backdrop-blur-md border border-[#DCE3EE] px-3.5 py-1.5 rounded-lg shadow-xs">
        {simResult && (
          <>
            <span className="flex items-center gap-1.5 text-[#68758A]">
              <span className="inline-block w-5 border-b-2 border-[#FFD2B8]" />
              <span>
                SCALE: 4 UNITS = {(simResult.config.planet.radiusM / 1000).toLocaleString()} km (R_p)
              </span>
            </span>
            <span className="text-[#CBD5E1]">|</span>
          </>
        )}
        {showVectors && (
          <>
            <span className="flex items-center gap-1 text-[#2D8A68] font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-[#AEE5D0] inline-block border border-[#2D8A68]" /> Spacecraft Velocity
            </span>
            {referenceFrame === 'HELIOCENTRIC' && (
              <span className="flex items-center gap-1 text-[#B86230] font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFD2B8] inline-block border border-[#B86230]" /> Planet Motion (V_p)
              </span>
            )}
            {showGravityVector && (
              <span className="flex items-center gap-1 text-[#6D5AA6] font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C9BDF2] inline-block border border-[#6D5AA6]" /> Gravity Accel g(r)
              </span>
            )}
          </>
        )}
      </div>

      {/* Collision Warning Banner */}
      {simResult?.collisionDetected && (
        <div className="absolute bottom-3 right-3 bg-[#FEE2E2] border border-[#FCA5A5] px-3.5 py-2 rounded-lg backdrop-blur-sm flex items-center gap-2 text-[#991B1B] font-mono text-xs z-10 shadow-md">
          <ShieldAlert size={15} className="text-[#DC2626] animate-pulse" />
          <strong className="text-[#7F1D1D] uppercase tracking-wide">SURFACE IMPACT EVENT</strong>
          <span className="text-[#B91C1C] text-[10px]">
            T_impact = {simResult.collisionTimeS?.toFixed(1)}s (Altitude 0 km)
          </span>
        </div>
      )}
    </div>
  );
};

export default Flyby3DCanvas;
