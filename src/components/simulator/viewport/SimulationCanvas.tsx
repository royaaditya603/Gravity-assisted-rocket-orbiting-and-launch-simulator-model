import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SimulationManager } from '../../../simulation/SimulationManager';
import { R_EARTH } from '../../../physics';
import { EarthVisuals, EarthVisualsBundle } from './EarthVisuals';
import { RocketVisuals, RocketVisualsBundle } from './RocketVisuals';

interface SimulationCanvasProps {
  sim: SimulationManager;
  cameraMode: 'CHASE' | 'ORBIT' | 'PAD';
}

export const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ sim, cameraMode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameIdRef = useRef<number>(0);

  // Scale: 10 units = Earth radius R_E (6,371 km)
  const SCENE_EARTH_RADIUS = 10.0;
  const TO_SCENE_SCALE = SCENE_EARTH_RADIUS / R_EARTH;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Setup Three.js Scene & Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020306);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      3000
    );
    camera.position.set(0, 15, 30);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. High-Fidelity Earth Visuals (Day/Night Terminator, Atmosphere, Clouds)
    const earthBundle: EarthVisualsBundle = EarthVisuals.create(SCENE_EARTH_RADIUS);
    scene.add(earthBundle.earthGroup);
    scene.add(earthBundle.sunLight);

    // Deep-space subtle ambient fill light
    const ambientLight = new THREE.AmbientLight(0x182030, 0.85);
    scene.add(ambientLight);

    // 3. NASA Hipparcos Celestial Starfield Skybox
    const starfieldMesh = EarthVisuals.createStarfield(1200);
    scene.add(starfieldMesh);

    // 4. Realistic Rocket Model & Supersonic Engine Plume
    const rocketBundle: RocketVisualsBundle = RocketVisuals.create();
    scene.add(rocketBundle.rocketGroup);

    // 5. Historical Trajectory Line
    const maxHistoryPts = 1000;
    const historyPositions = new Float32Array(maxHistoryPts * 3);
    const historyGeo = new THREE.BufferGeometry();
    historyGeo.setAttribute('position', new THREE.BufferAttribute(historyPositions, 3));
    const historyMat = new THREE.LineBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.85,
    });
    const historyLine = new THREE.Line(historyGeo, historyMat);
    scene.add(historyLine);

    // 6. Projected Keplerian Osculating Orbit Spline
    const maxPredictedPts = 150;
    const predPositions = new Float32Array(maxPredictedPts * 3);
    const predGeo = new THREE.BufferGeometry();
    predGeo.setAttribute('position', new THREE.BufferAttribute(predPositions, 3));
    const predMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
    });
    const predictedLine = new THREE.Line(predGeo, predMat);
    scene.add(predictedLine);

    // Mouse / Touch Orbit Controls logic
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let camDistance = 28.0;
    let camYaw = 0.4;
    let camPitch = 0.3;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      camYaw -= dx * 0.006;
      camPitch = Math.max(-1.4, Math.min(1.4, camPitch + dy * 0.006));
    };
    const onMouseUp = () => {
      isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      camDistance = Math.max(10.5, Math.min(250.0, camDistance + e.deltaY * 0.02));
      e.preventDefault();
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // 7. Animation & Render Loop
    let lastTime = performance.now();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const now = performance.now();
      const dtWall = (now - lastTime) / 1000.0;
      lastTime = now;

      // Update physics simulation
      sim.update(dtWall);

      // Update planetary rotation & clouds
      earthBundle.update(sim.timeS, dtWall);

      // Convert physics state (ECI meters) to Scene coordinates
      // Map ECI (x, y, z) -> Scene (x, z, -y) for Three.js Y-up convention
      const rx = sim.position.x * TO_SCENE_SCALE;
      const ry = sim.position.z * TO_SCENE_SCALE;
      const rz = -sim.position.y * TO_SCENE_SCALE;
      const rocketPos = new THREE.Vector3(rx, ry, rz);

      // Compute vehicle forward orientation vector
      let forwardDir = new THREE.Vector3(0, 1, 0);
      const isBurning = sim.rocket.isEngineBurning;
      const vel = sim.velocity;
      const altKm = Math.max(0, (sim.position.magnitude() - R_EARTH) / 1000.0);

      if (isBurning) {
        // Point along current thrust vector
        const thrustDir = sim.rocket.thrustDirection;
        forwardDir.set(thrustDir.x, thrustDir.z, -thrustDir.y).normalize();
      } else if (vel.magnitudeSq() > 1.0) {
        // Align with forward inertial velocity vector
        forwardDir.set(vel.x, vel.z, -vel.y).normalize();
      } else {
        // Static on pad: point along local vertical (zenith)
        forwardDir.copy(rocketPos).normalize();
      }

      // Update Rocket Position, Attitude, and Supersonic Plume
      rocketBundle.setPose(rocketPos, forwardDir);
      rocketBundle.updatePlume(isBurning, sim.rocket.throttle, altKm);

      // Update Historical Trajectory Line
      if (sim.trajectoryHistory.length > 1) {
        const history = sim.trajectoryHistory;
        const count = Math.min(history.length, maxHistoryPts);
        const posAttr = historyLine.geometry.attributes.position as THREE.BufferAttribute;
        const array = posAttr.array as Float32Array;

        for (let i = 0; i < count; i++) {
          const p = history[i];
          array[i * 3] = p.x * TO_SCENE_SCALE;
          array[i * 3 + 1] = p.z * TO_SCENE_SCALE;
          array[i * 3 + 2] = -p.y * TO_SCENE_SCALE;
        }
        posAttr.needsUpdate = true;
        historyLine.geometry.setDrawRange(0, count);
      }

      // Update Analytical Osculating Orbit Spline
      const orbitPoints = sim.getOsculatingOrbitPoints(maxPredictedPts - 1);
      if (orbitPoints.length > 0) {
        const predAttr = predictedLine.geometry.attributes.position as THREE.BufferAttribute;
        const predArray = predAttr.array as Float32Array;

        for (let i = 0; i < orbitPoints.length; i++) {
          const p = orbitPoints[i];
          predArray[i * 3] = p.x * TO_SCENE_SCALE;
          predArray[i * 3 + 1] = p.z * TO_SCENE_SCALE;
          predArray[i * 3 + 2] = -p.y * TO_SCENE_SCALE;
        }
        predAttr.needsUpdate = true;
        predictedLine.geometry.setDrawRange(0, orbitPoints.length);
      }

      // Camera Positioning based on Camera Mode
      if (cameraRef.current) {
        if (cameraMode === 'CHASE') {
          // Dynamic chase camera tracking close behind rocket
          const offsetDist = 2.4;
          const up = rocketPos.clone().normalize();
          const camPos = rocketPos.clone().addScaledVector(up, 1.0).add(new THREE.Vector3(
            Math.cos(camYaw) * offsetDist,
            Math.sin(camPitch) * offsetDist,
            Math.sin(camYaw) * offsetDist
          ));
          cameraRef.current.position.lerp(camPos, 0.15);
          cameraRef.current.lookAt(rocketPos);
        } else if (cameraMode === 'PAD') {
          // Launch pad horizon perspective
          const padPos = rocketPos.clone().normalize().multiplyScalar(SCENE_EARTH_RADIUS + 0.05);
          const eyePos = padPos.clone().add(new THREE.Vector3(0.6, 0.25, 0.6));
          cameraRef.current.position.lerp(eyePos, 0.1);
          cameraRef.current.lookAt(rocketPos);
        } else {
          // ORBIT Global View
          const cx = Math.cos(camPitch) * Math.sin(camYaw) * camDistance;
          const cy = Math.sin(camPitch) * camDistance;
          const cz = Math.cos(camPitch) * Math.cos(camYaw) * camDistance;
          cameraRef.current.position.set(cx, cy, cz);
          cameraRef.current.lookAt(0, 0, 0);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);

      earthBundle.dispose();
      rocketBundle.dispose();
      historyGeo.dispose();
      historyMat.dispose();
      predGeo.dispose();
      predMat.dispose();

      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [cameraMode]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full cursor-grab active:cursor-grabbing select-none"
    />
  );
};
