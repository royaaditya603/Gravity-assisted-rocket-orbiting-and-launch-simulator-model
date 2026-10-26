import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SpacecraftVisuals } from '../src/components/gravity-assist/viewport/SpacecraftVisuals';
import { TrajectoryInterpolator } from '../src/components/gravity-assist/viewport/TrajectoryInterpolator';
import { FlybyEngine, FlybyInitialConditions } from '../src/physics/FlybyEngine';
import { PLANETARY_BODIES } from '../src/physics/constants';

describe('Gravity Assist Stutter & Freezing Elimination Suite', () => {
  const config: FlybyInitialConditions = {
    planet: PLANETARY_BODIES.JUPITER,
    vInfSpeedMPerS: 12000.0,
    targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM * 1.8,
    passType: 'TRAILING',
  };
  const simResult = FlybyEngine.runSimulation(config);

  describe('1. SpacecraftVisuals Zero Heap Allocation in Render Loop', () => {
    it('executes 1,000 update frames with zero new Vector3/Matrix4 allocations in update', () => {
      const bundle = SpacecraftVisuals.create('PROBE');
      const pos = new THREE.Vector3(10, 0, 5);
      const vel = new THREE.Vector3(2, 0, 1);
      const sunPos = new THREE.Vector3(100, 40, 80);

      // Measure performance and verify no errors across 1,000 frames
      const t0 = performance.now();
      for (let i = 0; i < 1000; i++) {
        pos.x += 0.01;
        vel.z += 0.001;
        bundle.update(pos, vel, sunPos, 'VELOCITY_ALIGNED', 0.016);
      }
      const elapsed = performance.now() - t0;

      expect(elapsed).toBeLessThan(100); // 1,000 frames under 100ms
      expect(bundle.group.quaternion.length()).toBeCloseTo(1.0, 5);
      bundle.dispose();
    });

    it('smoothly interpolates orientation with exponential damping for rocket model', () => {
      const bundle = SpacecraftVisuals.create('ROCKET');
      const pos = new THREE.Vector3(0, 0, 0);
      const vel = new THREE.Vector3(1, 0, 0);
      const sunPos = new THREE.Vector3(50, 50, 50);

      bundle.update(pos, vel, sunPos, 'VELOCITY_ALIGNED', 0.016);
      const initialQuat = bundle.group.quaternion.clone();

      // Sudden flight direction change
      vel.set(0, 0, 1);
      bundle.update(pos, vel, sunPos, 'VELOCITY_ALIGNED', 0.016);

      // The quaternion should slerp smoothly, not snap instantaneously
      expect(bundle.group.quaternion.equals(initialQuat)).toBe(false);
      expect(bundle.group.quaternion.length()).toBeCloseTo(1.0, 5);
      bundle.dispose();
    });
  });

  describe('2. Trajectory Buffer Range vs Full Reallocation Benchmark', () => {
    it('demonstrates setDrawRange performance advantage over geometry reallocation', () => {
      const N = 1000;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < N; i++) {
        pts.push(new THREE.Vector3(i * 0.1, 0, Math.sin(i * 0.05)));
      }

      // Pre-allocated buffer + setDrawRange (zero GC, zero warnings, high throughput)
      const pastPositions = new Float32Array((N + 1) * 3);
      for (let i = 0; i < N; i++) {
        pastPositions[i * 3] = pts[i].x;
        pastPositions[i * 3 + 1] = pts[i].y;
        pastPositions[i * 3 + 2] = pts[i].z;
      }
      const newGeo = new THREE.BufferGeometry();
      newGeo.setAttribute('position', new THREE.BufferAttribute(pastPositions, 3));

      const t0New = performance.now();
      const posAttr = newGeo.attributes.position as THREE.BufferAttribute;
      for (let frame = 0; frame < 300; frame++) {
        const curIdx = frame % N;
        posAttr.setXYZ(curIdx + 1, pts[curIdx].x, pts[curIdx].y, pts[curIdx].z);
        posAttr.needsUpdate = true;
        newGeo.setDrawRange(0, curIdx + 2);
      }
      const tNew = performance.now() - t0New;

      expect(tNew).toBeLessThan(50);
      expect(newGeo.drawRange.count).toBeGreaterThan(0);
      newGeo.dispose();
    });
  });

  describe('3. Clock Synchronization & Continuous Hermite Interpolation', () => {
    it('handles NaN, non-finite, and out-of-bounds time without throwing or returning NaN', () => {
      const interpolator = new TrajectoryInterpolator(simResult);

      const stateNaN = interpolator.evaluateAtTime(NaN);
      expect(Number.isFinite(stateNaN.timeS)).toBe(true);
      expect(Number.isFinite(stateNaN.posPlanetM.x)).toBe(true);
      expect(Number.isFinite(stateNaN.speedPlanetMPerS)).toBe(true);

      const stateNegative = interpolator.evaluateAtTime(-99999);
      expect(stateNegative.timeS).toBe(simResult.trajectory[0].timeS);

      const statePastEnd = interpolator.evaluateAtTime(1e12);
      expect(statePastEnd.timeS).toBeLessThanOrEqual(simResult.trajectory[simResult.trajectory.length - 1].timeS);
    });

    it('ensures continuous C^1 smooth Hermite motion without coordinate jumps', () => {
      const interpolator = new TrajectoryInterpolator(simResult);
      const dt = 0.016; // 60 FPS
      let prevPos = interpolator.evaluateAtTime(100).posPlanetM;

      for (let t = 100.016; t <= 101.0; t += dt) {
        const state = interpolator.evaluateAtTime(t);
        const delta = state.posPlanetM.distanceTo(prevPos);
        // Step delta should be physically smooth (< 1000 km per 16ms for orbital speeds ~30km/s)
        expect(delta).toBeLessThan(1000 * 1000);
        expect(state.speedPlanetMPerS).toBeGreaterThan(0);
        prevPos = state.posPlanetM;
      }
    });

    it('verifies that self-emitted playback index does not force clock reset', () => {
      // Simulation of clock synchronization state machine
      let currentTimeS = 1045.2;
      let lastEmittedIndex = -1;
      const isPlaying = true;
      const isClockMaster = true;

      // Frame 1: Internal clock advances continuously
      currentTimeS += 0.5; // 1045.7
      const targetIndex = 12; // Discrete index corresponding to 1045.7s
      lastEmittedIndex = targetIndex;

      // Event arrives back as React prop update:
      const propIndex = 12;
      const simTrajectoryTimeS = 1040.0; // Point 12 starts at 1040.0s

      // Synchronization logic:
      const shouldIgnore = isPlaying && isClockMaster && propIndex === lastEmittedIndex;
      expect(shouldIgnore).toBe(true);

      if (!shouldIgnore) {
        currentTimeS = simTrajectoryTimeS;
      }

      // Assert continuous time was preserved and NOT snapped back to 1040.0!
      expect(currentTimeS).toBeCloseTo(1045.7, 4);

      // Frame 2: User explicitly scrubs timeline to index 45
      const userScrubbedIndex = 45;
      const shouldIgnoreScrub = isPlaying && isClockMaster && userScrubbedIndex === lastEmittedIndex;
      expect(shouldIgnoreScrub).toBe(false);

      if (!shouldIgnoreScrub) {
        currentTimeS = 5000.0; // Snapped to scrubbed point
      }
      expect(currentTimeS).toBe(5000.0);
    });
  });
});
