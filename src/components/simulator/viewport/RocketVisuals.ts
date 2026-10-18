/**
 * RocketVisuals.ts
 * 
 * High-fidelity 3D Rocket vehicle and dynamic engine plume renderer.
 * 
 * Features:
 * 1. Asynchronously loads official NASA Ares 1 launch vehicle model (.glb)
 *    using Three.js GLTFLoader with DRACOLoader decompression.
 * 2. Instantaneous procedural launch vehicle fallback:
 *    Multi-stage aerodynamic fuselage, payload fairing, cable raceways,
 *    interstage adapter, and de Laval expansion bell nozzles with PBR materials.
 * 3. Dynamic dual-component supersonic exhaust plume:
 *    - High-temperature supersonic Mach diamond inner core.
 *    - Expanding turbulent outer shear plume that flares in vacuum.
 *    - Responsive to throttle level and immediate cutoff on burnout / MECO.
 *    - Rocket aft illumination point light.
 * 
 * References:
 * - NASA 3D Resources / Ares 1 Launch Vehicle (Public Domain, NASA Langley).
 * - React Three Fiber model loading architecture guidelines.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export interface RocketVisualsBundle {
  rocketGroup: THREE.Group;
  setPose: (pos: THREE.Vector3, forward: THREE.Vector3) => void;
  updatePlume: (isBurning: boolean, throttle: number, altitudeKm: number) => void;
  dispose: () => void;
}

export class RocketVisuals {
  /**
   * Creates the visual rocket group containing the model and dynamic plume
   */
  public static create(): RocketVisualsBundle {
    const rocketGroup = new THREE.Group();
    const modelContainer = new THREE.Group();
    rocketGroup.add(modelContainer);

    // 1. Build High-Fidelity Procedural Fallback Model
    const proceduralRocket = this.buildProceduralRocket();
    modelContainer.add(proceduralRocket);

    // 2. Load Official NASA Ares 1 GLB Model Asynchronously
    this.loadNasaModel(modelContainer, proceduralRocket);

    // 3. Build Dynamic Dual-Layer Supersonic Exhaust Plume
    const plumeGroup = new THREE.Group();
    plumeGroup.position.set(0, 0, -0.42); // Position at engine nozzle exit
    plumeGroup.visible = false;
    rocketGroup.add(plumeGroup);

    // Inner Supersonic Core (Mach Diamonds / White-Cyan Core)
    const innerGeo = new THREE.ConeGeometry(0.045, 0.35, 12);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd, // Light blue-white
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const innerFlame = new THREE.Mesh(innerGeo, innerMat);
    innerFlame.rotation.x = -Math.PI / 2;
    innerFlame.position.z = -0.18;
    plumeGroup.add(innerFlame);

    // Outer Expansion Plume Envelope (Amber-Orange Glow)
    const outerGeo = new THREE.ConeGeometry(0.08, 0.65, 16);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b, // Amber-orange
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const outerFlame = new THREE.Mesh(outerGeo, outerMat);
    outerFlame.rotation.x = -Math.PI / 2;
    outerFlame.position.z = -0.35;
    plumeGroup.add(outerFlame);

    // Engine Exhaust Point Light
    const plumeLight = new THREE.PointLight(0xffaa44, 2.5, 3.5);
    plumeLight.position.set(0, 0, -0.2);
    plumeGroup.add(plumeLight);

    // 4. Update Methods
    const setPose = (pos: THREE.Vector3, forward: THREE.Vector3) => {
      rocketGroup.position.copy(pos);
      if (forward.lengthSq() > 1e-4) {
        const target = pos.clone().add(forward);
        rocketGroup.lookAt(target);
      }
    };

    const updatePlume = (isBurning: boolean, throttle: number, altitudeKm: number) => {
      plumeGroup.visible = isBurning && throttle > 0.01;
      if (!plumeGroup.visible) return;

      // Vacuum plume expansion effect: as atmospheric pressure drops with altitude,
      // underexpanded rocket exhaust flares laterally outwards
      const vacFlare = Math.min(2.2, 1.0 + (Math.min(100.0, altitudeKm) / 100.0) * 0.9);
      const safeThrottle = Math.max(0.1, throttle);
      const flicker = 0.92 + Math.random() * 0.16;

      // Scale inner core (elongates with throttle)
      innerFlame.scale.set(
        flicker * safeThrottle,
        flicker * safeThrottle,
        flicker * safeThrottle * 1.1
      );

      // Scale outer plume (flares wide in vacuum)
      outerFlame.scale.set(
        flicker * vacFlare * safeThrottle,
        flicker * vacFlare * safeThrottle,
        flicker * safeThrottle * (1.0 + safeThrottle * 0.4)
      );

      plumeLight.intensity = 2.0 * safeThrottle * flicker;
    };

    const dispose = () => {
      innerGeo.dispose();
      innerMat.dispose();
      outerGeo.dispose();
      outerMat.dispose();
    };

    return {
      rocketGroup,
      setPose,
      updatePlume,
      dispose,
    };
  }

  /**
   * Loads the NASA Ares 1 launch vehicle model and replaces procedural fallback
   */
  private static loadNasaModel(
    container: THREE.Group,
    proceduralFallback: THREE.Group
  ): void {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');

    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    gltfLoader.load(
      '/models/ares_1.glb',
      (gltf) => {
        const model = gltf.scene;

        // Compute model bounding box
        const bbox = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const center = new THREE.Vector3();
        bbox.getCenter(center);

        // Target length in scene coordinates ~ 0.7 units
        const targetLength = 0.75;
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = targetLength / (maxDim > 0 ? maxDim : 1);

        model.scale.setScalar(scaleFactor);

        // Center model so longitudinal axis runs along +Z, and base is at Z = -0.38
        // Ares 1 major axis in raw GLB is Z
        model.position.set(
          -center.x * scaleFactor,
          -center.y * scaleFactor,
          -center.z * scaleFactor
        );

        // Orient rocket nose along +Z
        const wrapper = new THREE.Group();
        wrapper.add(model);

        // Enable shadows and enhance PBR materials
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

        // Swap fallback with detailed NASA asset
        container.remove(proceduralFallback);
        container.add(wrapper);
        dracoLoader.dispose();
      },
      undefined,
      (err) => {
        console.warn('NASA GLB model load failed, retaining procedural launch vehicle fallback:', err);
        dracoLoader.dispose();
      }
    );
  }

  /**
   * Constructs a high-detail procedural launch vehicle (Falcon 9 / Ares scale)
   */
  private static buildProceduralRocket(): THREE.Group {
    const group = new THREE.Group();

    // Materials
    const whiteBodyMat = new THREE.MeshStandardMaterial({
      color: 0xf3f4f6, // Off-white aerospace coating
      roughness: 0.25,
      metalness: 0.15,
    });

    const darkInterstageMat = new THREE.MeshStandardMaterial({
      color: 0x181a20, // Carbon composite
      roughness: 0.7,
      metalness: 0.3,
    });

    const engineTitaniumMat = new THREE.MeshStandardMaterial({
      color: 0x2b2e36, // Refractory titanium/Inconel
      roughness: 0.35,
      metalness: 0.85,
    });

    // 1. First Stage Core Tank
    const firstStageGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.42, 24);
    const firstStage = new THREE.Mesh(firstStageGeo, whiteBodyMat);
    firstStage.rotation.x = Math.PI / 2;
    firstStage.position.z = -0.16;
    group.add(firstStage);

    // 2. Interstage Adapter Ring
    const interstageGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.06, 24);
    const interstage = new THREE.Mesh(interstageGeo, darkInterstageMat);
    interstage.rotation.x = Math.PI / 2;
    interstage.position.z = 0.08;
    group.add(interstage);

    // 3. Second Stage Core
    const secondStageGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.18, 24);
    const secondStage = new THREE.Mesh(secondStageGeo, whiteBodyMat);
    secondStage.rotation.x = Math.PI / 2;
    secondStage.position.z = 0.20;
    group.add(secondStage);

    // 4. Aerodynamic Ogive Payload Fairing (Nosecone)
    const fairingGeo = new THREE.ConeGeometry(0.075, 0.22, 24);
    const fairing = new THREE.Mesh(fairingGeo, whiteBodyMat);
    fairing.rotation.x = Math.PI / 2;
    fairing.position.z = 0.40;
    group.add(fairing);

    // 5. De Laval Engine Expansion Nozzle
    const nozzleGeo = new THREE.CylinderGeometry(0.035, 0.065, 0.10, 16);
    const nozzle = new THREE.Mesh(nozzleGeo, engineTitaniumMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.z = -0.41;
    group.add(nozzle);

    // 6. External Raceways (Cable Conduits) along fuselage
    const racewayGeo = new THREE.BoxGeometry(0.015, 0.012, 0.60);
    const raceway = new THREE.Mesh(racewayGeo, whiteBodyMat);
    raceway.position.set(0.076, 0, -0.05);
    group.add(raceway);

    // 7. Grid Fins / Aerodynamic Stabilizers
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const finGeo = new THREE.BoxGeometry(0.005, 0.04, 0.05);
      const fin = new THREE.Mesh(finGeo, darkInterstageMat);
      fin.position.set(
        Math.cos(angle) * 0.09,
        Math.sin(angle) * 0.09,
        0.05
      );
      fin.rotation.z = angle;
      group.add(fin);
    }

    return group;
  }
}
