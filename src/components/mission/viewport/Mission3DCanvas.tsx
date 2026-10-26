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
  Crosshair,
  Layers,
  ZoomIn,
  ZoomOut,
  Target,
} from 'lucide-react';

export type MissionCameraView = 'TOP_DOWN' | 'OBLIQUE' | 'FOCUS_SPACECRAFT' | 'FOCUS_PLANET' | 'FREE';

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

interface PlanetVisualEntity {
  id: string;
  name: string;
  group: THREE.Group;
  mesh: THREE.Mesh;
  halo: THREE.Mesh;
  reticle: THREE.Mesh;
  labelSprite?: THREE.Sprite;
  baseRadius: number;
}

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

  // References to dynamic 3D objects
  const planetEntitiesRef = useRef<Map<string, PlanetVisualEntity>>(new Map());
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
  const cameraPhiRef = useRef<number>(Math.PI / 3.2);
  const cameraDistanceRef = useRef<number>(140.0);
  const cameraTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // Current spacecraft state from time
  const currentSample: MissionTrajectorySample = useMemo(() => {
    if (!mission.fullTrajectory || mission.fullTrajectory.length === 0) {
      return {
        timeS: 0,
        timeDays: 0,
        epochUTC: mission.departureEpochUTC,
        julianDate: 2451545.0,
        posM: new THREE.Vector3(AU, 0, 0) as any,
        velMPerS: new THREE.Vector3(0, 30000, 0) as any,
        distanceAU: 1.0,
        speedKmPerS: 30.0,
        specificEnergyMJPerKg: 0,
        activeLegIndex: 1,
      };
    }

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
      // Clamp to at least 0.08 to prevent lookAt gimbal lock / NaN projection matrix
      cameraPhiRef.current = 0.08;
      cameraDistanceRef.current = 150.0;
      cameraTargetRef.current.set(0, 0, 0);
    } else if (view === 'OBLIQUE') {
      cameraThetaRef.current = Math.PI / 4.0;
      cameraPhiRef.current = Math.PI / 3.2;
      cameraDistanceRef.current = 140.0;
      cameraTargetRef.current.set(0, 0, 0);
    } else if (view === 'FOCUS_SPACECRAFT') {
      const posSC = currentSample.posM;
      // Coordinate mapping: X -> x, Z -> y (vertical), -Y -> z (orbital plane)
      const x = (posSC.x / AU) * SCENE_SCALE;
      const y = (posSC.z / AU) * SCENE_SCALE;
      const z = -(posSC.y / AU) * SCENE_SCALE;
      cameraTargetRef.current.set(x, y, z);
      cameraDistanceRef.current = 28.0;
    }
  }, [currentSample]);

  // Focus on selected planet if any
  useEffect(() => {
    if (selectedPlanetId && planetEntitiesRef.current.has(selectedPlanetId)) {
      const entity = planetEntitiesRef.current.get(selectedPlanetId)!;
      cameraTargetRef.current.copy(entity.group.position);
      cameraDistanceRef.current = Math.max(16.0, entity.baseRadius * 12.0);
      setCameraView('FOCUS_PLANET');
    }
  }, [selectedPlanetId]);

  // Reset view handler
  const handleResetView = () => {
    applyCameraView('OBLIQUE');
  };

  // Helper to create high-visibility billboard text sprite
  const createLabelSprite = (text: string, colorHex: string): THREE.Sprite => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = colorHex;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(text, 128, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      sizeAttenuation: true,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(6.0, 1.5, 1.0);
    return sprite;
  };

  // --- 1. SETUP THREE.JS SCENE ON MOUNT ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    // Soft celestial deep slate background (pastel space palette)
    scene.background = new THREE.Color(0x141a29);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / Math.max(height, 1), 0.1, 8000.0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Subtle, low-contrast starfield
    const starCount = 1200;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      const rad = 700.0 + Math.random() * 900.0;
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
      color: 0x94a9c9,
      size: 1.4,
      transparent: true,
      opacity: 0.45,
      sizeAttenuation: false,
    });
    const starfield = new THREE.Points(starGeometry, starMaterial);
    scene.add(starfield);

    // Ecliptic Plane Grid (Soft pastel slate styling)
    const eclipticGrid = new THREE.GridHelper(300, 30, 0x2e3a52, 0x1a2233);
    eclipticGrid.position.set(0, -0.05, 0);
    scene.add(eclipticGrid);

    // Central Sun (Soft pastel illumination)
    const sunGroup = new THREE.Group();
    const sunGeom = new THREE.SphereGeometry(2.5, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffe082 });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    sunGroup.add(sunMesh);

    // Sun Corona Glow (Soft peach aura)
    const coronaGeom = new THREE.SphereGeometry(3.6, 24, 24);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xffcc80,
      transparent: true,
      opacity: 0.35,
      side: THREE.BackSide,
    });
    const coronaMesh = new THREE.Mesh(coronaGeom, coronaMat);
    sunGroup.add(coronaMesh);
    scene.add(sunGroup);

    // Ambient & Point Lighting
    const sunLight = new THREE.PointLight(0xfffaee, 2.4, 3000);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    const ambLight = new THREE.AmbientLight(0x384868, 1.0);
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

    // Spacecraft Marker Group (Pastel cyan beacon octahedron)
    const scGroup = new THREE.Group();
    const scGeom = new THREE.OctahedronGeometry(0.85);
    const scMat = new THREE.MeshBasicMaterial({ color: 0x7bb6e8, wireframe: false });
    const scMesh = new THREE.Mesh(scGeom, scMat);
    scGroup.add(scMesh);

    // Outer wireframe ring around spacecraft for high visibility
    const scHaloGeom = new THREE.TorusGeometry(1.2, 0.04, 8, 24);
    const scHaloMat = new THREE.MeshBasicMaterial({ color: 0xa9d4f5 });
    scHaloGeom.rotateX(Math.PI / 2);
    scGroup.add(new THREE.Mesh(scHaloGeom, scHaloMat));

    // Velocity vector arrow (Pastel Mint)
    const velArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      4.0,
      0x5dd39e,
      1.2,
      0.8
    );
    scGroup.add(velArrow);
    velVectorArrowRef.current = velArrow;

    scene.add(scGroup);
    spacecraftMarkerRef.current = scGroup;

    // --- INITIALIZE PLANET ENTITIES (BUILT ONCE, PERSISTENT) ---
    const planetIds = ['MERCURY', 'VENUS', 'EARTH', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE'];
    const planetColors: Record<string, number> = {
      MERCURY: 0xb0bec5,
      VENUS: 0xffd180,
      EARTH: 0x81d4fa,
      MARS: 0xffab91,
      JUPITER: 0xffcc80,
      SATURN: 0xffe082,
      URANUS: 0x80deea,
      NEPTUNE: 0x90caf9,
    };

    for (const pid of planetIds) {
      const pRecord = JPL_PLANETARY_ELEMENTS[pid];
      if (!pRecord) continue;

      const pGroup = new THREE.Group();
      const baseRadius = pid === 'JUPITER' ? 1.8 : pid === 'SATURN' ? 1.5 : pid === 'URANUS' || pid === 'NEPTUNE' ? 1.1 : 0.75;

      // 1. Physical Planet Sphere
      const pGeom = new THREE.SphereGeometry(baseRadius, 24, 24);
      const pMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(planetColors[pid] || pRecord.color),
        roughness: 0.65,
        metalness: 0.1,
      });
      const pMesh = new THREE.Mesh(pGeom, pMat);
      pGroup.add(pMesh);

      // Saturn Ring System
      if (pid === 'SATURN') {
        const ringGeo = new THREE.RingGeometry(baseRadius * 1.3, baseRadius * 2.3, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xe6cc99,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.6,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2.3;
        pGroup.add(ringMesh);
      }

      // 2. High-Visibility Adaptive Halo Ring (Prevents disappearing at overview zoom)
      const haloGeo = new THREE.RingGeometry(baseRadius * 1.25, baseRadius * 1.45, 32);
      const haloMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(planetColors[pid] || 0xffffff),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.rotation.x = Math.PI / 2;
      pGroup.add(haloMesh);

      // 3. Selection Reticle Ring (Visible when selected)
      const reticleGeo = new THREE.RingGeometry(baseRadius * 1.8, baseRadius * 2.1, 32);
      const reticleMat = new THREE.MeshBasicMaterial({
        color: 0xffd2b8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const reticleMesh = new THREE.Mesh(reticleGeo, reticleMat);
      reticleMesh.rotation.x = Math.PI / 2;
      reticleMesh.visible = false;
      pGroup.add(reticleMesh);

      // 4. Billboard Text Label
      const labelSprite = createLabelSprite(pid, '#c4d4eb');
      labelSprite.position.set(0, baseRadius + 2.2, 0);
      labelSprite.visible = showLabels;
      pGroup.add(labelSprite);

      scene.add(pGroup);
      planetEntitiesRef.current.set(pid, {
        id: pid,
        name: pid,
        group: pGroup,
        mesh: pMesh,
        halo: haloMesh,
        reticle: reticleMesh,
        labelSprite,
        baseRadius,
      });
    }

    // Animation Loop
    let animId: number;
    const render = () => {
      animId = requestAnimationFrame(render);

      // Update camera position based on spherical coordinates
      const cam = cameraRef.current;
      if (cam) {
        // Clamp phi to avoid looking straight down gimbal singularity (lookAt matrix NaN collapse)
        const phi = Math.max(0.08, Math.min(Math.PI / 2.05, cameraPhiRef.current));
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
      cameraRef.current.aspect = w / Math.max(h, 1);
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []); // Mounts once and maintains stable 3D scene

  // Update Planet Positions based on Julian date
  useEffect(() => {
    const jd = currentSample.julianDate || 2451545.0;

    for (const [pid, entity] of planetEntitiesRef.current.entries()) {
      const pState = PlanetaryEphemerisEngine.getPlanetState(pid, jd, mission.motionMode);

      // Coordinate mapping from Heliocentric Ecliptic (X, Y, Z meters) to Three.js:
      const posX = (pState.positionM.x / AU) * SCENE_SCALE;
      const posY = (pState.positionM.z / AU) * SCENE_SCALE;
      const posZ = -(pState.positionM.y / AU) * SCENE_SCALE;

      entity.group.position.set(posX, posY, posZ);

      // Highlight selected planet
      entity.reticle.visible = selectedPlanetId === pid;

      // Update label visibility
      if (entity.labelSprite) {
        entity.labelSprite.visible = showLabels;
      }
    }
  }, [currentSample.julianDate, mission.motionMode, selectedPlanetId, showLabels]);

  // Update Planetary Orbit Rings
  useEffect(() => {
    const orbitGroup = orbitLinesRef.current;
    if (!orbitGroup) return;

    orbitGroup.clear();
    if (!showOrbits) return;

    const planetIds = ['MERCURY', 'VENUS', 'EARTH', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE'];

    for (const pid of planetIds) {
      const pRecord = JPL_PLANETARY_ELEMENTS[pid];
      if (!pRecord) continue;

      const aAU = pRecord.a0;
      const pts: THREE.Vector3[] = [];
      const segs = 128;
      for (let i = 0; i <= segs; i++) {
        const ang = (i / segs) * 2.0 * Math.PI;
        const x = aAU * Math.cos(ang) * SCENE_SCALE;
        const z = -aAU * Math.sin(ang) * SCENE_SCALE;
        pts.push(new THREE.Vector3(x, 0, z));
      }
      const orbitGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const isSelected = selectedPlanetId === pid;
      const orbitMat = new THREE.LineBasicMaterial({
        color: isSelected ? 0xffd2b8 : 0x485878,
        transparent: true,
        opacity: isSelected ? 0.85 : 0.45,
      });
      const orbitLine = new THREE.Line(orbitGeom, orbitMat);
      orbitGroup.add(orbitLine);
    }
  }, [showOrbits, selectedPlanetId]);

  // Update Trajectory Curves & Encounter Pins
  useEffect(() => {
    const trajGroup = trajectoryLinesRef.current;
    const encGroup = encounterPinsRef.current;
    if (!trajGroup || !encGroup) return;

    trajGroup.clear();
    encGroup.clear();

    // Distinct pastel transfer leg colors
    const legColors = [0xaee5d0, 0xffd2b8, 0xa9d4f5, 0xc9bdf2];

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
        });
        const line = new THREE.Line(geom, mat);
        trajGroup.add(line);
      }

      // Encounter Pin marker
      if (pts.length > 0) {
        const arrivalPt = pts[pts.length - 1];
        const pinGeom = new THREE.TorusGeometry(1.4, 0.06, 8, 24);
        pinGeom.rotateX(Math.PI / 2);
        const pinMat = new THREE.MeshBasicMaterial({
          color: legColors[idx % legColors.length],
          transparent: true,
          opacity: 0.7,
        });
        const pin = new THREE.Mesh(pinGeom, pinMat);
        pin.position.copy(arrivalPt);
        encGroup.add(pin);
      }
    });
  }, [mission.transferLegs]);

  // Update Spacecraft Position and Velocity Arrow
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
      cameraPhiRef.current = Math.max(0.08, Math.min(Math.PI / 2.05, cameraPhiRef.current));
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
    cameraDistanceRef.current = Math.max(8.0, Math.min(500.0, cameraDistanceRef.current + zoomFactor));
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={handleWheel}
      className={`relative w-full ${heightClass} bg-[#141a29] border border-[#DCE3EE] overflow-hidden select-none cursor-grab active:cursor-grabbing rounded-xl shadow-sm`}
    >
      {/* Viewport Overlay: Title & Mission Mode Badge */}
      <div className="absolute top-3 left-4 z-10 flex flex-col gap-1 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#AEE5D0] animate-pulse border border-[#2D8A68]" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
            HELIOCENTRIC SOLAR SYSTEM ORRERY
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/90 border border-[#DCE3EE] text-[#1D4F7A] font-bold shadow-xs">
            {mission.motionMode}
          </span>
        </div>
        <div className="text-[11px] font-mono text-[#94A3B8]">
          SUN-CENTERED INERTIAL ECLIPTIC FRAME (J2000) • 1 AU = {SCENE_SCALE} UNITS
        </div>
      </div>

      {/* Floating Spacecraft Telemetry Pill (Top Right, Pastel UI) */}
      <div className="absolute top-3 right-4 z-10 bg-white/95 backdrop-blur-md border border-[#DCE3EE] p-3 rounded-xl font-mono text-xs flex flex-col gap-1 text-right text-[#263247] shadow-sm">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#1E5F8A]">
          SPACECRAFT TELEMETRY // {mission.spacecraft.name.toUpperCase()}
        </div>
        <div className="text-[#1E293B] font-bold text-sm">
          {currentSample.distanceAU.toFixed(3)} <span className="text-[#68758A] text-xs">AU</span>
          <span className="text-[#CBD5E1] mx-2">|</span>
          {currentSample.speedKmPerS.toFixed(2)} <span className="text-[#68758A] text-xs">km/s</span>
        </div>
        <div className="text-[10px] text-[#68758A]">
          MET: {currentSample.timeDays.toFixed(1)} days ({currentSample.epochUTC.slice(0, 10)})
        </div>
      </div>

      {/* Camera Presets & Control Bar (Bottom Left, Pastel buttons) */}
      <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2 font-mono text-[11px]">
        <button
          onClick={() => applyCameraView('TOP_DOWN')}
          className={`px-3 py-1.5 rounded-lg border transition-colors shadow-xs cursor-pointer ${
            cameraView === 'TOP_DOWN'
              ? 'bg-[#A9D4F5] text-[#1D4F7A] font-bold border-[#89C3EE]'
              : 'bg-white/90 text-[#263247] border-[#DCE3EE] hover:bg-[#EEF2F8]'
          }`}
        >
          TOP-DOWN
        </button>
        <button
          onClick={() => applyCameraView('OBLIQUE')}
          className={`px-3 py-1.5 rounded-lg border transition-colors shadow-xs cursor-pointer ${
            cameraView === 'OBLIQUE'
              ? 'bg-[#A9D4F5] text-[#1D4F7A] font-bold border-[#89C3EE]'
              : 'bg-white/90 text-[#263247] border-[#DCE3EE] hover:bg-[#EEF2F8]'
          }`}
        >
          OBLIQUE 3D
        </button>
        <button
          onClick={() => applyCameraView('FOCUS_SPACECRAFT')}
          className={`px-3 py-1.5 rounded-lg border transition-colors shadow-xs cursor-pointer ${
            cameraView === 'FOCUS_SPACECRAFT'
              ? 'bg-[#AEE5D0] text-[#1D6C50] font-bold border-[#8BE0BE]'
              : 'bg-white/90 text-[#263247] border-[#DCE3EE] hover:bg-[#EEF2F8]'
          }`}
        >
          LOCK PROBE
        </button>
        <button
          onClick={handleResetView}
          className="p-1.5 rounded-lg bg-white/90 text-[#68758A] border border-[#DCE3EE] hover:text-[#263247] hover:bg-[#EEF2F8] shadow-xs cursor-pointer"
          title="Reset View"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Interactive Legend (Bottom Right, Pastel badges) */}
      <div className="absolute bottom-3 right-4 z-10 flex items-center gap-3 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-[#DCE3EE] text-[10px] font-mono text-[#263247] shadow-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFE082] border border-[#D4A373]" />
          <span className="font-bold">SUN</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#AEE5D0] border border-[#2D8A68]" />
          <span>LEG 1</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFD2B8] border border-[#B86230]" />
          <span>LEG 2</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#A9D4F5] border border-[#1E5F8A]" />
          <span>PROBE</span>
        </div>
      </div>
    </div>
  );
};

export default Mission3DCanvas;
