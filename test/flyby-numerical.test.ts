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

    it('detects closest approach with high positional fidelity', () => {
      const targetRp = jupiter.radiusM * 1.6;
      const config: FlybyInitialConditions = {
        planet: jupiter,
        vInfSpeedMPerS: 10000.0,
        targetPeriapsisM: targetRp,
        passType: 'TRAILING',
        spacecraftMassKg: 1000.0,
      };

      const result = FlybyEngine.runSimulation(config);

      // Closest approach distance matches target periapsis within 0.5%
      const relDiff = Math.abs(result.closestApproach.distanceM - targetRp) / targetRp;
      expect(relDiff).toBeLessThan(0.005);
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
      expect(result.closestApproach.distanceM).toBeLessThanOrEqual(jupiter.radiusM + 1000.0);
      expect(result.analytical.isPhysicalCollision).toBe(true);
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

      // Kinetic energy must scale exactly by mass ratio 100x
      const lightE = probeLight.trajectory[0].kineticEnergyJ;
      const heavyE = probeHeavy.trajectory[0].kineticEnergyJ;
      expect(heavyE / lightE).toBeCloseTo(100.0, 5);
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
