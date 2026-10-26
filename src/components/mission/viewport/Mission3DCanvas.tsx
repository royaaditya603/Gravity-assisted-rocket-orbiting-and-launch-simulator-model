import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import {
  MissionAnalysisResult,
  MissionTrajectorySample,
} from '../../../physics/MissionEngine';
import {
  PlanetaryEphemerisEngine,
  JPL_PLANETARY_ELEMENTS,
} from '../../../physics/PlanetaryEphemeris';
import { AU } from '../../../physics/constants';
import {
  RotateCcw,
  Compass,
  Eye,
  Crosshair,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Info,
} from 'lucide-react';

export type MissionCameraView = 'TOP_DOWN' | 'OBLIQUE' | 'FOCUS_SPACECRAFT' | 'FREE';

interface Mission3DCanvasProps {
  mission: MissionAnalysisResult;
  currentTimeDays: number;
  selectedPlanetId: string | null;
  onSelectPlanet: (planetId: string | null) => void;
  showOrbits: boolean;
  showLabels: boolean;
  showVectors: boolean;
  heightClass?: string;
}

// Visual scaling factor: 1 AU in meters mapped to Three.js units
const SCENE_SCALE = 10.0; // 1 AU = 10 Three.js units

export const Mission3DCanvas: React.FC<Mission3DCanvasProps> = ({
  mission,
  currentTimeDays,
  selectedPlanetId,
  onSelectPlanet,
  showOrbits = true,
  showLabels = true,
  showVectors = true,
  heightClass = 'h-[580px]',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const [cameraView, setCameraView] = useState<MissionCameraView>('OBLIQUE');
  const [hoveredPlanet, setHoveredPlanet] = useState<string | null>(null);

  // References to dynamic 3D objects
  const planetMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const orbitLinesRef = useRef<THREE.Group | null>(null);
  const trajectoryLinesRef = useRef<THREE.Group | null>(null);
  const encounterPinsRef = useRef<THREE.Group | null>(null);
  const spacecraftMarkerRef = useRef<THREE.Group | null>(null);
  const velVectorArrowRef = useRef<THREE.ArrowHelper | null>(null);

  // Mouse interaction state for camera controls
  const isDraggingRef = useRef<boolean>(false);
  const dragButtonRef = useRef<number>(0);
  const previousMousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraThetaRef = useRef<number>(Math.PI / 4.0);
  const cameraPhiRef = useRef<number>(Math.PI / 3.0);
  const cameraDistanceRef = useRef<number>(140.0);
  const cameraTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // Current spacecraft state from time
  const currentSample: MissionTrajectorySample = useMemo(() => {
    if (!mission.fullTrajectory || mission.fullTrajectory.length === 0) {
      return {
        timeS: 0,
        timeDays: 0,
        epochUTC: mission.departureEpochUTC,
        julianDate: 0,
        posM: new THREE.Vector3(AU, 0, 0) as any,
        velMPerS: new THREE.Vector3(0, 30000, 0) as any,
        distanceAU: 1.0,
        speedKmPerS: 30.0,
        specificEnergyMJPerKg: 0,
        activeLegIndex: 1,
      };
    }

    // Find sample closest to currentTimeDays
    let closest = mission.fullTrajectory[0];
    let minDiff = Math.abs(closest.timeDays - currentTimeDays);
    for (let i = 1; i < mission.fullTrajectory.length; i++) {
      const diff = Math.abs(mission.fullTrajectory[i].timeDays - currentTimeDays);
      if (diff < minDiff) {
        minDiff = diff;
        closest = mission.fullTrajectory[i];
      }
    }
    return closest;
  }, [mission.fullTrajectory, currentTimeDays, mission.departureEpochUTC]);

  // Set camera view preset
  const applyCameraView = useCallback((view: MissionCameraView) => {
    setCameraView(view);
    if (view === 'TOP_DOWN') {
      cameraThetaRef.current = 0;
      cameraPhiRef.current = 0.001; // Almost 0 to keep up vector stable
      cameraDistanceRef.current = 150.0;
      cameraTargetRef.current.set(0, 0, 0);
    } else if (view === 'OBLIQUE') {
      cameraThetaRef.current = Math.PI / 4.0;
      cameraPhiRef.current = Math.PI / 3.2;
      cameraDistanceRef.current = 140.0;
      cameraTargetRef.current.set(0, 0, 0);
    } else if (view === 'FOCUS_SPACECRAFT') {
      const posSC = currentSample.posM;
      const x = (posSC.x / AU) * SCENE_SCALE;
      const y = (posSC.y / AU) * SCENE_SCALE;
      const z = (posSC.z / AU) * SCENE_SCALE;
      cameraTargetRef.current.set(x, z, -y); // Y-up Three.js
      cameraDistanceRef.current = 30.0;
    }
  }, [currentSample]);

  // Reset view handler
  const handleResetView = () => {
    applyCameraView('OBLIQUE');
  };

  // Setup Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06070c);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000.0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Subtle starfield
    const starCount = 1200;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      const rad = 600.0 + Math.random() * 800.0;
      const u = Math.random();
      const v = Math.random();
      const theta = 2.0 * Math.PI * u;
      const phi = Math.acos(2.0 * v - 1.0);
      starPositions[i] = rad * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = rad * Math.sin(phi) * Math.sin(theta);
      starPositions[i + 2] = rad * Math.cos(phi);
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0x8892b0,
      size: 1.5,
      transparent: true,
      opacity: 0.65,
    });
    const starfield = new THREE.Points(starGeometry, starMaterial);
    scene.add(starfield);

    // Ecliptic Plane Grid (Subtle AU reference)
    const eclipticGrid = new THREE.GridHelper(300, 30, 0x1f293d, 0x111624);
    eclipticGrid.position.set(0, -0.05, 0);
    scene.add(eclipticGrid);

    // Central Sun
    const sunGroup = new THREE.Group();
    const sunGeom = new THREE.SphereGeometry(2.5, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    sunGroup.add(sunMesh);

    // Sun Corona Glow
    const coronaGeom = new THREE.SphereGeometry(3.6, 24, 24);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xffa040,
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide,
    });
    const coronaMesh = new THREE.Mesh(coronaGeom, coronaMat);
    sunGroup.add(coronaMesh);
    scene.add(sunGroup);

    // Ambient & Point Lighting
    const sunLight = new THREE.PointLight(0xffffff, 2.5, 2000);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    const ambLight = new THREE.AmbientLight(0x3a4055, 0.8);
    scene.add(ambLight);

    // Groups for dynamic elements
    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);
    orbitLinesRef.current = orbitGroup;

    const trajGroup = new THREE.Group();
    scene.add(trajGroup);
    trajectoryLinesRef.current = trajGroup;

    const encGroup = new THREE.Group();
    scene.add(encGroup);
    encounterPinsRef.current = encGroup;

    // Spacecraft Marker Group
    const scGroup = new THREE.Group();
    const scGeom = new THREE.OctahedronGeometry(0.8);
    const scMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: false });
    const scMesh = new THREE.Mesh(scGeom, scMat);
    scGroup.add(scMesh);

    // Velocity vector arrow
    const velArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      4.0,
      0x00f0ff,
      1.2,
      0.8
    );
    scGroup.add(velArrow);
    velVectorArrowRef.current = velArrow;

    scene.add(scGroup);
    spacecraftMarkerRef.current = scGroup;

    // Animation Loop
    let animId: number;
    const render = () => {
      animId = requestAnimationFrame(render);

      // Update camera position based on spherical coordinates
      const cam = cameraRef.current;
      if (cam) {
        const phi = Math.max(0.01, Math.min(Math.PI / 2.05, cameraPhiRef.current));
        const theta = cameraThetaRef.current;
        const d = cameraDistanceRef.current;
        const target = cameraTargetRef.current;

        cam.position.x = target.x + d * Math.sin(phi) * Math.sin(theta);
        cam.position.y = target.y + d * Math.cos(phi);
        cam.position.z = target.z + d * Math.sin(phi) * Math.cos(theta);
        cam.lookAt(target);
      }

      renderer.render(scene, camera);
    };
    render();

    // Window Resize Handler
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Update Planetary Orbits and Mesh Positions
  useEffect(() => {
    const scene = sceneRef.current;
    const orbitGroup = orbitLinesRef.current;
    if (!scene || !orbitGroup) return;

    // Clear old orbit lines and meshes
    orbitGroup.clear();
    for (const mesh of planetMeshesRef.current.values()) {
      scene.remove(mesh);
    }
    planetMeshesRef.current.clear();

    const jd = currentSample.julianDate || 2451545.0;

    // Planets to render
    const planetIds = ['MERCURY', 'VENUS', 'EARTH', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE'];

    for (const pid of planetIds) {
      const pRecord = JPL_PLANETARY_ELEMENTS[pid];
      if (!pRecord) continue;

      const pState = PlanetaryEphemerisEngine.getPlanetState(pid, jd, mission.motionMode);

      // 1. Draw Orbit Ring
      if (showOrbits) {
        const aAU = pRecord.a0;
        const pts: THREE.Vector3[] = [];
        const segs = 128;
        for (let i = 0; i <= segs; i++) {
          const ang = (i / segs) * 2.0 * Math.PI;
          const x = aAU * Math.cos(ang) * SCENE_SCALE;
          const z = -aAU * Math.sin(ang) * SCENE_SCALE; // Three.js Y-up, Z-depth
          pts.push(new THREE.Vector3(x, 0, z));
        }
        const orbitGeom = new THREE.BufferGeometry().setFromPoints(pts);
        const orbitMat = new THREE.LineBasicMaterial({
          color: pid === 'JUPITER' ? 0xd4a373 : pid === 'SATURN' ? 0xe0cda9 : 0x27354a,
          transparent: true,
          opacity: pid === 'JUPITER' || pid === 'SATURN' ? 0.6 : 0.35,
        });
        const orbitLine = new THREE.Line(orbitGeom, orbitMat);
        orbitGroup.add(orbitLine);
      }

      // 2. Planet Sphere Mesh
      // Visual radius scaled for visibility while preserving relative hierarchy
      const baseRadius = pid === 'JUPITER' ? 1.6 : pid === 'SATURN' ? 1.4 : pid === 'URANUS' || pid === 'NEPTUNE' ? 1.0 : 0.6;
      const pGeom = new THREE.SphereGeometry(baseRadius, 20, 20);
      const pMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(pRecord.color),
        roughness: 0.7,
        metalness: 0.1,
      });
      const pMesh = new THREE.Mesh(pGeom, pMat);

      // Coordinate mapping from Heliocentric Ecliptic (X, Y, Z meters) to Three.js (X, Y_up, Z):
      // posM.x -> Three.js X
      // posM.y -> Three.js -Z (orbital plane)
      // posM.z -> Three.js Y (inclination / out-of-ecliptic)
      const posX = (pState.positionM.x / AU) * SCENE_SCALE;
      const posY = (pState.positionM.z / AU) * SCENE_SCALE;
      const posZ = -(pState.positionM.y / AU) * SCENE_SCALE;

      pMesh.position.set(posX, posY, posZ);
      scene.add(pMesh);
      planetMeshesRef.current.set(pid, pMesh);
    }
  }, [mission.motionMode, currentSample.julianDate, showOrbits]);

  // Update Trajectory Curves & Encounter Pins
  useEffect(() => {
    const trajGroup = trajectoryLinesRef.current;
    const encGroup = encounterPinsRef.current;
    if (!trajGroup || !encGroup) return;

    trajGroup.clear();
    encGroup.clear();

    const legColors = [0x38bdf8, 0xfbbf24, 0x34d399, 0xc084fc];

    // Plot each transfer leg curve
    mission.transferLegs.forEach((leg, idx) => {
      const pts: THREE.Vector3[] = leg.trajectorySamples.map((s) => {
        const x = (s.posM.x / AU) * SCENE_SCALE;
        const y = (s.posM.z / AU) * SCENE_SCALE;
        const z = -(s.posM.y / AU) * SCENE_SCALE;
        return new THREE.Vector3(x, y, z);
      });

      if (pts.length > 1) {
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({
          color: legColors[idx % legColors.length],
          linewidth: 2,
          transparent: true,
          opacity: 0.85,
        });
        const line = new THREE.Line(geom, mat);
        trajGroup.add(line);
      }
    });

    // Plot Encounter Milestone Pins
    mission.encounters.forEach((enc) => {
      const x = (enc.planetPosM.x / AU) * SCENE_SCALE;
      const y = (enc.planetPosM.z / AU) * SCENE_SCALE;
      const z = -(enc.planetPosM.y / AU) * SCENE_SCALE;

      const pinGroup = new THREE.Group();
      pinGroup.position.set(x, y, z);

      // Glowing encounter ring
      const ringGeom = new THREE.RingGeometry(2.0, 2.5, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: enc.planetId === 'JUPITER' ? 0xffaa40 : 0x40e0d0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = Math.PI / 2.0;
      pinGroup.add(ringMesh);

      encGroup.add(pinGroup);
    });
  }, [mission]);

  // Update Spacecraft Position & Velocity Arrow
  useEffect(() => {
    const scGroup = spacecraftMarkerRef.current;
    const arrow = velVectorArrowRef.current;
    if (!scGroup || !currentSample) return;

    const x = (currentSample.posM.x / AU) * SCENE_SCALE;
    const y = (currentSample.posM.z / AU) * SCENE_SCALE;
    const z = -(currentSample.posM.y / AU) * SCENE_SCALE;

    scGroup.position.set(x, y, z);

    if (arrow && showVectors) {
      arrow.visible = true;
      const vx = currentSample.velMPerS.x;
      const vy = currentSample.velMPerS.z;
      const vz = -currentSample.velMPerS.y;
      const dir = new THREE.Vector3(vx, vy, vz).normalize();
      arrow.setDirection(dir);
      arrow.setLength(Math.min(6.0, Math.max(2.0, currentSample.speedKmPerS * 0.15)));
    } else if (arrow) {
      arrow.visible = false;
    }
  }, [currentSample, showVectors]);

  // Mouse drag camera controls
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragButtonRef.current = e.button;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - previousMousePositionRef.current.x;
    const deltaY = e.clientY - previousMousePositionRef.current.y;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };

    if (dragButtonRef.current === 0) {
      // Orbit rotation
      cameraThetaRef.current += deltaX * 0.008;
      cameraPhiRef.current -= deltaY * 0.008;
      cameraPhiRef.current = Math.max(0.01, Math.min(Math.PI / 2.05, cameraPhiRef.current));
    } else if (dragButtonRef.current === 2 || e.shiftKey) {
      // Pan camera target
      const factor = cameraDistanceRef.current * 0.0012;
      const forward = new THREE.Vector3(
        -Math.sin(cameraThetaRef.current),
        0,
        -Math.cos(cameraThetaRef.current)
      );
      const right = new THREE.Vector3(
        Math.cos(cameraThetaRef.current),
        0,
        -Math.sin(cameraThetaRef.current)
      );
      cameraTargetRef.current.addScaledVector(right, -deltaX * factor);
      cameraTargetRef.current.addScaledVector(forward, deltaY * factor);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = e.deltaY * 0.08;
    cameraDistanceRef.current = Math.max(10.0, Math.min(400.0, cameraDistanceRef.current + zoomFactor));
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={handleWheel}
      className={`relative w-full ${heightClass} bg-[#06070c] border border-[#222536] overflow-hidden select-none cursor-grab active:cursor-grabbing rounded-xs`}
    >
      {/* Viewport Overlay: Title & Mission Mode Badge */}
      <div className="absolute top-3 left-4 z-10 flex flex-col gap-1 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
            HELIOCENTRIC SOLAR SYSTEM ORRERY
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-xs bg-[#161a29] border border-[#2b334d] text-cyan-300">
            {mission.motionMode} MODE
          </span>
        </div>
        <div className="text-[11px] font-mono text-neutral-400">
          SUN-CENTERED INERTIAL ECLIPTIC FRAME (J2000) • 1 AU = {SCENE_SCALE} UNITS
        </div>
      </div>

      {/* Floating Spacecraft Telemetry Pill (Top Right) */}
      <div className="absolute top-3 right-4 z-10 bg-[#0e111a]/90 backdrop-blur-md border border-[#252b3d] p-3 rounded-xs font-mono text-xs flex flex-col gap-1 text-right text-neutral-300">
        <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
          SPACECRAFT TELEMETRY // {mission.spacecraft.name.toUpperCase()}
        </div>
        <div className="text-white font-bold text-sm">
          {currentSample.distanceAU.toFixed(3)} <span className="text-neutral-400 text-xs">AU</span>
          <span className="text-neutral-500 mx-2">|</span>
          {currentSample.speedKmPerS.toFixed(2)} <span className="text-neutral-400 text-xs">km/s</span>
        </div>
        <div className="text-[10px] text-neutral-400">
          MET: {currentSample.timeDays.toFixed(1)} days ({currentSample.epochUTC.slice(0, 10)})
        </div>
      </div>

      {/* Camera Presets & Control Bar (Bottom Left) */}
      <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2 font-mono text-[11px]">
        <button
          onClick={() => applyCameraView('TOP_DOWN')}
          className={`px-2.5 py-1 rounded-xs border transition-colors ${
            cameraView === 'TOP_DOWN'
              ? 'bg-cyan-500 text-black font-bold border-cyan-400'
              : 'bg-[#121522] text-neutral-300 border-[#252b3d] hover:bg-[#1a1f33]'
          }`}
        >
          TOP-DOWN ECLIPTIC
        </button>
        <button
          onClick={() => applyCameraView('OBLIQUE')}
          className={`px-2.5 py-1 rounded-xs border transition-colors ${
            cameraView === 'OBLIQUE'
              ? 'bg-cyan-500 text-black font-bold border-cyan-400'
              : 'bg-[#121522] text-neutral-300 border-[#252b3d] hover:bg-[#1a1f33]'
          }`}
        >
          OBLIQUE 3D
        </button>
        <button
          onClick={() => applyCameraView('FOCUS_SPACECRAFT')}
          className={`px-2.5 py-1 rounded-xs border transition-colors ${
            cameraView === 'FOCUS_SPACECRAFT'
              ? 'bg-cyan-500 text-black font-bold border-cyan-400'
              : 'bg-[#121522] text-neutral-300 border-[#252b3d] hover:bg-[#1a1f33]'
          }`}
        >
          LOCK PROBE
        </button>
        <button
          onClick={handleResetView}
          className="p-1 rounded-xs bg-[#121522] text-neutral-400 border border-[#252b3d] hover:text-white"
          title="Reset View"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Interactive Legend (Bottom Right) */}
      <div className="absolute bottom-3 right-4 z-10 flex items-center gap-3 bg-[#0e111a]/85 backdrop-blur-md px-3 py-1.5 rounded-xs border border-[#252b3d] text-[10px] font-mono text-neutral-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#ffd166]" />
          <span>SUN</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#38bdf8]" />
          <span>LEG 1 (EARTH→JUP)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#fbbf24]" />
          <span>LEG 2 (JUP→SAT)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#00f0ff]" />
          <span>PROBE</span>
        </div>
      </div>
    </div>
  );
};
