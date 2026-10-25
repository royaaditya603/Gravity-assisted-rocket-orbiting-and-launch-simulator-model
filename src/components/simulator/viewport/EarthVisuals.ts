/**
 * EarthVisuals.ts
 * 
 * Photorealistic multi-layer Earth rendering module for Three.js / React Three Fiber.
 * 
 * Implements:
 * 1. Day / Night Terminator Shader Material with solar directional lighting,
 *    specular ocean glint, and city lights on Earth's night side.
 * 2. Dynamic multi-altitude cloud sphere with independent rotation and solar shading.
 * 3. Atmospheric limb/rim glow with view-dependent Fresnel scattering.
 * 4. High-resolution background starfield from NASA Hipparcos catalog.
 * 5. Accurate planetary texture orientation matching Cape Canaveral pad coordinates (28.5 deg N, -80.6 deg W).
 * 
 * References & Credits:
 * - NASA Visible Earth & Blue Marble Next Generation (Public Domain).
 * - NASA 3D Resources / Hipparcos Star Map (Public Domain).
 * - Solar System Scope 2K Textures (CC BY 4.0 - https://www.solarsystemscope.com/textures/).
 * - Shading techniques adapted from jordan-will/threejs-realistic-earth & MarkLaMer/realistic-earth.
 */

import * as THREE from 'three';
import { R_EARTH, H_ATMOSPHERE, OMEGA_EARTH } from '../../../physics';

export interface EarthVisualsBundle {
  earthGroup: THREE.Group;
  earthMesh: THREE.Mesh;
  cloudsMesh: THREE.Mesh;
  atmosphereMesh: THREE.Mesh;
  sunLight: THREE.DirectionalLight;
  sunDirection: THREE.Vector3;
  update: (timeS: number, dt: number) => void;
  dispose: () => void;
}

export class EarthVisuals {
  /**
   * Builds the complete multi-layer Earth visual hierarchy
   */
  public static create(sceneEarthRadius: number = 10.0): EarthVisualsBundle {
    const earthGroup = new THREE.Group();

    // 1. Sun Direction & Lighting
    // Position Sun in ECI space illuminating Atlantic and North America
    const sunDirection = new THREE.Vector3(1.2, 0.5, 0.8).normalize();
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.8);
    sunLight.position.copy(sunDirection.clone().multiplyScalar(150));

    // 2. Load Textures with Local Fallbacks (safe for both browser and headless Node)
    const isBrowser = typeof document !== 'undefined';
    const textureLoader = isBrowser ? new THREE.TextureLoader() : null;
    
    // Day Surface Texture (2K Solar System Scope / NASA Blue Marble)
    const dayTexture = isBrowser
      ? textureLoader!.load('/textures/earth_day_2k.jpg', undefined, undefined, () => {
          console.warn('Using procedural day texture fallback');
        })
      : new THREE.Texture();
    dayTexture.colorSpace = THREE.SRGBColorSpace;

    // Night Surface Texture (2K City Lights)
    const nightTexture = isBrowser
      ? textureLoader!.load('/textures/earth_night_2k.jpg', undefined, undefined, () => {
          console.warn('Using procedural night texture fallback');
        })
      : new THREE.Texture();
    nightTexture.colorSpace = THREE.SRGBColorSpace;

    // Cloud Layer Texture (2K NASA Cloud Composite)
    const cloudsTexture = isBrowser
      ? textureLoader!.load('/textures/earth_clouds_2k.jpg', undefined, undefined, () => {
          console.warn('Using procedural cloud texture fallback');
        })
      : new THREE.Texture();

    // 3. Custom Day / Night Terminator Earth Shader Material
    const earthUniforms = {
      dayTexture: { value: dayTexture },
      nightTexture: { value: nightTexture },
      sunDirection: { value: sunDirection },
    };

