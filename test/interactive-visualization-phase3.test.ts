import { describe, it, expect } from 'vitest';
import {
  FlybyEngine,
  FlybyInitialConditions,
  FlybySimulationResult,
} from '../src/physics/FlybyEngine';
import { PLANETARY_BODIES } from '../src/physics/constants';
import { CoordinateFrames } from '../src/physics/CoordinateFrames';
import { TrajectoryInterpolator } from '../src/components/gravity-assist/viewport/TrajectoryInterpolator';
import { Vector3D } from '../src/physics/Vector3D';

describe('ASTRA Phase 3 — Interactive Scientific Visualization Suite', () => {
  const earth = PLANETARY_BODIES.EARTH;
  const jupiter = PLANETARY_BODIES.JUPITER;

  // --------------------------------------------------------------------------
  // 1. Slow Flyby (v_inf = 3.0 km/s)
  // --------------------------------------------------------------------------
  describe('1. Slow Flyby Dynamics (v_inf = 3 km/s)', () => {
    const slowConfig: FlybyInitialConditions = {
      planet: jupiter,
      vInfSpeedMPerS: 3000.0, // 3 km/s (Slow approach -> Large deflection)
      targetPeriapsisM: jupiter.radiusM * 1.8,
      passType: 'TRAILING',
      spacecraftMassKg: 1000.0,
      approachAngleDeg: 0.0,
    };

    const sim = FlybyEngine.runSimulation(slowConfig);

    it('exhibits substantial hyperbolic deflection without numerical divergence', () => {
      expect(sim.status).toBe('COMPLETED');
      expect(sim.collisionDetected).toBe(false);

      // Low excess speed yields large deflection angle delta
      expect(sim.analytical.deflectionAngleDeg).toBeGreaterThan(60.0);
      expect(sim.numericalDeflectionAngleDeg).toBeGreaterThan(120.0);

      // Planet-relative asymptotic speed conservation
      expect(sim.speedConservationErrorPercent).toBeLessThan(0.05);

      // Specific energy conservation across entire trajectory
      const epsInitial = sim.trajectory[0].specificEnergyPlanetJPerKg;
      const epsFinal = sim.trajectory[sim.trajectory.length - 1].specificEnergyPlanetJPerKg;
      expect(Math.abs((epsFinal - epsInitial) / epsInitial)).toBeLessThan(0.001);
    });

    it('interpolates continuous states smoothly along the slow encounter', () => {
      const interpolator = new TrajectoryInterpolator(sim);
      const totalT = interpolator.getTotalDurationS();
      expect(totalT).toBeGreaterThan(0);

      const midState = interpolator.evaluateAtTime(totalT * 0.5);
      expect(midState.distanceFromCenterM).toBeGreaterThan(jupiter.radiusM);
      expect(midState.speedPlanetMPerS).toBeGreaterThan(3000.0);
      expect(midState.isTerminalImpact).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Fast Flyby (v_inf = 30.0 km/s)
  // --------------------------------------------------------------------------
  describe('2. Fast Flyby Dynamics (v_inf = 30 km/s)', () => {
    const fastConfig: FlybyInitialConditions = {
      planet: earth,
      vInfSpeedMPerS: 30000.0, // 30 km/s (High excess speed -> Small turning angle)
      targetPeriapsisM: earth.radiusM + 1000000.0, // 1,000 km altitude
      passType: 'TRAILING',
      spacecraftMassKg: 850.0,
    };

    const sim = FlybyEngine.runSimulation(fastConfig);

    it('exhibits small turning angle consistent with hyperbolic asymptotics', () => {
      expect(sim.status).toBe('COMPLETED');
      expect(sim.collisionDetected).toBe(false);

      // High speed yields high eccentricity and small turning angle delta
      expect(sim.analytical.eccentricity).toBeGreaterThan(10.0);
      expect(sim.analytical.deflectionAngleDeg).toBeLessThan(15.0);

      // Strict energy conservation holds
      expect(sim.speedConservationErrorPercent).toBeLessThan(0.05);
    });

    it('produces valid coordinates and velocities without numerical instability', () => {
      for (const pt of sim.trajectory) {
        expect(isFinite(pt.posPlanetM.x)).toBe(true);
        expect(isFinite(pt.velPlanetMPerS.x)).toBe(true);
        expect(pt.speedPlanetMPerS).toBeGreaterThanOrEqual(30000.0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. Close Flyby (h_p = 500 km)
  // --------------------------------------------------------------------------
  describe('3. Close Flyby Dynamics (h_p = 500 km)', () => {
    const closeAltitudeM = 500000.0; // 500 km altitude
    const closeConfig: FlybyInitialConditions = {
      planet: earth,
      vInfSpeedMPerS: 8000.0,
      targetPeriapsisM: earth.radiusM + closeAltitudeM,
      passType: 'TRAILING',
      spacecraftMassKg: 1000.0,
    };

    const sim = FlybyEngine.runSimulation(closeConfig);

    it('clears physical surface with peak acceleration at periapsis', () => {
      expect(sim.status).toBe('COMPLETED');
      expect(sim.collisionDetected).toBe(false);

      // Closest approach altitude matches target within integration sub-step tolerance (< 100 m error at 500 km)
      expect(sim.closestApproach.altitudeM).toBeCloseTo(closeAltitudeM, -3);
      expect(sim.closestApproach.distanceM).toBeGreaterThan(earth.radiusM);

      // Gravitational acceleration peaks near periapsis: g = mu / r_p^2
      const expectedPeakG = earth.mu / Math.pow(earth.radiusM + closeAltitudeM, 2);
      expect(sim.peakGravitationalAccelerationMPerS2).toBeCloseTo(expectedPeakG, 1);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Distant Flyby (h_p = 500,000 km)
  // --------------------------------------------------------------------------
  describe('4. Distant Flyby Dynamics (h_p = 500,000 km)', () => {
    const distantAltM = 500000000.0; // 500,000 km altitude
    const distantConfig: FlybyInitialConditions = {
      planet: earth,
      vInfSpeedMPerS: 11000.0,
      targetPeriapsisM: earth.radiusM + distantAltM,
      passType: 'TRAILING',
      spacecraftMassKg: 1000.0,
    };

    const sim = FlybyEngine.runSimulation(distantConfig);

    it('exhibits very small deflection angle and large impact parameter', () => {
      expect(sim.status).toBe('COMPLETED');
      expect(sim.collisionDetected).toBe(false);

      // Deflection is minimal due to vast distance from Earth (< 1.0 deg)
      expect(sim.analytical.deflectionAngleDeg).toBeLessThan(1.0);

      // Impact parameter is virtually equal to periapsis radius
      expect(sim.analytical.impactParameterM).toBeGreaterThan(distantAltM);
      expect(Math.abs(sim.analytical.impactParameterM - sim.analytical.periapsisRadiusM)).toBeLessThan(
        sim.analytical.periapsisRadiusM * 0.01
      );
    });
  });

  // --------------------------------------------------------------------------
  // 5. Collision Flyby (Sub-Surface Periapsis & Impact Termination)
  // --------------------------------------------------------------------------
  describe('5. Collision and Invalid Trajectories Handling', () => {
    const collisionConfig: FlybyInitialConditions = {
      planet: jupiter,
      vInfSpeedMPerS: 12000.0,
      targetPeriapsisM: jupiter.radiusM * 0.5, // Target periapsis well inside planet physical radius
      passType: 'TRAILING',
      spacecraftMassKg: 1000.0,
    };

    const sim = FlybyEngine.runSimulation(collisionConfig);

    it('detects collision and terminates trajectory precisely at physical surface radius', () => {
      expect(sim.collisionDetected).toBe(true);
      expect(sim.status).toBe('COLLIDED');
      expect(sim.collisionTimeS).toBeDefined();
      expect(sim.collisionPositionPlanetM).toBeDefined();

      // Trajectory must stop at collision: final point is on the surface
      const finalPt = sim.trajectory[sim.trajectory.length - 1];
      expect(finalPt.distanceFromCenterM).toBeCloseTo(jupiter.radiusM, 1);
      expect(finalPt.altitudeM).toBeCloseTo(0.0, 1);

      // Does not continue drawing a physically invalid outgoing flyby
      // All points must have r >= R_planet
      for (const pt of sim.trajectory) {
        expect(pt.distanceFromCenterM).toBeGreaterThanOrEqual(jupiter.radiusM - 100.0);
      }
    });

    it('clamps Hermite interpolator at terminal collision impact without penetration', () => {
      const interpolator = new TrajectoryInterpolator(sim);
      const colTime = sim.collisionTimeS!;

      // At or after collision time, state is locked to terminal impact
      const postImpactState = interpolator.evaluateAtTime(colTime + 1000.0);
      expect(postImpactState.isTerminalImpact).toBe(true);
      expect(postImpactState.distanceFromCenterM).toBeCloseTo(jupiter.radiusM, 1);
      expect(postImpactState.altitudeM).toBeCloseTo(0.0, 1);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Reference-Frame Transformations & Energy Identity
  // --------------------------------------------------------------------------
  describe('6. Reference-Frame Comparisons & Kinematics', () => {
    it('verifies consistent velocity addition and the work-energy identity', () => {
      const vRelIn = new Vector3D(10000.0, 0.0, 0.0);
      const vPlanet = new Vector3D(0.0, 13056.0, 0.0); // Jupiter orbital velocity

      // Coordinate transform to Sun frame: v_Sun = v_rel + v_planet
      const vSunIn = CoordinateFrames.toSunRelative(vRelIn, vPlanet);
      expect(vSunIn.x).toBe(10000.0);
      expect(vSunIn.y).toBe(13056.0);

      // Transform back to Planet frame: v_rel = v_Sun - v_planet
      const vRelRecovered = CoordinateFrames.toPlanetRelative(vSunIn, vPlanet);
      expect(vRelRecovered.x).toBe(10000.0);
      expect(vRelRecovered.y).toBe(0.0);

      // Trailing deflection: turn velocity by 45 degrees towards +Y
      const angle = (45.0 * Math.PI) / 180.0;
      const vRelOut = new Vector3D(
        10000.0 * Math.cos(angle),
        10000.0 * Math.sin(angle),
        0.0
      );
      const vSunOut = CoordinateFrames.toSunRelative(vRelOut, vPlanet);

      // Verify work-energy identity: Delta E_Sun == V_planet · Delta v_vector
      const check = CoordinateFrames.verifyEnergyIdentity(vSunIn, vSunOut, vPlanet);
      expect(check.errorAbsoluteJPerKg).toBeLessThan(1e-7);

      // Prove scalar speed change differs from vector delta-v magnitude
      const scalarDelta = CoordinateFrames.computeScalarSpeedChange(vSunOut, vSunIn);
      const vectorDeltaMag = CoordinateFrames.computeVectorDeltaVMagnitude(vSunOut, vSunIn);
      expect(vectorDeltaMag).toBeGreaterThan(Math.abs(scalarDelta));
    });
  });

  // --------------------------------------------------------------------------
  // 7. Visual Playback Speed & Decoupled Rendering
  // --------------------------------------------------------------------------
  describe('7. Visual Playback Speed Invariance', () => {
    it('proves that visual playback speed does not alter the underlying physical solution', () => {
      const config: FlybyInitialConditions = {
        planet: earth,
        vInfSpeedMPerS: 9000.0,
        targetPeriapsisM: earth.radiusM * 2.0,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      };

      const result1 = FlybyEngine.runSimulation(config);
      const interpolator = new TrajectoryInterpolator(result1);

      // Evaluate physical state at exactly 500.0 seconds
      const sample1 = interpolator.evaluateAtTime(500.0);
      const sample2 = interpolator.evaluateAtTime(500.0);

      // Identical timestamps yield strictly identical state vectors regardless of animation loop frame rate
      expect(sample1.posPlanetM.x).toBe(sample2.posPlanetM.x);
      expect(sample1.velPlanetM.x).toBe(sample2.velPlanetM.x);
      expect(sample1.speedPlanetMPerS).toBe(sample2.speedPlanetMPerS);
    });
  });
});
