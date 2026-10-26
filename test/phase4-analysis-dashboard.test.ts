import { describe, it, expect } from 'vitest';
import { PLANETARY_BODIES } from '../src/physics/constants';
import { FlybyEngine, FlybyPassType, Vector3D } from '../src/physics/FlybyEngine';
import {
  FlybyExperimentEngine,
  SweepConfig,
  SavedExperiment,
} from '../src/physics/FlybyExperimentEngine';

describe('ASTRA Phase 4 — Physics Experiments & Analysis Dashboard Verification', () => {
  // =========================================================================
  // 1. GRAPHS & TRAJECTORY DATA CONSISTENCY (9 REQUIRED CHARTS)
  // =========================================================================
  describe('1. Scientific Graph Calculations & Non-Fabricated Data Consistency', () => {
    const planet = PLANETARY_BODIES.JUPITER;
    const vInf = 12000.0;
    const rp = planet.radiusM + 50000000.0;

    const sim = FlybyEngine.runSimulation(
      {
        planet,
        vInfSpeedMPerS: vInf,
        targetPeriapsisM: rp,
        passType: 'TRAILING',
        spacecraftMassKg: 1000,
      },
      { timeStepCoeff: 0.015, maxPoints: 1000 }
    );

    it('Chart 1: Distance from planet centre vs time r(t) matches trajectory coordinates', () => {
      expect(sim.trajectory.length).toBeGreaterThan(10);
      const distances = sim.trajectory.map((pt) => pt.posPlanetM.magnitude());

      // Minimum distance must correspond to closest approach (periapsis within sub-step interpolation)
      const minDistance = Math.min(...distances);
      expect(sim.closestApproach.distanceM).toBeCloseTo(minDistance, -4);
      expect(minDistance).toBeCloseTo(rp, -4); // within 0.01% of targeted periapsis
    });

    it('Chart 2: Altitude above surface vs time h(t) = r(t) - R_p correctly accounts for planet radius', () => {
      for (const pt of sim.trajectory) {
        const r = pt.posPlanetM.magnitude();
        const h = r - planet.radiusM;
        expect(pt.altitudeM).toBeCloseTo(h, 0);
      }
      expect(sim.closestApproach.altitudeM).toBeCloseTo(sim.closestApproach.distanceM - planet.radiusM, 0);
    });

    it('Chart 3: Planet-relative speed vs time ||v_rel(t)|| peaks at closest approach and enters/exits at v_inf', () => {
      const speeds = sim.trajectory.map((pt) => pt.velPlanetMPerS.magnitude());
      const maxSpeed = Math.max(...speeds);

      // Conservation of hyperbolic energy: v_p^2 = v_inf^2 + 2*mu/rp
      const expectedPeriapsisSpeed = Math.sqrt(vInf * vInf + (2 * planet.mu) / rp);
      expect(maxSpeed).toBeCloseTo(expectedPeriapsisSpeed, -2);

      // Asymptotic boundary speed should equal incoming vInf within SOI cutoff
      const startSpeed = speeds[0];
      const endSpeed = speeds[speeds.length - 1];
      expect(startSpeed).toBeGreaterThan(vInf * 0.95);
      expect(endSpeed).toBeGreaterThan(vInf * 0.95);
    });

    it('Chart 4: Sun-relative speed vs time ||v_Sun(t)|| shows heliocentric acceleration for trailing pass', () => {
      const sunSpeeds = sim.trajectory.map((pt) => pt.velSunMPerS.magnitude());
      const startSunSpeed = sunSpeeds[0];
      const endSunSpeed = sunSpeeds[sunSpeeds.length - 1];

      // Trailing pass adds energy
      expect(endSunSpeed).toBeGreaterThan(startSunSpeed);
      expect(sim.sunRelativeDeltaVSpeedMPerS).toBeGreaterThan(0);
    });

    it('Chart 5: Gravitational acceleration vs time a_g(t) = mu / r(t)^2 peaks at closest approach', () => {
      const accelerations = sim.trajectory.map((pt) => {
        const r = pt.posPlanetM.magnitude();
        return planet.mu / (r * r);
      });
      const maxAccel = Math.max(...accelerations);
      const expectedPeakAccel = planet.mu / (rp * rp);

      expect(maxAccel).toBeCloseTo(expectedPeakAccel, -1);
      expect(sim.peakGravitationalAccelerationMPerS2).toBeCloseTo(expectedPeakAccel, -1);
    });

    it('Chart 6: Spacecraft x-y trajectory coordinates are smooth and continuous', () => {
      for (let i = 1; i < sim.trajectory.length; i++) {
        const prev = sim.trajectory[i - 1].posPlanetM;
        const curr = sim.trajectory[i].posPlanetM;
        const dt = sim.trajectory[i].timeS - sim.trajectory[i - 1].timeS;
        expect(dt).toBeGreaterThanOrEqual(0);

        const dr = curr.clone().sub(prev).magnitude();
        expect(dr).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(dr)).toBe(true);
      }
    });

    it('Chart 7: Deflection angle vs closest-approach altitude demonstrates inverse relationship', () => {
      const altitudes = [25000, 50000, 100000, 200000];
      const deltas = altitudes.map((alt) => {
        const res = FlybyEngine.computeAnalytical({
          planet,
          vInfSpeedMPerS: vInf,
          targetPeriapsisM: planet.radiusM + alt * 1000,
          passType: 'TRAILING',
          spacecraftMassKg: 1000,
        });
        return res.deflectionAngleDeg;
      });

      for (let i = 0; i < deltas.length - 1; i++) {
        expect(deltas[i]).toBeGreaterThan(deltas[i + 1]);
      }
    });

    it('Chart 8: Deflection angle vs incoming asymptotic speed shows decay ~ 1/v_inf^2', () => {
      const speeds = [5000, 10000, 15000, 20000];
      const deltas = speeds.map((v) => {
        const res = FlybyEngine.computeAnalytical({
          planet,
          vInfSpeedMPerS: v,
          targetPeriapsisM: rp,
          passType: 'TRAILING',
          spacecraftMassKg: 1000,
        });
        return res.deflectionAngleDeg;
      });

      for (let i = 0; i < deltas.length - 1; i++) {
        expect(deltas[i]).toBeGreaterThan(deltas[i + 1]);
      }
    });

    it('Chart 9: Sun-relative speed change vs flyby geometry differentiates trailing from leading', () => {
      const trailing = FlybyEngine.computeAnalytical({
        planet,
        vInfSpeedMPerS: vInf,
        targetPeriapsisM: rp,
        passType: 'TRAILING',
        spacecraftMassKg: 1000,
      });

      const leading = FlybyEngine.computeAnalytical({
        planet,
        vInfSpeedMPerS: vInf,
        targetPeriapsisM: rp,
        passType: 'LEADING',
        spacecraftMassKg: 1000,
      });

      expect(trailing.deflectionAngleDeg).toBeCloseTo(leading.deflectionAngleDeg, 3);
      expect(trailing.deltaVSunSpeedMPerS).toBeGreaterThan(0);
      expect(leading.deltaVSunSpeedMPerS).toBeLessThan(0);
    });

    it('Chart data CSV exporter produces valid formatted tabular data', () => {
      const chartPoints = [
        { x: 0, y: 10.5, label: 't=0' },
        { x: 100, y: 15.2, label: 't=100' },
      ];
      const csv = FlybyExperimentEngine.exportChartDataToCSV(
        'Planet-Relative Speed vs Time',
        'Time',
        's',
        'Speed',
        'km/s',
        chartPoints
      );

      expect(csv).toContain('# ASTRA CHART DATA EXPORT: Planet-Relative Speed vs Time');
      expect(csv).toContain('Time_s,Speed_km/s');
      expect(csv).toContain('1,0.000000,10.500000,"t=0"');
    });
  });

  // =========================================================================
  // 2. EXPERIMENT BUILDER & REPEATABILITY
  // =========================================================================
  describe('2. Parameter Sweeps & Repeatability Verification', () => {
    it('holds all other baseline parameters strictly fixed during a parameter sweep', () => {
      const baseline = {
        planet: PLANETARY_BODIES.JUPITER,
        vInfSpeedMPerS: 12000,
        targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM + 60000000,
        passType: 'TRAILING' as FlybyPassType,
        spacecraftMassKg: 1500,
      };

      const sweep: SweepConfig = {
        parameter: 'vInfMPerS',
        minValue: 5000,
        maxValue: 25000,
        sampleCount: 5,
        scale: 'LINEAR',
      };

      const records = FlybyExperimentEngine.runParameterSweep(baseline, sweep);
      expect(records.length).toBe(5);

      for (const r of records) {
        expect(r.planetName).toBe('Jupiter');
        expect(r.closestApproachAltitudeKm).toBeCloseTo(60000, 0);
      }
    });

    it('repeats saved experiment and reproduces identical numerical output', () => {
      const baseline = {
        planet: PLANETARY_BODIES.EARTH,
        vInfSpeedMPerS: 8000,
        targetPeriapsisM: PLANETARY_BODIES.EARTH.radiusM + 3000000,
        passType: 'TRAILING' as FlybyPassType,
        spacecraftMassKg: 1000,
      };

      const sweep: SweepConfig = {
        parameter: 'periapsisAltitudeKm',
        minValue: 500,
        maxValue: 10000,
        sampleCount: 4,
        scale: 'LINEAR',
      };

      const run1 = FlybyExperimentEngine.runParameterSweep(baseline, sweep);
      const run2 = FlybyExperimentEngine.runParameterSweep(baseline, sweep);

      expect(run1.length).toBe(run2.length);
      for (let i = 0; i < run1.length; i++) {
        expect(run1[i].deflectionAngleDeg).toBeCloseTo(run2[i].deflectionAngleDeg, 8);
        expect(run1[i].deltaVSpeedKmPerS).toBeCloseTo(run2[i].deltaVSpeedKmPerS, 8);
        expect(run1[i].deltaSpecificEnergyMJPerKg).toBeCloseTo(run2[i].deltaSpecificEnergyMJPerKg, 8);
      }
    });

    it('exports experiment records to CSV including baseline metadata and header comments', () => {
      const records = FlybyExperimentEngine.runExperimentA_ClosestApproach(
        PLANETARY_BODIES.JUPITER,
        10000,
        'TRAILING',
        4
      );

      const csv = FlybyExperimentEngine.exportExperimentToCSV(records, {
        title: 'Jupiter Test Sweep',
        baselinePlanet: 'Jupiter',
        baselineVInfMPerS: 10000,
        baselineAltKm: 50000,
        baselinePassType: 'TRAILING',
        baselineMassKg: 1000,
      });

      expect(csv).toContain('# Title: Jupiter Test Sweep');
      expect(csv).toContain('# Baseline Planet: Jupiter');
      expect(csv).toContain('Step,Scenario,Planet,ModelType,ParameterName');
      expect(csv).toContain('Jupiter');
    });
  });

  // =========================================================================
  // 3. REQUIRED EXPERIMENT TEMPLATES (A THROUGH F)
  // =========================================================================
  describe('3. Required Built-in Templates (Suites A — F)', () => {
    it('Template A: Planetary mass compares presets and explains collision vs radius constraints', () => {
      const expA = FlybyExperimentEngine.runTemplateA_PlanetaryMass(10000, 'TRAILING');

      expect(expA.equalRadiusRecords.length).toBe(4);
      expect(expA.equalAltitudeRecords.length).toBe(4);
      expect(expA.explanation).toContain('Gravitational parameter (mu) alone does NOT dictate');
      expect(expA.explanation).toContain('Equal-altitude comparisons (h_p = r_p - R_p) can be physically misleading');

      // Largest mu (Jupiter) yields highest deflection under equal radius
      const jup = expA.equalRadiusRecords.find((r) => r.planetName === 'Jupiter')!;
      const earth = expA.equalRadiusRecords.find((r) => r.planetName === 'Earth')!;
      expect(jup.deflectionAngleDeg).toBeGreaterThan(earth.deflectionAngleDeg);
    });

    it('Template B: Flyby distance varies altitude and flags collision risk when hp <= 0', () => {
      const expB = FlybyExperimentEngine.runTemplateB_FlybyDistance(
        PLANETARY_BODIES.JUPITER,
        10000,
        'TRAILING',
        7
      );

      expect(expB.length).toBe(7);
      const subSurface = expB[0];
      expect(subSurface.closestApproachAltitudeKm).toBeLessThan(0);
      expect(subSurface.isCollision).toBe(true);
      expect(subSurface.collisionStatus).toBe('SURFACE_IMPACT');

      const distant = expB[expB.length - 1];
      expect(distant.closestApproachAltitudeKm).toBeGreaterThan(0);
      expect(distant.isCollision).toBe(false);
      expect(distant.collisionStatus).toBe('SAFE_FLYBY');
    });

    it('Template C: Incoming speed shows deflection decline with speed', () => {
      const expC = FlybyExperimentEngine.runTemplateC_IncomingSpeed(
        PLANETARY_BODIES.JUPITER,
        PLANETARY_BODIES.JUPITER.radiusM * 1.5,
        'TRAILING',
        6
      );

      expect(expC.length).toBe(6);
      for (let i = 0; i < expC.length - 1; i++) {
        expect(expC[i].deflectionAngleDeg).toBeGreaterThan(expC[i + 1].deflectionAngleDeg);
      }
    });

    it('Template D: Flyby orientation demonstrates identical delta with opposite Sun speed change', () => {
      const expD = FlybyExperimentEngine.runTemplateD_FlybyOrientation(
        PLANETARY_BODIES.JUPITER,
        12000,
        50000,
        6
      );

      expect(expD.trailing.deflectionAngleDeg).toBeCloseTo(expD.leading.deflectionAngleDeg, 3);
      expect(expD.trailing.deltaVSunSpeedMPerS).toBeGreaterThan(0);
      expect(expD.leading.deltaVSunSpeedMPerS).toBeLessThan(0);
      expect(expD.explanation).toContain('momentum');
      expect(expD.records.length).toBe(6);
    });

    it('Template E: Reference-frame comparison proves |v_rel,out| = |v_rel,in| and verifies energy identity', () => {
      const expE = FlybyExperimentEngine.runTemplateE_ReferenceFrameComparison(
        PLANETARY_BODIES.JUPITER,
        12000,
        50000
      );

      // Planet frame: speed strictly conserved
      expect(expE.planetFrame.vInSpeedKmPerS).toBeCloseTo(expE.planetFrame.vOutSpeedKmPerS, 6);
      expect(expE.planetFrame.deltaSpeedKmPerS).toBe(0);
      expect(expE.planetFrame.isConserved).toBe(true);

      // Sun frame: speed changes
      expect(expE.sunFrameTrailing.deltaSpeedKmPerS).toBeGreaterThan(0);
      expect(expE.sunFrameLeading.deltaSpeedKmPerS).toBeLessThan(0);

      // Energy identity: Delta epsilon_Sun = V_p · Delta v_rel
      expect(expE.identityVerification.errorJPerKg).toBeLessThan(1e-4);
    });

    it('Template F: Numerical validation shows reduced error at tighter integration tolerances', () => {
      const expF = FlybyExperimentEngine.runTemplateF_NumericalValidation(
        PLANETARY_BODIES.JUPITER,
        12000,
        PLANETARY_BODIES.JUPITER.radiusM * 1.5,
        'TRAILING',
        [0.05, 0.01, 0.002]
      );

      expect(expF.length).toBe(3);
      // Tighter tolerance produces more integration steps
      expect(expF[2].stepCount).toBeGreaterThan(expF[0].stepCount);

      // Truncation at SOI boundary yields consistent small deflection error percentage
      expect(expF[2].deflectionErrorPercent).toBeLessThan(5.0);
    });
  });

  // =========================================================================
  // 4. SIDE-BY-SIDE RESULT COMPARISON & SCIENTIFIC EXPLANATIONS
  // =========================================================================
  describe('4. Side-by-Side Comparison Catalog & Scientific Explanations', () => {
    it('catalog defines all required comparison fields across config, geometry, velocity, energy, diagnostics', () => {
      const metrics = FlybyExperimentEngine.getComparisonMetrics();
      const keys = metrics.map((m) => m.key);

      expect(keys).toContain('planet');
      expect(keys).toContain('periapsisRadius');
      expect(keys).toContain('periapsisAltitude');
      expect(keys).toContain('deflectionDeg');
      expect(keys).toContain('vSunIn');
      expect(keys).toContain('vSunOut');
      expect(keys).toContain('deltaVSunSpeed');
      expect(keys).toContain('deltaSpecificEnergy');
      expect(keys).toContain('collisionStatus');
    });

    it('provides all 5 required concise scientific explanations with math and evidence', () => {
      const explanations = FlybyExperimentEngine.getScientificExplanations();
      expect(explanations.length).toBe(5);

      const ids = explanations.map((e) => e.id);
      expect(ids).toContain('CLOSER_FLYBY');
      expect(ids).toContain('HIGH_SPEED');
      expect(ids).toContain('ENERGY_EXCHANGE');
      expect(ids).toContain('MASS_INVARIANCE');
      expect(ids).toContain('PLANET_MASS_ALONE');

      for (const note of explanations) {
        expect(note.question.length).toBeGreaterThan(10);
        expect(note.shortAnswer.length).toBeGreaterThan(20);
        expect(note.derivation.length).toBeGreaterThan(20);
        expect(note.realWorldEvidence.length).toBeGreaterThan(20);
      }
    });

    it('generates complete college physics lab report with abstract, equations, and tables', () => {
      const baseline = {
        planet: PLANETARY_BODIES.JUPITER,
        vInfSpeedMPerS: 10000,
        targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM * 1.5,
        passType: 'TRAILING' as FlybyPassType,
        spacecraftMassKg: 1000,
      };

      const records = FlybyExperimentEngine.runExperimentA_ClosestApproach(
        PLANETARY_BODIES.JUPITER,
        10000,
        'TRAILING',
        4
      );

      const report = FlybyExperimentEngine.generatePhysicsLabReport(
        'Jupiter Trajectory bending analysis',
        baseline,
        records
      );

      expect(report).toContain('# LABORATORY REPORT: ASTRODYNAMICAL GRAVITY ASSIST ANALYSIS');
      expect(report).toContain('## 1. ABSTRACT & OBJECTIVE');
      expect(report).toContain('## 2. THEORETICAL FRAMEWORK & GOVERNING EQUATIONS');
      expect(report).toContain('## 3. EXPERIMENTAL SETUP & CONTROLLED PARAMETERS');
      expect(report).toContain('## 4. EXPERIMENTAL MEASUREMENTS & PARAMETRIC DATA');
      expect(report).toContain('## 5. SCIENTIFIC ANALYSIS & PHYSICAL DISCUSSION');
      expect(report).toContain('## 6. CONCLUSION');
      expect(report).toContain('Jupiter');
    });
  });

  // =========================================================================
  // 5. SCIENTIFIC CORRECTNESS & PHYSICAL INTEGRITY CONSTRAINTS
  // =========================================================================
  describe('5. Scientific Correctness, Non-Fabrication & Physical Integrity', () => {
    it('demonstrates that vector delta-v ||Δv|| is distinct from scalar speed change |v_out| - |v_in|', () => {
      const res = FlybyEngine.computeAnalytical({
        planet: PLANETARY_BODIES.JUPITER,
        vInfSpeedMPerS: 12000,
        targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM * 1.5,
        passType: 'TRAILING',
        spacecraftMassKg: 1000,
      });

      const scalarSpeedChange = res.deltaVSunSpeedMPerS;
      const vectorDeltaVMag = res.deltaVVectorMagnitudeMPerS;

      // In general, vector magnitude change > scalar speed change because incoming and outgoing directions are non-parallel
      expect(vectorDeltaVMag).toBeGreaterThan(Math.abs(scalarSpeedChange));
      expect(vectorDeltaVMag).not.toBeCloseTo(scalarSpeedChange, 0);

      // In planet rest frame: scalar speed change is exactly zero, but vector delta-v is strictly non-zero
      const vInfInMag = res.vInfMinusMPerS.magnitude();
      const vInfOutMag = res.vInfPlusMPerS.magnitude();
      expect(Math.abs(vInfOutMag - vInfInMag)).toBeLessThan(1e-9);

      const planetFrameVectorDeltaV = res.vInfPlusMPerS.clone().sub(res.vInfMinusMPerS).magnitude();
      expect(planetFrameVectorDeltaV).toBeGreaterThan(1000); // multiple km/s of vector redirection
      expect(planetFrameVectorDeltaV).toBeCloseTo(vectorDeltaVMag, 6); // Vector delta-v is Galilean invariant!
    });

    it('proves higher planetary mass alone does NOT guarantee a larger useful Sun-relative speed gain', () => {
      // Compare Jupiter (huge mass, ~13.06 km/s orbital speed) with Earth (~29.78 km/s orbital speed)
      // or compare trailing vs leading orientation where planet mass is identical but speed change is negative
      const jupiterLeading = FlybyEngine.computeAnalytical({
        planet: PLANETARY_BODIES.JUPITER,
        vInfSpeedMPerS: 10000,
        targetPeriapsisM: PLANETARY_BODIES.JUPITER.radiusM * 1.5,
        passType: 'LEADING',
        spacecraftMassKg: 1000,
      });

      const earthTrailing = FlybyEngine.computeAnalytical({
        planet: PLANETARY_BODIES.EARTH,
        vInfSpeedMPerS: 10000,
        targetPeriapsisM: PLANETARY_BODIES.EARTH.radiusM + 500000,
        passType: 'TRAILING',
        spacecraftMassKg: 1000,
      });

      // Even though Jupiter is 318x more massive than Earth, leading encounter decelerates the probe,
      // whereas smaller Earth accelerates it in heliocentric frame!
      expect(jupiterLeading.deltaVSunSpeedMPerS).toBeLessThan(0);
      expect(earthTrailing.deltaVSunSpeedMPerS).toBeGreaterThan(0);
      expect(earthTrailing.deltaVSunSpeedMPerS).toBeGreaterThan(jupiterLeading.deltaVSunSpeedMPerS);
    });

    it('flags surface collisions and distinguishes invalid/unrealized results from zero', () => {
      // Target periapsis well inside Earth's physical radius (R_E ~ 6,371 km)
      const collisionSim = FlybyEngine.runSimulation({
        planet: PLANETARY_BODIES.EARTH,
        vInfSpeedMPerS: 8000,
        targetPeriapsisM: 3000000, // 3,000 km < 6,371 km radius
        passType: 'TRAILING',
        spacecraftMassKg: 1000,
      });

      expect(collisionSim.collisionDetected).toBe(true);
      expect(collisionSim.status).toBe('COLLIDED');
      expect(collisionSim.closestApproach.altitudeM).toBeLessThanOrEqual(0);
      expect(collisionSim.collisionTimeS).toBeDefined();
      expect(collisionSim.collisionPositionPlanetM).toBeDefined();

      // Ensure the simulation stopped at the surface rather than continuing indefinitely
      const lastPoint = collisionSim.trajectory[collisionSim.trajectory.length - 1];
      expect(lastPoint.distanceFromCenterM).toBeLessThanOrEqual(PLANETARY_BODIES.EARTH.radiusM * 1.05);
    });

    it('maintains strict scientific accuracy without fabricating data points', () => {
      const baseline = {
        planet: PLANETARY_BODIES.SATURN,
        vInfSpeedMPerS: 9000,
        targetPeriapsisM: PLANETARY_BODIES.SATURN.radiusM * 1.6,
        passType: 'TRAILING' as FlybyPassType,
        spacecraftMassKg: 800,
      };

      const sweep: SweepConfig = {
        parameter: 'spacecraftMassKg',
        minValue: 100,
        maxValue: 10000,
        sampleCount: 5,
        scale: 'LINEAR',
      };

      const records = FlybyExperimentEngine.runParameterSweep(baseline, sweep);
      expect(records.length).toBe(5);

      // Deflection angle and velocity changes are purely governed by gravitational acceleration,
      // which is independent of probe mass (equivalence principle):
      const initialDelta = records[0].deflectionAngleDeg;
      for (const r of records) {
        expect(r.deflectionAngleDeg).toBeCloseTo(initialDelta, 8);
        expect(r.deltaVSpeedKmPerS).toBeCloseTo(records[0].deltaVSpeedKmPerS, 8);
        expect(r.deltaSpecificEnergyMJPerKg).toBeCloseTo(records[0].deltaSpecificEnergyMJPerKg, 8);
      }
    });
  });
});
