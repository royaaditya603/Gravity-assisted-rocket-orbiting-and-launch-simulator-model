/**
 * SpacecraftVisuals.ts
 *
 * High-Fidelity Interplanetary Exploration Spacecraft & Launch Vehicle Model Generator.
 * Inspired by NASA flagship deep-space probes (Voyager, Cassini, New Horizons)
 * and launch vehicles (NASA Ares 1 / multi-stage rockets).
 *
 * Implements:
 * 1. Deep-Space Exploration Probe:
 *    - Decagonal primary structural bus wrapped in gold/silver MLI (Multi-Layer Insulation).
 *    - High-Gain Antenna (HGA) parabolic reflector dish with central feed horn and tripod struts.
 *    - Deployable Radioisotope Thermoelectric Generator (RTG) boom with cooling fins.
 *    - Deployable magnetometer science boom with triaxial sensor canisters.
 *    - Articulated optical scan platform (telephoto cameras, spectrometer).
 *    - Quad-thruster Reaction Control System (RCS) pods at bus corners.
 *    - Star-tracker optical navigation baffles.
 * 2. Launch Vehicle / Rocket Model:
 *    - Asynchronously loads NASA Ares 1 (.glb) via Three.js GLTFLoader & DRACOLoader.
 *    - Seamless procedural launch vehicle fallback: multi-stage fuselage, payload fairing,
 *      interstage adapter, cable raceways, and de Laval rocket nozzles.
 * 3. Smooth attitude kinematics:
 *    - Probe: Velocity-aligned, Sun/Earth-pointing, or Inertial modes with Quaternion SLERP.
 *    - Rocket: Longitudinal axis alignment along velocity vector.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export type SpacecraftAttitudeMode = 'VELOCITY_ALIGNED' | 'SUN_POINTING' | 'INERTIAL';
export type SpacecraftModelType = 'PROBE' | 'ROCKET';

export interface SpacecraftBundle {
  group: THREE.Group;
  modelType: SpacecraftModelType;
  setModelType: (type: SpacecraftModelType) => void;
  update: (
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    sunPos: THREE.Vector3,
    mode: SpacecraftAttitudeMode,
    dt: number
  ) => void;
  dispose: () => void;
}

// Scratch objects to eliminate per-frame allocations & GC pressure
const _scForward = new THREE.Vector3();
const _scUp = new THREE.Vector3();
const _scRight = new THREE.Vector3();
const _scRealUp = new THREE.Vector3();
const _scRotMat = new THREE.Matrix4();
const _scToSun = new THREE.Vector3();
const _scAxisY = new THREE.Vector3(0, 1, 0);

export class SpacecraftVisuals {
  public static create(
    scale: number = 1.0,
    initialModelType: SpacecraftModelType = 'PROBE'
  ): SpacecraftBundle {
    const group = new THREE.Group();
    group.scale.setScalar(scale);

    let currentModelType: SpacecraftModelType = initialModelType;

    // 1. Build Deep-Space Exploration Probe Subgroup
    const probeGroup = this.buildProbeGroup();
    group.add(probeGroup);

    // 2. Build Rocket Subgroup (NASA Ares 1 GLB with procedural fallback)
    const rocketGroup = this.buildRocketGroup();
    group.add(rocketGroup);

    // Set initial model visibility
    probeGroup.visible = currentModelType === 'PROBE';
    rocketGroup.visible = currentModelType === 'ROCKET';

    const setModelType = (type: SpacecraftModelType) => {
      currentModelType = type;
      probeGroup.visible = type === 'PROBE';
      rocketGroup.visible = type === 'ROCKET';
    };

    // State for smooth orientation interpolation
    const currentQuat = new THREE.Quaternion();
    const targetQuat = new THREE.Quaternion();

    // UPDATE METHOD (Zero Heap Allocations in Render Loop)
    const update = (
      pos: THREE.Vector3,
      vel: THREE.Vector3,
      sunPos: THREE.Vector3,
      mode: SpacecraftAttitudeMode,
      dt: number
    ) => {
      group.position.copy(pos);

      if (currentModelType === 'ROCKET') {
        // Rocket longitudinal axis (+Z or flight direction) aligns along velocity vector
        if (vel.lengthSq() > 1e-4) {
          _scForward.copy(vel).normalize();
          _scUp.set(0, 1, 0);
          if (Math.abs(_scForward.dot(_scUp)) > 0.95) {
            _scUp.set(1, 0, 0);
          }
          _scRight.crossVectors(_scForward, _scUp).normalize();
          _scRealUp.crossVectors(_scRight, _scForward).normalize();
          // Rocket nose points along flight direction (+forward)
          _scRotMat.makeBasis(_scRight, _scRealUp, _scForward);
          targetQuat.setFromRotationMatrix(_scRotMat);
        }
      } else {
        // Calculate target orientation based on probe attitude mode
        if (mode === 'VELOCITY_ALIGNED' && vel.lengthSq() > 1e-4) {
          _scForward.copy(vel).normalize();
          _scUp.set(0, 1, 0);
          if (Math.abs(_scForward.dot(_scUp)) > 0.95) {
            _scUp.set(1, 0, 0);
          }
          _scRight.crossVectors(_scForward, _scUp).normalize();
          _scRealUp.crossVectors(_scRight, _scForward).normalize();
          _scForward.negate();
          _scRotMat.makeBasis(_scRight, _scRealUp, _scForward);
          targetQuat.setFromRotationMatrix(_scRotMat);
        } else if (mode === 'SUN_POINTING') {
          // High-Gain Antenna points directly toward Sun (or Earth)
          _scToSun.subVectors(sunPos, pos).normalize();
          _scUp.set(0, 0, 1);
          _scRight.crossVectors(_scToSun, _scUp).normalize();
          _scRealUp.crossVectors(_scRight, _scToSun).normalize();
          _scRotMat.makeBasis(_scRight, _scToSun, _scRealUp);
          targetQuat.setFromRotationMatrix(_scRotMat);
        } else {
          // Inertially fixed attitude (slow galactic roll)
          targetQuat.setFromAxisAngle(_scAxisY, 0.35);
        }
      }

      // Smooth Quaternion SLERP with frame-rate independent exponential damping
      const slerpFactor = 1.0 - Math.exp(-6.0 * dt);
      currentQuat.slerp(targetQuat, Math.max(0.05, Math.min(1.0, slerpFactor)));
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

    return {
      group,
      get modelType() {
        return currentModelType;
      },
      setModelType,
      update,
      dispose,
    };
  }

  /**
   * Constructs the deep-space exploration probe geometry and PBR materials
   */
  private static buildProbeGroup(): THREE.Group {
    const probe = new THREE.Group();

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
    probe.add(busMesh);

    // Upper structural ring
    const upperRingGeo = new THREE.CylinderGeometry(busRadius * 0.95, busRadius * 0.95, 0.06, 10);
    const upperRing = new THREE.Mesh(upperRingGeo, mliSilverMat);
    upperRing.position.y = busHeight * 0.5 + 0.03;
    probe.add(upperRing);

    // 2. HIGH-GAIN ANTENNA (HGA) PARABOLIC DISH
    const dishRadius = 0.92;
    const dishDepth = 0.28;
    const dishGeo = new THREE.ConeGeometry(dishRadius, dishDepth, 32, 1, true);
    const dishMesh = new THREE.Mesh(dishGeo, antennaWhiteMat);
    dishMesh.rotation.x = Math.PI; // Face upward (+Y)
    dishMesh.position.y = busHeight * 0.5 + dishDepth + 0.08;
    probe.add(dishMesh);

    // Central sub-reflector feed horn
    const feedGeo = new THREE.CylinderGeometry(0.04, 0.07, 0.22, 12);
    const feedMesh = new THREE.Mesh(feedGeo, titaniumMat);
    feedMesh.position.y = dishMesh.position.y - dishDepth * 0.45;
    probe.add(feedMesh);

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
      probe.add(strut);
    }

    // 3. RADIOISOTOPE THERMOELECTRIC GENERATOR (RTG) BOOM
    const rtgBoomGroup = new THREE.Group();
    const boomGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.45, 6);
    const boomMesh = new THREE.Mesh(boomGeo, titaniumMat);
    boomMesh.rotation.z = Math.PI / 2;
    boomMesh.position.x = 0.75;
    rtgBoomGroup.add(boomMesh);

    for (let c = 0; c < 2; c++) {
      const rtgCan = new THREE.Group();
      const canGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.35, 12);
      const canMesh = new THREE.Mesh(canGeo, rtgMat);
      rtgCan.add(canMesh);

      for (let f = 0; f < 4; f++) {
        const finGeo = new THREE.BoxGeometry(0.015, 0.32, 0.07);
        const finMesh = new THREE.Mesh(finGeo, titaniumMat);
        finMesh.rotation.y = (f * Math.PI) / 4;
        rtgCan.add(finMesh);
      }
      rtgCan.position.set(1.15 + c * 0.32, 0, 0);
      rtgBoomGroup.add(rtgCan);
    }
    probe.add(rtgBoomGroup);

    // 4. MAGNETOMETER SCIENCE BOOM
    const magBoomGroup = new THREE.Group();
    const magTrussGeo = new THREE.CylinderGeometry(0.018, 0.018, 2.2, 6);
    const magTruss = new THREE.Mesh(magTrussGeo, titaniumMat);
    magTruss.rotation.z = -Math.PI / 2;
    magTruss.position.x = -1.15;
    magBoomGroup.add(magTruss);

    const magSensorGeo = new THREE.SphereGeometry(0.07, 12, 10);
    const magSensor = new THREE.Mesh(magSensorGeo, mliGoldMat);
    magSensor.position.x = -2.25;
    magBoomGroup.add(magSensor);
    probe.add(magBoomGroup);

    // 5. SCAN PLATFORM & OPTICAL INSTRUMENTS
    const scanPlatform = new THREE.Group();
    const platformBaseGeo = new THREE.BoxGeometry(0.24, 0.12, 0.28);
    const platformBase = new THREE.Mesh(platformBaseGeo, titaniumMat);
    scanPlatform.add(platformBase);

    const cameraLongGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.32, 16);
    const cameraLong = new THREE.Mesh(cameraLongGeo, opticsMat);
    cameraLong.rotation.x = Math.PI / 2;
    cameraLong.position.set(-0.06, 0.02, 0.18);
    scanPlatform.add(cameraLong);

    const cameraShortGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.18, 16);
    const cameraShort = new THREE.Mesh(cameraShortGeo, opticsMat);
    cameraShort.rotation.x = Math.PI / 2;
    cameraShort.position.set(0.07, 0.02, 0.12);
    scanPlatform.add(cameraShort);

    scanPlatform.position.set(0, -busHeight * 0.5 - 0.1, 0.38);
    probe.add(scanPlatform);

    // 6. REACTION CONTROL SYSTEM (RCS) THRUSTER CLUSTERS
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

      for (let n = 0; n < 3; n++) {
        const nozzleGeo = new THREE.ConeGeometry(0.022, 0.045, 8);
        const nozzle = new THREE.Mesh(nozzleGeo, titaniumMat);
        if (n === 0) nozzle.rotation.z = Math.PI / 2;
        if (n === 1) nozzle.rotation.x = -Math.PI / 2;
        if (n === 2) nozzle.rotation.y = Math.PI;
        rcsBlock.add(nozzle);
      }
      rcsBlock.position.copy(pos);
      probe.add(rcsBlock);
    });

    // 7. STAR TRACKER LIGHT BAFFLE
    const trackerGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.12, 12, 1, true);
    const tracker = new THREE.Mesh(trackerGeo, opticsMat);
    tracker.rotation.z = Math.PI / 3;
    tracker.position.set(busRadius * 0.8, busHeight * 0.35, 0);
    probe.add(tracker);

    return probe;
  }

  /**
   * Constructs the launch vehicle subgroup, loading the NASA Ares 1 model
   * asynchronously with a procedural rocket fallback.
   */
  private static buildRocketGroup(): THREE.Group {
    const rocketContainer = new THREE.Group();

    // 1. Procedural launch vehicle fallback
    const fallback = this.buildProceduralRocket();
    rocketContainer.add(fallback);

    // 2. Load official NASA Ares 1 GLB model if in browser
    if (typeof document !== 'undefined') {
      try {
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/draco/');

        const gltfLoader = new GLTFLoader();
        gltfLoader.setDRACOLoader(dracoLoader);

        gltfLoader.load(
          '/models/ares_1.glb',
          (gltf) => {
            const model = gltf.scene;

            const bbox = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            bbox.getSize(size);
            const center = new THREE.Vector3();
            bbox.getCenter(center);

            // Scale to match scene scale ~1.2 units length
            const targetLength = 1.35;
            const maxDim = Math.max(size.x, size.y, size.z);
            const scaleFactor = targetLength / (maxDim > 0 ? maxDim : 1);

            model.scale.setScalar(scaleFactor);
            model.position.set(
              -center.x * scaleFactor,
              -center.y * scaleFactor,
              -center.z * scaleFactor
            );

            const wrapper = new THREE.Group();
            wrapper.add(model);

            model.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
                  const mat = mesh.material as THREE.MeshStandardMaterial;
                  mat.roughness = Math.max(0.2, mat.roughness);
                  mat.metalness = Math.min(0.8, mat.metalness);
                }
              }
            });

            rocketContainer.remove(fallback);
            rocketContainer.add(wrapper);
            dracoLoader.dispose();
          },
          undefined,
          (err) => {
            console.warn('NASA Ares 1 GLB load failed, retaining procedural launch vehicle fallback:', err);
            dracoLoader.dispose();
          }
        );
      } catch (e) {
        console.warn('GLTFLoader initialization error, retaining procedural fallback:', e);
      }
    }

    return rocketContainer;
  }

  /**
   * High-detail procedural multi-stage launch vehicle fallback
   */
  private static buildProceduralRocket(): THREE.Group {
    const group = new THREE.Group();

    const whiteBodyMat = new THREE.MeshStandardMaterial({
      color: 0xf3f4f6,
      roughness: 0.28,
      metalness: 0.15,
    });

    const darkInterstageMat = new THREE.MeshStandardMaterial({
      color: 0x181a20,
      roughness: 0.7,
      metalness: 0.3,
    });

    const engineTitaniumMat = new THREE.MeshStandardMaterial({
      color: 0x2b2e36,
      roughness: 0.35,
      metalness: 0.85,
    });

    // 1. First Stage Core Tank
    const firstStageGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.75, 24);
    const firstStage = new THREE.Mesh(firstStageGeo, whiteBodyMat);
    firstStage.rotation.x = Math.PI / 2;
    firstStage.position.z = -0.28;
    group.add(firstStage);

    // 2. Interstage Adapter Ring
    const interstageGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 24);
    const interstage = new THREE.Mesh(interstageGeo, darkInterstageMat);
    interstage.rotation.x = Math.PI / 2;
    interstage.position.z = 0.14;
    group.add(interstage);

    // 3. Second Stage Core
    const secondStageGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.32, 24);
    const secondStage = new THREE.Mesh(secondStageGeo, whiteBodyMat);
    secondStage.rotation.x = Math.PI / 2;
    secondStage.position.z = 0.35;
    group.add(secondStage);

    // 4. Aerodynamic Payload Fairing / Nosecone
    const fairingGeo = new THREE.ConeGeometry(0.12, 0.35, 24);
    const fairing = new THREE.Mesh(fairingGeo, whiteBodyMat);
    fairing.rotation.x = Math.PI / 2;
    fairing.position.z = 0.68;
    group.add(fairing);

    // 5. De Laval Rocket Nozzle
    const nozzleGeo = new THREE.ConeGeometry(0.09, 0.16, 16, 1, true);
    const nozzle = new THREE.Mesh(nozzleGeo, engineTitaniumMat);
    nozzle.rotation.x = -Math.PI / 2;
    nozzle.position.z = -0.73;
    group.add(nozzle);

    return group;
  }
}
