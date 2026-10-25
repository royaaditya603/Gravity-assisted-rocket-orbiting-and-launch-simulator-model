/**
 * SpacecraftVisuals.ts
 *
 * High-Fidelity Interplanetary Exploration Spacecraft Model Generator
 * Inspired by NASA flagship deep-space probes (Voyager, Cassini, New Horizons).
 *
 * Implements:
 * 1. Decagonal primary structural bus wrapped in gold/silver MLI (Multi-Layer Insulation) thermal blankets.
 * 2. High-Gain Antenna (HGA) parabolic reflector dish with central feed horn and tripod support struts.
 * 3. Deployable Radioisotope Thermoelectric Generator (RTG) boom with cooling fins.
 * 4. Deployable magnetometer science boom with triaxial sensor canisters.
 * 5. Articulated optical scan platform (telephoto cameras, spectrometer).
 * 6. Quad-thruster Reaction Control System (RCS) pods at bus corners.
 * 7. Star-tracker optical navigation baffles.
 * 8. Smooth Quaternion-based attitude transitions (SLERP) to eliminate orientation snapping.
 */

import * as THREE from 'three';

export type SpacecraftAttitudeMode = 'VELOCITY_ALIGNED' | 'SUN_POINTING' | 'INERTIAL';

export interface SpacecraftBundle {
  group: THREE.Group;
  update: (
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    sunPos: THREE.Vector3,
    mode: SpacecraftAttitudeMode,
    dt: number
  ) => void;
  dispose: () => void;
}

