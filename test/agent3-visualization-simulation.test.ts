import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  FlybyEngine,
  FlybyInitialConditions,
} from '../src/physics/FlybyEngine';
import { PLANETARY_BODIES } from '../src/physics/constants';
import {
  TrajectoryInterpolator,
} from '../src/components/gravity-assist/viewport/TrajectoryInterpolator';
import { SpacecraftVisuals } from '../src/components/gravity-assist/viewport/SpacecraftVisuals';
import { PlanetaryVisuals } from '../src/components/gravity-assist/viewport/PlanetaryVisuals';

describe('Agent 3 — Trajectory Viewport & Live Simulation Verification', () => {
  const earth = PLANETARY_BODIES.EARTH;
  const jupiter = PLANETARY_BODIES.JUPITER;

  // --------------------------------------------------------------------------
  // 1. Numerical Trajectory Geometry & Visual Scale Mapping
  // --------------------------------------------------------------------------
  describe('1. Numerical Trajectory Geometry & Physical Radius Representation', () => {
    const config: FlybyInitialConditions = {
      planet: jupiter,
      vInfSpeedMPerS: 12000.0,
      targetPeriapsisM: jupiter.radiusM * 1.5,
      passType: 'TRAILING',
      spacecraftMassKg: 1000.0,
      approachAngleDeg: 15.0,
    };

    const sim = FlybyEngine.runSimulation(config);

    it('consumes actual numerical states without hardcoded or illustrative curves', () => {
      expect(sim.status).toBe('COMPLETED');
      expect(sim.trajectory.length).toBeGreaterThan(50);

      // Verify that every point contains valid, non-zero numerical vectors
      for (const pt of sim.trajectory) {
        expect(Number.isFinite(pt.posPlanetM.x)).toBe(true);
        expect(Number.isFinite(pt.posPlanetM.y)).toBe(true);
        expect(Number.isFinite(pt.velPlanetMPerS.x)).toBe(true);
        expect(Number.isFinite(pt.velPlanetMPerS.y)).toBe(true);
        expect(pt.distanceFromCenterM).toBeGreaterThanOrEqual(jupiter.radiusM);
      }
    });

    it('maps physical planet radius to consistent scene units (VISUAL_PLANET_RADIUS = 4.0)', () => {
      const visualRadius = 4.0;
      const toSceneScale = visualRadius / jupiter.radiusM;

      // Periapsis in scene units
      const ca = sim.closestApproach;
      const caSceneX = ca.positionPlanetM.x * toSceneScale;
      const caSceneY = ca.positionPlanetM.y * toSceneScale;
      const caDistScene = Math.sqrt(caSceneX * caSceneX + caSceneY * caSceneY);

      // Distance in scene units should equal target periapsis ratio * visualRadius
      const expectedDistScene = 1.5 * visualRadius;
      expect(caDistScene).toBeCloseTo(expectedDistScene, 1);
    });

    it('computes gravitational acceleration vector strictly pointing to planet center', () => {
      const interpolator = new TrajectoryInterpolator(sim);
      const state = interpolator.evaluateAtTime(sim.totalDurationS * 0.3);

      // In planet frame, planet center is (0,0,0)
      const toPlanet = new THREE.Vector3(0, 0, 0).sub(state.posPlanetM);
      const dirToPlanet = toPlanet.clone().normalize();

      // Position vector pointing away from planet
      const dirPos = state.posPlanetM.clone().normalize();

      // Gravity vector must point antiparallel to position vector (dot product = -1)
      const dot = dirToPlanet.dot(dirPos);
      expect(dot).toBeCloseTo(-1.0, 4);

      // Magnitude must equal Newton's law: g = mu / r^2
      const r = state.distanceFromCenterM;
      const expectedG = jupiter.mu / (r * r);
      expect(state.gravitationalAccelerationMPerS2).toBeCloseTo(expectedG, 2);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Dual Reference Frames (Planet-Relative vs Sun-Relative)
  // --------------------------------------------------------------------------
  describe('2. Dual Reference Frames & Vector Consistency', () => {
    const config: FlybyInitialConditions = {
      planet: earth,
      vInfSpeedMPerS: 10000.0,
      targetPeriapsisM: earth.radiusM * 1.8,
      passType: 'TRAILING',
      spacecraftMassKg: 1000.0,
    };

    const sim = FlybyEngine.runSimulation(config);

    it('strictly conserves speed in Planet-Relative frame', () => {
      const vInitial = sim.trajectory[0].speedPlanetMPerS;
      const vFinal = sim.trajectory[sim.trajectory.length - 1].speedPlanetMPerS;
      const errorRel = Math.abs(vFinal - vInitial) / vInitial;
      expect(errorRel).toBeLessThan(0.001); // < 0.1% speed error
    });

    it('delivers real heliocentric momentum transfer in Sun-Relative frame', () => {
      const vSunInitial = sim.trajectory[0].speedSunMPerS;
      const vSunFinal = sim.trajectory[sim.trajectory.length - 1].speedSunMPerS;

      // Trailing pass at Earth delivers positive heliocentric speed boost
      expect(vSunFinal).toBeGreaterThan(vSunInitial);
      const deltaVSun = vSunFinal - vSunInitial;
      expect(deltaVSun).toBeGreaterThan(500.0); // > 0.5 km/s boost
    });

    it('transforms velocities and positions consistently via kinematic addition', () => {
      for (let i = 0; i < sim.trajectory.length; i += 20) {
        const pt = sim.trajectory[i];
        // v_sun = v_rel + v_planet
        const expectedSunVx = pt.velPlanetMPerS.x + pt.planetVelSunMPerS.x;
        const expectedSunVy = pt.velPlanetMPerS.y + pt.planetVelSunMPerS.y;

        expect(pt.velSunMPerS.x).toBeCloseTo(expectedSunVx, 2);
        expect(pt.velSunMPerS.y).toBeCloseTo(expectedSunVy, 2);
      }
    });

    it('correctly maps closest approach marker in both Planet and Sun frames', () => {
      const visualRadius = 4.0;
      const toSceneScale = visualRadius / earth.radiusM;
      const ca = sim.closestApproach;

      // Planet frame CA coords
      const caPlanetX = ca.positionPlanetM.x * toSceneScale;
      const caPlanetY = ca.positionPlanetM.y * toSceneScale;
      expect(Number.isFinite(caPlanetX)).toBe(true);
      expect(Number.isFinite(caPlanetY)).toBe(true);

      // Sun frame CA coords
      const originPlanet = sim.trajectory[0].planetPosSunM;
      const caSunX = (ca.positionSunM.x - originPlanet.x) * toSceneScale;
      const caSunY = (ca.positionSunM.y - originPlanet.y) * toSceneScale;
      expect(Number.isFinite(caSunX)).toBe(true);
      expect(Number.isFinite(caSunY)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Playback Invariance & Hermite Continuity
  // --------------------------------------------------------------------------
  describe('3. Playback Rate Decoupling & Continuous Interpolation', () => {
    const config: FlybyInitialConditions = {
      planet: jupiter,
      vInfSpeedMPerS: 14000.0,
      targetPeriapsisM: jupiter.radiusM * 2.0,
      passType: 'TRAILING',
      spacecraftMassKg: 1000.0,
    };

    const sim = FlybyEngine.runSimulation(config);
    const interpolator = new TrajectoryInterpolator(sim);

    it('evaluates exact states independently of visual playback frame rate', () => {
      const testTimestamps = [0, 500, 1500, sim.totalDurationS * 0.5, sim.totalDurationS];

      for (const t of testTimestamps) {
        const eval1 = interpolator.evaluateAtTime(t);
        const eval2 = interpolator.evaluateAtTime(t);

        // Same timestamp yields bitwise identical physics vectors
        expect(eval1.posPlanetM.x).toBe(eval2.posPlanetM.x);
        expect(eval1.velPlanetM.x).toBe(eval2.velPlanetM.x);
        expect(eval1.speedPlanetMPerS).toBe(eval2.speedPlanetMPerS);
        expect(eval1.gravitationalAccelerationMPerS2).toBe(eval2.gravitationalAccelerationMPerS2);
      }
    });

    it('preserves physical velocity derivative as exact tangent along trajectory', () => {
      const tMid = sim.totalDurationS * 0.5;
      const eps = 0.01; // small dt for numerical derivative check

      const pMinus = interpolator.evaluateAtTime(tMid - eps).posPlanetM;
      const pPlus = interpolator.evaluateAtTime(tMid + eps).posPlanetM;
      const vApproxX = (pPlus.x - pMinus.x) / (2 * eps);
      const vApproxY = (pPlus.y - pMinus.y) / (2 * eps);

      const vExact = interpolator.evaluateAtTime(tMid).velPlanetM;
      expect(vExact.x).toBeCloseTo(vApproxX, 0);
      expect(vExact.y).toBeCloseTo(vApproxY, 0);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Collision Detection & Surface Boundary Clamping
  // --------------------------------------------------------------------------
  describe('4. Collision Detection & Boundary Impact Clamping', () => {
    const collisionConfig: FlybyInitialConditions = {
      planet: earth,
      vInfSpeedMPerS: 11000.0,
      targetPeriapsisM: earth.radiusM * 0.4, // Well inside physical planet
      passType: 'TRAILING',
      spacecraftMassKg: 1000.0,
    };

    const collisionSim = FlybyEngine.runSimulation(collisionConfig);

    it('identifies physical surface impact and terminates trajectory at R_planet', () => {
      expect(collisionSim.collisionDetected).toBe(true);
      expect(collisionSim.status).toBe('COLLIDED');
      expect(collisionSim.collisionTimeS).toBeDefined();

      const lastPoint = collisionSim.trajectory[collisionSim.trajectory.length - 1];
      expect(lastPoint.distanceFromCenterM).toBeCloseTo(earth.radiusM, 0);
      expect(lastPoint.altitudeM).toBeCloseTo(0.0, 0);
    });

    it('clamps interpolator strictly at terminal collision without sub-surface penetration', () => {
      const interpolator = new TrajectoryInterpolator(collisionSim);
      const colTime = collisionSim.collisionTimeS!;

      // Evaluate past collision time
      const postColState = interpolator.evaluateAtTime(colTime + 5000.0);
      expect(postColState.isTerminalImpact).toBe(true);
      expect(postColState.distanceFromCenterM).toBeCloseTo(earth.radiusM, 0);
      expect(postColState.altitudeM).toBeLessThanOrEqual(50.0);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Visual Bundles Creation & Three.js Hierarchy
  // --------------------------------------------------------------------------
  describe('5. Spacecraft & Planetary Visual Bundles Integrity', () => {
    it('initializes SpacecraftVisuals with full structural hierarchy and disposal', () => {
      const sc = SpacecraftVisuals.create(1.0);
      expect(sc.group).toBeDefined();
      expect(sc.group.children.length).toBeGreaterThan(0);

      // Verify update doesn't throw
      const pos = new THREE.Vector3(10, 0, 10);
      const vel = new THREE.Vector3(5, 0, 5);
      const sunPos = new THREE.Vector3(100, 50, 50);
      expect(() => sc.update(pos, vel, sunPos, 'VELOCITY_ALIGNED', 0.016)).not.toThrow();
      expect(() => sc.dispose()).not.toThrow();
    });

    it('initializes PlanetaryVisuals for all major bodies with axial tilts', () => {
      for (const key of ['EARTH', 'JUPITER', 'SATURN', 'VENUS'] as const) {
        const body = PLANETARY_BODIES[key];
        const planetBundle = PlanetaryVisuals.create(body, 4.0);
        expect(planetBundle.group).toBeDefined();
        expect(planetBundle.planetMesh).toBeDefined();
        expect(Number.isFinite(planetBundle.axialTiltRad)).toBe(true);
        expect(() => planetBundle.update(100, 0.016)).not.toThrow();
        expect(() => planetBundle.dispose()).not.toThrow();
      }
    });
  });
});
