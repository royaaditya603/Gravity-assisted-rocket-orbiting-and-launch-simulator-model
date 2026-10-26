/**
 * RocketVisuals.ts
 * 
 * High-fidelity 3D multi-stage Rocket vehicle, dynamic stage separation,
 * payload fairing jettison, and supersonic engine plume renderer.
 * 
 * Features:
 * 1. Multi-Stage Launch Vehicle Architecture:
 *    - Stage 1 Booster: First-stage propellant core with 9-engine cluster and grid fins.
 *    - Interstage Adapter: Carbon composite vented ring.
 *    - Stage 2 Core: Upper stage tank with high-expansion vacuum de Laval nozzle.
 *    - Payload / Spacecraft: Gold MLI satellite/probe with high-gain dish, visible after fairing separation.
 *    - Bi-Sector Payload Fairing: Split aerodynamic fairing halves that jettison laterally.
 * 2. Dynamic Physical Staging:
 *    - Stage 1 booster separation: booster cleanly slides backward and drifts aft.
 *    - Fairing separation: fairing halves pivot and translate outward at exo-atmospheric boundary.
 * 3. Jitter-Free Quaternion-Based Attitude Alignment:
 *    - Full 3D orientation tracking using SLERP and orthonormal reference frames.
 *    - Eliminates gimbal flipping and instantaneous snapping at engine cutoff.
 * 4. Dual Dynamic Supersonic Exhaust Plumes:
 *    - Stage 1 sea-level cluster plume with supersonic Mach diamonds.
 *    - Stage 2 vacuum-expanded flaring plume with reactive illumination.
 */

import * as THREE from 'three';

export interface StageVisualState {
  stage1Attached: boolean;
  fairingAttached: boolean;
  stage1SeparationDist?: number;
  fairingSeparationDist?: number;
}

export interface RocketVisualsBundle {
  rocketGroup: THREE.Group;
  setPose: (pos: THREE.Vector3, forward: THREE.Vector3, up?: THREE.Vector3) => void;
  setPoseQuaternion: (pos: THREE.Vector3, quaternion: THREE.Quaternion) => void;
  setStageState: (state: StageVisualState) => void;
  updatePlume: (isBurning: boolean, throttle: number, altitudeKm: number, isUpperStage?: boolean) => void;
  dispose: () => void;
}