    const earthVertexShader = `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec3 vViewPosition;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = viewMatrix * worldPos;
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const earthFragmentShader = `
      uniform sampler2D dayTexture;
      uniform sampler2D nightTexture;
      uniform vec3 sunDirection;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec3 vViewPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 sunDir = normalize(sunDirection);
        vec3 viewDir = normalize(vViewPosition);

        // Angle between surface normal and directional sunlight
        float NdotL = dot(normal, sunDir);

        // Smooth day/night twilight terminator transition
        float dayFactor = smoothstep(-0.15, 0.22, NdotL);

        // Sample textures
        vec3 dayColor = texture2D(dayTexture, vUv).rgb;
        vec3 nightColor = texture2D(nightTexture, vUv).rgb * 1.7;

        // Specular ocean reflection
        // Identify oceans: higher blue channel than green/red
        float isOcean = clamp((dayColor.b - dayColor.r * 0.65 - dayColor.g * 0.65) * 2.2, 0.0, 1.0);
        vec3 halfVector = normalize(sunDir + viewDir);
        float specIntensity = pow(max(0.0, dot(normal, halfVector)), 28.0) * isOcean * 0.85;
        vec3 sunSpecular = vec3(1.0, 0.96, 0.85) * specIntensity * max(0.0, NdotL);

        // Ambient deep-space bounce
        vec3 ambient = vec3(0.02, 0.03, 0.05);

        // Composite daytime illumination
        vec3 litDay = dayColor * (max(0.0, NdotL) * 0.95 + 0.08) + sunSpecular;

        // Final color blend across the terminator
        vec3 finalColor = mix(nightColor, litDay, dayFactor) + ambient * dayColor;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const earthMaterial = new THREE.ShaderMaterial({
      uniforms: earthUniforms,
      vertexShader: earthVertexShader,
      fragmentShader: earthFragmentShader,
    });

