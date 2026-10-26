/**
 * PlanetaryVisuals.ts
 *
 * Photorealistic planetary visualization system for Three.js.
 * Implements:
 * 1. Physical body meshes with high-res procedural and image-based albedo/roughness textures.
 * 2. Saturn multi-layer ring system with realistic transparency, Cassini Division, and axial tilt.
 * 3. Earth multi-layer day/night terminator with atmospheric cloud deck and specular highlights.
 * 4. Physically-motivated atmospheric limb Fresnel scattering shell per planetary atmosphere type.
 * 5. Correct astronomical axial tilts and locked planetary surface rotation.
 */

import * as THREE from 'three';
import { PlanetaryBodyData } from '../../../physics/constants';
import { PlanetaryTextures } from '../textures/PlanetaryTextures';
import { EarthVisuals, EarthVisualsBundle } from '../../simulator/viewport/EarthVisuals';

export interface PlanetBundle {
  group: THREE.Group;
  planetMesh: THREE.Mesh;
  atmosphereMesh?: THREE.Mesh;
  ringMesh?: THREE.Mesh;
  earthBundle?: EarthVisualsBundle;
  axialTiltRad: number;
  rotationSpeedRadPerS: number;
  update: (timeS: number, dt: number) => void;
  dispose: () => void;
}

