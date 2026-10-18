import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SimulationManager } from '../../../simulation/SimulationManager';
import { R_EARTH, H_ATMOSPHERE } from '../../../physics';

interface SimulationCanvasProps {
  sim: SimulationManager;
  cameraMode: 'CHASE' | 'ORBIT' | 'PAD';
}

export const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ sim, cameraMode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rocketGroupRef = useRef<THREE.Group | null>(null);
  const flameMeshRef = useRef<THREE.Mesh | null>(null);
  const historyLineRef = useRef<THREE.Line | null>(null);
  const predictedLineRef = useRef<THREE.Line | null>(null);
  const animFrameIdRef = useRef<number>(0);

  // Scale: 10 units = Earth radius R_E (6,371 km)
  const SCENE_EARTH_RADIUS = 10.0;
  const TO_SCENE_SCALE = SCENE_EARTH_RADIUS / R_EARTH;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Setup Three.js Scene & Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06070a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );
    camera.position.set(0, 15, 30);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0x222a38, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunLight.position.set(100, 40, 80);
    scene.add(sunLight);

    // 3. Procedural Starfield
    const starCount = 1500;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      const radius = 400 + Math.random() * 400;
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      starPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i + 2] = radius * Math.cos(phi);
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0x8899bb, size: 1.5, transparent: true, opacity: 0.8 });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // 4. Procedural High-Fidelity Earth Texture
    const earthCanvas = document.createElement('canvas');
    earthCanvas.width = 1024;
    earthCanvas.height = 512;
    const ctx = earthCanvas.getContext('2d');
    if (ctx) {
      // Deep Blue Ocean
      ctx.fillStyle = '#0c1b33';
      ctx.fillRect(0, 0, 1024, 512);

      // Continent-like organic landmasses
      ctx.fillStyle = '#223825';
      for (let i = 0; i < 40; i++) {
        const cx = (Math.sin(i * 1.7) * 0.5 + 0.5) * 1024;
        const cy = (Math.cos(i * 2.3) * 0.4 + 0.5) * 512;
        const radius = 30 + (i % 5) * 20;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Latitude and Longitude reference grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let y = 0; y <= 512; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1024, y);
        ctx.stroke();
      }
      for (let x = 0; x <= 1024; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }

      // Equator highlight
      ctx.strokeStyle = 'rgba(41, 121, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 256);
      ctx.lineTo(1024, 256);
      ctx.stroke();
    }

    const earthTexture = new THREE.CanvasTexture(earthCanvas);
    const earthGeo = new THREE.SphereGeometry(SCENE_EARTH_RADIUS, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.7,
      metalness: 0.1,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);

    // Atmosphere Rim Glow (100 km boundary)
    const atmRadius = SCENE_EARTH_RADIUS * ((R_EARTH + H_ATMOSPHERE) / R_EARTH);
    const atmGeo = new THREE.SphereGeometry(atmRadius, 48, 48);
    const atmMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    const atmMesh = new THREE.Mesh(atmGeo, atmMat);
    scene.add(atmMesh);

    // 5. 3D Rocket Model
    const rocketGroup = new THREE.Group();
    rocketGroupRef.current = rocketGroup;

    // Body tube
    const bodyGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xeeeff2, roughness: 0.3, metalness: 0.4 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.rotation.x = Math.PI / 2;
    rocketGroup.add(bodyMesh);

    // Nosecone
    const noseGeo = new THREE.ConeGeometry(0.08, 0.25, 16);
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.5 });
    const noseMesh = new THREE.Mesh(noseGeo, noseMat);
    noseMesh.rotation.x = Math.PI / 2;
    noseMesh.position.z = 0.42;
    rocketGroup.add(noseMesh);

    // Engine nozzle
    const nozzleGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.12, 12);
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x33353d, roughness: 0.6 });
    const nozzleMesh = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzleMesh.rotation.x = Math.PI / 2;
    nozzleMesh.position.z = -0.36;
    rocketGroup.add(nozzleMesh);

    // Exhaust Plume (Flame)
    const flameGeo = new THREE.ConeGeometry(0.09, 0.5, 12);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.85,
    });
    const flameMesh = new THREE.Mesh(flameGeo, flameMat);
    flameMesh.rotation.x = -Math.PI / 2;
    flameMesh.position.z = -0.65;
    flameMesh.visible = false;
    flameMeshRef.current = flameMesh;
    rocketGroup.add(flameMesh);

    scene.add(rocketGroup);

    // 6. Historical Trajectory Line
    const maxHistoryPts = 1000;
    const historyPositions = new Float32Array(maxHistoryPts * 3);
    const historyGeo = new THREE.BufferGeometry();
    historyGeo.setAttribute('position', new THREE.BufferAttribute(historyPositions, 3));
    const historyMat = new THREE.LineBasicMaterial({ color: 0xff7722, linewidth: 2 });
    const historyLine = new THREE.Line(historyGeo, historyMat);
    historyLineRef.current = historyLine;
    scene.add(historyLine);

    // 7. Projected Keplerian Osculating Orbit Spline
    const maxPredictedPts = 150;
    const predPositions = new Float32Array(maxPredictedPts * 3);
    const predGeo = new THREE.BufferGeometry();
    predGeo.setAttribute('position', new THREE.BufferAttribute(predPositions, 3));
    const predMat = new THREE.LineBasicMaterial({
      color: 0x2979ff,
      transparent: true,
      opacity: 0.7,
      linewidth: 1,
    });
    const predictedLine = new THREE.Line(predGeo, predMat);
    predictedLineRef.current = predictedLine;
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

    // 8. Animation & Render Loop
    let lastTime = performance.now();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const now = performance.now();
      const dtWall = (now - lastTime) / 1000.0;
      lastTime = now;

      // Update physics simulation
      sim.update(dtWall);

      // Convert physics state (ECI meters) to Scene coordinates
      // Note: Map ECI (x, y, z) -> Scene (x, z, -y) for Three.js Y-up convention
      const rx = sim.position.x * TO_SCENE_SCALE;
      const ry = sim.position.z * TO_SCENE_SCALE;
      const rz = -sim.position.y * TO_SCENE_SCALE;

      // Update Rocket Position & Attitude
      if (rocketGroupRef.current) {
        rocketGroupRef.current.position.set(rx, ry, rz);

        // Attitude orientation: align rocket nose with velocity or thrust vector
        const vel = sim.velocity;
        if (vel.magnitudeSq() > 1.0) {
          const forward = new THREE.Vector3(vel.x, vel.z, -vel.y).normalize();
          const target = new THREE.Vector3(rx, ry, rz).add(forward);
          rocketGroupRef.current.lookAt(target);
        }

        // Exhaust plume visibility & dynamic flicker
        if (flameMeshRef.current) {
          const isBurning = sim.rocket.isEngineBurning;
          flameMeshRef.current.visible = isBurning;
          if (isBurning) {
            const flicker = 0.9 + Math.random() * 0.25;
            flameMeshRef.current.scale.set(flicker, flicker, flicker * (sim.rocket.throttle || 1.0));
          }
        }
      }

      // Update Historical Trajectory Line
      if (historyLineRef.current && sim.trajectoryHistory.length > 1) {
        const history = sim.trajectoryHistory;
        const count = Math.min(history.length, maxHistoryPts);
        const posAttr = historyLineRef.current.geometry.attributes.position as THREE.BufferAttribute;
        const array = posAttr.array as Float32Array;

        for (let i = 0; i < count; i++) {
          const p = history[i];
          array[i * 3] = p.x * TO_SCENE_SCALE;
          array[i * 3 + 1] = p.z * TO_SCENE_SCALE;
          array[i * 3 + 2] = -p.y * TO_SCENE_SCALE;
        }
        posAttr.needsUpdate = true;
        historyLineRef.current.geometry.setDrawRange(0, count);
      }

      // Update Analytical Osculating Orbit Spline
      if (predictedLineRef.current) {
        const orbitPoints = sim.getOsculatingOrbitPoints(maxPredictedPts - 1);
        const predAttr = predictedLineRef.current.geometry.attributes.position as THREE.BufferAttribute;
        const predArray = predAttr.array as Float32Array;

        for (let i = 0; i < orbitPoints.length; i++) {
          const p = orbitPoints[i];
          predArray[i * 3] = p.x * TO_SCENE_SCALE;
          predArray[i * 3 + 1] = p.z * TO_SCENE_SCALE;
          predArray[i * 3 + 2] = -p.y * TO_SCENE_SCALE;
        }
        predAttr.needsUpdate = true;
        predictedLineRef.current.geometry.setDrawRange(0, orbitPoints.length);
      }

      // Camera Positioning based on Camera Mode
      if (cameraRef.current) {
        if (cameraMode === 'CHASE') {
          // Dynamic chase camera following rocket close behind
          const offsetDist = 2.5;
          const rocketPos = new THREE.Vector3(rx, ry, rz);
          const up = rocketPos.clone().normalize();
          const camPos = rocketPos.clone().addScaledVector(up, 1.2).add(new THREE.Vector3(
            Math.cos(camYaw) * offsetDist,
            Math.sin(camPitch) * offsetDist,
            Math.sin(camYaw) * offsetDist
          ));
          cameraRef.current.position.lerp(camPos, 0.15);
          cameraRef.current.lookAt(rocketPos);
        } else if (cameraMode === 'PAD') {
          // Launch pad horizon perspective
          const rocketPos = new THREE.Vector3(rx, ry, rz);
          const padPos = rocketPos.clone().normalize().multiplyScalar(SCENE_EARTH_RADIUS + 0.05);
          const eyePos = padPos.clone().add(new THREE.Vector3(0.5, 0.2, 0.5));
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