export class RocketVisuals {
  /**
   * Creates the multi-stage visual rocket group and dynamic exhaust plumes
   */
  public static create(): RocketVisualsBundle {
    const rocketGroup = new THREE.Group();
    const modelContainer = new THREE.Group();
    rocketGroup.add(modelContainer);

    // --- MATERIALS (Aerospace Finishes) ---
    const whiteBodyMat = new THREE.MeshStandardMaterial({
      color: 0xf5f6fa,
      roughness: 0.28,
      metalness: 0.12,
    });

    const darkInterstageMat = new THREE.MeshStandardMaterial({
      color: 0x1a1c23,
      roughness: 0.75,
      metalness: 0.35,
    });

    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0x333742,
      roughness: 0.38,
      metalness: 0.82,
    });

    const goldFoilMat = new THREE.MeshStandardMaterial({
      color: 0xdfa130,
      roughness: 0.32,
      metalness: 0.88,
    });

    const solarBlueMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      roughness: 0.22,
      metalness: 0.65,
    });

    // --- 1. STAGE 1 (BOOSTER CORE) ---
    const stage1Group = new THREE.Group();
    modelContainer.add(stage1Group);

    // Booster main tank cylinder
    const s1Radius = 0.075;
    const s1Height = 0.44;
    const s1Geo = new THREE.CylinderGeometry(s1Radius, s1Radius, s1Height, 24);
    const s1Mesh = new THREE.Mesh(s1Geo, whiteBodyMat);
    s1Mesh.rotation.x = Math.PI / 2;
    s1Mesh.position.z = -0.18;
    stage1Group.add(s1Mesh);

    // Booster Engine Skirt & 9-Engine Cluster
    const skirtGeo = new THREE.CylinderGeometry(s1Radius, s1Radius * 0.95, 0.05, 24);
    const skirtMesh = new THREE.Mesh(skirtGeo, titaniumMat);
    skirtMesh.rotation.x = Math.PI / 2;
    skirtMesh.position.z = -0.41;
    stage1Group.add(skirtMesh);

    // Engine nozzles: 1 center + 8 perimeter nozzles
    const nozzleGeo = new THREE.ConeGeometry(0.016, 0.065, 12, 1, true);
    const centerNozzle = new THREE.Mesh(nozzleGeo, titaniumMat);
    centerNozzle.rotation.x = -Math.PI / 2;
    centerNozzle.position.set(0, 0, -0.45);
    stage1Group.add(centerNozzle);

    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const r = s1Radius * 0.62;
      const nozzle = new THREE.Mesh(nozzleGeo, titaniumMat);
      nozzle.rotation.x = -Math.PI / 2;
      nozzle.position.set(Math.cos(angle) * r, Math.sin(angle) * r, -0.45);
      stage1Group.add(nozzle);
    }

    // 4 Titanium Grid Fins at top of Stage 1
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const finGeo = new THREE.BoxGeometry(0.005, 0.038, 0.045);
      const fin = new THREE.Mesh(finGeo, titaniumMat);
      fin.position.set(Math.cos(angle) * (s1Radius + 0.015), Math.sin(angle) * (s1Radius + 0.015), 0.02);
      fin.rotation.z = angle;
      stage1Group.add(fin);
    }

    // Cable raceway along Stage 1
    const s1RacewayGeo = new THREE.BoxGeometry(0.012, 0.01, s1Height * 0.9);
    const s1Raceway = new THREE.Mesh(s1RacewayGeo, whiteBodyMat);
    s1Raceway.position.set(s1Radius + 0.004, 0, -0.18);
    stage1Group.add(s1Raceway);

    // --- 2. INTERSTAGE & STAGE 2 (UPPER STAGE) ---
    const stage2Group = new THREE.Group();
    modelContainer.add(stage2Group);

    // Interstage adapter ring
    const interstageGeo = new THREE.CylinderGeometry(s1Radius, s1Radius, 0.06, 24);
    const interstageMesh = new THREE.Mesh(interstageGeo, darkInterstageMat);
    interstageMesh.rotation.x = Math.PI / 2;
    interstageMesh.position.z = 0.07;
    stage2Group.add(interstageMesh);

    // Stage 2 core tank
    const s2Height = 0.20;
    const s2Geo = new THREE.CylinderGeometry(s1Radius, s1Radius, s2Height, 24);
    const s2Mesh = new THREE.Mesh(s2Geo, whiteBodyMat);
    s2Mesh.rotation.x = Math.PI / 2;
    s2Mesh.position.z = 0.20;
    stage2Group.add(s2Mesh);

    // Vacuum de Laval engine nozzle for Stage 2
    const vacNozzleGeo = new THREE.ConeGeometry(0.042, 0.09, 16, 1, true);
    const vacNozzle = new THREE.Mesh(vacNozzleGeo, titaniumMat);
    vacNozzle.rotation.x = -Math.PI / 2;
    vacNozzle.position.set(0, 0, 0.06);
    stage2Group.add(vacNozzle);

    // --- 3. INTERNAL PAYLOAD / SPACECRAFT ---
    const payloadGroup = new THREE.Group();
    payloadGroup.position.set(0, 0, 0.36);
    stage2Group.add(payloadGroup);

    // Gold MLI satellite bus
    const busGeo = new THREE.BoxGeometry(0.065, 0.065, 0.08);
    const busMesh = new THREE.Mesh(busGeo, goldFoilMat);
    payloadGroup.add(busMesh);

    // High-gain parabolic antenna dish
    const dishGeo = new THREE.ConeGeometry(0.045, 0.018, 16, 1, true);
    const dishMesh = new THREE.Mesh(dishGeo, whiteBodyMat);
    dishMesh.rotation.x = Math.PI / 2;
    dishMesh.position.set(0, 0.04, 0.03);
    payloadGroup.add(dishMesh);

    // Deployable solar array wings
    const wingGeo = new THREE.BoxGeometry(0.12, 0.04, 0.003);
    const leftWing = new THREE.Mesh(wingGeo, solarBlueMat);
    leftWing.position.set(-0.08, 0, 0);
    payloadGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, solarBlueMat);
    rightWing.position.set(0.08, 0, 0);
    payloadGroup.add(rightWing);

    // --- 4. BI-SECTOR PAYLOAD FAIRING (LEFT & RIGHT HALVES) ---
    const fairingLeft = new THREE.Group();
    const fairingRight = new THREE.Group();
    modelContainer.add(fairingLeft);
    modelContainer.add(fairingRight);

    // Procedural fairing halves using half-cylinder and half-cone
    const fairingCylGeo = new THREE.CylinderGeometry(s1Radius, s1Radius, 0.12, 16, 1, false, 0, Math.PI);
    const fairingNoseGeo = new THREE.ConeGeometry(s1Radius, 0.18, 16, 1, false, 0, Math.PI);

    const fCylL = new THREE.Mesh(fairingCylGeo, whiteBodyMat);
    fCylL.rotation.x = Math.PI / 2;
    fCylL.position.z = 0.34;
    fairingLeft.add(fCylL);

    const fNoseL = new THREE.Mesh(fairingNoseGeo, whiteBodyMat);
    fNoseL.rotation.x = Math.PI / 2;
    fNoseL.position.z = 0.49;
    fairingLeft.add(fNoseL);

    const fCylR = new THREE.Mesh(fairingCylGeo, whiteBodyMat);
    fCylR.rotation.x = Math.PI / 2;
    fCylR.rotation.z = Math.PI;
    fCylR.position.z = 0.34;
    fairingRight.add(fCylR);

    const fNoseR = new THREE.Mesh(fairingNoseGeo, whiteBodyMat);
    fNoseR.rotation.x = Math.PI / 2;
    fNoseR.rotation.z = Math.PI;
    fNoseR.position.z = 0.49;
    fairingRight.add(fNoseR);

    // --- 5. DYNAMIC DUAL-COMPONENT SUPERSONIC EXHAUST PLUMES ---
    const plumeGroup = new THREE.Group();
    plumeGroup.position.set(0, 0, -0.45);
    plumeGroup.visible = false;
    rocketGroup.add(plumeGroup);

    // Inner Supersonic Core (Mach Diamonds / Light Blue-White)
    const innerGeo = new THREE.ConeGeometry(0.05, 0.40, 16);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xa5f3fc,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const innerFlame = new THREE.Mesh(innerGeo, innerMat);
    innerFlame.rotation.x = -Math.PI / 2;
    innerFlame.position.z = -0.20;
    plumeGroup.add(innerFlame);

    // Outer Expansion Plume Envelope (Amber-Orange Radiant Flame)
    const outerGeo = new THREE.ConeGeometry(0.09, 0.75, 20);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const outerFlame = new THREE.Mesh(outerGeo, outerMat);
    outerFlame.rotation.x = -Math.PI / 2;
    outerFlame.position.z = -0.38;
    plumeGroup.add(outerFlame);

    // Engine Exhaust Point Light
    const plumeLight = new THREE.PointLight(0xffa500, 3.0, 4.0);
    plumeLight.position.set(0, 0, -0.25);
    plumeGroup.add(plumeLight);

    // Smooth current quaternion to prevent snapping
    const currentQuat = new THREE.Quaternion();
    const targetQuat = new THREE.Quaternion();

    // --- 6. UPDATE & POSE METHODS ---
    const setPoseQuaternion = (pos: THREE.Vector3, quaternion: THREE.Quaternion) => {
      rocketGroup.position.copy(pos);
      rocketGroup.quaternion.copy(quaternion);
    };

    const setPose = (pos: THREE.Vector3, forward: THREE.Vector3, up?: THREE.Vector3) => {
      rocketGroup.position.copy(pos);

      if (forward.lengthSq() > 1e-6) {
        const fwdNorm = forward.clone().normalize();

        // Derive stable up vector
        let upNorm: THREE.Vector3;
        if (up && up.lengthSq() > 1e-4) {
          upNorm = up.clone().normalize();
        } else {
          upNorm = pos.clone().normalize();
          if (Math.abs(upNorm.dot(fwdNorm)) > 0.95) {
            upNorm = new THREE.Vector3(0, 1, 0);
          }
        }

        // Construct orthonormal rotation matrix
        const right = new THREE.Vector3().crossVectors(upNorm, fwdNorm).normalize();
        const trueUp = new THREE.Vector3().crossVectors(fwdNorm, right).normalize();

        const m = new THREE.Matrix4().makeBasis(right, trueUp, fwdNorm);
        targetQuat.setFromRotationMatrix(m);

        // Smoothly slerp to avoid instantaneous snapping at burnout or liftoff
        currentQuat.slerp(targetQuat, 0.25);
        rocketGroup.quaternion.copy(currentQuat);
      }
    };

    const setStageState = (state: StageVisualState) => {
      if (state.stage1Attached) {
        stage1Group.position.set(0, 0, 0);
        stage1Group.visible = true;
      } else {
        // Booster separates and falls aft
        const sepDist = state.stage1SeparationDist ?? 0.8;
        stage1Group.position.set(0, 0, -sepDist);
        stage1Group.visible = sepDist < 15.0; // Cull after falling far
      }

      if (state.fairingAttached) {
        fairingLeft.position.set(0, 0, 0);
        fairingLeft.rotation.set(0, 0, 0);
        fairingLeft.visible = true;

        fairingRight.position.set(0, 0, 0);
        fairingRight.rotation.set(0, 0, 0);
        fairingRight.visible = true;
      } else {
        // Fairing halves jettison laterally
        const sepDist = state.fairingSeparationDist ?? 0.6;
        fairingLeft.position.set(-sepDist, 0, sepDist * 0.4);
        fairingLeft.rotation.y = -sepDist * 0.8;
        fairingLeft.visible = sepDist < 10.0;

        fairingRight.position.set(sepDist, 0, sepDist * 0.4);
        fairingRight.rotation.y = sepDist * 0.8;
        fairingRight.visible = sepDist < 10.0;
      }
    };

    const updatePlume = (
      isBurning: boolean,
      throttle: number,
      altitudeKm: number,
      isUpperStage: boolean = false
    ) => {
      plumeGroup.visible = isBurning && throttle > 0.01;
      if (!plumeGroup.visible) return;

      // Position plume at Stage 1 base or Stage 2 vacuum nozzle
      plumeGroup.position.z = isUpperStage ? 0.03 : -0.45;

      const safeThrottle = Math.max(0.1, Math.min(1.0, throttle));
      const vacFlare = Math.min(2.5, 1.0 + (Math.min(120.0, altitudeKm) / 120.0) * 1.4);
      const flicker = 0.94 + Math.random() * 0.12;

      innerFlame.scale.set(
        flicker * safeThrottle,
        flicker * safeThrottle,
        flicker * safeThrottle * (isUpperStage ? 0.75 : 1.1)
      );

      outerFlame.scale.set(
        flicker * vacFlare * safeThrottle,
        flicker * vacFlare * safeThrottle,
        flicker * safeThrottle * (isUpperStage ? 0.85 : 1.2)
      );

      plumeLight.intensity = (isUpperStage ? 1.8 : 3.2) * safeThrottle * flicker;
    };

    const dispose = () => {
      whiteBodyMat.dispose();
      darkInterstageMat.dispose();
      titaniumMat.dispose();
      goldFoilMat.dispose();
      solarBlueMat.dispose();

      s1Geo.dispose();
      skirtGeo.dispose();
      nozzleGeo.dispose();
      s1RacewayGeo.dispose();
      interstageGeo.dispose();
      s2Geo.dispose();
      vacNozzleGeo.dispose();
      busGeo.dispose();
      dishGeo.dispose();
      wingGeo.dispose();
      fairingCylGeo.dispose();
      fairingNoseGeo.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      outerGeo.dispose();
      outerMat.dispose();
    };

    return {
      rocketGroup,
      setPose,
      setPoseQuaternion,
      setStageState,
      updatePlume,
      dispose,
    };
  }
}