export class PlanetaryVisuals {
  /**
   * Creates a dedicated planetary visual bundle based on planet configuration
   */
  public static create(
    planet: PlanetaryBodyData | { id?: string; name: string; radiusM: number; massKg?: number; mu?: number; color?: number },
    visualRadius: number = 4.0,
    sunLightDirection: THREE.Vector3 = new THREE.Vector3(1.2, 0.5, 0.8).normalize()
  ): PlanetBundle {
    const group = new THREE.Group();
    const planetId = (('id' in planet && planet.id) ? planet.id : planet.name || 'CUSTOM').toUpperCase();

    // Astronomical axial tilts (radians)
    const AXIAL_TILTS: Record<string, number> = {
      JUPITER: THREE.MathUtils.degToRad(3.13),
      SATURN: THREE.MathUtils.degToRad(26.73),
      EARTH: THREE.MathUtils.degToRad(23.44),
      VENUS: THREE.MathUtils.degToRad(177.36), // Retrograde
      MERCURY: THREE.MathUtils.degToRad(0.03),
      URANUS: THREE.MathUtils.degToRad(97.77),
      NEPTUNE: THREE.MathUtils.degToRad(28.32),
    };

    const axialTiltRad = AXIAL_TILTS[planetId] ?? 0.0;
    group.rotation.z = axialTiltRad;

    // Atmospheric limb glow colors
    const ATMOSPHERE_COLORS: Record<string, { color: number; intensity: number }> = {
      JUPITER: { color: 0xdeb887, intensity: 0.35 },
      SATURN: { color: 0xf5deb3, intensity: 0.30 },
      EARTH: { color: 0x38bdf8, intensity: 0.85 },
      VENUS: { color: 0xfef08a, intensity: 0.65 },
      URANUS: { color: 0x67e8f9, intensity: 0.45 },
      NEPTUNE: { color: 0x3b82f6, intensity: 0.55 },
    };

    let planetMesh: THREE.Mesh;
    let atmosphereMesh: THREE.Mesh | undefined;
    let ringMesh: THREE.Mesh | undefined;
    let earthBundle: EarthVisualsBundle | undefined;

    // --- 1. EARTH: Full Multi-Layer Photorealistic Bundle ---
    if (planetId === 'EARTH') {
      earthBundle = EarthVisuals.create(visualRadius);
      group.add(earthBundle.earthGroup);
      planetMesh = earthBundle.earthMesh;
      atmosphereMesh = earthBundle.atmosphereMesh;

      return {
        group,
        planetMesh,
        atmosphereMesh,
        earthBundle,
        axialTiltRad,
        rotationSpeedRadPerS: 0.05,
        update: (timeS: number, dt: number) => {
          if (earthBundle) {
            earthBundle.update(timeS, dt);
          }
        },
        dispose: () => {
          if (earthBundle) earthBundle.dispose();
        },
      };
    }

    // --- 2. JUPITER, SATURN, VENUS, MERCURY, ICE GIANTS & CUSTOM ---
    const sphereGeo = new THREE.SphereGeometry(visualRadius, 64, 48);
    let sphereMat: THREE.Material;

    if (planetId === 'JUPITER') {
      const tex = PlanetaryTextures.createJupiterTexture();
      sphereMat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.82,
        metalness: 0.04,
      });
    } else if (planetId === 'SATURN') {
      const tex = PlanetaryTextures.createSaturnTexture();
      sphereMat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.78,
        metalness: 0.06,
      });

      // Saturn Ring System
      const ringInner = visualRadius * 1.25;
      const ringOuter = visualRadius * 2.38;
      const ringGeo = new THREE.RingGeometry(ringInner, ringOuter, 96);
      const ringTex = PlanetaryTextures.createSaturnRingTexture();

      // UV mapping for annular radial gradient
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
        roughness: 0.45,
        metalness: 0.1,
      });

      ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      group.add(ringMesh);
    } else if (planetId === 'VENUS') {
      const tex = PlanetaryTextures.createVenusTexture();
      sphereMat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.9,
        metalness: 0.02,
      });
    } else if (planetId === 'MERCURY') {
      const tex = PlanetaryTextures.createMercuryTexture();
      sphereMat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.95,
        metalness: 0.1,
      });
    } else if (planetId === 'URANUS' || planetId === 'NEPTUNE') {
      const tex = PlanetaryTextures.createIceGiantTexture(planetId === 'NEPTUNE');
      sphereMat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.75,
        metalness: 0.08,
      });
    } else {
      // Custom / Theoretical Planet
      sphereMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(planet.color || '#4f9fff'),
        roughness: 0.7,
        metalness: 0.1,
      });
    }

    planetMesh = new THREE.Mesh(sphereGeo, sphereMat);
    group.add(planetMesh);

    // --- 3. ATMOSPHERIC LIMB FRESNEL SCATTERING SHELL ---
    const atmoConfig = ATMOSPHERE_COLORS[planetId];
    if (atmoConfig) {
      const atmoGeo = new THREE.SphereGeometry(visualRadius * 1.025, 48, 36);
      const atmoMat = new THREE.ShaderMaterial({
        uniforms: {
          glowColor: { value: new THREE.Color(atmoConfig.color) },
          sunDirection: { value: sunLightDirection },
          intensity: { value: atmoConfig.intensity },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform vec3 glowColor;
          uniform vec3 sunDirection;
          uniform float intensity;
          varying vec3 vNormal;
          varying vec3 vViewPosition;

          void main() {
            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);

            // View-dependent rim Fresnel factor
            float fresnel = 1.0 - max(0.0, dot(normal, viewDir));
            fresnel = pow(fresnel, 3.2);

            // Sun illumination factor on limb
            float sunFactor = max(0.0, dot(normal, sunDirection) * 0.5 + 0.5);

            float alpha = fresnel * sunFactor * intensity;
            gl_FragColor = vec4(glowColor, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      });

      atmosphereMesh = new THREE.Mesh(atmoGeo, atmoMat);
      group.add(atmosphereMesh);
    }

    const rotationSpeedRadPerS = planetId === 'VENUS' ? -0.015 : 0.04;

    const update = (_timeS: number, dt: number) => {
      planetMesh.rotation.y += dt * rotationSpeedRadPerS;
    };

    const dispose = () => {
      planetMesh.geometry.dispose();
      if (Array.isArray(planetMesh.material)) {
        planetMesh.material.forEach((m) => m.dispose());
      } else {
        planetMesh.material.dispose();
      }
      if (atmosphereMesh) {
        atmosphereMesh.geometry.dispose();
        (atmosphereMesh.material as THREE.Material).dispose();
      }
      if (ringMesh) {
        ringMesh.geometry.dispose();
        (ringMesh.material as THREE.Material).dispose();
      }
    };

    return {
      group,
      planetMesh,
      atmosphereMesh,
      ringMesh,
      axialTiltRad,
      rotationSpeedRadPerS,
      update,
      dispose,
    };
  }
}