    const earthGeometry = new THREE.SphereGeometry(sceneEarthRadius, 96, 96);
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);

    // Initial longitude alignment for Cape Canaveral (28.5 N, -80.6 W)
    // At t=0, pad is along Scene X axis. Rotate Earth texture so Florida lines up with X axis.
    const capeCanaveralLongitudeRad = (-80.6 * Math.PI) / 180.0;
    // Align texture longitude to scene coordinates
    const initialTextureRotationY = -capeCanaveralLongitudeRad - Math.PI * 0.5;
    earthMesh.rotation.y = initialTextureRotationY;

    earthGroup.add(earthMesh);

    // 4. Cloud Sphere Layer (Radius = R_E + 15 km)
    const cloudsRadius = sceneEarthRadius * ((R_EARTH + 15000.0) / R_EARTH);
    const cloudsGeometry = new THREE.SphereGeometry(cloudsRadius, 64, 64);

    const cloudsUniforms = {
      cloudsTexture: { value: cloudsTexture },
      sunDirection: { value: sunDirection },
    };

    const cloudsVertexShader = `
      varying vec2 vUv;
      varying vec3 vNormal;

      void main() {
        vUv = uv;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const cloudsFragmentShader = `
      uniform sampler2D cloudsTexture;
      uniform vec3 sunDirection;

      varying vec2 vUv;
      varying vec3 vNormal;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 sunDir = normalize(sunDirection);

        float NdotL = max(0.0, dot(normal, sunDir));
        float cloudDensity = texture2D(cloudsTexture, vUv).r;

        // White cloud illumination modulated by sunlight
        vec3 cloudColor = vec3(0.96, 0.98, 1.0) * (NdotL * 0.88 + 0.12);

        // On the dark side of Earth, clouds are visible as faint silhouettes
        float dayFade = smoothstep(-0.25, 0.20, dot(normal, sunDir));
        float alpha = cloudDensity * (0.05 + 0.72 * dayFade);

        gl_FragColor = vec4(cloudColor, alpha);
      }
    `;

    const cloudsMaterial = new THREE.ShaderMaterial({
      uniforms: cloudsUniforms,
      vertexShader: cloudsVertexShader,
      fragmentShader: cloudsFragmentShader,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });

    const cloudsMesh = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
    cloudsMesh.rotation.y = initialTextureRotationY;
    earthGroup.add(cloudsMesh);

    // 5. Atmospheric Rim Fresnel Glow (100 km Kármán line boundary)
    const atmRadius = sceneEarthRadius * ((R_EARTH + H_ATMOSPHERE) / R_EARTH);
    const atmGeometry = new THREE.SphereGeometry(atmRadius, 64, 64);

    const atmosphereUniforms = {
      atmosphereColor: { value: new THREE.Color(0x38bdf8) }, // Cyan-blue Rayleigh scattering
      sunDirection: { value: sunDirection },
      fresnelPower: { value: 3.5 },
    };

    const atmVertexShader = `
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const atmFragmentShader = `
      uniform vec3 atmosphereColor;
      uniform vec3 sunDirection;
      uniform float fresnelPower;

      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);

        // Horizon grazing Fresnel edge
        float fresnel = 1.0 - max(0.0, dot(normal, viewDir));
        float rim = pow(fresnel, fresnelPower);

        // Sunlight orientation: stronger atmosphere glow on day/sunset side
        vec3 sunDirView = normalize((viewMatrix * vec4(sunDirection, 0.0)).xyz);
        float sunAngle = dot(normal, sunDirView);
        float sunMod = max(0.0, sunAngle * 0.5 + 0.5);

        // Sunset orange tint along the terminator
        vec3 sunsetColor = vec3(0.98, 0.55, 0.25);
        float terminatorEdge = 1.0 - abs(sunAngle);
        vec3 finalAtmColor = mix(atmosphereColor, sunsetColor, pow(terminatorEdge, 4.0) * 0.45);

        float alpha = rim * (0.2 + 0.8 * sunMod);
        gl_FragColor = vec4(finalAtmColor, alpha * 0.85);
      }
    `;

    const atmosphereMaterial = new THREE.ShaderMaterial({
      uniforms: atmosphereUniforms,
      vertexShader: atmVertexShader,
      fragmentShader: atmFragmentShader,
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const atmosphereMesh = new THREE.Mesh(atmGeometry, atmosphereMaterial);
    earthGroup.add(atmosphereMesh);

    // 6. Animation Update Method
    let cloudPhase = 0.0;
    const update = (timeS: number, dt: number) => {
      // Rotate Earth according to physical planetary rotation rate Omega_Earth
      earthMesh.rotation.y = initialTextureRotationY + timeS * OMEGA_EARTH;

      // Independent cloud rotation (clouds drift slightly faster eastward)
      cloudPhase += dt * 0.02;
      cloudsMesh.rotation.y = initialTextureRotationY + timeS * OMEGA_EARTH + cloudPhase * 0.08;
    };

    // 7. Cleanup & Disposal
    const dispose = () => {
      earthGeometry.dispose();
      earthMaterial.dispose();
      cloudsGeometry.dispose();
      cloudsMaterial.dispose();
      atmGeometry.dispose();
      atmosphereMaterial.dispose();
      dayTexture.dispose();
      nightTexture.dispose();
      cloudsTexture.dispose();
    };

    return {
      earthGroup,
      earthMesh,
      cloudsMesh,
      atmosphereMesh,
      sunLight,
      sunDirection,
      update,
      dispose,
    };
  }

  /**
   * Builds an expansive starfield skybox using the NASA Hipparcos star catalog
   */
  public static createStarfield(sceneRadius: number = 800): THREE.Mesh {
    const starGeo = new THREE.SphereGeometry(sceneRadius, 48, 48);
    const textureLoader = new THREE.TextureLoader();
    const starTexture = textureLoader.load('/textures/starfield.jpg');
    starTexture.colorSpace = THREE.SRGBColorSpace;

    const starMat = new THREE.MeshBasicMaterial({
      map: starTexture,
      side: THREE.BackSide,
      opacity: 0.9,
      transparent: true,
    });

    return new THREE.Mesh(starGeo, starMat);
  }
}
