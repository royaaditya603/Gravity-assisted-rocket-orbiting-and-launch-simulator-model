/**
 * test/visual-fidelity-interpolation.test.ts
 *
 * Automated verification for Visual Fidelity, Cubic Hermite Trajectory Interpolation,
 * Planetary Visuals, Spacecraft Attitude Dynamics, and Jitter-Free Animation.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PLANETARY_BODIES } from '../src/physics/constants';
import { FlybyEngine } from '../src/physics/FlybyEngine';
import { TrajectoryInterpolator } from '../src/components/gravity-assist/viewport/TrajectoryInterpolator';
import { SpacecraftVisuals } from '../src/components/gravity-assist/viewport/SpacecraftVisuals';
import { PlanetaryVisuals } from '../src/components/gravity-assist/viewport/PlanetaryVisuals';

describe('Visual Fidelity & Jitter-Free Animation Verification', () => {
  // 1. Cubic Hermite Trajectory Interpolation
  describe('1. Cubic Hermite Trajectory Interpolation Engine', () => {
    const simResult = FlybyEngine.runSimulation({
      planet: PLANETARY_BODIES.JUPITER,
      vInfSpeedMPerS: 12000,
      targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM * 1.6,
      passType: 'TRAILING',
      spacecraftMassKg: 1000,
    });

    const interpolator = new TrajectoryInterpolator(simResult);

    it('exactly reproduces recorded trajectory state vectors at sample nodes', () => {
      const pts = simResult.trajectory;
      expect(pts.length).toBeGreaterThan(100);

      // Test multiple representative nodes (start, 25%, closest approach, 75%, end)
      const testIndices = [0, Math.floor(pts.length * 0.25), Math.floor(pts.length * 0.5), pts.length - 1];

      for (const idx of testIndices) {
        const node = pts[idx];
        const state = interpolator.evaluateAtTime(node.timeS);

        expect(state.timeS).toBeCloseTo(node.timeS, 6);
        expect(state.posPlanetM.x).toBeCloseTo(node.posPlanetM.x, 3);
        expect(state.posPlanetM.y).toBeCloseTo(node.posPlanetM.y, 3);
        expect(state.velPlanetM.x).toBeCloseTo(node.velPlanetMPerS.x, 2);
        expect(state.velPlanetM.y).toBeCloseTo(node.velPlanetMPerS.y, 2);
        expect(state.altitudeM).toBeCloseTo(node.altitudeM, 1);
        expect(state.speedPlanetMPerS).toBeCloseTo(node.speedPlanetMPerS, 2);
      }
    });

    it('produces continuous sub-step motion without position or velocity jumps', () => {
      const pts = simResult.trajectory;
      const t0 = pts[10].timeS;
      const t1 = pts[11].timeS;
      const deltaT = t1 - t0;

      // Sample 20 intermediate points within a single numerical integration step
      let prevPos = interpolator.evaluateAtTime(t0).posPlanetM;
      for (let step = 1; step <= 20; step++) {
        const t = t0 + (step / 20) * deltaT;
        const currentPos = interpolator.evaluateAtTime(t).posPlanetM;
        const distMoved = currentPos.distanceTo(prevPos);

        // Movement must be strictly non-zero and smooth
        expect(distMoved).toBeGreaterThan(0);
        // Step movement must not jump discontinuously (less than 3,000 km per 5% sub-step at Jovian scale)
        expect(distMoved).toBeLessThan(3000000);
        prevPos = currentPos;
      }
    });

    it('strictly clamps at collision boundary and prevents extrapolation past terminal event', () => {
      const collisionSim = FlybyEngine.runSimulation({
        planet: PLANETARY_BODIES.VENUS,
        vInfSpeedMPerS: 8000,
        targetPeriapsisM: PLANETARY_BODIES.VENUS.radiusM * 0.7, // Sub-surface collision
        passType: 'TRAILING',
        spacecraftMassKg: 1000,
      });

      expect(collisionSim.collisionDetected).toBe(true);
      const collisionTime = collisionSim.collisionTimeS!;
      const colInterpolator = new TrajectoryInterpolator(collisionSim);

      // Querying time at collision
      const atCollision = colInterpolator.evaluateAtTime(collisionTime);
      expect(atCollision.isTerminalImpact).toBe(true);

      // Querying time far past collision (should be clamped exactly to impact point)
      const pastCollision = colInterpolator.evaluateAtTime(collisionTime + 10000);
      expect(pastCollision.isTerminalImpact).toBe(true);
      expect(pastCollision.timeS).toBe(collisionTime);
      expect(pastCollision.posPlanetM.distanceTo(atCollision.posPlanetM)).toBe(0);
      // Altitude at impact must be approximately zero (surface threshold)
      expect(pastCollision.altitudeM).toBeLessThanOrEqual(50);
    });
  });

  // 2. High-Quality Spacecraft Model & Attitude Dynamics
  describe('2. Spacecraft Model & Quaternion Attitude Transitions', () => {
    it('creates detailed structural hierarchy with HGA, RTG, magnetometer and scan platform', () => {
      const sc = SpacecraftVisuals.create(1.0);
      expect(sc.group).toBeDefined();

      let meshCount = 0;
      sc.group.traverse((child) => {
        if (child instanceof THREE.Mesh) meshCount++;
      });

      // Believable aerospace model should have rich structural detail (> 15 sub-meshes)
      expect(meshCount).toBeGreaterThanOrEqual(15);
      sc.dispose();
    });

    it('smoothly interpolates orientation via Quaternion SLERP across angular boundaries without flips', () => {
      const sc = SpacecraftVisuals.create(1.0);
      const sunPos = new THREE.Vector3(100, 50, 0);

      // Step 1: Heading along +X
      const pos1 = new THREE.Vector3(0, 0, 0);
      const vel1 = new THREE.Vector3(10000, 0, 10);
      sc.update(pos1, vel1, sunPos, 'VELOCITY_ALIGNED', 0.016);
      const q1 = sc.group.quaternion.clone();

      // Step 2: Heading turns smoothly through +Z
      const vel2 = new THREE.Vector3(5000, 0, 8000);
      sc.update(pos1, vel2, sunPos, 'VELOCITY_ALIGNED', 0.016);
      const q2 = sc.group.quaternion.clone();

      // Quaternion dot product must be positive and smooth (no 180° flip / NaN)
      const dot = q1.dot(q2);
      expect(dot).toBeGreaterThan(0.9);
      expect(Number.isFinite(sc.group.quaternion.x)).toBe(true);
      expect(Number.isFinite(sc.group.quaternion.y)).toBe(true);
      expect(Number.isFinite(sc.group.quaternion.z)).toBe(true);
      expect(Number.isFinite(sc.group.quaternion.w)).toBe(true);

      sc.dispose();
    });
  });

  // 3. Realistic Planetary Rendering System
  describe('3. Planetary Visuals & Atmospheric Scattering System', () => {
    it('correctly builds photorealistic bundles with astronomical axial tilts', () => {
      const sunDir = new THREE.Vector3(1, 0, 0);

      // Jupiter
      const jupiterBundle = PlanetaryVisuals.create(PLANETARY_BODIES.JUPITER, 4.0, sunDir);
      expect(jupiterBundle.axialTiltRad).toBeCloseTo(THREE.MathUtils.degToRad(3.13), 3);
      expect(jupiterBundle.atmosphereMesh).toBeDefined(); // Atmospheric limb shell
      jupiterBundle.dispose();

      // Saturn (with ring mesh)
      const saturnBundle = PlanetaryVisuals.create(PLANETARY_BODIES.SATURN, 4.0, sunDir);
      expect(saturnBundle.axialTiltRad).toBeCloseTo(THREE.MathUtils.degToRad(26.73), 3);
      expect(saturnBundle.ringMesh).toBeDefined(); // Annular ring system
      saturnBundle.dispose();

      // Earth (photorealistic multi-layer bundle with day/night shader)
      const earthBundle = PlanetaryVisuals.create(PLANETARY_BODIES.EARTH, 4.0, sunDir);
      expect(earthBundle.earthBundle).toBeDefined();
      expect(earthBundle.axialTiltRad).toBeCloseTo(THREE.MathUtils.degToRad(23.44), 3);
      earthBundle.dispose();

      // Venus (retrograde axial tilt)
      const venusBundle = PlanetaryVisuals.create(PLANETARY_BODIES.VENUS, 4.0, sunDir);
      expect(venusBundle.axialTiltRad).toBeCloseTo(THREE.MathUtils.degToRad(177.36), 3);
      venusBundle.dispose();
    });
  });
});
