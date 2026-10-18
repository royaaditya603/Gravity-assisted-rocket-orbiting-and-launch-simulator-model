import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FlybySimulationResult, ReferenceFrame, TrajectoryPoint } from '../../../physics/FlybyEngine';
import { PlanetaryTextures } from '../textures/PlanetaryTextures';

export type FlybyCameraMode = 'OVERVIEW' | 'CLOSE_UP' | 'PROBE_FOLLOW' | 'FREE';

interface Flyby3DCanvasProps {
  simResult: FlybySimulationResult | null;
  currentPlaybackIndex: number;
  referenceFrame: ReferenceFrame;
  cameraMode: FlybyCameraMode;
  showVectors: boolean;
  showTrajectoryTrail: boolean;
  onCameraChange?: (mode: FlybyCameraMode) => void;
}

export const Flyby3DCanvas: React.FC<Flyby3DCanvasProps> = ({
  simResult,
  currentPlaybackIndex,
  referenceFrame,
  cameraMode,
  showVectors,
  showTrajectoryTrail,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameIdRef = useRef<number>(0);

  // Scene references for updates
  const planetGroupRef = useRef<THREE.Group | null>(null);
  const probeMeshRef = useRef<THREE.Group | null>(null);
  const trajectoryLineRef = useRef<THREE.Line | null>(null);
  const closestMarkerRef = useRef<THREE.Mesh | null>(null);
  const vectorsGroupRef = useRef<THREE.Group | null>(null);
  const collisionSphereRef = useRef<THREE.Mesh | null>(null);

  // Mouse orbit state
  const isMouseDownRef = useRef(false);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const cameraSphericalRef = useRef({ radius: 35, theta: Math.PI / 4, phi: Math.PI / 3 });
  const targetLookAtRef = useRef(new THREE.Vector3(0, 0, 0));

  // Normalized visual scale: Planet visual radius = 4.0 units in 3D world
  const VISUAL_PLANET_RADIUS = 4.0;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene & Renderer setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05060a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );
    camera.position.set(25, 20, 25);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Lighting
    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.5);
    sunLight.position.set(60, 25, 40);
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0x222838, 1.0);
    scene.add(ambientLight);

    // Deep space celestial starfield
    const starCount = 1500;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      const r = 500 + Math.random() * 400;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      starPos[i] = r * Math.sin(ph) * Math.cos(th);
      starPos[i + 1] = r * Math.sin(ph) * Math.sin(th);
      starPos[i + 2] = r * Math.cos(ph);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x8899bb, size: 1.5, sizeAttenuation: false });
    scene.add(new THREE.Points(starGeo, starMat));

    // Reference equatorial orbital grid plane
    const grid = new THREE.GridHelper(80, 40, 0x2a3348, 0x141824);
    grid.position.y = 0;
    scene.add(grid);

    // 3. Planetary Body Group
    const planetGroup = new THREE.Group();
    scene.add(planetGroup);
    planetGroupRef.current = planetGroup;

    // 4. Spacecraft Probe Mesh
    const probeGroup = new THREE.Group();
    // Probe central bus (gold foil)
    const busGeo = new THREE.BoxGeometry(0.5, 0.4, 0.4);
    const busMat = new THREE.MeshStandardMaterial({ color: 0xdfab34, roughness: 0.3, metalness: 0.85 });
    const busMesh = new THREE.Mesh(busGeo, busMat);
    probeGroup.add(busMesh);

    // High-gain parabolic antenna dish
    const dishGeo = new THREE.ConeGeometry(0.35, 0.15, 24, 1, true);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xededed, roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide });
    const dishMesh = new THREE.Mesh(dishGeo, dishMat);
    dishMesh.rotation.x = Math.PI;
    dishMesh.position.set(0, 0.3, 0);
    probeGroup.add(dishMesh);

    // Solar panels / RTG booms
    const panelGeo = new THREE.BoxGeometry(1.4, 0.03, 0.3);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x1c3560, roughness: 0.2, metalness: 0.9 });
    const panelMesh = new THREE.Mesh(panelGeo, panelMat);
    probeGroup.add(panelMesh);

    scene.add(probeGroup);
    probeMeshRef.current = probeGroup;

    // 5. Vectors Group
    const vectorsGroup = new THREE.Group();
    scene.add(vectorsGroup);
    vectorsGroupRef.current = vectorsGroup;

    // 6. Closest approach marker
    const markerGeo = new THREE.TorusGeometry(0.6, 0.05, 16, 32);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.rotation.x = Math.PI / 2;
    marker.visible = false;
    scene.add(marker);
    closestMarkerRef.current = marker;

    // 7. Mouse interaction listeners
    const onMouseDown = (e: MouseEvent) => {
      isMouseDownRef.current = true;
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDownRef.current) return;
      const dx = e.clientX - mousePosRef.current.x;
      const dy = e.clientY - mousePosRef.current.y;
      mousePosRef.current = { x: e.clientX, y: e.clientY };

      cameraSphericalRef.current.theta -= dx * 0.007;
      cameraSphericalRef.current.phi = Math.max(
        0.05,
        Math.min(Math.PI - 0.05, cameraSphericalRef.current.phi - dy * 0.007)
      );
    };

    const onMouseUp = () => {
      isMouseDownRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraSphericalRef.current.radius = Math.max(
        6.0,
        Math.min(180.0, cameraSphericalRef.current.radius + e.deltaY * 0.04)
      );
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // 8. Resize handler
    const onResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // 9. Animation render loop
    let lastTime = performance.now();
    const animate = (time: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const dt = (time - lastTime) * 0.001;
      lastTime = time;

      // Slow planetary axial spin
      if (planetGroupRef.current) {
        planetGroupRef.current.rotation.y += dt * 0.04;
      }

      // Update camera position based on mode
      const cam = cameraRef.current;
      if (cam) {
        const { radius, theta, phi } = cameraSphericalRef.current;
        const target = targetLookAtRef.current;

        cam.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
        cam.position.y = target.y + radius * Math.cos(phi);
        cam.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
        cam.lookAt(target);
      }

      renderer.render(scene, camera);
    };
    animFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameIdRef.current);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  // Update Planet Mesh when planet selection changes
  useEffect(() => {
    const scene = sceneRef.current;
    const planetGroup = planetGroupRef.current;
    if (!scene || !planetGroup || !simResult) return;

    // Clear existing planet children
    while (planetGroup.children.length > 0) {
      const obj = planetGroup.children[0];
      planetGroup.remove(obj);
    }

    const planetData = simResult.config.planet;

    // Planet Sphere
    const sphereGeo = new THREE.SphereGeometry(VISUAL_PLANET_RADIUS, 64, 48);
    let sphereMat: THREE.Material;

    if (planetData.id === 'JUPITER') {
      const jupTex = PlanetaryTextures.createJupiterTexture();
      sphereMat = new THREE.MeshStandardMaterial({
        map: jupTex,
        roughness: 0.85,
        metalness: 0.05,
      });
      planetGroup.rotation.z = THREE.MathUtils.degToRad(3.13); // Jupiter axial tilt
    } else if (planetData.id === 'SATURN') {
      const satTex = PlanetaryTextures.createSaturnTexture();
      sphereMat = new THREE.MeshStandardMaterial({
        map: satTex,
        roughness: 0.8,
        metalness: 0.1,
      });

      // Saturn Ring System
      // Physical scale: inner radius ~1.28 R_S, outer radius ~2.35 R_S
      const ringInner = VISUAL_PLANET_RADIUS * 1.28;
      const ringOuter = VISUAL_PLANET_RADIUS * 2.35;
      const ringGeo = new THREE.RingGeometry(ringInner, ringOuter, 64);
      const ringTex = PlanetaryTextures.createSaturnRingTexture();

      // Adjust UV mapping for circular ring geometry
      const pos = ringGeo.attributes.position;
      const uv = ringGeo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const dist = Math.sqrt(x * x + y * y);
        const u = (dist - ringInner) / (ringOuter - ringInner);
        uv.setXY(i, u, 0.5);
      }
      uv.needsUpdate = true;

      const ringMat = new THREE.MeshStandardMaterial({
        map: ringTex,
        side: THREE.DoubleSide,
        transparent: true,
        roughness: 0.5,
      });

      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      planetGroup.add(ringMesh);

      planetGroup.rotation.z = THREE.MathUtils.degToRad(26.73); // Saturn axial tilt
    } else {
      sphereMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(planetData.color),
        roughness: 0.7,
      });
      planetGroup.rotation.z = 0;
    }

    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    planetGroup.add(sphereMesh);

    // Collision wireframe sphere
    if (collisionSphereRef.current) {
      scene.remove(collisionSphereRef.current);
    }
    const colWireGeo = new THREE.SphereGeometry(VISUAL_PLANET_RADIUS * 1.01, 32, 24);
    const colWireMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      wireframe: true,
      transparent: true,
      opacity: simResult.collisionDetected ? 0.6 : 0.15,
    });
    const colSphere = new THREE.Mesh(colWireGeo, colWireMat);
    scene.add(colSphere);
    collisionSphereRef.current = colSphere;
  }, [simResult?.config.planet.id, simResult?.collisionDetected]);

  // Update Trajectory Trail line
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !simResult || simResult.trajectory.length === 0) return;

    if (trajectoryLineRef.current) {
      scene.remove(trajectoryLineRef.current);
      trajectoryLineRef.current.geometry.dispose();
      trajectoryLineRef.current = null;
    }

    if (!showTrajectoryTrail) return;

    const planetRadiusM = simResult.config.planet.radiusM;
    const toSceneScale = VISUAL_PLANET_RADIUS / planetRadiusM;

    const points: THREE.Vector3[] = [];
    const isSunFrame = referenceFrame === 'HELIOCENTRIC';

    for (const pt of simResult.trajectory) {
      if (isSunFrame) {
        // In Sun frame, center origin on the initial planet location
        const relSunX = (pt.posSunM.x - simResult.trajectory[0].planetPosSunM.x) * toSceneScale;
        const relSunY = (pt.posSunM.y - simResult.trajectory[0].planetPosSunM.y) * toSceneScale;
        points.push(new THREE.Vector3(relSunX, 0, relSunY));
      } else {
        // In Planet-centric frame
        points.push(new THREE.Vector3(pt.posPlanetM.x * toSceneScale, 0, pt.posPlanetM.y * toSceneScale));
      }
    }

    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineColor = simResult.collisionDetected ? 0xef4444 : 0x38bdf8;
    const lineMat = new THREE.LineBasicMaterial({ color: lineColor, linewidth: 2 });
    const line = new THREE.Line(lineGeo, lineMat);
    scene.add(line);
    trajectoryLineRef.current = line;

    // Position closest-approach marker
    if (closestMarkerRef.current) {
      const ca = simResult.closestApproach;
      const caX = ca.positionPlanetM.x * toSceneScale;
      const caY = ca.positionPlanetM.y * toSceneScale;
      closestMarkerRef.current.position.set(caX, 0, caY);
      closestMarkerRef.current.visible = !isSunFrame && !simResult.collisionDetected;
    }
  }, [simResult, referenceFrame, showTrajectoryTrail]);

  // Update Probe Position and Vectors on every playback step
  useEffect(() => {
    if (!simResult || simResult.trajectory.length === 0) return;
    const idx = Math.min(currentPlaybackIndex, simResult.trajectory.length - 1);
    const pt: TrajectoryPoint = simResult.trajectory[idx];
    const planetRadiusM = simResult.config.planet.radiusM;
    const toSceneScale = VISUAL_PLANET_RADIUS / planetRadiusM;

    const probe = probeMeshRef.current;
    const isSunFrame = referenceFrame === 'HELIOCENTRIC';

    let scX = 0;
    let scZ = 0;
    let vx = 0;
    let vz = 0;

    if (isSunFrame) {
      const originPlanet = simResult.trajectory[0].planetPosSunM;
      scX = (pt.posSunM.x - originPlanet.x) * toSceneScale;
      scZ = (pt.posSunM.y - originPlanet.y) * toSceneScale;
      vx = pt.velSunMPerS.x;
      vz = pt.velSunMPerS.y;

      // In Sun frame, planet moves too
      if (planetGroupRef.current) {
        const pX = (pt.planetPosSunM.x - originPlanet.x) * toSceneScale;
        const pZ = (pt.planetPosSunM.y - originPlanet.y) * toSceneScale;
        planetGroupRef.current.position.set(pX, 0, pZ);
        if (collisionSphereRef.current) {
          collisionSphereRef.current.position.set(pX, 0, pZ);
        }
      }
    } else {
      scX = pt.posPlanetM.x * toSceneScale;
      scZ = pt.posPlanetM.y * toSceneScale;
      vx = pt.velPlanetMPerS.x;
      vz = pt.velPlanetMPerS.y;

      if (planetGroupRef.current) {
        planetGroupRef.current.position.set(0, 0, 0);
        if (collisionSphereRef.current) {
          collisionSphereRef.current.position.set(0, 0, 0);
        }
      }
    }

    if (probe) {
      probe.position.set(scX, 0, scZ);
      // Align probe with direction of motion
      const heading = Math.atan2(vz, vx);
      probe.rotation.y = -heading;
    }

    // Dynamic Camera Tracking
    if (cameraMode === 'PROBE_FOLLOW') {
      targetLookAtRef.current.set(scX, 0, scZ);
      cameraSphericalRef.current.radius = Math.max(8.0, cameraSphericalRef.current.radius);
    } else if (cameraMode === 'CLOSE_UP') {
      const ca = simResult.closestApproach;
      const caX = isSunFrame ? scX : ca.positionPlanetM.x * toSceneScale;
      const caZ = isSunFrame ? scZ : ca.positionPlanetM.y * toSceneScale;
      targetLookAtRef.current.set(caX, 0, caZ);
      cameraSphericalRef.current.radius = 12.0;
    } else if (cameraMode === 'OVERVIEW') {
      targetLookAtRef.current.set(0, 0, 0);
      cameraSphericalRef.current.radius = 45.0;
    }

    // Dynamic Vector Arrows
    const vecGroup = vectorsGroupRef.current;
    if (vecGroup) {
      while (vecGroup.children.length > 0) {
        vecGroup.remove(vecGroup.children[0]);
      }

      if (showVectors) {
        const vScale = 0.0006; // Scaled for 3D visibility
        // 1. Current velocity vector (Emerald)
        const vLen = Math.hypot(vx, vz) * vScale;
        if (vLen > 0.1) {
          const vDir = new THREE.Vector3(vx, 0, vz).normalize();
          const arrow = new THREE.ArrowHelper(vDir, new THREE.Vector3(scX, 0, scZ), vLen, 0x10b981, 0.4, 0.2);
          vecGroup.add(arrow);
        }

        // 2. In Heliocentric frame, show planet velocity vector (Cyan)
        if (isSunFrame && planetGroupRef.current) {
          const pPos = planetGroupRef.current.position;
          const pVDir = new THREE.Vector3(pt.planetVelSunMPerS.x, 0, pt.planetVelSunMPerS.y).normalize();
          const pVLen = pt.planetVelSunMPerS.magnitude() * vScale;
          const pArrow = new THREE.ArrowHelper(pVDir, pPos, pVLen, 0x38bdf8, 0.5, 0.25);
          vecGroup.add(pArrow);
        }

        // 3. Assist vector (Rose) at periapsis
        const deltaV = simResult.analytical.deltaVAssistMPerS;
        const dVLen = deltaV.magnitude() * vScale * 1.5;
        if (dVLen > 0.2) {
          const dVDir = new THREE.Vector3(deltaV.x, 0, deltaV.y).normalize();
          const dArrow = new THREE.ArrowHelper(
            dVDir,
            new THREE.Vector3(scX, 0.3, scZ),
            dVLen,
            0xf43f5e,
            0.5,
            0.25
          );
          vecGroup.add(dArrow);
        }
      }
    }
  }, [currentPlaybackIndex, simResult, referenceFrame, cameraMode, showVectors]);

  return (
    <div className="relative w-full h-[520px] bg-[#05060a] rounded-xs overflow-hidden border border-[#1f2433]">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Viewport Overlays */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 pointer-events-none">
        <span className="px-2.5 py-1 bg-[#11141e]/90 border border-[#23293d] rounded-xs font-mono text-[10px] text-amber-400 font-bold tracking-wider">
          {referenceFrame === 'PLANET_CENTRIC' ? 'FRAME: PLANET REST FRAME' : 'FRAME: HELIOCENTRIC INERTIAL FRAME'}
        </span>
        <span className="px-2 py-1 bg-[#11141e]/90 border border-[#23293d] rounded-xs font-mono text-[10px] text-neutral-300">
          CAMERA: {cameraMode}
        </span>
        {simResult?.collisionDetected && (
          <span className="px-2.5 py-1 bg-rose-600/90 text-white font-mono text-[10px] font-bold rounded-xs animate-pulse">
            SURFACE IMPACT DETECTED (r ≤ Rp)
          </span>
        )}
      </div>

      {/* Camera and Legend Hints */}
      <div className="absolute bottom-3 left-3 text-[10px] font-mono text-neutral-400 bg-[#090b10]/80 px-2.5 py-1.5 rounded-xs border border-[#181d2b] pointer-events-none flex items-center gap-3">
        <span>DRAG TO ORBIT</span>
        <span>•</span>
        <span>SCROLL TO ZOOM</span>
        <span>•</span>
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> v_current
        </span>
        <span className="flex items-center gap-1 text-sky-400">
          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> V_planet
        </span>
        <span className="flex items-center gap-1 text-rose-400">
          <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Δv_assist
        </span>
      </div>
    </div>
  );
};