export class SpacecraftVisuals {
  public static create(scale: number = 1.0): SpacecraftBundle {
    const group = new THREE.Group();
    group.scale.setScalar(scale);

    // --- MATERIALS (PBR Aerospace Finishes) ---
    // Gold Multi-Layer Insulation (Kapton / MLI)
    const mliGoldMat = new THREE.MeshStandardMaterial({
      color: 0xe5a93b,
      metalness: 0.88,
      roughness: 0.32,
    });

    // Silver Foil MLI
    const mliSilverMat = new THREE.MeshStandardMaterial({
      color: 0xd8dbe2,
      metalness: 0.92,
      roughness: 0.28,
    });

    // High-Gain Antenna white composite
    const antennaWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf4f5f8,
      metalness: 0.15,
      roughness: 0.35,
      side: THREE.DoubleSide,
    });

    // Titanium structural trusses & struts
    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0x4a4d55,
      metalness: 0.85,
      roughness: 0.45,
    });

    // Dark graphite RTG casing
    const rtgMat = new THREE.MeshStandardMaterial({
      color: 0x222326,
      metalness: 0.65,
      roughness: 0.65,
    });

    // Optical instruments & lenses
    const opticsMat = new THREE.MeshStandardMaterial({
      color: 0x111625,
      metalness: 0.95,
      roughness: 0.1,
    });

    // 1. PRIMARY EQUIPMENT BUS (Decagonal prism)
    const busRadius = 0.55;
    const busHeight = 0.42;
    const busGeo = new THREE.CylinderGeometry(busRadius, busRadius, busHeight, 10);
    const busMesh = new THREE.Mesh(busGeo, mliGoldMat);
    busMesh.rotation.y = Math.PI / 10;
    group.add(busMesh);

    // Upper structural ring
    const upperRingGeo = new THREE.CylinderGeometry(busRadius * 0.95, busRadius * 0.95, 0.06, 10);
    const upperRing = new THREE.Mesh(upperRingGeo, mliSilverMat);
    upperRing.position.y = busHeight * 0.5 + 0.03;
    group.add(upperRing);

    // 2. HIGH-GAIN ANTENNA (HGA) PARABOLIC DISH
    const dishRadius = 0.92;
    const dishDepth = 0.28;
    const dishGeo = new THREE.ConeGeometry(dishRadius, dishDepth, 32, 1, true);
    const dishMesh = new THREE.Mesh(dishGeo, antennaWhiteMat);
    dishMesh.rotation.x = Math.PI; // Face upward (+Y)
    dishMesh.position.y = busHeight * 0.5 + dishDepth + 0.08;
    group.add(dishMesh);

    // Central sub-reflector feed horn
    const feedGeo = new THREE.CylinderGeometry(0.04, 0.07, 0.22, 12);
    const feedMesh = new THREE.Mesh(feedGeo, titaniumMat);
    feedMesh.position.y = dishMesh.position.y - dishDepth * 0.45;
    group.add(feedMesh);

    // Tripod sub-reflector support struts
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const strutGeo = new THREE.CylinderGeometry(0.012, 0.012, dishRadius * 0.95, 8);
      const strut = new THREE.Mesh(strutGeo, titaniumMat);
      strut.position.set(
        Math.cos(angle) * dishRadius * 0.38,
        dishMesh.position.y - dishDepth * 0.3,
        Math.sin(angle) * dishRadius * 0.38
      );
      strut.rotation.z = Math.cos(angle) * 0.48;
      strut.rotation.x = Math.sin(angle) * 0.48;
      group.add(strut);
    }

    // 3. RADIOISOTOPE THERMOELECTRIC GENERATOR (RTG) BOOM
    const rtgBoomGroup = new THREE.Group();
    // Triangular truss boom
    const boomGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.45, 6);
    const boomMesh = new THREE.Mesh(boomGeo, titaniumMat);
    boomMesh.rotation.z = Math.PI / 2;
    boomMesh.position.x = 0.75;
    rtgBoomGroup.add(boomMesh);

    // RTG cylindrical canisters with cooling fins
    for (let c = 0; c < 2; c++) {
      const rtgCan = new THREE.Group();
      const canGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.35, 12);
      const canMesh = new THREE.Mesh(canGeo, rtgMat);
      rtgCan.add(canMesh);

      // Radiator cooling fins
      for (let f = 0; f < 4; f++) {
        const finGeo = new THREE.BoxGeometry(0.015, 0.32, 0.07);
        const finMesh = new THREE.Mesh(finGeo, titaniumMat);
        finMesh.rotation.y = (f * Math.PI) / 4;
        rtgCan.add(finMesh);
      }
      rtgCan.position.set(1.15 + c * 0.32, 0, 0);
      rtgBoomGroup.add(rtgCan);
    }
    group.add(rtgBoomGroup);

    // 4. MAGNETOMETER SCIENCE BOOM (Extends on opposite side)
    const magBoomGroup = new THREE.Group();
    const magTrussGeo = new THREE.CylinderGeometry(0.018, 0.018, 2.2, 6);
    const magTruss = new THREE.Mesh(magTrussGeo, titaniumMat);
    magTruss.rotation.z = -Math.PI / 2;
    magTruss.position.x = -1.15;
    magBoomGroup.add(magTruss);

    // Triaxial sensor canister at boom tip
    const magSensorGeo = new THREE.SphereGeometry(0.07, 12, 10);
    const magSensor = new THREE.Mesh(magSensorGeo, mliGoldMat);
    magSensor.position.x = -2.25;
    magBoomGroup.add(magSensor);
    group.add(magBoomGroup);

    // 5. SCAN PLATFORM & OPTICAL INSTRUMENTS
    const scanPlatform = new THREE.Group();
    const platformBaseGeo = new THREE.BoxGeometry(0.24, 0.12, 0.28);
    const platformBase = new THREE.Mesh(platformBaseGeo, titaniumMat);
    scanPlatform.add(platformBase);

    // Narrow-angle telephoto camera barrel
    const cameraLongGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.32, 16);
    const cameraLong = new THREE.Mesh(cameraLongGeo, opticsMat);
    cameraLong.rotation.x = Math.PI / 2;
    cameraLong.position.set(-0.06, 0.02, 0.18);
    scanPlatform.add(cameraLong);

    // Wide-angle camera
    const cameraShortGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.18, 16);
    const cameraShort = new THREE.Mesh(cameraShortGeo, opticsMat);
    cameraShort.rotation.x = Math.PI / 2;
    cameraShort.position.set(0.07, 0.02, 0.12);
    scanPlatform.add(cameraShort);

    scanPlatform.position.set(0, -busHeight * 0.5 - 0.1, 0.38);
    group.add(scanPlatform);

    // 6. REACTION CONTROL SYSTEM (RCS) THRUSTER CLUSTERS (4 bus corners)
    const rcsPositions = [
      new THREE.Vector3(busRadius * 0.85, 0, busRadius * 0.85),
      new THREE.Vector3(-busRadius * 0.85, 0, busRadius * 0.85),
      new THREE.Vector3(busRadius * 0.85, 0, -busRadius * 0.85),
      new THREE.Vector3(-busRadius * 0.85, 0, -busRadius * 0.85),
    ];

    rcsPositions.forEach((pos) => {
      const rcsBlock = new THREE.Group();
      const blockGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
      const blockMesh = new THREE.Mesh(blockGeo, titaniumMat);
      rcsBlock.add(blockMesh);

      // Micro thruster nozzles
      for (let n = 0; n < 3; n++) {
        const nozzleGeo = new THREE.ConeGeometry(0.022, 0.045, 8);
        const nozzle = new THREE.Mesh(nozzleGeo, titaniumMat);
        if (n === 0) nozzle.rotation.z = Math.PI / 2;
        if (n === 1) nozzle.rotation.x = -Math.PI / 2;
        if (n === 2) nozzle.rotation.y = Math.PI;
        rcsBlock.add(nozzle);
      }
      rcsBlock.position.copy(pos);
      group.add(rcsBlock);
    });

    // 7. STAR TRACKER LIGHT BAFFLE
    const trackerGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.12, 12, 1, true);
    const tracker = new THREE.Mesh(trackerGeo, opticsMat);
    tracker.rotation.z = Math.PI / 3;
    tracker.position.set(busRadius * 0.8, busHeight * 0.35, 0);
    group.add(tracker);

    // State for smooth orientation interpolation
    const currentQuat = new THREE.Quaternion();
    const targetQuat = new THREE.Quaternion();

    // UPDATE METHOD
    const update = (
      pos: THREE.Vector3,
      vel: THREE.Vector3,
      sunPos: THREE.Vector3,
      mode: SpacecraftAttitudeMode,
      dt: number
    ) => {
      group.position.copy(pos);

      // Calculate target orientation based on attitude mode
      if (mode === 'VELOCITY_ALIGNED' && vel.lengthSq() > 1e-4) {
        // Main forward axis points along velocity; antenna dish points slightly retrograde/normal
        const forward = vel.clone().normalize();
        const up = new THREE.Vector3(0, 1, 0);
        if (Math.abs(forward.dot(up)) > 0.95) {
          up.set(1, 0, 0);
        }
        const right = new THREE.Vector3().crossVectors(forward, up).normalize();
        const realUp = new THREE.Vector3().crossVectors(right, forward).normalize();
        const rotMat = new THREE.Matrix4().makeBasis(right, realUp, forward.negate());
        targetQuat.setFromRotationMatrix(rotMat);
      } else if (mode === 'SUN_POINTING') {
        // High-Gain Antenna points directly toward Sun (or Earth)
        const toSun = new THREE.Vector3().subVectors(sunPos, pos).normalize();
        const up = new THREE.Vector3(0, 0, 1);
        const right = new THREE.Vector3().crossVectors(toSun, up).normalize();
        const realUp = new THREE.Vector3().crossVectors(right, toSun).normalize();
        const rotMat = new THREE.Matrix4().makeBasis(right, toSun, realUp);
        targetQuat.setFromRotationMatrix(rotMat);
      } else {
        // Inertially fixed attitude (slow galactic roll)
        targetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.35);
      }

      // Smooth Quaternion SLERP (eliminates coordinate boundary snaps)
      const slerpFactor = Math.min(1.0, Math.max(0.05, dt * 6.0));
      currentQuat.slerp(targetQuat, slerpFactor);
      group.quaternion.copy(currentQuat);
    };

    const dispose = () => {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    };

    return { group, update, dispose };
  }
}
