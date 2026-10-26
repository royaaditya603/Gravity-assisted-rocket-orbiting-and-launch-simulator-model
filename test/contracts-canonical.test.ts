/**
 * test/contracts-canonical.test.ts
 *
 * Canonical Contract Verification Suite (ASTRA Phase 2)
 *
 * Verifies that the canonical interfaces defined in src/physics/contracts.ts
 * satisfy all Phase 2 architectural requirements:
 * 1. Planet interface & planetary data mapping
 * 2. FlybyConfig with strictly authoritative geometry input
 * 3. SimulationSettings with tolerances and sampling settings
 * 4. TrajectoryState with full dual-frame and acceleration kinematics
 * 5. FlybyResult with comprehensive error & energy diagnostics
 * 6. UIConverters explicit SI boundary conversions
 * 7. Engine bidirectional adapter fidelity
 */

import { describe, it, expect } from 'vitest';
import {
  Planet,
  FlybyConfig,
  SimulationSettings,
  TrajectoryState,
  FlybyResult,
  UIConverters,
  toCanonicalPlanet,
  toCanonicalFlybyConfig,
  fromCanonicalFlybyConfig,
  toCanonicalTrajectoryState,
  toCanonicalFlybyResult,
  PLANETARY_BODIES,
  FlybyEngine,
  Vector3D,
} from '../src/physics';

