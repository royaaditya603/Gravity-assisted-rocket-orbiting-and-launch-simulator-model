import { describe, it, expect } from 'vitest';
import { PLANETARY_BODIES } from '../src/physics/constants';
import {
  FlybyExperimentEngine,
  SweepConfig,
} from '../src/physics/FlybyExperimentEngine';
import {
  HISTORICAL_MISSION_DOSSIERS,
  propagateMissionLeg,
} from '../src/physics/HistoricalEphemeris';

describe('Phase 5 — Controlled Experiments, Parameter Sweeps & Mission Analysis', () => {
  describe('1. Controlled Experiment Builder & Validation', () => {
    it('validates sweep config and rejects invalid ranges', () => {
      // Min >= Max
      const invalidRange = FlybyExperimentEngine.validateSweepConfig({
        parameter: 'vInfMPerS',
        minValue: 10000,
        maxValue: 5000,
        sampleCount: 10,
      });
      expect(invalidRange.isValid).toBe(false);
      expect(invalidRange.errors[0]).toContain('strictly less than');

      // Sample count out of bounds
      const invalidSamples = FlybyExperimentEngine.validateSweepConfig({
        parameter: 'periapsisAltitudeKm',
        minValue: 1000,
        maxValue: 10000,
        sampleCount: 1,
      });
      expect(invalidSamples.isValid).toBe(false);

      // Non-positive speed
      const invalidSpeed = FlybyExperimentEngine.validateSweepConfig({
        parameter: 'vInfMPerS',
        minValue: -500,
        maxValue: 5000,
        sampleCount: 5,
      });
      expect(invalidSpeed.isValid).toBe(false);

      // Valid configuration
      const valid = FlybyExperimentEngine.validateSweepConfig({
        parameter: 'periapsisAltitudeKm',
        minValue: 10000,
        maxValue: 100000,
        sampleCount: 10,
      });
      expect(valid.isValid).toBe(true);
      expect(valid.errors.length).toBe(0);
    });

    it('generates uniform linear and logarithmic samples within specified bounds', () => {
      const linearSamples = FlybyExperimentEngine.generateSampleValues({
        parameter: 'vInfMPerS',
        minValue: 5000,
        maxValue: 25000,
        sampleCount: 5,
        scale: 'LINEAR',
      });
      expect(linearSamples.length).toBe(5);
      expect(linearSamples[0]).toBe(5000);
      expect(linearSamples[2]).toBe(15000);
      expect(linearSamples[4]).toBe(25000);

      const logSamples = FlybyExperimentEngine.generateSampleValues({
        parameter: 'spacecraftMassKg',
        minValue: 100,
        maxValue: 10000,
        sampleCount: 3,
        scale: 'LOGARITHMIC',
      });
      expect(logSamples.length).toBe(3);
      expect(logSamples[0]).toBeCloseTo(100, 1);
      expect(logSamples[1]).toBeCloseTo(1000, 1);
      expect(logSamples[2]).toBeCloseTo(10000, 1);
    });

    it('runs custom parameter sweep holding all other parameters strictly fixed', () => {
      const baseline = {
        planet: PLANETARY_BODIES.JUPITER,
        vInfSpeedMPerS: 12000,
        targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM + 50000000,
        passType: 'TRAILING' as const,
        spacecraftMassKg: 1000,
      };

      const sweep: SweepConfig = {
        parameter: 'vInfMPerS',
        minValue: 5000,
        maxValue: 20000,
        sampleCount: 4,
      };

      const records = FlybyExperimentEngine.runParameterSweep(baseline, sweep);
      expect(records.length).toBe(4);

      // Verify that swept values change while non-swept parameters remain fixed
      expect(records[0].inputParamValue).toBe(5000);
      expect(records[3].inputParamValue).toBe(20000);

      for (const r of records) {
        expect(r.planetName).toBe('Jupiter');
        // Periapsis radius should be strictly held at R_J + 50,000 km
        expect(r.closestApproachAltitudeKm).toBeCloseTo(50000, 0);
      }
    });
  });

  describe('2. Required Scientific Experiments (Suites A — F)', () => {
    it('Experiment A: flags sub-surface collisions when rp < R_planet', () => {
      const expA = FlybyExperimentEngine.runExperimentA_ClosestApproach(PLANETARY_BODIES.JUPITER, 10000, 'TRAILING', 7);
      expect(expA.length).toBe(7);

      // First sample at 0.8 R_J is sub-surface
      const subSurface = expA[0];
      expect(subSurface.isCollision).toBe(true);
      expect(subSurface.collisionStatus).toBe('SURFACE_IMPACT');
      expect(subSurface.closestApproachAltitudeKm).toBeLessThan(0);

      // Last sample at 6.0 R_J is safe
      const safe = expA[expA.length - 1];
      expect(safe.isCollision).toBe(false);
      expect(safe.collisionStatus).toBe('SAFE_FLYBY');
      expect(safe.closestApproachAltitudeKm).toBeGreaterThan(0);

      // Deflection angle decreases monotonically as periapsis distance increases
      expect(expA[1].deflectionAngleDeg).toBeGreaterThan(expA[expA.length - 1].deflectionAngleDeg);
    });

    it('Experiment B: verifies turning angle declines as excess speed increases', () => {
      const expB = FlybyExperimentEngine.runExperimentB_SpeedSweep(
        PLANETARY_BODIES.JUPITER,
        PLANETARY_BODIES.JUPITER.radiusM * 1.5,
        'TRAILING',
        6
      );

      expect(expB.length).toBe(6);
      // Turning angle delta = 2 * asin(1/e) where e = 1 + rp*v_inf^2/mu.
      // As v_inf grows, e grows, delta drops monotonically.
      for (let i = 0; i < expB.length - 1; i++) {
        expect(expB[i].deflectionAngleDeg).toBeGreaterThan(expB[i + 1].deflectionAngleDeg);
      }
    });

    it('Experiment C: compares planetary gravity under matched radius vs matched altitude', () => {
      const expC = FlybyExperimentEngine.runExperimentC_GravityStrength(10000, 'TRAILING');

      expect(expC.equalRadiusRecords.length).toBe(4);
      expect(expC.equalAltitudeRecords.length).toBe(4);
      expect(expC.explanation).toContain('Gravitational parameter (mu) alone does NOT dictate');

      // In equal radius test, Jupiter (largest mu) has the largest deflection angle
      const jupRadius = expC.equalRadiusRecords.find((r) => r.planetName === 'Jupiter')!;
      const earthRadius = expC.equalRadiusRecords.find((r) => r.planetName === 'Earth')!;
      expect(jupRadius.deflectionAngleDeg).toBeGreaterThan(earthRadius.deflectionAngleDeg);
    });

    it('Experiment D: confirms trailing (+) vs leading (-) orientation vector changes without arbitrary sign hardcoding', () => {
      const expD = FlybyExperimentEngine.runExperimentD_Orientation(
        PLANETARY_BODIES.JUPITER,
        12000,
        50000
      );

      // In the planet rest frame, speed is strictly conserved
      expect(expD.trailing.vInfPlusMPerS.magnitude()).toBeCloseTo(expD.trailing.vInfMinusMPerS.magnitude(), 2);
      expect(expD.leading.vInfPlusMPerS.magnitude()).toBeCloseTo(expD.leading.vInfMinusMPerS.magnitude(), 2);

      // In the Sun frame:
      // Trailing pass produces positive speed gain
      expect(expD.vectorAnalysis.speedGainTrailingMPerS).toBeGreaterThan(0);
      expect(expD.vectorAnalysis.dotProductTrailingMPerS2).toBeGreaterThan(0);

      // Leading pass produces negative speed gain (gravity brake)
      expect(expD.vectorAnalysis.speedGainLeadingMPerS).toBeLessThan(0);
      expect(expD.vectorAnalysis.dotProductLeadingMPerS2).toBeLessThan(0);
    });

    it('Experiment E: compares Jupiter and Saturn under consistent matching conditions', () => {
      const expE = FlybyExperimentEngine.runExperimentE_JupiterVsSaturnComparison(12000, 'TRAILING', 50000);

      expect(expE.metrics.muRatio).toBeGreaterThan(3.0); // Jupiter mu is ~3.34x Saturn mu
      expect(expE.jupiter.deflectionAngleDeg).toBeGreaterThan(expE.saturn.deflectionAngleDeg);
      expect(expE.metrics.speedBoostDiffKmPerS).toBeGreaterThan(0); // Jupiter gives higher speed boost
    });

    it('Experiment F: proves trajectory invariance while kinetic energy scales linearly with spacecraft mass', () => {
      const masses = [10, 100, 1000, 10000];
      const expF = FlybyExperimentEngine.runExperimentF_MassInvariance(
        PLANETARY_BODIES.JUPITER,
        10000,
        50000,
        masses
      );

      expect(expF.length).toBe(4);

      // Kinematic quantities must be IDENTICAL across all probe masses
      const baseDeflection = expF[0].deflectionAngleDeg;
      const baseDeltaV = expF[0].deltaVSpeedKmPerS;
      const baseSpecificEnergy = expF[0].deltaSpecificEnergyMJPerKg;

      for (let i = 1; i < expF.length; i++) {
        expect(expF[i].deflectionAngleDeg).toBeCloseTo(baseDeflection, 6);
        expect(expF[i].deltaVSpeedKmPerS).toBeCloseTo(baseDeltaV, 6);
        expect(expF[i].deltaSpecificEnergyMJPerKg).toBeCloseTo(baseSpecificEnergy, 6);

        // Total kinetic energy change Delta_K = m * Delta_epsilon scales in direct 1:1 proportion with mass
        const massRatio = expF[i].inputParamValue / expF[0].inputParamValue;
        const energyRatio = expF[i].deltaTotalKineticEnergyGJ / expF[0].deltaTotalKineticEnergyGJ;
        expect(energyRatio).toBeCloseTo(massRatio, 4);
      }
    });
  });

  describe('3. CSV Export Formatting & Metadata Integrity', () => {
    it('generates compliant RFC-4180 CSV with header metadata and scientific assumptions', () => {
      const records = FlybyExperimentEngine.runExperimentA_ClosestApproach(PLANETARY_BODIES.JUPITER, 10000, 'TRAILING', 3);
      const csv = FlybyExperimentEngine.exportExperimentToCSV(records, {
        title: 'Jupiter Test Sweep',
        baselinePlanet: 'Jupiter',
        baselineVInfMPerS: 10000,
        baselineAltKm: 50000,
        baselinePassType: 'TRAILING',
        baselineMassKg: 1000,
        assumptions: ['2-Body Unperturbed Newton Gravity', 'Patched Conic Asymptotes'],
      });

      expect(csv).toContain('# Title: Jupiter Test Sweep');
      expect(csv).toContain('# Model Assumption: 2-Body Unperturbed Newton Gravity');
      expect(csv).toContain('Step,Scenario,Planet,ModelType,ParameterName');
      expect(csv).toContain('SURFACE_IMPACT');
      expect(csv).toContain('SAFE_FLYBY');

      const lines = csv.split('\r\n').filter((l) => l.trim().length > 0);
      // Header metadata lines start with #
      const dataRows = lines.filter((l) => !l.startsWith('#'));
      expect(dataRows.length).toBe(4); // 1 header row + 3 data rows
    });
  });

  describe('4. Historical Mission Dossiers & Sequential Propagation Mode', () => {
    it('contains comprehensive historical dossiers for Mariner 10, Voyager 2, and Cassini', () => {
      expect(HISTORICAL_MISSION_DOSSIERS.MARINER_10).toBeDefined();
      expect(HISTORICAL_MISSION_DOSSIERS.VOYAGER_2).toBeDefined();
      expect(HISTORICAL_MISSION_DOSSIERS.CASSINI_HUYGENS).toBeDefined();

      const vgr = HISTORICAL_MISSION_DOSSIERS.VOYAGER_2;
      expect(vgr.legs.length).toBe(4); // Jupiter, Saturn, Uranus, Neptune
      expect(vgr.legs[0].classification).toBe('HISTORICAL_FACT');
      expect(vgr.legs[0].archivalSource).toContain('NASA JPL');

      const cas = HISTORICAL_MISSION_DOSSIERS.CASSINI_HUYGENS;
      expect(cas.legs.length).toBe(4); // Venus 1, Venus 2, Earth, Jupiter
      expect(cas.legs[0].periapsisAltitudeKm).toBeCloseTo(284, 0);

      const m10 = HISTORICAL_MISSION_DOSSIERS.MARINER_10;
      expect(m10.legs[0].flybyPassType).toBe('LEADING'); // Venus gravity brake
      expect(m10.legs[0].sunSpeedBoostKmPerS).toBeLessThan(0);
    });

    it('propagates heliocentric orbits across sequential legs and explains non-linear delta-V mechanics', () => {
      const vgrJupiterLeg = HISTORICAL_MISSION_DOSSIERS.VOYAGER_2.legs[0];
      const propagated = propagateMissionLeg(vgrJupiterLeg);

      // Pre-flyby orbit is bound (semi-major axis > 0)
      expect(propagated.preOrbit.semiMajorAxisAU).toBeGreaterThan(0);

      // Post-flyby heliocentric speed increases beyond solar escape speed at Jupiter (hyperbolic escape: energy > 0)
      expect(propagated.postFlybySunSpeedKmPerS).toBeGreaterThan(propagated.preFlybySunSpeedKmPerS);
      expect(propagated.postOrbit.specificEnergyJPerKg).toBeGreaterThan(0); // Solar escape achieved
      expect(propagated.specificEnergyChangeMJPerKg).toBeGreaterThan(0);

      // Verify the astrodynamic non-linear explanation
      expect(propagated.whyLinearSumIsInvalid).toContain('scalar delta-Vs cannot be summed linearly');
    });
  });
});
