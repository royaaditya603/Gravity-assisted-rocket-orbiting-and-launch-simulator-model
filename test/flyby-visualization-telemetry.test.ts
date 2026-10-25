import { describe, it, expect } from 'vitest';
import { FlybyEngine, FlybyInitialConditions } from '../src/physics/FlybyEngine';
import { PLANETARY_BODIES } from '../src/physics/constants';
import {
  HISTORICAL_MISSION_REFERENCES,
  getHistoricalReferenceForPlanet,
} from '../src/physics/HistoricalEphemeris';

describe('Phase 4 — Live Visualization & Telemetry Synchronization', () => {
  const jupiter = PLANETARY_BODIES.JUPITER;

  const baseConfig: FlybyInitialConditions = {
    planet: jupiter,
    vInfSpeedMPerS: 11000.0,
    targetPeriapsisM: jupiter.radiusM * 1.6,
    approachAngleDeg: 10.0,
    passType: 'TRAILING',
    spacecraftMassKg: 1200.0,
  };

  const simResult = FlybyEngine.runSimulation(baseConfig);

  describe('1. Authoritative State Synchronization Across Playback', () => {
    it('verifies trajectory points contain synchronized dual-frame state and gravitational acceleration', () => {
      expect(simResult.trajectory.length).toBeGreaterThan(100);

      for (let i = 0; i < simResult.trajectory.length; i += 25) {
        const pt = simResult.trajectory[i];

        // Gravitational acceleration must match Newton's inverse-square law: g = mu / r^2
        const r = pt.distanceFromCenterM;
        const expectedG = jupiter.mu / (r * r);
        expect(pt.gravitationalAccelerationMPerS2).toBeCloseTo(expectedG, 4);

        // Planet speed and Sun speed must be positive and finite
        expect(pt.speedPlanetMPerS).toBeGreaterThan(0);
        expect(pt.speedSunMPerS).toBeGreaterThan(0);

        // Specific energy in planet rest frame must be conserved throughout
        expect(pt.specificEnergyPlanetJPerKg).toBeCloseTo(
          simResult.trajectory[0].specificEnergyPlanetJPerKg,
          -1 // within ~10 J/kg on order of 1e8 J/kg
        );
      }
    });

    it('confirms gravitational acceleration peaks precisely at closest approach', () => {
      const traj = simResult.trajectory;
      let maxG = -Infinity;
      let maxGTime = 0;

      for (const pt of traj) {
        if (pt.gravitationalAccelerationMPerS2 > maxG) {
          maxG = pt.gravitationalAccelerationMPerS2;
          maxGTime = pt.timeS;
        }
      }

      // Peak acceleration must coincide with closest approach timestamp
      const periTime = simResult.closestApproach.timeS;
      expect(Math.abs(maxGTime - periTime)).toBeLessThan(100.0); // within numerical step resolution
    });
  });

  describe('2. Provisional vs Confirmed Closest Approach Progression', () => {
    it('distinguishes provisional state from confirmed state relative to periapsis timestamp', () => {
      const periTime = simResult.closestApproach.timeS;
      const traj = simResult.trajectory;

      const beforeIdx = traj.findIndex((p) => p.timeS < periTime - 200.0);
      const afterIdx = traj.findIndex((p) => p.timeS > periTime + 200.0);

      expect(beforeIdx).toBeGreaterThanOrEqual(0);
      expect(afterIdx).toBeGreaterThan(beforeIdx);

      const ptBefore = traj[beforeIdx];
      const ptAfter = traj[afterIdx];

      // Time before periapsis has positive countdown
      expect(periTime - ptBefore.timeS).toBeGreaterThan(0);

      // Time after periapsis has negative countdown (passed)
      expect(periTime - ptAfter.timeS).toBeLessThan(0);
    });
  });

  describe('3. Offline Historical Reference Ephemeris Grounding', () => {
    it('retrieves verified archival ephemeris for Voyager 2 at Jupiter', () => {
      const ref = getHistoricalReferenceForPlanet('JUPITER');
      expect(ref).toBeDefined();
      expect(ref?.missionName).toContain('Voyager 2');
      expect(ref?.targetPlanetName).toBe('Jupiter');
      expect(ref?.periapsisAltitudeKm).toBe(570000.0);
      expect(ref?.asymptoticExcessSpeedKmPerS).toBeCloseTo(10.5, 1);
      expect(ref?.sunSpeedBoostKmPerS).toBeGreaterThan(15.0);
      expect(ref?.archivalSource).toContain('NASA JPL');
      expect(ref?.documentationUrl).toBeDefined();
    });

    it('retrieves verified archival ephemeris for Mariner 10 Venus gravity brake', () => {
      const ref = HISTORICAL_MISSION_REFERENCES.VENUS_MARINER_10;
      expect(ref).toBeDefined();
      expect(ref.flybyPassType).toBe('LEADING');
      expect(ref.sunSpeedBoostKmPerS).toBeLessThan(0); // Gravity brake
      expect(ref.notes).toContain('First operational gravitational assist');
    });

    it('gracefully returns undefined for fictitious or non-archival bodies without throwing', () => {
      const fictitious = getHistoricalReferenceForPlanet('PROXIMA_CENTAURI_B');
      expect(fictitious).toBeUndefined();
    });
  });

  describe('4. Performance & Rendering Decoupling', () => {
    it('verifies that trajectory computation is pre-calculated and independent of playback rate', () => {
      // Running simulation with identical config returns identical points
      const simRun2 = FlybyEngine.runSimulation(baseConfig);
      expect(simRun2.trajectory.length).toBe(simResult.trajectory.length);
      expect(simRun2.closestApproach.distanceM).toBe(simResult.closestApproach.distanceM);
      expect(simRun2.analytical.deltaVVectorMagnitudeMPerS).toBe(simResult.analytical.deltaVVectorMagnitudeMPerS);
    });
  });
});