describe('Phase 2 — Canonical Interfaces & Shared Contracts Verification', () => {
  // 1. Canonical Planet Interface
  describe('1. Canonical Planet Interface', () => {
    it('accurately maps planetary constants to canonical Planet structure', () => {
      const jupiterData = PLANETARY_BODIES.JUPITER;
      const planet: Planet = toCanonicalPlanet(jupiterData);

      expect(planet.name).toBe('Jupiter');
      expect(planet.massKg).toBeGreaterThan(1e27);
      expect(planet.radiusM).toBeCloseTo(69911000, -3);
      expect(planet.mu).toBeCloseTo(1.26686534e17, 0);
      expect(planet.semiMajorAxisM).toBeGreaterThan(0);
      expect(planet.orbitalSpeedMPerS).toBeGreaterThan(0);
      expect(planet.source).toBeDefined();
    });
  });

  // 2. Canonical FlybyConfig Interface
  describe('2. Canonical FlybyConfig Interface', () => {
    it('enforces authoritative closest-approach altitude geometry mode', () => {
      const planet = toCanonicalPlanet(PLANETARY_BODIES.JUPITER);
      const config: FlybyConfig = {
        planet,
        vInfSpeedMPerS: 12000,
        approachAngleDeg: 0,
        passType: 'TRAILING',
        spacecraftMassKg: 1000,
        geometry: {
          mode: 'CLOSEST_APPROACH_ALTITUDE',
          altitudeM: 350000000, // 350,000 km
        },
      };

      expect(config.geometry.mode).toBe('CLOSEST_APPROACH_ALTITUDE');
      if (config.geometry.mode === 'CLOSEST_APPROACH_ALTITUDE') {
        expect(config.geometry.altitudeM).toBe(350000000);
      }

      // Convert to engine initial conditions
      const engineInit = fromCanonicalFlybyConfig(config);
      expect(engineInit.targetPeriapsisM).toBeCloseTo(planet.radiusM + 350000000, 0);
      expect(engineInit.impactParameterM).toBeUndefined();
    });

    it('enforces authoritative impact parameter geometry mode', () => {
      const planet = toCanonicalPlanet(PLANETARY_BODIES.EARTH);
      const config: FlybyConfig = {
        planet,
        vInfSpeedMPerS: 8000,
        approachAngleDeg: 45,
        passType: 'LEADING',
        spacecraftMassKg: 750,
        geometry: {
          mode: 'IMPACT_PARAMETER',
          impactParameterM: 25000000, // 25,000 km
        },
      };

      expect(config.geometry.mode).toBe('IMPACT_PARAMETER');
      if (config.geometry.mode === 'IMPACT_PARAMETER') {
        expect(config.geometry.impactParameterM).toBe(25000000);
      }

      const engineInit = fromCanonicalFlybyConfig(config);
      expect(engineInit.impactParameterM).toBe(25000000);
      expect(engineInit.targetPeriapsisM).toBeUndefined();
    });
  });

  // 3. Canonical SimulationSettings Interface
  describe('3. Canonical SimulationSettings Interface', () => {
    it('defines start/end time, method, tolerance, step sizes and sampling', () => {
      const settings: SimulationSettings = {
        startTimeS: -86400,
        endTimeS: 86400,
        durationS: 172800,
        method: 'RK4',
        numericalTolerance: 1e-6,
        fixedTimeStepS: 10,
        timeStepCoeff: 0.015,
        outputSampling: {
          sampleIntervalS: 60,
          maxOutputSteps: 5000,
          entryDistanceMultiple: 20,
        },
      };

      expect(settings.durationS).toBe(172800);
      expect(settings.method).toBe('RK4');
      expect(settings.numericalTolerance).toBe(1e-6);
      expect(settings.outputSampling.maxOutputSteps).toBe(5000);
    });
  });

  // 4. Canonical TrajectoryState Interface
  describe('4. Canonical TrajectoryState Interface', () => {
    it('captures full state kinematics, relative vectors, and acceleration', () => {
      const sim = FlybyEngine.runSimulation({
        planet: PLANETARY_BODIES.JUPITER,
        vInfSpeedMPerS: 14000,
        targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM * 2.0,
        passType: 'TRAILING',
        spacecraftMassKg: 1000,
      });

      expect(sim.trajectory.length).toBeGreaterThan(0);
      const firstPt = sim.trajectory[0];
      const state: TrajectoryState = toCanonicalTrajectoryState(
        firstPt,
        sim.collisionDetected,
        sim.status
      );

      expect(state.timeS).toBe(firstPt.timeS);
      expect(state.relativePositionM.x).toBe(firstPt.posPlanetM.x);
      expect(state.relativeVelocityMPerS.x).toBe(firstPt.velPlanetMPerS.x);
      expect(state.spacecraftPositionM.x).toBe(firstPt.posSunM.x);
      expect(state.spacecraftVelocityMPerS.x).toBe(firstPt.velSunMPerS.x);
      expect(state.accelerationMagnitudeMPerS2).toBe(firstPt.gravitationalAccelerationMPerS2);
      expect(state.collision).toBe(false);
      expect(state.status).toBe('COMPLETED');
    });
  });

  // 5. Canonical FlybyResult Interface
  describe('5. Canonical FlybyResult Interface', () => {
    it('provides complete asymptotic vectors, deflection angle, energy & error diagnostics', () => {
      const sim = FlybyEngine.runSimulation({
        planet: PLANETARY_BODIES.JUPITER,
        vInfSpeedMPerS: 13000,
        targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM * 1.8,
        passType: 'TRAILING',
        spacecraftMassKg: 1200,
      });

      const result: FlybyResult = toCanonicalFlybyResult(sim);

      // Incoming and outgoing vectors
      expect(result.vInfMinusMPerS).toBeDefined();
      expect(result.vInfPlusMPerS).toBeDefined();
      expect(result.vInSunMPerS).toBeDefined();
      expect(result.vOutSunMPerS).toBeDefined();

      // Deflection angle
      expect(result.deflectionAngleDeg).toBeGreaterThan(0);
      expect(result.deflectionAngleRad).toBeCloseTo(
        (result.deflectionAngleDeg * Math.PI) / 180,
        4
      );

      // Closest approach
      expect(result.closestApproach.distanceM).toBeGreaterThan(0);
      expect(result.closestApproach.altitudeM).toBeGreaterThan(0);
      expect(result.impactParameterM).toBeGreaterThan(0);

      // Speed changes
      expect(result.relativeSpeedChangeMPerS).toBeCloseTo(0, 4); // ||v_inf(+)|| - ||v_inf(-)|| = 0
      expect(result.sunRelativeDeltaVSpeedMPerS).toBeGreaterThan(0); // Boost for trailing pass
      expect(result.deltaVVectorMagnitudeMPerS).toBeGreaterThan(0);

      // Energy diagnostics
      expect(result.energyDiagnostics.deltaSpecificEnergyJPerKg).toBeGreaterThan(0);
      expect(result.energyDiagnostics.deltaKineticEnergyJ).toBeGreaterThan(0);
      expect(result.energyDiagnostics.vPlanetDotDeltaVMPerS2).toBeGreaterThan(0);
      expect(result.energyDiagnostics.energyIdentityDiffJPerKg).toBeCloseTo(0, 3);

      // Numerical error diagnostics
      expect(result.numericalErrorDiagnostics.speedConservationErrorPercent).toBeLessThan(1.0);
      expect(result.numericalErrorDiagnostics.deflectionErrorPercent).toBeLessThan(5.0);
      expect(result.numericalErrorDiagnostics.stepCount).toBeGreaterThan(10);

      // Validity & collision
      expect(result.isValid).toBe(true);
      expect(result.collisionDetected).toBe(false);
      expect(result.status).toBe('COMPLETED');
      expect(result.trajectory.length).toBeGreaterThan(0);
    });
  });

  // 6. UIConverters SI Boundary Conversions
  describe('6. UIConverters SI Boundary Conversions', () => {
    it('correctly converts distance, velocity, angles, and energies', () => {
      // Distance
      expect(UIConverters.mToKm(150000000)).toBe(150000);
      expect(UIConverters.kmToM(150000)).toBe(150000000);

      // Speed
      expect(UIConverters.mPerSToKmPerS(11200)).toBe(11.2);
      expect(UIConverters.kmPerSToMPerS(11.2)).toBe(11200);

      // Angles
      expect(UIConverters.radToDeg(Math.PI / 2)).toBeCloseTo(90, 5);
      expect(UIConverters.degToRad(90)).toBeCloseTo(Math.PI / 2, 5);

      // Formatting
      expect(UIConverters.formatSpeedKmS(13056)).toBe('13.06 km/s');
      expect(UIConverters.formatAngleDeg(1.5707963, true)).toBe('90.00°');
      expect(UIConverters.formatAngleDeg(45.678, false)).toBe('45.68°');
    });
  });
});
