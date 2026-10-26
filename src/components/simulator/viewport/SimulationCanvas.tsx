import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SimulationManager, ReplayStateSnapshot } from '../../../simulation/SimulationManager';
import { R_EARTH } from '../../../physics';
import { EarthVisuals, EarthVisualsBundle } from './EarthVisuals';
import { RocketVisuals, RocketVisualsBundle } from './RocketVisuals';

export type CameraMode =
  | 'OVERVIEW'
  | 'ROCKET_FOLLOW'
  | 'CHASE'
  | 'PAD'
  | 'ORBIT'
  | 'FREE'
  | 'CINEMATIC';

interface SimulationCanvasProps {
  sim: SimulationManager;
  cameraMode: CameraMode;
  showVectors?: boolean;
}

export const SimulationCanvas: React.FC<SimulationCanvasProps> = ({
  sim,
  cameraMode,
  showVectors = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameIdRef = useRef<number>(0);

  // Keep cameraMode in ref so camera changes do NOT recreate WebGL scene!
  const cameraModeRef = useRef<CameraMode>(cameraMode);
  cameraModeRef.current = cameraMode;

  const showVectorsRef = useRef<boolean>(showVectors);
  showVectorsRef.current = showVectors;

  // Scale: 10 units = Earth radius R_E (6,371 km)
  const SCENE_EARTH_RADIUS = 10.0;
  const TO_SCENE_SCALE = SCENE_EARTH_RADIUS / R_EARTH;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Setup Three.js Scene & High-Performance Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020306);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.05,
      4000
    );
    camera.position.set(0, 16, 32);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
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

    // 4. Realistic Multi-Stage Rocket Model & Supersonic Engine Plumes
    const rocketBundle: RocketVisualsBundle = RocketVisuals.create();
    scene.add(rocketBundle.rocketGroup);

    // 5. Cape Canaveral Launch Complex 39A Gantry & Topocentric Horizon Axes
    const padGroup = new THREE.Group();
    // Compute pad scene position at t=0 (latitude 28.5 deg N)
    const latRad = (28.5 * Math.PI) / 180.0;
    const padECI = new THREE.Vector3(
      SCENE_EARTH_RADIUS * Math.cos(latRad),
      SCENE_EARTH_RADIUS * Math.sin(latRad),
      0
    );
    // Convert to Scene coordinates: ECI (x, y, z) -> Scene (x, z, -y)
    const padScenePos = new THREE.Vector3(padECI.x, padECI.z, -padECI.y);
    padGroup.position.copy(padScenePos);

    // Concrete flame trench pedestal
    const pedestalGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.04, 16);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x333842,
      roughness: 0.8,
      metalness: 0.2,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), padScenePos.clone().normalize());
    padGroup.add(pedestal);

    // Launch umbilical lattice tower
    const towerGeo = new THREE.BoxGeometry(0.03, 0.22, 0.03);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x883322,
      roughness: 0.6,
      metalness: 0.4,
    });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(0.04, 0.1, 0.03);
    padGroup.add(tower);

    // Topocentric Local Coordinate Axes at Launch Site (Zenith = Green, East = Red, North = Blue)
    const upNorm = padScenePos.clone().normalize();
    const northNorm = new THREE.Vector3(0, 1, 0).projectOnPlane(upNorm).normalize();
    const eastNorm = new THREE.Vector3().crossVectors(northNorm, upNorm).normalize();

    const axisLength = 0.35;
    const zenithArrow = new THREE.ArrowHelper(upNorm, new THREE.Vector3(0, 0, 0), axisLength, 0x22c55e, 0.08, 0.04);
    const eastArrow = new THREE.ArrowHelper(eastNorm, new THREE.Vector3(0, 0, 0), axisLength, 0xef4444, 0.08, 0.04);
    const northArrow = new THREE.ArrowHelper(northNorm, new THREE.Vector3(0, 0, 0), axisLength, 0x3b82f6, 0.08, 0.04);
    padGroup.add(zenithArrow);
    padGroup.add(eastArrow);
    padGroup.add(northArrow);

    scene.add(padGroup);

    // 6. Dynamic 3D Force Vectors (Velocity = Cyan, Thrust = Amber, Gravity = Purple, Drag = Red)
    const vectorsGroup = new THREE.Group();
    const velArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 1.0, 0x00e5ff, 0.15, 0.08);
    const thrustArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 1.0, 0xf59e0b, 0.15, 0.08);
    const gravArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 0), 1.0, 0xa855f7, 0.15, 0.08);
    const dragArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 0), 1.0, 0xef4444, 0.15, 0.08);
    vectorsGroup.add(velArrow);
    vectorsGroup.add(thrustArrow);
    vectorsGroup.add(gravArrow);
    vectorsGroup.add(dragArrow);
    scene.add(vectorsGroup);

    // 7. Continuous Historical Trajectory Line
    const maxHistoryPts = 3000;
    const historyPositions = new Float32Array(maxHistoryPts * 3);
    const historyGeo = new THREE.BufferGeometry();
    historyGeo.setAttribute('position', new THREE.BufferAttribute(historyPositions, 3));
    const historyMat = new THREE.LineBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.9,
      linewidth: 2,
    });
    const historyLine = new THREE.Line(historyGeo, historyMat);
    scene.add(historyLine);

    // 8. Projected Keplerian Osculating Orbit Spline
    const maxPredictedPts = 180;
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

    // Smoothed Camera & Target State for Jitter-Free Damping
    const currentCamPos = new THREE.Vector3(0, 16, 32);
    const currentCamLookAt = new THREE.Vector3(0, 0, 0);

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
      camPitch = Math.max(-1.45, Math.min(1.45, camPitch + dy * 0.006));
    };
    const onMouseUp = () => {
      isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      camDistance = Math.max(10.2, Math.min(300.0, camDistance + e.deltaY * 0.02));
      e.preventDefault();
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // 9. Animation & Render Loop (Physics & Render Decoupled)
    let lastTime = performance.now();
    let frameCount = 0;

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      frameCount++;

      const now = performance.now();
      const dtWall = Math.min(0.1, (now - lastTime) / 1000.0);
      lastTime = now;

      // Evaluate Simulation State: Live Engine or Recorded Replay Snapshot
      let activeSnapshot: ReplayStateSnapshot | null = null;
      let rocketPosScene = new THREE.Vector3();
      let forwardDirScene = new THREE.Vector3(0, 1, 0);
      let isBurning = false;
      let throttle = 0.0;
      let altKm = 0.0;
      let simTime = 0.0;

      if (sim.isReplayMode) {
        sim.advanceReplay(dtWall);
        activeSnapshot = sim.evaluateReplayAt(sim.replayTimeS);
        simTime = activeSnapshot.timeS;

        // ECI (x, y, z) -> Scene (x, z, -y)
        rocketPosScene.set(
          activeSnapshot.positionM.x * TO_SCENE_SCALE,
          activeSnapshot.positionM.z * TO_SCENE_SCALE,
          -activeSnapshot.positionM.y * TO_SCENE_SCALE
        );

        const fwd = activeSnapshot.attitudeForward;
        forwardDirScene.set(fwd.x, fwd.z, -fwd.y).normalize();

        isBurning = activeSnapshot.isEngineBurning;
        throttle = activeSnapshot.throttle;
        altKm = activeSnapshot.altitudeKm;

        // Apply multi-stage separation state
        rocketBundle.setStageState(activeSnapshot.stageState);
      } else {
        // Step authoritative fixed-timestep physics engine
        sim.update(dtWall);
        simTime = sim.timeS;

        rocketPosScene.set(
          sim.position.x * TO_SCENE_SCALE,
          sim.position.z * TO_SCENE_SCALE,
          -sim.position.y * TO_SCENE_SCALE
        );

        const vel = sim.velocity;
        altKm = Math.max(0, (sim.position.magnitude() - R_EARTH) / 1000.0);
        isBurning = sim.rocket.isEngineBurning;
        throttle = sim.rocket.throttle;

        if (isBurning) {
          const thrustDir = sim.rocket.thrustDirection;
          forwardDirScene.set(thrustDir.x, thrustDir.z, -thrustDir.y).normalize();
        } else if (vel.magnitudeSq() > 1.0) {
          forwardDirScene.set(vel.x, vel.z, -vel.y).normalize();
        } else {
          forwardDirScene.copy(rocketPosScene).normalize();
        }

        // Live staging state from simulation manager
        const burnDuration = sim.params.burnDurationS;
        const isStage1Attached = simTime < burnDuration + 1.0;
        const isFairingAttached = altKm < 85.0;
        rocketBundle.setStageState({
          stage1Attached: isStage1Attached,
          fairingAttached: isFairingAttached,
          stage1SeparationDist: isStage1Attached ? 0 : Math.min(25.0, (simTime - burnDuration) * 3.5),
          fairingSeparationDist: isFairingAttached ? 0 : Math.min(18.0, (altKm - 85.0) * 0.4),
        });
      }

      // Update planetary rotation & clouds
      earthBundle.update(simTime, dtWall);

      // Update Rocket Visuals Pose & Supersonic Dual Plume
      rocketBundle.setPose(rocketPosScene, forwardDirScene);
      rocketBundle.updatePlume(isBurning, throttle, altKm);

      // Update 3D Force Vectors
      const showVec = showVectorsRef.current;
      vectorsGroup.visible = showVec;
      if (showVec) {
        vectorsGroup.position.copy(rocketPosScene);

        // Velocity vector (Cyan)
        const velVec = sim.isReplayMode && activeSnapshot
          ? activeSnapshot.velocityMPerS
          : sim.velocity;
        const speed = velVec.magnitude();
        if (speed > 1.0) {
          const velDir = new THREE.Vector3(velVec.x, velVec.z, -velVec.y).normalize();
          const velLen = Math.min(1.8, Math.max(0.3, speed / 3000.0));
          velArrow.setDirection(velDir);
          velArrow.setLength(velLen, velLen * 0.25, velLen * 0.12);
          velArrow.visible = true;
        } else {
          velArrow.visible = false;
        }

        // Thrust vector (Amber)
        const thrustForce = sim.isReplayMode && activeSnapshot
          ? activeSnapshot.thrustForceN
          : sim.engine.thrustForceVector;
        const thrustMag = thrustForce.magnitude();
        if (thrustMag > 1000.0) {
          const thDir = new THREE.Vector3(thrustForce.x, thrustForce.z, -thrustForce.y).normalize();
          const thLen = Math.min(1.6, Math.max(0.3, thrustMag / 5e6));
          thrustArrow.setDirection(thDir);
          thrustArrow.setLength(thLen, thLen * 0.25, thLen * 0.12);
          thrustArrow.visible = true;
        } else {
          thrustArrow.visible = false;
        }

        // Gravity vector (Purple)
        const gravDir = rocketPosScene.clone().normalize().negate();
        gravArrow.setDirection(gravDir);
        gravArrow.setLength(0.8, 0.18, 0.08);

        // Aerodynamic Drag vector (Red)
        const dragForce = sim.isReplayMode && activeSnapshot
          ? activeSnapshot.dragForceN
          : sim.engine.dragForceVector;
        const dragMag = dragForce.magnitude();
        if (dragMag > 500.0) {
          const dDir = new THREE.Vector3(dragForce.x, dragForce.z, -dragForce.y).normalize();
          const dLen = Math.min(1.4, Math.max(0.25, dragMag / 8e5));
          dragArrow.setDirection(dDir);
          dragArrow.setLength(dLen, dLen * 0.25, dLen * 0.12);
          dragArrow.visible = true;
        } else {
          dragArrow.visible = false;
        }
      }

      // Update Historical Trajectory Line (No Gaps: connect line to rocket)
      const history = sim.trajectoryHistory;
      if (history.length > 0) {
        const count = Math.min(history.length, maxHistoryPts - 1);
        const posAttr = historyLine.geometry.attributes.position as THREE.BufferAttribute;
        const array = posAttr.array as Float32Array;

        for (let i = 0; i < count; i++) {
          const p = history[i];
          array[i * 3] = p.x * TO_SCENE_SCALE;
          array[i * 3 + 1] = p.z * TO_SCENE_SCALE;
          array[i * 3 + 2] = -p.y * TO_SCENE_SCALE;
        }
        // Always connect the trajectory trail directly to the current rocket location!
        array[count * 3] = rocketPosScene.x;
        array[count * 3 + 1] = rocketPosScene.y;
        array[count * 3 + 2] = rocketPosScene.z;

        posAttr.needsUpdate = true;
        historyLine.geometry.setDrawRange(0, count + 1);
      }

      // Update Analytical Osculating Orbit Spline (Throttled to once every 24 frames for 60fps smoothness)
      if (frameCount % 24 === 0) {
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
      }

      // 10. Jitter-Free 7-Mode Camera Tracking with Exponential Damping
      if (cameraRef.current) {
        const mode = cameraModeRef.current;
        const desiredPos = new THREE.Vector3();
        const desiredLookAt = new THREE.Vector3();
        let dampingK = 6.0; // Exponential damping factor

        switch (mode) {
          case 'CHASE': {
            // Camera directly behind vehicle aligned with flight direction
            const backDir = forwardDirScene.clone().negate().normalize();
            const upNorm = rocketPosScene.clone().normalize();
            desiredPos.copy(rocketPosScene)
              .addScaledVector(backDir, 1.8)
              .addScaledVector(upNorm, 0.45);
            desiredLookAt.copy(rocketPosScene).addScaledVector(forwardDirScene, 0.8);
            dampingK = 8.0;
            break;
          }

          case 'ROCKET_FOLLOW': {
            // Smooth offset tracking without snapping to pitch oscillations
            const upNorm = rocketPosScene.clone().normalize();
            const sideNorm = new THREE.Vector3().crossVectors(forwardDirScene, upNorm).normalize();
            desiredPos.copy(rocketPosScene)
              .addScaledVector(upNorm, 1.2)
              .addScaledVector(sideNorm, 2.2)
              .addScaledVector(forwardDirScene, -1.5);
            desiredLookAt.copy(rocketPosScene);
            dampingK = 5.0;
            break;
          }

          case 'PAD': {
            // Ground-level view at Cape Canaveral pad looking up at climbing rocket
            const padSurface = padScenePos.clone().normalize().multiplyScalar(SCENE_EARTH_RADIUS + 0.04);
            desiredPos.copy(padSurface).add(new THREE.Vector3(0.5, 0.2, 0.5));
            desiredLookAt.copy(rocketPosScene);
            dampingK = 4.0;
            break;
          }

          case 'OVERVIEW': {
            // Wide mission overview showing Earth, pad, and full flight trajectory
            desiredPos.set(0, 18, 30);
            desiredLookAt.copy(rocketPosScene.clone().multiplyScalar(0.4));
            dampingK = 3.0;
            break;
          }

          case 'ORBIT': {
            // Orbit-centered high view
            const cx = Math.cos(camPitch) * Math.sin(camYaw) * camDistance;
            const cy = Math.sin(camPitch) * camDistance;
            const cz = Math.cos(camPitch) * Math.cos(camYaw) * camDistance;
            desiredPos.set(cx, cy, cz);
            desiredLookAt.set(0, 0, 0);
            dampingK = 7.0;
            break;
          }

          case 'CINEMATIC': {
            // Automatically transitions smoothly across mission milestones
            if (simTime < 18.0) {
              // Pad Liftoff
              const padSurface = padScenePos.clone().normalize().multiplyScalar(SCENE_EARTH_RADIUS + 0.04);
              desiredPos.copy(padSurface).add(new THREE.Vector3(0.6, 0.3, 0.6));
              desiredLookAt.copy(rocketPosScene);
            } else if (simTime < 130.0) {
              // Chase & Gravity Turn
              const backDir = forwardDirScene.clone().negate().normalize();
              const upNorm = rocketPosScene.clone().normalize();
              desiredPos.copy(rocketPosScene).addScaledVector(backDir, 2.5).addScaledVector(upNorm, 0.7);
              desiredLookAt.copy(rocketPosScene);
            } else {
              // High Orbital Overview
              desiredPos.set(0, 16, 26);
              desiredLookAt.copy(rocketPosScene);
            }
            dampingK = 4.0;
            break;
          }

          case 'FREE':
          default: {
            // Manual interactive orbit camera
            const cx = Math.cos(camPitch) * Math.sin(camYaw) * camDistance;
            const cy = Math.sin(camPitch) * camDistance;
            const cz = Math.cos(camPitch) * Math.cos(camYaw) * camDistance;
            desiredPos.set(cx, cy, cz);
            desiredLookAt.set(0, 0, 0);
            dampingK = 12.0;
            break;
          }
        }

        // Apply frame-rate independent exponential damping: 1.0 - Math.exp(-k * dt)
        const alpha = 1.0 - Math.exp(-dampingK * dtWall);
        currentCamPos.lerp(desiredPos, alpha);
        currentCamLookAt.lerp(desiredLookAt, alpha);

        cameraRef.current.position.copy(currentCamPos);
        cameraRef.current.lookAt(currentCamLookAt);
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

      pedestalGeo.dispose();
      pedestalMat.dispose();
      towerGeo.dispose();
      towerMat.dispose();

      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [sim]); // ONLY re-create when sim instance changes, NOT on cameraMode!

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full cursor-grab active:cursor-grabbing select-none"
    />
  );
};
