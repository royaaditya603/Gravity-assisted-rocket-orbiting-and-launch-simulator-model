import { describe, it, expect } from 'vitest';
import { FlybyEngine, FlybyInitialConditions } from '../src/physics/FlybyEngine';
import { PLANETARY_BODIES, MU_SUN } from '../src/physics/constants';
import { Vector3D } from '../src/physics/Vector3D';

describe('FlybyEngine - High-Precision Planetary Gravity Assist', () => {
  const jupiter = PLANETARY_BODIES.JUPITER;
  const saturn = PLANETARY_BODIES.SATURN;

  describe('1. Impact Parameter and Periapsis Bi-directional Conversions', () => {
    it('accurately converts periapsis distance to impact parameter and back for Jupiter', () => {
      const vInf = 10000.0; // 10 km/s
      const originalRp = jupiter.radiusM * 1.5; // 1.5 R_J

      const b = FlybyEngine.periapsisToImpactParameter(originalRp, vInf, jupiter.mu);
      expect(b).toBeGreaterThan(originalRp); // Gravitational focusing makes b > r_p

      const reconstructedRp = FlybyEngine.impactParameterToPeriapsis(b, vInf, jupiter.mu);
      expect(reconstructedRp).toBeCloseTo(originalRp, 0); // Within 1 meter over 100,000 km
    });

    it('accurately converts for Saturn across multiple speeds', () => {
      const speeds = [3000, 7500, 15000, 30000];
      const targetRp = saturn.radiusM * 2.0;

      for (const vInf of speeds) {
        const b = FlybyEngine.periapsisToImpactParameter(targetRp, vInf, saturn.mu);
        const reconstructedRp = FlybyEngine.impactParameterToPeriapsis(b, vInf, saturn.mu);
        const relError = Math.abs(reconstructedRp - targetRp) / targetRp;
        expect(relError).toBeLessThan(1e-12);
      }
    });

    it('verifies explicit analytical relations (e, delta, b) across all supported planets (Jupiter, Saturn, Earth, Venus)', () => {
      const planets = [
        PLANETARY_BODIES.JUPITER,
        PLANETARY_BODIES.SATURN,
        PLANETARY_BODIES.EARTH,
        PLANETARY_BODIES.VENUS,
      ];
      const vInf = 11200.0; // 11.2 km/s

      for (const p of planets) {
        const rp = p.radiusM * 1.4;
        const e = FlybyEngine.eccentricityFromPeriapsis(rp, vInf, p.mu);
        expect(e).toBeGreaterThan(1.0); // Hyperbolic trajectory

        // delta = 2 * asin(1 / e)
        const delta = FlybyEngine.deflectionFromEccentricity(e);
        expect(delta).toBeCloseTo(2.0 * Math.asin(1.0 / e), 10);

        // b = (mu / v_inf^2) * sqrt(e^2 - 1)
        const bFromE = FlybyEngine.impactParameterFromEccentricity(e, vInf, p.mu);
        const bDirect = FlybyEngine.periapsisToImpactParameter(rp, vInf, p.mu);
        expect(bFromE).toBeCloseTo(bDirect, 6);

        // Reconstruct rp from b: rp = -c + sqrt(c^2 + b^2)
        const reconstructedRp = FlybyEngine.impactParameterToPeriapsis(bDirect, vInf, p.mu);
        const relDiff = Math.abs(reconstructedRp - rp) / rp;
        expect(relDiff).toBeLessThan(1e-12);
      }
    });
  });

  describe('2. Analytical Patched-Conic Mechanics', () => {
    it('conserves asymptotic speed in planet rest frame', () => {
      const config: FlybyInitialConditions = {
        planet: jupiter,
        vInfSpeedMPerS: 12000.0,
        targetPeriapsisM: jupiter.radiusM * 1.8,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      };

      const analytical = FlybyEngine.computeAnalytical(config);
      expect(analytical.vInfMinusMPerS.magnitude()).toBeCloseTo(12000.0, 5);
      expect(analytical.vInfPlusMPerS.magnitude()).toBeCloseTo(12000.0, 5);
    });

    it('produces positive Sun-relative delta-V for Trailing pass and negative for Leading pass', () => {
      const baseConfig = {
        planet: jupiter,
        vInfSpeedMPerS: 10000.0,
        targetPeriapsisM: jupiter.radiusM * 1.5,
        spacecraftMassKg: 1000.0,
      };

      const trailing = FlybyEngine.computeAnalytical({ ...baseConfig, passType: 'TRAILING' });
      const leading = FlybyEngine.computeAnalytical({ ...baseConfig, passType: 'LEADING' });

      // Trailing pass adds velocity in direction of planetary motion
      expect(trailing.isAcceleration).toBe(true);
      expect(trailing.deltaVSunSpeedMPerS).toBeGreaterThan(0.0);
      expect(trailing.deltaKineticEnergyJPerKg).toBeGreaterThan(0.0);

      // Leading pass subtracts velocity (gravity brake)
      expect(leading.isAcceleration).toBe(false);
      expect(leading.deltaVSunSpeedMPerS).toBeLessThan(0.0);
      expect(leading.deltaKineticEnergyJPerKg).toBeLessThan(0.0);
    });

    it('confirms deflection decreases as incoming excess speed increases', () => {
      const rp = jupiter.radiusM * 2.0;

      const slow = FlybyEngine.computeAnalytical({
        planet: jupiter,
        vInfSpeedMPerS: 6000.0,
        targetPeriapsisM: rp,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      });

      const fast = FlybyEngine.computeAnalytical({
        planet: jupiter,
        vInfSpeedMPerS: 18000.0,
        targetPeriapsisM: rp,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      });

      expect(slow.deflectionAngleDeg).toBeGreaterThan(fast.deflectionAngleDeg);
    });

    it('confirms deflection increases as periapsis distance decreases', () => {
      const vInf = 12000.0;

      const close = FlybyEngine.computeAnalytical({
        planet: jupiter,
        vInfSpeedMPerS: vInf,
        targetPeriapsisM: jupiter.radiusM * 1.2,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      });

      const distant = FlybyEngine.computeAnalytical({
        planet: jupiter,
        vInfSpeedMPerS: vInf,
        targetPeriapsisM: jupiter.radiusM * 5.0,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      });

      expect(close.deflectionAngleDeg).toBeGreaterThan(distant.deflectionAngleDeg);
    });

    it('confirms deflection increases monotonically with planetary mass parameter mu', () => {
      const fixedRp = 200000000.0; // 200,000 km common periapsis
      const vInf = 10000.0; // 10 km/s

      const venusRes = FlybyEngine.computeAnalytical({
        planet: PLANETARY_BODIES.VENUS,
        vInfSpeedMPerS: vInf,
        targetPeriapsisM: fixedRp,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      });

      const earthRes = FlybyEngine.computeAnalytical({
        planet: PLANETARY_BODIES.EARTH,
        vInfSpeedMPerS: vInf,
        targetPeriapsisM: fixedRp,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      });

      const saturnRes = FlybyEngine.computeAnalytical({
        planet: PLANETARY_BODIES.SATURN,
        vInfSpeedMPerS: vInf,
        targetPeriapsisM: fixedRp,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      });

      const jupiterRes = FlybyEngine.computeAnalytical({
        planet: PLANETARY_BODIES.JUPITER,
        vInfSpeedMPerS: vInf,
        targetPeriapsisM: fixedRp,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      });

      // Monotonic ordering by gravitational parameter: mu_Venus < mu_Earth < mu_Saturn < mu_Jupiter
      expect(venusRes.deflectionAngleDeg).toBeLessThan(earthRes.deflectionAngleDeg);
      expect(earthRes.deflectionAngleDeg).toBeLessThan(saturnRes.deflectionAngleDeg);
      expect(saturnRes.deflectionAngleDeg).toBeLessThan(jupiterRes.deflectionAngleDeg);
    });

    it('confirms exact energy identity: Delta_eps = V_planet · Delta_v across FlybyEngine analytical summary', () => {
      const config: FlybyInitialConditions = {
        planet: jupiter,
        vInfSpeedMPerS: 12500.0,
        targetPeriapsisM: jupiter.radiusM * 1.5,
        approachAngleDeg: 25.0,
        passType: 'TRAILING',
        spacecraftMassKg: 1200.0,
      };

      const trailing = FlybyEngine.computeAnalytical(config);
      expect(trailing.energyIdentityDiffJPerKg).toBeLessThan(1e-7); // Within IEEE 754 double precision roundoff limit
      expect(trailing.deltaSpecificEnergyJPerKg).toBeCloseTo(trailing.vPlanetDotDeltaVMPerS2, 6);

      const leading = FlybyEngine.computeAnalytical({ ...config, passType: 'LEADING' });
      expect(leading.energyIdentityDiffJPerKg).toBeLessThan(1e-7);
      expect(leading.deltaSpecificEnergyJPerKg).toBeCloseTo(leading.vPlanetDotDeltaVMPerS2, 6);
    });

    it('demonstrates distinctness of vector velocity change ||Delta_v|| vs scalar speed change Delta_v_speed', () => {
      const config: FlybyInitialConditions = {
        planet: jupiter,
        vInfSpeedMPerS: 11000.0,
        targetPeriapsisM: jupiter.radiusM * 1.4,
        approachAngleDeg: 15.0,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      };

      const res = FlybyEngine.computeAnalytical(config);

      // ||Delta_v_vector|| is the magnitude of the velocity vector difference
      const vectorDeltaVMag = res.deltaVVectorMagnitudeMPerS;
      // Delta_v_speed is the scalar speed difference ||v_out|| - ||v_in||
      const scalarSpeedChange = res.deltaVSpeedMPerS;

      expect(vectorDeltaVMag).toBeGreaterThan(0);
      expect(scalarSpeedChange).toBeGreaterThan(0);
      // They are fundamentally distinct quantities and must not be equal
      expect(Math.abs(vectorDeltaVMag - scalarSpeedChange)).toBeGreaterThan(100.0); // Differs by > 100 m/s
    });
  });

  describe('3. Numerical RK4 Simulation & Asymptotic Convergence', () => {
    it('numerically conserves planet-relative specific energy within 0.1%', () => {
      const config: FlybyInitialConditions = {
        planet: jupiter,
        vInfSpeedMPerS: 14000.0,
        targetPeriapsisM: jupiter.radiusM * 2.0,
        passType: 'TRAILING',
        spacecraftMassKg: 1500.0,
      };

      const result = FlybyEngine.runSimulation(config);

      expect(result.status).toBe('COMPLETED');
      expect(result.collisionDetected).toBe(false);
      expect(result.speedConservationErrorPercent).toBeLessThan(0.1);

      // Verify specific energy at start vs end
      const initialEnergy = result.trajectory[0].specificEnergyPlanetJPerKg;
      const finalEnergy = result.trajectory[result.trajectory.length - 1].specificEnergyPlanetJPerKg;
      const energyError = Math.abs((finalEnergy - initialEnergy) / initialEnergy);
      expect(energyError).toBeLessThan(0.001); // < 0.1% drift
    });

    it('numerical deflection angle converges to analytical prediction within 1.5%', () => {
      const config: FlybyInitialConditions = {
        planet: jupiter,
        vInfSpeedMPerS: 12000.0,
        targetPeriapsisM: jupiter.radiusM * 1.8,
        passType: 'TRAILING',
        spacecraftMassKg: 800.0,
      };

      const result = FlybyEngine.runSimulation(config, {
        entryDistanceMultiple: 25.0,
      });

      expect(result.deflectionErrorPercent).toBeLessThan(1.5);
    });

    it('detects closest approach with high positional fidelity via sub-step refinement', () => {
      const targetRp = jupiter.radiusM * 1.6;
      const config: FlybyInitialConditions = {
        planet: jupiter,
        vInfSpeedMPerS: 10000.0,
        targetPeriapsisM: targetRp,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      };

      const result = FlybyEngine.runSimulation(config);

      // Sub-step refined closest approach distance matches analytical target periapsis within 0.05%
      const relDiff = Math.abs(result.closestApproach.distanceM - targetRp) / targetRp;
      expect(relDiff).toBeLessThan(0.0005);
    });
  });

  describe('4. Physical Surface Collision Detection', () => {
    it('detects and flags physical collision when target periapsis is below planet radius', () => {
      const subSurfaceRp = jupiter.radiusM * 0.7; // Below 69,911 km
      const config: FlybyInitialConditions = {
        planet: jupiter,
        vInfSpeedMPerS: 11000.0,
        targetPeriapsisM: subSurfaceRp,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      };

      const result = FlybyEngine.runSimulation(config);

      expect(result.collisionDetected).toBe(true);
      expect(result.status).toBe('COLLIDED');
      expect(result.closestApproach.distanceM).toBeLessThanOrEqual(jupiter.radiusM + 1.0);
      expect(result.analytical.isPhysicalCollision).toBe(true);
      expect(result.collisionPositionPlanetM).toBeDefined();

      // Sub-step collision detection projects exactly onto physical radius Rp
      const colDist = result.collisionPositionPlanetM!.magnitude();
      expect(Math.abs(colDist - jupiter.radiusM)).toBeLessThan(1e-6); // < 1 micrometer precision!
    });
  });

  describe('5. Trajectory Invariance and Mass Scaling', () => {
    it('confirms kinematics are identical for 500 kg vs 50,000 kg spacecraft while kinetic energy scales linearly', () => {
      const base = {
        planet: jupiter,
        vInfSpeedMPerS: 12000.0,
        targetPeriapsisM: jupiter.radiusM * 2.0,
        passType: 'TRAILING' as const,
      };

      const probeLight = FlybyEngine.runSimulation({ ...base, spacecraftMassKg: 500.0 });
      const probeHeavy = FlybyEngine.runSimulation({ ...base, spacecraftMassKg: 50000.0 });

      // Trajectory points count and closest approach distance must be identical
      expect(probeLight.closestApproach.distanceM).toBeCloseTo(probeHeavy.closestApproach.distanceM, 2);
      expect(probeLight.closestApproach.speedPlanetMPerS).toBeCloseTo(probeHeavy.closestApproach.speedPlanetMPerS, 2);

      // Position along trajectory must be invariant to spacecraft mass (Galilean / Einstein Equivalence Principle)
      for (let i = 0; i < Math.min(probeLight.trajectory.length, 10); i++) {
        expect(probeLight.trajectory[i].posPlanetM.x).toBeCloseTo(probeHeavy.trajectory[i].posPlanetM.x, 3);
        expect(probeLight.trajectory[i].posPlanetM.y).toBeCloseTo(probeHeavy.trajectory[i].posPlanetM.y, 3);
        expect(probeLight.trajectory[i].speedPlanetMPerS).toBeCloseTo(probeHeavy.trajectory[i].speedPlanetMPerS, 3);
      }

      // Kinetic energy must scale exactly by mass ratio 100x
      const lightE = probeLight.trajectory[0].kineticEnergyJ;
      const heavyE = probeHeavy.trajectory[0].kineticEnergyJ;
      expect(heavyE / lightE).toBeCloseTo(100.0, 5);

      // Delta K = m_sc * Delta_eps
      expect(probeLight.analytical.deltaKineticEnergyJ).toBeCloseTo(500.0 * probeLight.analytical.deltaSpecificEnergyJPerKg, 4);
      expect(probeHeavy.analytical.deltaKineticEnergyJ).toBeCloseTo(50000.0 * probeHeavy.analytical.deltaSpecificEnergyJPerKg, 4);
    });
  });

  describe('6. Parameter Sweep Experiments', () => {
    it('Experiment A: Distance sweep correctly flags collisions and verifies decreasing deflection', () => {
      const sweepA = FlybyEngine.runExperimentA_DistanceSweep(jupiter, 10000.0, 'TRAILING');
      expect(sweepA.length).toBeGreaterThan(0);

      // The 0.8 R_J entry must be flagged as collision
      const collisionCase = sweepA.find((c) => c.rpFactor === 0.8);
      expect(collisionCase?.isCollision).toBe(true);

      // Deflection must decrease monotonically for increasing distance
      const validCases = sweepA.filter((c) => !c.isCollision);
      for (let i = 0; i < validCases.length - 1; i++) {
        expect(validCases[i].deflectionDeg).toBeGreaterThan(validCases[i + 1].deflectionDeg);
      }
    });

    it('Experiment E: Jupiter vs Saturn shows Jupiter produces higher deflection and explains non-linear Sun-relative boost', () => {
      const comp = FlybyEngine.runExperimentE_JupiterVsSaturn(12000.0, 'TRAILING', 40000.0);
      expect(comp.jupiter.deflectionAngleDeg).toBeGreaterThan(comp.saturn.deflectionAngleDeg);
      expect(comp.comparison.muRatio).toBeGreaterThan(3.0);
      expect(comp.comparison.explanation).toContain('gravitational parameter');
      expect(typeof comp.saturn.deltaVSunSpeedMPerS).toBe('number');
      expect(typeof comp.jupiter.deltaVSunSpeedMPerS).toBe('number');
    });
  });
});
