import { describe, it, expect } from 'vitest';
import {
  Vector3D,
  PLANETARY_BODIES,
  G_NEWTON,
  FlybyEngine,
  FlybyInitialConditions,
  computeGravitationalAcceleration,
  computeHyperbolicEccentricity,
  computeDeflectionAngle,
  computeImpactParameter,
  computePeriapsisFromImpactParameter,
  computePeriapsisFromAltitude,
  computeAltitudeFromPeriapsis,
  toPlanetRelativeVelocity,
  toSunRelativeVelocity,
  computeFlybyAnalytical,
  simulateFlybyTrajectory,
  CoordinateFrames,
  toCanonicalFlybyConfig,
  toCanonicalFlybyResult,
} from '../src/physics';

describe('ASTRA Agent 1 — Physics Engine Specialist Dedicated Test Suite', () => {
  const earth = PLANETARY_BODIES.EARTH;
  const jupiter = PLANETARY_BODIES.JUPITER;
  const saturn = PLANETARY_BODIES.SATURN;
  const venus = PLANETARY_BODIES.VENUS;

  // --------------------------------------------------------------------------
  // 1. Planet Gravitational Acceleration & mu Formulation
  // --------------------------------------------------------------------------
  describe('1. Planet Gravitational Acceleration (mu = G * M, a_rel = -mu * r / |r|^3)', () => {
    it('verifies standard gravitational parameter derivation mu = G * M', () => {
      const calculatedEarthMu = G_NEWTON * earth.massKg;
      expect(calculatedEarthMu).toBeCloseTo(earth.mu, -10); // Matches within 0.1% of IERS canonical
      const calculatedJupiterMu = G_NEWTON * jupiter.massKg;
      expect(calculatedJupiterMu).toBeCloseTo(jupiter.mu, -13);
    });

    it('computes exact relative gravitational acceleration vector a_rel = -mu * r / |r|^3', () => {
      const pos = new Vector3D(10000000.0, 0, 0); // 10,000 km along +X
      const r = pos.magnitude();
      const accel = computeGravitationalAcceleration(pos, earth.mu);

      // Magnitude should be mu / r^2
      const expectedMag = earth.mu / (r * r);
      expect(accel.magnitude()).toBeCloseTo(expectedMag, 6);
      // Direction must be strictly toward center (-X)
      expect(accel.x).toBeCloseTo(-expectedMag, 6);
      expect(accel.y).toBeCloseTo(0, 9);
      expect(accel.z).toBeCloseTo(0, 9);

      // Verify static class method produces identical result
      const classAccel = FlybyEngine.computeGravitationalAcceleration(pos, earth.mu);
      expect(classAccel.x).toBe(accel.x);
      expect(classAccel.y).toBe(accel.y);
      expect(classAccel.z).toBe(accel.z);
    });

    it('handles zero position / singularity safely without crashing or returning NaN', () => {
      const zeroPos = new Vector3D(0, 0, 0);
      const accel = computeGravitationalAcceleration(zeroPos, earth.mu);
      expect(accel.magnitude()).toBe(0);
      expect(isFinite(accel.x)).toBe(true);
      expect(isFinite(accel.y)).toBe(true);
      expect(isFinite(accel.z)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Hyperbolic Flyby Calculations & Parameter Conversions
  // --------------------------------------------------------------------------
  describe('2. Hyperbolic Calculations (e, delta, b, rp = planetRadius + flybyAltitude)', () => {
    const vInf = 12500.0; // 12.5 km/s
    const altitude = 50000000.0; // 50,000 km altitude above surface

    it('calculates rp = planetRadius + flybyAltitude and maintains b distinct from rp', () => {
      const rp = computePeriapsisFromAltitude(jupiter.radiusM, altitude);
      expect(rp).toBe(jupiter.radiusM + altitude);
      expect(computeAltitudeFromPeriapsis(jupiter.radiusM, rp)).toBe(altitude);

      const e = computeHyperbolicEccentricity(rp, vInf, jupiter.mu);
      expect(e).toBeGreaterThan(1.0); // e > 1 for hyperbola

      const delta = computeDeflectionAngle(e);
      expect(delta).toBeCloseTo(2.0 * Math.asin(1.0 / e), 10);

      const b = computeImpactParameter(e, vInf, jupiter.mu);
      // Because of gravitational focusing, impact parameter b > periapsis radius rp
      expect(b).toBeGreaterThan(rp);
      expect(b).not.toBe(rp);

      // Invert b back to rp
      const reconstructedRp = computePeriapsisFromImpactParameter(b, vInf, jupiter.mu);
      expect(reconstructedRp).toBeCloseTo(rp, 2);
    });

    it('supports flybyAltitudeM directly in FlybyInitialConditions', () => {
      const configWithAlt: FlybyInitialConditions = {
        planet: jupiter,
        vInfSpeedMPerS: vInf,
        flybyAltitudeM: altitude,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      };

      const analytical = computeFlybyAnalytical(configWithAlt);
      expect(analytical.periapsisAltitudeM).toBeCloseTo(altitude, 1);
      expect(analytical.periapsisRadiusM).toBeCloseTo(jupiter.radiusM + altitude, 1);
      expect(analytical.impactParameterM).toBeGreaterThan(analytical.periapsisRadiusM);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Coordinate Frames & Transformations
  // --------------------------------------------------------------------------
  describe('3. Coordinate Frames (v_rel = v_sc - v_planet, v_sun = v_rel + v_planet)', () => {
    it('verifies exact Galilean velocity transformations between Sun and planet frames', () => {
      const vPlanet = new Vector3D(0, 13056.0, 0); // Jupiter orbital velocity
      const vSpacecraftSun = new Vector3D(10000.0, 25000.0, 500.0);

      const vRel = toPlanetRelativeVelocity(vSpacecraftSun, vPlanet);
      expect(vRel.x).toBe(vSpacecraftSun.x - vPlanet.x);
      expect(vRel.y).toBe(vSpacecraftSun.y - vPlanet.y);
      expect(vRel.z).toBe(vSpacecraftSun.z - vPlanet.z);

      const reconstructedVSun = toSunRelativeVelocity(vRel, vPlanet);
      expect(reconstructedVSun.x).toBeCloseTo(vSpacecraftSun.x, 9);
      expect(reconstructedVSun.y).toBeCloseTo(vSpacecraftSun.y, 9);
      expect(reconstructedVSun.z).toBeCloseTo(vSpacecraftSun.z, 9);
    });

    it('conserves asymptotic speed in planet frame while changing Sun-relative speed', () => {
      const config: FlybyInitialConditions = {
        planet: jupiter,
        vInfSpeedMPerS: 15000.0,
        targetPeriapsisM: jupiter.radiusM * 1.6,
        passType: 'TRAILING',
        spacecraftMassKg: 800.0,
      };

      const analytical = computeFlybyAnalytical(config);
      // In planet frame, incoming speed == outgoing speed identically
      expect(analytical.vInfMinusMPerS.magnitude()).toBeCloseTo(15000.0, 6);
      expect(analytical.vInfPlusMPerS.magnitude()).toBeCloseTo(15000.0, 6);

      // In Sun frame, speed changes significantly
      expect(analytical.vInSunSpeedMPerS).not.toBe(analytical.vOutSunSpeedMPerS);
      expect(analytical.deltaVSpeedMPerS).toBeGreaterThan(0); // Boost for trailing pass
    });

    it('proves that a gravity assist does not always increase Sun-relative speed (Leading = braking)', () => {
      const configTrailing: FlybyInitialConditions = {
        planet: saturn,
        vInfSpeedMPerS: 10000.0,
        targetPeriapsisM: saturn.radiusM * 2.0,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      };
      const configLeading: FlybyInitialConditions = {
        ...configTrailing,
        passType: 'LEADING',
      };

      const trailing = computeFlybyAnalytical(configTrailing);
      const leading = computeFlybyAnalytical(configLeading);

      // Trailing pass accelerates relative to Sun:
      expect(trailing.deltaVSpeedMPerS).toBeGreaterThan(0);
      expect(trailing.isAcceleration).toBe(true);

      // Leading pass decelerates relative to Sun (gravity braking):
      expect(leading.deltaVSpeedMPerS).toBeLessThan(0);
      expect(leading.isAcceleration).toBe(false);

      // Fundamental energy identity holds identically for both:
      expect(trailing.energyIdentityDiffJPerKg).toBeLessThan(1e-6);
      expect(leading.energyIdentityDiffJPerKg).toBeLessThan(1e-6);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Deflection-Angle Trends
  // --------------------------------------------------------------------------
  describe('4. Deflection-Angle Trends', () => {
    it('deflection increases as closest approach distance decreases', () => {
      const vInf = 12000.0;
      const distances = [5.0, 3.0, 2.0, 1.4].map((f) => jupiter.radiusM * f);
      const deflections = distances.map((rp) =>
        computeFlybyAnalytical({
          planet: jupiter,
          vInfSpeedMPerS: vInf,
          targetPeriapsisM: rp,
          passType: 'TRAILING',
          spacecraftMassKg: 1000.0,
        }).deflectionAngleDeg
      );

      for (let i = 0; i < deflections.length - 1; i++) {
        expect(deflections[i + 1]).toBeGreaterThan(deflections[i]);
      }
    });

    it('deflection decreases as incoming asymptotic speed increases', () => {
      const rp = jupiter.radiusM * 2.0;
      const speeds = [5000.0, 10000.0, 18000.0, 30000.0];
      const deflections = speeds.map((v) =>
        computeFlybyAnalytical({
          planet: jupiter,
          vInfSpeedMPerS: v,
          targetPeriapsisM: rp,
          passType: 'TRAILING',
          spacecraftMassKg: 1000.0,
        }).deflectionAngleDeg
      );

      for (let i = 0; i < deflections.length - 1; i++) {
        expect(deflections[i + 1]).toBeLessThan(deflections[i]);
      }
    });

    it('deflection increases as planetary mass mu increases under identical encounter conditions', () => {
      const rp = 250000000.0; // 250,000 km common periapsis
      const vInf = 11000.0;

      const bodies = [venus, earth, saturn, jupiter]; // sorted by mass: Venus < Earth < Saturn < Jupiter
      const deflections = bodies.map((b) =>
        computeFlybyAnalytical({
          planet: b,
          vInfSpeedMPerS: vInf,
          targetPeriapsisM: rp,
          passType: 'TRAILING',
          spacecraftMassKg: 1000.0,
        }).deflectionAngleDeg
      );

      for (let i = 0; i < deflections.length - 1; i++) {
        expect(deflections[i + 1]).toBeGreaterThan(deflections[i]);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 5. Numerical Integration & Convergence
  // --------------------------------------------------------------------------
  describe('5. Numerical Integration, Convergence & Energy Conservation', () => {
    it('matches analytical vs numerical trajectory asymptotic deflection and speed', () => {
      const config: FlybyInitialConditions = {
        planet: jupiter,
        vInfSpeedMPerS: 14000.0,
        targetPeriapsisM: jupiter.radiusM * 1.8,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      };

      const result = simulateFlybyTrajectory(config);
      expect(result.status).toBe('COMPLETED');
      expect(result.collisionDetected).toBe(false);

      // Speed conservation error across the complete trajectory < 0.1%
      expect(result.speedConservationErrorPercent).toBeLessThan(0.1);
      // Deflection angle matches analytical Keplerian solution < 2%
      expect(result.deflectionErrorPercent).toBeLessThan(2.0);
    });

    it('maintains energy conservation across isolated two-body hyperbolic flight to < 0.05%', () => {
      const config: FlybyInitialConditions = {
        planet: saturn,
        vInfSpeedMPerS: 9500.0,
        targetPeriapsisM: saturn.radiusM * 2.2,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      };

      const result = simulateFlybyTrajectory(config);
      const first = result.trajectory[0];
      const last = result.trajectory[result.trajectory.length - 1];

      const relativeEnergyDrift = Math.abs(
        (last.specificEnergyPlanetJPerKg - first.specificEnergyPlanetJPerKg) /
          first.specificEnergyPlanetJPerKg
      );
      expect(relativeEnergyDrift).toBeLessThan(0.0005); // < 0.05% relative drift
    });

    it('converges numerically when time step coefficient is tightened', () => {
      const config: FlybyInitialConditions = {
        planet: earth,
        vInfSpeedMPerS: 9000.0,
        targetPeriapsisM: earth.radiusM * 1.5,
        passType: 'TRAILING',
        spacecraftMassKg: 600.0,
      };

      const coarse = simulateFlybyTrajectory(config, { timeStepCoeff: 0.04 });
      const fine = simulateFlybyTrajectory(config, { timeStepCoeff: 0.01 });

      expect(fine.speedConservationErrorPercent).toBeLessThan(coarse.speedConservationErrorPercent + 0.02);
      expect(fine.trajectory.length).toBeGreaterThan(coarse.trajectory.length);
    });

    it('produces 100% deterministic, repeatable trajectories with identical inputs', () => {
      const config: FlybyInitialConditions = {
        planet: jupiter,
        vInfSpeedMPerS: 12000.0,
        targetPeriapsisM: jupiter.radiusM * 1.75,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      };

      const run1 = simulateFlybyTrajectory(config);
      const run2 = simulateFlybyTrajectory(config);

      expect(run1.trajectory.length).toBe(run2.trajectory.length);
      const pt1 = run1.trajectory[Math.floor(run1.trajectory.length / 2)];
      const pt2 = run2.trajectory[Math.floor(run2.trajectory.length / 2)];

      expect(pt1.posPlanetM.x).toBe(pt2.posPlanetM.x);
      expect(pt1.posPlanetM.y).toBe(pt2.posPlanetM.y);
      expect(pt1.velPlanetMPerS.x).toBe(pt2.velPlanetMPerS.x);
      expect(pt1.speedPlanetMPerS).toBe(pt2.speedPlanetMPerS);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Collision Detection & Planetary Surface Protection
  // --------------------------------------------------------------------------
  describe('6. Collision Detection & Surface Boundary Clamping', () => {
    it('detects sub-surface periapsis and stops immediately at surface (never continues inside planet)', () => {
      const config: FlybyInitialConditions = {
        planet: earth,
        vInfSpeedMPerS: 7500.0,
        targetPeriapsisM: earth.radiusM * 0.7, // Sub-surface periapsis -> physical collision
        passType: 'TRAILING',
        spacecraftMassKg: 500.0,
      };

      const result = simulateFlybyTrajectory(config);
      expect(result.collisionDetected).toBe(true);
      expect(result.status).toBe('COLLIDED');
      expect(result.collisionPositionPlanetM).toBeDefined();

      // Trajectory must terminate exactly on physical spherical radius R_p
      const finalImpactRadius = result.collisionPositionPlanetM!.magnitude();
      expect(finalImpactRadius).toBeCloseTo(earth.radiusM, 1);

      // Trajectory must not contain points inside the planet
      const lastPoint = result.trajectory[result.trajectory.length - 1];
      expect(lastPoint.distanceFromCenterM).toBeGreaterThanOrEqual(earth.radiusM - 1.0);
    });

    it('handles direct radial head-on plunge (b = 0, rp = 0) safely without NaN', () => {
      const config: FlybyInitialConditions = {
        planet: earth,
        vInfSpeedMPerS: 8000.0,
        impactParameterM: 0.0, // Head-on plunge
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      };

      const result = simulateFlybyTrajectory(config);
      expect(result.collisionDetected).toBe(true);
      expect(result.status).toBe('COLLIDED');
      expect(result.collisionPositionPlanetM).toBeDefined();

      for (const pt of result.trajectory) {
        expect(isFinite(pt.posPlanetM.x)).toBe(true);
        expect(isFinite(pt.posPlanetM.y)).toBe(true);
        expect(isFinite(pt.speedPlanetMPerS)).toBe(true);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 7. Invalid Input Handling & Finite-State Validation
  // --------------------------------------------------------------------------
  describe('7. Invalid Input Handling & Finite-State Safety', () => {
    it('safely handles zero-gravity planet limit without NaN/Inf crash', () => {
      const zeroGPlanet = {
        ...earth,
        id: 'ZERO_G',
        name: 'Zero G Body',
        mu: 0.0,
        massKg: 0.0,
        radiusM: 5000000.0,
        orbitalSpeedMPerS: 0.0,
      };

      const config: FlybyInitialConditions = {
        planet: zeroGPlanet,
        vInfSpeedMPerS: 10000.0,
        targetPeriapsisM: 10000000.0,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      };

      const analytical = computeFlybyAnalytical(config);
      expect(analytical.deflectionAngleDeg).toBe(0.0);
      expect(analytical.deltaVSpeedMPerS).toBe(0.0);

      const sim = simulateFlybyTrajectory(config);
      expect(sim.status).toBe('COMPLETED');
      expect(sim.numericalDeflectionAngleDeg).toBeCloseTo(0.0, 4);
    });

    it('safely handles custom initial state with plain IVector3D objects', () => {
      const config: FlybyInitialConditions = {
        planet: jupiter,
        vInfSpeedMPerS: 12000.0,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
        customInitialState: {
          posPlanetM: { x: -jupiter.radiusM * 20.0, y: jupiter.radiusM * 3.0, z: 0 },
          velPlanetMPerS: { x: 12000.0, y: 0, z: 0 },
        },
      };

      const analytical = computeFlybyAnalytical(config);
      expect(isFinite(analytical.deflectionAngleDeg)).toBe(true);
      expect(analytical.periapsisRadiusM).toBeGreaterThan(0);

      const sim = simulateFlybyTrajectory(config);
      expect(isFinite(sim.numericalDeflectionAngleDeg)).toBe(true);
      expect(sim.trajectory.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Canonical Shared Contract Compatibility (Agent 5 Alignment)
  // --------------------------------------------------------------------------
  describe('8. Canonical Contract Alignment (Integration with contracts.ts)', () => {
    it('seamlessly bridges between FlybyEngine results and canonical FlybyResult contract', () => {
      const config: FlybyInitialConditions = {
        planet: jupiter,
        vInfSpeedMPerS: 13500.0,
        targetPeriapsisM: jupiter.radiusM * 1.85,
        passType: 'TRAILING',
        spacecraftMassKg: 1200.0,
      };

      const simResult = simulateFlybyTrajectory(config);
      const canonical = toCanonicalFlybyResult(simResult);

      // Verify canonical contracts are populated correctly
      expect(canonical.config.planet.name).toBe('Jupiter');
      expect(canonical.vInfMinusMPerS).toBeDefined();
      expect(canonical.vInfPlusMPerS).toBeDefined();
      expect(canonical.closestApproach.altitudeM).toBeCloseTo(
        canonical.closestApproach.distanceM - jupiter.radiusM,
        1
      );
      expect(canonical.energyDiagnostics.relativeEnergyConservationError).toBeLessThan(0.0005);
      expect(canonical.numericalErrorDiagnostics.speedConservationErrorPercent).toBeLessThan(0.1);
      expect(canonical.isValid).toBe(true);
      expect(canonical.trajectory.length).toBe(simResult.trajectory.length);
    });
  });
});
